<?php
declare(strict_types=1);

namespace Femini\Sync;

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
    public function __construct(private readonly array $user)
    {
    }

    /**
     * @param \stdClass $req the request decoded WITH objects (see Request::jsonObject), so stored rows keep their exact shape
     * @return array{rev:int,prev:int}
     */
    public function push(\stdClass $req): array
    {
        $since = max(0, (int)($req->since ?? 0));
        return Database::transaction(function () use ($req, $since): array {
            $prev = (int)Database::value('SELECT rev FROM sync_state WHERE id = 1 FOR UPDATE');
            $rev = $prev + 1;
            $lock = (string)json_decode((string)Database::value("SELECT v FROM meta WHERE k = 'lock'") ?: '""', true);
            $rules = new Rules($this->user, $lock, date('Y-m-d'));
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
        foreach (Database::all('SELECT k, v, rev FROM meta WHERE rev > ?', [$since]) as $r) {
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
                 mb_substr((string)($m['by'] ?? ''), 0, 80), mb_substr((string)($m['note'] ?? ''), 0, 500), $ctx->rev]
            );
            $ctx->changed++;
        }
    }

    private function applyCollection(string $name, \stdClass $ops, Rules $rules, PushContext $ctx): void
    {
        $isTable = isset(Collections::TABLES[$name]);
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
                $rules->checkRows($name, is_array($old) ? $old : []);
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
            $rules->checkRows($name, is_array($row) ? $row : []);
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
            Database::run(
                'INSERT INTO meta (k, v, rev, updated_by, updated_at) VALUES (?,?,?,?,UTC_TIMESTAMP())
                 ON DUPLICATE KEY UPDATE v = VALUES(v), rev = VALUES(rev), updated_by = VALUES(updated_by), updated_at = VALUES(updated_at)',
                [$key, $json, $ctx->rev, $this->user['id']]
            );
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
            $names = array_merge([$t['key']], array_keys($cols), ['payload', 'gone', 'ord', 'rev']);
            $vals = array_merge([$key], array_values($cols), [$payload, 0, $ord, $rev]);
            $place = implode(',', array_fill(0, count($names), '?'));
            $upd = implode(',', array_map(static fn($c) => "$c = VALUES($c)", array_slice($names, 1)));
            Database::run("INSERT INTO {$t['table']} (" . implode(',', $names) . ") VALUES ($place) ON DUPLICATE KEY UPDATE $upd", $vals);
            return;
        }
        Database::run(
            'INSERT INTO coll_rows (coll, k, payload, gone, ord, rev) VALUES (?,?,?,0,?,?)
             ON DUPLICATE KEY UPDATE payload = VALUES(payload), gone = 0, rev = VALUES(rev)',
            [$name, $key, $payload, $ord, $rev]
        );
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
