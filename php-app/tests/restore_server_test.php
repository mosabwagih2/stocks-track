<?php
declare(strict_types=1);

/**
 * Restore test on the real server, against a THROW-AWAY database (its name must end with "_femtest").
 *
 *   FEMINI_CONFIG=/path/to/live/config.php php tests/restore_server_test.php
 *
 * Phase 1 (live database, read only): builds a full backup exactly like Settings › full backup (state + every file's bytes).
 * Phase 2 (test database only): loads that backup, makes real changes, restores, undoes, and checks after every step that
 * the data matches row by row. The live database is only ever read (SELECT); every write goes to the *_femtest database.
 */

require dirname(__DIR__) . '/app/bootstrap.php';

use Femini\Auth\UserRepository;
use Femini\Config;
use Femini\Database;
use Femini\Files\FileStore;
use Femini\Http\HttpError;
use Femini\Migrator;
use Femini\Sync\Restore;
use Femini\Sync\Snapshot;
use Femini\Sync\SyncService;

$pass = 0; $fail = 0;
$ok = static function (bool $c, string $what) use (&$pass, &$fail): void {
    echo ($c ? 'PASS ' : 'FAIL ') . $what . "\n";
    $c ? $pass++ : $fail++;
};
echo 'PHP ' . PHP_VERSION . "\n";

$liveCfg = require getenv('FEMINI_CONFIG');
$testDb = preg_replace('/_[a-z0-9]+$/i', '', (string)$liveCfg['db']['name']) . '_femtest';
$testCfg = $liveCfg;
$testCfg['db']['name'] = $testDb;
$testCfg['app']['storage_path'] = getenv('FEMTEST_STORAGE') ?: (getenv('HOME') ?: '/tmp') . '/femtest-storage';
if ($testDb === $liveCfg['db']['name'] || !str_ends_with($testDb, '_femtest')) {
    exit("REFUSED: test database name is not a *_femtest database\n");
}
@mkdir($testCfg['app']['storage_path'], 0750, true);
$admin = ['id' => 'femtest', 'name' => 'Mosab', 'role' => 'admin', 'perms' => ['*']];

/** everything a page load sees, as plain data (no revisions), for comparison */
$fingerprint = static function (): array {
    $p = (new SyncService(['id' => 'x', 'name' => 'x', 'perms' => ['*']]))->pull(0);
    $coll = [];
    foreach ($p['coll'] as $name => $rows) {
        $live = array_values(array_filter($rows, static fn($r) => !$r['gone']));
        $keyed = [];
        foreach ($live as $r) { $keyed[$r['k']] = $r['row']; }
        ksort($keyed);
        $coll[$name] = $keyed;
    }
    $meta = [];
    // a setting that is missing and the same setting saved empty mean the same to the app (the page fills in the empty default)
    foreach ($p['meta'] as $k => $v) { if ($k !== 'epoch' && !in_array($v['v'], [null, '', [], new stdClass()], false) && json_encode($v['v']) !== '{}') { $meta[$k] = $v['v']; } }
    ksort($meta);
    $files = array_map(static fn($r) => [$r['kind'], $r['owner_type'], $r['owner_id'], $r['sha256']], Database::all('SELECT kind, owner_type, owner_id, sha256 FROM files'));
    sort($files);
    return ['moves' => $p['moves'], 'coll' => $coll, 'meta' => $meta, 'files' => $files];
};
$diff = static function (array $a, array $b): string {
    foreach (['moves', 'coll', 'meta', 'files'] as $k) {
        if ($k === 'coll') {
            foreach (array_unique(array_merge(array_keys($a['coll']), array_keys($b['coll']))) as $c) {
                if (json_encode($a['coll'][$c] ?? []) !== json_encode($b['coll'][$c] ?? [])) { return "coll $c: " . count($a['coll'][$c] ?? []) . ' vs ' . count($b['coll'][$c] ?? []); }
            }
        } elseif (json_encode($a[$k]) !== json_encode($b[$k])) {
            return "$k: " . count($a[$k]) . ' vs ' . count($b[$k]);
        }
    }
    return '';
};

// ---------------------------------------------------------------- phase 1: live, read only
$snap = Snapshot::build($admin);
$pack = static function (array $rows, int $at) use ($snap): \stdClass {   // a backup like Settings › full backup
    $photos = []; $list = [];
    foreach ($rows as $f) {
        $row = FileStore::find((int)$f['id']);
        $abs = $row ? FileStore::absolute($row['path']) : '';
        if (!$row || !is_file($abs)) { continue; }
        $photos['f' . $f['id']] = 'data:' . $row['mime'] . ';base64,' . base64_encode((string)file_get_contents($abs));
        $list[] = $f + ['data' => 'f' . $f['id']];
    }
    return json_decode(json_encode(['app' => 'femini-stock', 'v' => 3, 'at' => $at, 'source' => 'live', 'rev' => $snap['rev'],
        'state' => $snap['state'], 'photos' => $photos, 'files' => $list], JSON_UNESCAPED_UNICODE));
};
$now = (int)(microtime(true) * 1000);
// the new backup button: every file; the button you used today: the newest file of each sheet only
$full = $pack(array_map([FileStore::class, 'present'], Database::all('SELECT * FROM files ORDER BY id')), $now);
$asToday = $pack(FileStore::index(0), $now);
$liveFp = $fingerprint();
echo 'live: ' . count($liveFp['moves']) . ' moves, ' . count($liveFp['coll']['orders']) . ' orders, ' . count($liveFp['coll']['docs']) . ' docs, '
    . count($liveFp['files']) . ' file records; backup files: full ' . count($full->files) . ', as today ' . count($asToday->files) . " (read only)\n";

// ---------------------------------------------------------------- phase 2: the test database only
Config::load($testCfg);
Database::reset();
$ok(Database::value('SELECT DATABASE()') === $testDb, "connected to $testDb");
$pdo = Database::pdo();
foreach ($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $t) { $pdo->exec("DROP TABLE `$t`"); }
Migrator::run(dirname(__DIR__) . '/sql');
UserRepository::ensureDefaultRoles();
UserRepository::create('femtest', 'Mosab', 'admin', bin2hex(random_bytes(16)));

try {
    // 1. the full backup into the empty test database = an exact copy of live (every file record too)
    $r1 = Restore::run($full, $admin, 'live-copy');
    $fp1 = $fingerprint();
    $ok($diff($fp1, $liveFp) === '', 'restore 1 (full backup): data and files equal live ' . $diff($fp1, $liveFp));
    $onDisk = 0;
    foreach (Database::all('SELECT path, sha256 FROM files') as $f) { $onDisk += hash_file('sha256', FileStore::absolute($f['path'])) === $f['sha256'] ? 1 : 0; }
    $ok($onDisk === count($liveFp['files']), "restore 1: every file on disk with the right content ($onDisk)");
    $ok(count(FileStore::index(0)) === count($asToday->files), 'restore 1: the app sees the newest file of every sheet (' . count(FileStore::index(0)) . ')');

    // 2. a page opened before the restore cannot save; one with the new epoch can; a file uploaded while testing
    $epoch = json_decode((string)Database::value("SELECT v FROM meta WHERE k = 'epoch'"), true)['id'] ?? '';
    $rev = (int)Database::value('SELECT rev FROM sync_state WHERE id = 1');
    $push = static fn(?string $e) => (new SyncService($admin))->push(json_decode(json_encode(['since' => $rev, 'epoch' => $e,
        'coll' => ['pickups' => ['up' => [['id' => 'PZTEST', 'label' => 'تيست', 'date' => date('Y-m-d'), 'channel' => 'VENDOOR', 'src' => 't.xlsx']]],
                   'shops' => ['up' => ['محل تيست']]]])));
    $refused = '';
    try { $push(null); } catch (HttpError $e) { $refused = $e->errorCode; }
    $ok($refused === 'restored', "old page (no epoch) refused: $refused");
    $ok((int)Database::value('SELECT rev FROM sync_state WHERE id = 1') === $rev, 'nothing written by the refused save');
    $push($epoch);
    sleep(2);   // the upload is after the backup's time
    $png = tempnam(sys_get_temp_dir(), 'pt');
    file_put_contents($png, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='));
    $docId = (string)(Database::value("SELECT id FROM docs WHERE type = 'SHP' AND gone = 0 ORDER BY ord LIMIT 1") ?? 'd1');
    $test = FileStore::saveLocal($png, 'test-upload.png', 'doc_photo', 'doc', $docId, 'femtest');
    $fp2 = $fingerprint();
    $ok(isset($fp2['coll']['pickups']['PZTEST']) && count($fp2['files']) === count($liveFp['files']) + 1, 'normal use after restore: the change and the new photo are saved');

    // 3. restore with a backup like the one downloaded today (no replaced originals): back to live exactly
    $r3 = Restore::run($asToday, $admin, 'as-today');
    $fp3 = $fingerprint();
    $ok($diff($fp3, $liveFp) === '', 'restore 2 (backup as today): data and files equal live ' . $diff($fp3, $liveFp));
    $ok(!isset($fp3['coll']['pickups']['PZTEST']), 'restore 2: the change after the backup is gone');
    $ok(!Database::value('SELECT id FROM files WHERE id = ?', [$test['id']]), 'restore 2: the photo uploaded while testing is gone');
    $shown = static function (array $files): array { $o = array_map(static fn($f) => [(string)((array)$f)['key'], (string)((array)$f)['name']], $files); sort($o); return $o; };
    $ok($shown(FileStore::index(0)) === $shown($asToday->files), 'restore 2: the app shows the same file on every sheet as before');
    $ok(is_file($testCfg['app']['storage_path'] . '/restore/' . $r3['safety']), "safety copy kept: {$r3['safety']}");

    // 4. undo the restore: back to the state with the change
    Restore::undo($r3['safety'], $admin);
    $fp4 = $fingerprint();
    $ok($diff($fp4, $fp2) === '', 'undo: back to the state before restore 2 ' . $diff($fp4, $fp2));

    // 5. users untouched, revisions only grow
    $ok(count(UserRepository::all()) === 1, 'users untouched');
    $ok((int)Database::value('SELECT rev FROM sync_state WHERE id = 1') > $rev, 'revision only grows');
} catch (\Throwable $e) {
    $ok(false, 'exception: ' . $e::class . ': ' . $e->getMessage() . ' @ ' . basename($e->getFile()) . ':' . $e->getLine());
}
echo "\n$pass passed, $fail failed\n";
exit($fail ? 1 : 0);
