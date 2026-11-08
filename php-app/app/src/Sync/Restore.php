<?php
declare(strict_types=1);

namespace Femini\Sync;

use Femini\Config;
use Femini\Database;
use Femini\Files\FileStore;
use Femini\Http\HttpError;

/**
 * Restoring the whole stock data from a full backup (Settings › full backup, "femini-stock" v3, with its files).
 *
 *  1. Safety copy first: every data table as it is now goes to storage/restore/before-<time>.json.gz. Without it nothing runs.
 *     That copy can be put back with undo(), so a restore can itself be undone.
 *  2. In ONE transaction: the ledger, documents, orders, pickups, other collections and settings are emptied and the backup is
 *     loaded through the normal sync path (the same rules as every save, keeping the backup's authors). Files are put back
 *     with their kind and owner: a file whose content is already on the server reuses it, the others are written from the backup.
 *  3. A new "epoch" is stamped: every page that was open before the restore is refused on its next save and reloads,
 *     so nobody can save on top of the restored data from a screen that still shows the old one.
 *
 * Users, passwords, roles and the activity log are never touched (the log gets a line saying a restore happened).
 */
final class Restore
{
    private const DATA_TABLES = ['moves', 'docs', 'pickups', 'orders', 'coll_rows', 'meta', 'files'];

    /** What a backup holds, for the screen to show before anything is done. */
    public static function summary(\stdClass $b): array
    {
        self::check($b);
        $S = $b->state;
        $n = static fn(mixed $v): int => is_array($v) ? count($v) : 0;
        return [
            'at' => isset($b->at) ? (int)$b->at : null, 'source' => (string)($b->source ?? ''), 'rev' => isset($b->rev) ? (int)$b->rev : null,
            'moves' => $n($S->moves ?? null), 'orders' => $n($S->orders ?? null), 'docs' => $n($S->docs ?? null), 'pickups' => $n($S->pickups ?? null),
            'holds' => $n($S->holds ?? null), 'files' => $n($b->files ?? null) ?: count((array)($b->photos ?? [])),
            'now' => [
                'moves' => (int)Database::value('SELECT COUNT(*) FROM moves'), 'orders' => (int)Database::value('SELECT COUNT(*) FROM orders WHERE gone = 0'),
                'docs' => (int)Database::value('SELECT COUNT(*) FROM docs WHERE gone = 0'), 'files' => (int)Database::value('SELECT COUNT(*) FROM files'),
                'rev' => (int)Database::value('SELECT rev FROM sync_state WHERE id = 1'),
            ],
        ];
    }

    /** @return array{summary:array,safety:string,rev:int,files:int} */
    public static function run(\stdClass $b, array $user, string $label): array
    {
        $summary = self::summary($b);
        $safety = self::safetyCopy('before');
        $S = $b->state;
        $list = static fn(mixed $v): array => is_array($v) ? $v : [];

        $files = Database::transaction(function () use ($b, $S, $list, $user, $label): int {
            Database::value('SELECT rev FROM sync_state WHERE id = 1 FOR UPDATE');   // nobody saves while this runs
            $known = [];   // content already on the server: sha256 => [path, thumb]
            foreach (Database::all('SELECT sha256, path, thumb_path FROM files') as $r) {
                $known[$r['sha256']] ??= [$r['path'], $r['thumb_path']];
            }
            foreach (['moves', 'docs', 'pickups', 'orders', 'coll_rows', 'meta', 'files'] as $t) {
                Database::run("DELETE FROM `$t`");   // DELETE, not TRUNCATE: TRUNCATE would end the transaction
            }

            $req = new \stdClass();
            $req->since = 0;
            $req->moves = $list($S->moves ?? []);
            $coll = [];
            foreach (['docs', 'orders', 'pickups', 'closes', 'shops', 'emps', 'archPk', 'archDocs', 'oldOrd', 'holds'] as $c) {
                $coll[$c] = (object)['up' => $list($S->$c ?? [])];
            }
            $coll['sup_items'] = (object)['up' => $list($S->sup->items ?? [])];
            $coll['sup_log'] = (object)['up' => $list($S->sup->log ?? [])];
            $req->coll = (object)$coll;
            $req->meta = new \stdClass();
            $metaSrc = ['mid' => $S->mid ?? null, 'did' => $S->did ?? null, 'seq' => $S->seq ?? null, 'sup_eid' => $S->sup->eid ?? null,
                'st' => $S->st ?? null, 'costs' => $S->costs ?? null, 'alias' => $S->alias ?? null, 'img' => $S->img ?? null,
                'cat' => $S->cat ?? null, 'lock' => $S->lock ?? null, 'bk' => $S->bk ?? null];
            foreach ($metaSrc as $k => $v) {
                if ($v !== null) {
                    $req->meta->$k = $v;
                }
            }
            (new SyncService($user, true))->push($req);

            $n = self::putFiles($b, $known, (string)$user['id']);

            // a new epoch: every page opened before now must reload before it can save again
            $rev = (int)Database::value('SELECT rev FROM sync_state WHERE id = 1') + 1;
            $epoch = json_encode(['id' => bin2hex(random_bytes(8)), 'at' => gmdate('c'), 'by' => $user['name'], 'from' => $label], JSON_UNESCAPED_UNICODE);
            Database::run('INSERT INTO meta (k, v, rev, updated_by, updated_at) VALUES (?,?,?,?,UTC_TIMESTAMP())', ['epoch', $epoch, $rev, $user['id']]);
            Database::run('UPDATE sync_state SET rev = ? WHERE id = 1', [$rev]);
            Database::run('INSERT INTO audit (t, by_name, msg, rev) VALUES (?,?,?,?)',
                [(int)(microtime(true) * 1000), mb_substr($user['name'], 0, 80), mb_substr("اترجعت البيانات من نسخة احتياطية: $label", 0, 500), $rev]);
            return $n;
        });

        return ['summary' => $summary, 'safety' => $safety, 'rev' => (int)Database::value('SELECT rev FROM sync_state WHERE id = 1'), 'files' => $files];
    }

    /** The safety copies on the server, newest first. @return array<int,array{name:string,size:int,at:string}> */
    public static function points(): array
    {
        $out = [];
        foreach (glob(self::dir() . '/*.json.gz') ?: [] as $f) {
            $out[] = ['name' => basename($f), 'size' => (int)filesize($f), 'at' => gmdate('c', (int)filemtime($f))];
        }
        usort($out, static fn($a, $b) => strcmp($b['name'], $a['name']));
        return $out;
    }

    /** Puts a safety copy back exactly (it is itself kept first, so this too can be undone). */
    public static function undo(string $name, array $user): array
    {
        if (!preg_match('/^[\w.-]+\.json\.gz$/', $name) || !is_file(self::dir() . '/' . $name)) {
            throw new HttpError(404, 'not_found', 'النسخة دي مش موجودة على السيرفر.');
        }
        $raw = gzdecode((string)file_get_contents(self::dir() . '/' . $name));
        $dump = $raw === false ? null : json_decode($raw, true);
        if (!is_array($dump) || ($dump['app'] ?? '') !== 'femini-restore-point' || !is_array($dump['tables'] ?? null)) {
            throw new HttpError(422, 'bad_point', 'ملف النسخة ده تالف.');
        }
        $safety = self::safetyCopy('before-undo');
        Database::transaction(function () use ($dump, $user, $name): void {
            $rev = (int)Database::value('SELECT rev FROM sync_state WHERE id = 1 FOR UPDATE') + 1;
            foreach (self::DATA_TABLES as $t) {
                Database::run("DELETE FROM `$t`");
                foreach ($dump['tables'][$t] ?? [] as $row) {
                    if (array_key_exists('rev', $row)) {
                        $row['rev'] = $rev;   // newer than anything a page has seen
                    }
                    $cols = array_keys($row);
                    Database::run('INSERT INTO `' . $t . '` (`' . implode('`,`', $cols) . '`) VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ')', array_values($row));
                }
            }
            $epoch = json_encode(['id' => bin2hex(random_bytes(8)), 'at' => gmdate('c'), 'by' => $user['name'], 'from' => $name], JSON_UNESCAPED_UNICODE);
            Database::run('DELETE FROM meta WHERE k = ?', ['epoch']);
            Database::run('INSERT INTO meta (k, v, rev, updated_by, updated_at) VALUES (?,?,?,?,UTC_TIMESTAMP())', ['epoch', $epoch, $rev, $user['id']]);
            Database::run('UPDATE sync_state SET rev = ? WHERE id = 1', [$rev]);
            Database::run('INSERT INTO audit (t, by_name, msg, rev) VALUES (?,?,?,?)',
                [(int)(microtime(true) * 1000), mb_substr($user['name'], 0, 80), mb_substr("اترجعت البيانات لنسخة السيرفر: $name", 0, 500), $rev]);
        });
        return ['safety' => $safety, 'rev' => (int)Database::value('SELECT rev FROM sync_state WHERE id = 1')];
    }

    // ---------------------------------------------------------------------------------------------------------------

    private static function check(\stdClass $b): void
    {
        if (($b->app ?? '') !== 'femini-stock' || !isset($b->state) || !is_object($b->state) || !is_array($b->state->moves ?? null)) {
            throw new HttpError(422, 'not_backup', 'الملف ده مش نسخة احتياطية من Fémini Stock.');
        }
        if (!is_array($b->state->orders ?? null) || !is_array($b->state->docs ?? null)) {
            throw new HttpError(422, 'not_backup', 'النسخة ناقصة (مفيش أوردرات أو مستندات).');
        }
    }

    private static function dir(): string
    {
        $d = rtrim((string)Config::get('app.storage_path'), '/') . '/restore';
        if (!is_dir($d) && !mkdir($d, 0750, true) && !is_dir($d)) {
            throw new HttpError(500, 'storage_error', 'مش قادر أعمل فولدر النسخ على السيرفر.');
        }
        return $d;
    }

    /** Every data table as it is now, gzipped. Refuses to continue if it cannot be written completely. */
    private static function safetyCopy(string $what): string
    {
        $tables = [];
        foreach (self::DATA_TABLES as $t) {
            $tables[$t] = Database::all("SELECT * FROM `$t`");
        }
        $json = json_encode(['app' => 'femini-restore-point', 'at' => gmdate('c'), 'rev' => (int)Database::value('SELECT rev FROM sync_state WHERE id = 1'), 'tables' => $tables],
            JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        $gz = $json === false ? false : gzencode($json, 6);
        $name = $what . '-' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(3)) . '.json.gz';
        $path = self::dir() . '/' . $name;
        if ($gz === false || file_put_contents($path, $gz) !== strlen($gz)) {
            @unlink($path);
            throw new HttpError(500, 'safety_failed', 'مقدرتش أحفظ نسخة أمان قبل الاسترجاع، فما عملتش حاجة.');
        }
        return $name;
    }

    /** The backup's files back with their kind and owner. @param array<string,array{0:string,1:?string}> $known */
    private static function putFiles(\stdClass $b, array $known, string $userId): int
    {
        $photos = (array)($b->photos ?? []);
        $items = [];
        foreach ((array)($b->files ?? []) as $f) {        // this app's backups: a list with kind/owner + the content's key
            $items[] = ['kind' => (string)($f->kind ?? ''), 'ot' => (string)($f->ownerType ?? ''), 'oid' => (string)($f->ownerId ?? ''),
                'name' => (string)($f->name ?? 'file'), 'data' => $photos[(string)($f->data ?? '')] ?? null];
        }
        if (!$items) {                                    // the original app's backups: photos only, keyed by owner
            foreach ($photos as $key => $data) {
                $cx = str_starts_with((string)$key, 'cx_');
                $items[] = ['kind' => $cx ? 'cancel' : 'doc_photo', 'ot' => $cx ? 'order' : 'doc', 'oid' => (string)preg_replace('/^cx_/', '', (string)$key), 'name' => "$key.jpg", 'data' => $data];
            }
        }
        $n = 0;
        foreach ($items as $it) {
            if (!is_string($it['data']) || !preg_match('#^data:([^;,]*)(;base64)?,(.*)$#s', $it['data'], $m) || $it['oid'] === '') {
                continue;
            }
            $bytes = $m[2] !== '' ? base64_decode($m[3], true) : rawurldecode($m[3]);
            if ($bytes === false || $bytes === '') {
                continue;
            }
            $sha = hash('sha256', $bytes);
            if (isset($known[$sha]) && is_file(FileStore::absolute($known[$sha][0]))) {   // already on disk: point to it
                Database::run(
                    'INSERT INTO files (kind, owner_type, owner_id, orig_name, mime, size_bytes, sha256, path, thumb_path, uploaded_by, uploaded_at)
                     VALUES (?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP())',
                    [$it['kind'], $it['ot'], $it['oid'], mb_substr($it['name'], 0, 200), $m[1] ?: 'application/octet-stream', strlen($bytes), $sha, $known[$sha][0], $known[$sha][1], $userId]
                );
            } else {
                $tmp = tempnam(sys_get_temp_dir(), 'rs');
                file_put_contents($tmp, $bytes);
                try {
                    FileStore::saveLocal($tmp, $it['name'], $it['kind'], $it['ot'], $it['oid'], $userId);
                } finally {
                    @unlink($tmp);
                }
            }
            $n++;
        }
        return $n;
    }
}
