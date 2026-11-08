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
$photos = []; $list = [];
foreach (FileStore::index(0) as $f) {
    $row = FileStore::find((int)$f['id']);
    $abs = $row ? FileStore::absolute($row['path']) : '';
    if (!$row || !is_file($abs)) { continue; }
    $photos['f' . $f['id']] = 'data:' . $row['mime'] . ';base64,' . base64_encode((string)file_get_contents($abs));
    $list[] = $f + ['data' => 'f' . $f['id']];
}
$backup = json_decode(json_encode(['app' => 'femini-stock', 'v' => 3, 'at' => (int)(microtime(true) * 1000), 'source' => 'live', 'rev' => $snap['rev'],
    'state' => $snap['state'], 'photos' => $photos, 'files' => $list], JSON_UNESCAPED_UNICODE));
$liveFp = $fingerprint();
echo 'live: ' . count($liveFp['moves']) . ' moves, ' . count($liveFp['coll']['orders']) . ' orders, ' . count($liveFp['coll']['docs']) . ' docs, ' . count($list) . " files (read only)\n";

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
    // 1. restore into the empty test database = an exact copy of live
    $r1 = Restore::run($backup, $admin, 'live-copy');
    $fp1 = $fingerprint();
    $ok($diff($fp1, $liveFp) === '', 'restore 1: data equals live ' . $diff($fp1, $liveFp));
    $ok($r1['files'] === count($list), "restore 1: {$r1['files']} files put back");
    $onDisk = 0;
    foreach (Database::all('SELECT path, sha256 FROM files') as $f) { $onDisk += hash_file('sha256', FileStore::absolute($f['path'])) === $f['sha256'] ? 1 : 0; }
    $ok($onDisk === count($list), "restore 1: every file on disk with the right content ($onDisk)");

    // 2. a page opened before the restore cannot save; one with the new epoch can
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
    $fp2 = $fingerprint();
    $ok(isset($fp2['coll']['pickups']['PZTEST']) && $diff($fp2, $liveFp) !== '', 'normal use after restore: the change is saved');

    // 3. restore again: back to the backup exactly, the change is gone
    $r3 = Restore::run($backup, $admin, 'again');
    $fp3 = $fingerprint();
    $ok($diff($fp3, $liveFp) === '', 'restore 2: data equals the backup again ' . $diff($fp3, $liveFp));
    $ok(!isset($fp3['coll']['pickups']['PZTEST']), 'restore 2: the change after the backup is gone');
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
