<?php
declare(strict_types=1);

namespace Femini\Sync;

use Femini\Auth\Permissions;
use Femini\Database;
use Femini\Http\HttpError;

/**
 * Applies a client's change set atomically and serves "what changed since revision N".
 *
 * Concurrency model (optimistic):
 *  - Every committed change set gets the next global revision; touched rows are stamped with it.
 *  - A push carries `since`, the revision its author last saw. If any row it writes was changed by
 *    somebody else after `since`, the whole push is rejected with 409 and nothing is applied.
 *  - Pushes are serialized by locking the single `sync_state` row.
 */
final class SyncService
{
    /** @param bool $trustActors CLI import only: keep the authors recorded in a backup instead of the signed-in user */
    public function __construct(private readonly array $user, private readonly bool $trustActors = false)
    {
    }

    /**
     * @param \stdClass $req the request decoded WITH objects (see Request::jsonObject), so stored rows keep their exact shape
     * @return array{rev:int,prev:int}
     */
    public function push(\stdClass $req): array
    {
        if (!Permissions::canWrite($this->user)) {
            throw new HttpError(403, 'read_only', 'حسابك للقراءة فقط.');
        }
        $since = max(0, (int)($req->since ?? 0));
        return Database::transaction(function () use ($req, $since): array {
            $prev = (int)Database::value('SELECT rev FROM sync_state WHERE id = 1 FOR UPDATE');
            $rev = $prev + 1;
            $lock = (string)json_decode((string)Database::value("SELECT v FROM meta WHERE k = 'lock'") ?: '""', true);
            $rules = new Rules($this->user, $lock, date('Y-m-d'), $this->trustActors);
            $ctx = new PushContext($rev, $since);

            $this->applyMoves((array)($req->moves ?? []), $rules, $ctx);
            foreach ((array)($req->coll ?? []) as $name => $ops) {
                if (!is_string($name) || !Collections::isCollection($name)) {
                    throw new HttpError(422, 'bad_collection', 'Unknown collection.');
                }
                $this->applyCollection($name, (object)$ops, $rules, $ctx);
            }
            $this->applyMeta((array)($req->meta ?? []), $rules, $ctx);
            $this->applyAudit((array)($req->audit ?? []), $ctx);
            if (!$this->trustActors) {
                $this->checkMovesBelongToDocs($ctx);
            }

            if ($ctx->conflicts) {
                throw new HttpError(409, 'stale', 'حد تاني عدّل نفس البيانات. اتحدّث البيانات.', ['conflicts' => $ctx->conflicts]);
            }
            if ($ctx->changed === 0) {
                return ['rev' => $prev, 'prev' => $prev];
            }
            Database::run('UPDATE sync_state SET rev = ? WHERE id = 1', [$rev]);
            return ['rev' => $rev, 'prev' => $prev];
        });
    }

    /** Everything that changed after revision $since (or the whole state when $since is 0). */
    public function pull(int $since): array
    {
        $rev = (int)Database::value('SELECT rev FROM sync_state WHERE id = 1');
        $out = ['rev' => $rev, 'moves' => [], 'coll' => [], 'meta' => [], 'audit' => []];

        foreach (Database::all('SELECT * FROM moves WHERE rev > ? ORDER BY id', [$since]) as $r) {
            $out['moves'][] = [
                'id' => (int)$r['id'], 't' => (int)$r['t'], 'date' => $r['on_date'], 'sku' => $r['sku'], 'q' => (int)$r['q'],
                'from' => $r['from_loc'], 'to' => $r['to_loc'], 'type' => $r['type'], 'doc' => $r['doc'], 'by' => $r['by_name'], 'note' => $r['note'],
            ];
        }
        foreach (Collections::TABLES as $name => $def) {
            $out['coll'][$name] = $this->pullTable($def['table'], $since);
        }
        foreach (array_keys(Collections::ROWS) as $name) {
            $rows = [];
            foreach (Database::all('SELECT k, payload, gone, rev FROM coll_rows WHERE coll = ? AND rev > ? ORDER BY ord', [$name, $since]) as $r) {
                $rows[] = ['k' => $r['k'], 'row' => json_decode($r['payload']), 'gone' => (bool)$r['gone'], 'rev' => (int)$r['rev']];
            }
            $out['coll'][$name] = $rows;
        }
        // Unit costs and prices are only for roles that may see money (or edit the settings): the browser hiding them is not enough.
        $seeMoney = Permissions::canAny($this->user, ['money', 'settings']);
        foreach (Database::all('SELECT k, v, rev FROM meta WHERE rev > ?', [$since]) as $r) {
            if ($r['k'] === 'costs' && !$seeMoney) {
                continue;
            }
            $out['meta'][$r['k']] = ['v' => json_decode($r['v']), 'rev' => (int)$r['rev']];
        }
        foreach (Database::all('SELECT t, by_name, msg FROM audit WHERE rev > ? ORDER BY id', [$since]) as $r) {
            $out['audit'][] = ['t' => (int)$r['t'], 'by' => $r['by_name'], 'm' => $r['msg']];
        }
        return $out;
    }

    // ------------------------------------------------------------------ pull helpers

    private function pullTable(string $table, int $since): array
    {
        $rows = [];
        foreach (Database::all("SELECT payload, gone, rev, " . ($table === 'orders' ? 'ref' : 'id') . " AS k FROM $table WHERE rev > ? ORDER BY ord", [$since]) as $r) {
            $rows[] = ['k' => $r['k'], 'row' => json_decode($r['payload']), 'gone' => (bool)$r['gone'], 'rev' => (int)$r['rev']];
        }
        return $rows;
    }

    // ------------------------------------------------------------------ push helpers

    private function applyMoves(array $moves, Rules $rules, PushContext $ctx): void
    {
        foreach ($moves as $obj) {
            $m = self::toArray($obj);
            if ($m === null) {
                throw new HttpError(422, 'bad_move', 'Malformed move.');
            }
            $rules->checkMove($m);
            $dup = Database::one('SELECT sku, q, from_loc, to_loc, doc FROM moves WHERE id = ?', [$m['id']]);
            if ($dup !== null) {
                // Re-sending the very same move (a retried request) is harmless; a different move with that id is a clash.
                $same = $dup['sku'] === $m['sku'] && (int)$dup['q'] === $m['q'] && $dup['from_loc'] === $m['from']
                    && $dup['to_loc'] === $m['to'] && $dup['doc'] === $m['doc'];
                if (!$same) {
                    $ctx->conflicts[] = ['coll' => 'moves', 'k' => (string)$m['id']];
                }
                continue;
            }
            Database::run(
                'INSERT INTO moves (id, t, on_date, type, doc, sku, q, from_loc, to_loc, by_name, note, rev) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
                [$m['id'], (int)($m['t'] ?? 0), $m['date'], $m['type'], $m['doc'], $m['sku'], $m['q'], $m['from'], $m['to'],
                 // the actor is the signed-in user (the opening balance is written by 'النظام' and kept as is)
                 $this->trustActors || $m['type'] === 'OPN' ? mb_substr((string)($m['by'] ?? ''), 0, 80) : mb_substr($this->user['name'], 0, 80),
                 mb_substr((string)($m['note'] ?? ''), 0, 500), $ctx->rev]
            );
            $ctx->changed++;
            if ($m['type'] !== 'OPN') {
                $ctx->newMoves[] = ['doc' => $m['doc'], 'type' => $m['type'], 'date' => $m['date']];
            }
        }
    }

    /**
     * Stock moves are never free-floating: every new move must belong to a document that this SAME push confirms
     * (same type, same date, and exactly the number of moves the document declares), or, for a cancellation, to an
     * order this push cancels with that number. So nobody can post stock movements without a signed document behind them.
     */
    private function checkMovesBelongToDocs(PushContext $ctx): void
    {
        $groups = [];
        foreach ($ctx->newMoves as $m) {
            $groups[$m['doc']][$m['type']][] = $m['date'];
        }
        foreach ($groups as $doc => $types) {
            $fail = static fn(string $why) => new HttpError(409, 'orphan_moves', "الحركات لازم تكون تابعة لمستند مؤكّد ($doc): $why", ['doc' => $doc]);
            if (count($types) !== 1) {
                throw $fail('رقم المستند مستخدم لنوعين');
            }
            $type = (string)array_key_first($types);
            $dates = $types[$type];
            if ($type === 'CXL') {
                foreach ($ctx->orders as $o) {
                    if (($o['st'] ?? '') === 'cx' && ($o['cx']['doc'] ?? null) === $doc) {
                        continue 2;
                    }
                }
                throw $fail('مفيش أوردر ملغي بالرقم ده');
            }
            // a reversal files its counter-moves under "<no> (عكس)" and flips the document to "reversed"
            $isRev = str_ends_with($doc, ' (عكس)');
            $no = $isRev ? substr($doc, 0, -strlen(' (عكس)')) : $doc;
            $row = Database::one('SELECT type, status, rev, on_date, payload FROM docs WHERE doc_no = ? AND gone = 0', [$no]);
            if ($row === null || $row['type'] !== $type || $row['status'] !== ($isRev ? 'reversed' : 'done') || (int)$row['rev'] !== $ctx->rev) {
                throw $fail('مفيش مستند مؤكّد بالرقم ده في نفس الحفظ');
            }
            foreach ($dates as $d) {
                if (!$isRev && $d !== $row['on_date']) {
                    throw $fail('تاريخ الحركة مش تاريخ المستند');
                }
            }
            $declared = json_decode($row['payload'], true)['nMoves'] ?? null;
            $total = (int)Database::value('SELECT COUNT(*) FROM moves WHERE doc = ?', [$doc]);
            if (is_int($declared) && ($isRev ? $total > $declared : $declared !== $total)) {
                throw $fail("عدد الحركات ($total) مش زي اللي المستند معلنه ($declared)");
            }
            if ($isRev) {
                $this->checkReversalMirrorsOriginal($no, $doc, $fail);
            }
        }
    }

    /**
     * A reversal ("<no> (عكس)") may only put back what the document moved: every counter-move must go the opposite way of a
     * move of the original document, and per sku and direction it may not exceed the original quantity. (The app can send
     * less, e.g. it skips orders that were already returned.) Without this, a reversal could be used to post any stock change.
     * @param callable(string):\Throwable $fail
     */
    private function checkReversalMirrorsOriginal(string $no, string $revDoc, callable $fail): void
    {
        $sql = 'SELECT sku, from_loc, to_loc, SUM(q) AS q FROM moves WHERE doc = ? GROUP BY sku, from_loc, to_loc';
        $orig = [];
        foreach (Database::all($sql, [$no]) as $r) {
            $orig[$r['sku'] . '|' . $r['from_loc'] . '|' . $r['to_loc']] = (int)$r['q'];
        }
        foreach (Database::all($sql, [$revDoc]) as $r) {
            $q = (int)$r['q'];
            $mirror = $r['sku'] . '|' . $r['to_loc'] . '|' . $r['from_loc'];
            if ($q <= 0 || !isset($orig[$mirror]) || $q > $orig[$mirror]) {
                throw $fail('حركة العكس لازم تكون عكس حركة من المستند الأصلي ومش أكتر منها');
            }
        }
    }

    private function applyCollection(string $name, \stdClass $ops, Rules $rules, PushContext $ctx): void
    {
        $nextOrd = $this->maxOrd($name) + 1;

        foreach ((array)($ops->up ?? []) as $obj) {
            $row = self::toArray($obj) ?? $obj;      // arrays for the rules and the key; the object is what gets stored
            $key = Collections::keyOf($name, $row);
            if ($key === null) {
                throw new HttpError(422, 'bad_row', "Row in $name has no valid key.");
            }
            $payload = Collections::encode($obj);
            if (strlen($payload) > Collections::MAX_ROW_BYTES) {
                throw new HttpError(413, 'row_too_big', "Row $key is too large.");
            }
            $existing = $this->fetchRow($name, $key);
            if ($existing !== null && (int)$existing['rev'] > $ctx->since) {
                if ($existing['payload'] !== $payload || (int)$existing['gone'] === 1) {
                    $ctx->conflicts[] = ['coll' => $name, 'k' => $key];
                }
                continue;
            }
            if ($existing !== null && $existing['payload'] === $payload && (int)$existing['gone'] === 0) {
                continue; // nothing changed
            }
            $decodedOld = $existing === null ? null : json_decode($existing['payload'], true);   // arrays: only used by the rules
            $this->checkRow($name, $row, $decodedOld, $rules);
            if ($name === 'orders') {
                $ctx->orders[] = json_decode($payload, true);
            }
            $this->writeRow($name, $key, $row, $payload, $existing === null ? $nextOrd++ : (int)$existing['ord'], $ctx->rev, $existing !== null);
            $ctx->changed++;
        }

        foreach ((array)($ops->gone ?? []) as $key) {
            if (!is_string($key)) {
                continue;
            }
            $existing = $this->fetchRow($name, $key);
            if ($existing === null || (int)$existing['gone'] === 1) {
                continue;
            }
            if ((int)$existing['rev'] > $ctx->since) {
                $ctx->conflicts[] = ['coll' => $name, 'k' => $key];
                continue;
            }
            $old = json_decode($existing['payload'], true);
            if ($name === 'docs') {
                $rules->checkDocArchive($old);
            } elseif ($name === 'orders') {
                $rules->checkOrder();
            } elseif ($name === 'pickups') {
                $rules->checkPickup();
            } else {
                $rules->checkRows($name, is_array($old) ? $old : [], $old);
            }
            $this->markGone($name, $key, $ctx->rev);
            $ctx->changed++;
        }
    }

    private function checkRow(string $name, mixed $row, mixed $old, Rules $rules): void
    {
        if ($name === 'docs') {
            $rules->checkDoc($row, is_array($old) ? $old : null);
        } elseif ($name === 'orders') {
            $rules->checkOrder();
        } elseif ($name === 'pickups') {
            $rules->checkPickup();
        } else {
            $rules->checkRows($name, is_array($row) ? $row : [], is_array($old) ? $old : null);
        }
    }

    private function applyMeta(array $meta, Rules $rules, PushContext $ctx): void
    {
        foreach ($meta as $key => $obj) {
            if (!is_string($key) || !array_key_exists($key, Collections::META)) {
                throw new HttpError(422, 'bad_meta', "Unknown setting: $key");
            }
            $json = Collections::encode($obj);
            $value = json_decode($json, true);
            if (strlen($json) > Collections::MAX_ROW_BYTES * 4) {
                throw new HttpError(413, 'row_too_big', "Value $key is too large.");
            }
            $existing = Database::one('SELECT v, rev FROM meta WHERE k = ? FOR UPDATE', [$key]);
            if ($existing !== null && (int)$existing['rev'] > $ctx->since) {
                if ($existing['v'] !== $json) {
                    $ctx->conflicts[] = ['coll' => 'meta', 'k' => $key];
                }
                continue;
            }
            if ($existing !== null && $existing['v'] === $json) {
                continue;
            }
            $rules->checkMeta($key, $value, $existing === null ? null : json_decode($existing['v'], true));
            if ($existing === null) {
                Database::run('INSERT INTO meta (k, v, rev, updated_by, updated_at) VALUES (?,?,?,?,UTC_TIMESTAMP())', [$key, $json, $ctx->rev, $this->user['id']]);
            } else {
                Database::run('UPDATE meta SET v = ?, rev = ?, updated_by = ?, updated_at = UTC_TIMESTAMP() WHERE k = ?', [$json, $ctx->rev, $this->user['id'], $key]);
            }
            $ctx->changed++;
        }
    }

    private function applyAudit(array $entries, PushContext $ctx): void
    {
        foreach ($entries as $obj) {
            $e = self::toArray($obj);
            if ($e === null || !is_string($e['m'] ?? null)) {
                continue;
            }
            // The server writes the actor itself: the log cannot be forged from the browser.
            Database::run(
                'INSERT INTO audit (t, by_name, msg, rev) VALUES (?,?,?,?)',
                [(int)($e['t'] ?? 0), mb_substr($this->user['name'], 0, 80), mb_substr($e['m'], 0, 500), $ctx->rev]
            );
            $ctx->changed++;
        }
    }

    // ------------------------------------------------------------------ row storage

    /** @return array<string,mixed>|null */
    private function fetchRow(string $name, string $key): ?array
    {
        if (isset(Collections::TABLES[$name])) {
            $t = Collections::TABLES[$name];
            return Database::one("SELECT payload, gone, ord, rev FROM {$t['table']} WHERE {$t['key']} = ? FOR UPDATE", [$key]);
        }
        return Database::one('SELECT payload, gone, ord, rev FROM coll_rows WHERE coll = ? AND k = ? FOR UPDATE', [$name, $key]);
    }

    private function writeRow(string $name, string $key, mixed $row, string $payload, int $ord, int $rev, bool $exists): void
    {
        if (isset(Collections::TABLES[$name])) {
            $t = Collections::TABLES[$name];
            $cols = [];
            foreach ($t['cols'] as $col => $field) {
                $v = is_array($row) ? ($row[$field] ?? null) : null;
                $cols[$col] = is_scalar($v) ? (string)$v : null;
                if ($col === 'on_date' && $cols[$col] !== null && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $cols[$col])) {
                    $cols[$col] = null;
                }
            }
            if ($exists) {
                $set = implode(', ', array_map(static fn($c) => "$c = ?", array_merge(array_keys($cols), ['payload', 'gone', 'rev'])));
                Database::run("UPDATE {$t['table']} SET $set WHERE {$t['key']} = ?", array_merge(array_values($cols), [$payload, 0, $rev, $key]));
                return;
            }
            $names = array_merge([$t['key']], array_keys($cols), ['payload', 'gone', 'ord', 'rev']);
            Database::run(
                "INSERT INTO {$t['table']} (" . implode(',', $names) . ') VALUES (' . implode(',', array_fill(0, count($names), '?')) . ')',
                array_merge([$key], array_values($cols), [$payload, 0, $ord, $rev])
            );
            return;
        }
        if ($exists) {
            Database::run('UPDATE coll_rows SET payload = ?, gone = 0, rev = ? WHERE coll = ? AND k = ?', [$payload, $rev, $name, $key]);
            return;
        }
        Database::run('INSERT INTO coll_rows (coll, k, payload, gone, ord, rev) VALUES (?,?,?,0,?,?)', [$name, $key, $payload, $ord, $rev]);
    }

    private function markGone(string $name, string $key, int $rev): void
    {
        if (isset(Collections::TABLES[$name])) {
            $t = Collections::TABLES[$name];
            Database::run("UPDATE {$t['table']} SET gone = 1, rev = ? WHERE {$t['key']} = ?", [$rev, $key]);
            return;
        }
        Database::run('UPDATE coll_rows SET gone = 1, rev = ? WHERE coll = ? AND k = ?', [$rev, $name, $key]);
    }

    private function maxOrd(string $name): int
    {
        if (isset(Collections::TABLES[$name])) {
            return (int)Database::value('SELECT COALESCE(MAX(ord),0) FROM ' . Collections::TABLES[$name]['table']);
        }
        return (int)Database::value('SELECT COALESCE(MAX(ord),0) FROM coll_rows WHERE coll = ?', [$name]);
    }

    /** @return array<string,mixed>|null */
    private static function toArray(mixed $v): ?array
    {
        if (is_array($v)) {
            return $v;
        }
        return is_object($v) ? json_decode(json_encode($v), true) : null;
    }
}
