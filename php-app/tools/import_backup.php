<?php
declare(strict_types=1);

/**
 * CLI: php tools/import_backup.php path/to/femini-backup-YYYY-MM-DD.json [admin-username]
 *
 * Loads a backup file made by the standalone app (Settings → Data → download backup) into the database:
 * the ledger, documents, orders, pickups, supplies, catalog, settings and photos. Users are NOT imported
 * (create them with tools/create_admin.php or from the Users screen). Refuses to run when the database already has data.
 */
require dirname(__DIR__) . '/app/bootstrap.php';

use Femini\Auth\UserRepository;
use Femini\Database;
use Femini\Files\FileStore;
use Femini\Sync\SyncService;

[$self, $file, $adminName] = $argv + [null, null, 'admin'];
if (!$file || !is_file($file)) {
    fwrite(STDERR, "Usage: php tools/import_backup.php backup.json [admin-username]\n");
    exit(1);
}
$backup = json_decode((string)file_get_contents($file));          // objects: keeps {} as {}
if (!is_object($backup) || ($backup->app ?? '') !== 'femini-stock' || !isset($backup->state)) {
    fwrite(STDERR, "This is not a Fémini Stock backup file.\n");
    exit(1);
}
if ((int)Database::value('SELECT COUNT(*) FROM moves') > 0 || (int)Database::value('SELECT COUNT(*) FROM orders') > 0) {
    fwrite(STDERR, "The database already has data. Import is only for an empty database.\n");
    exit(1);
}
$admin = Database::one("SELECT u.id, u.name, r.perms FROM users u JOIN roles r ON r.id = u.role_id WHERE u.username = ?", [$adminName]);
if ($admin === null) {
    fwrite(STDERR, "Admin user '$adminName' not found. Create it first: php tools/create_admin.php\n");
    exit(1);
}
$user = ['id' => $admin['id'], 'name' => $admin['name'], 'perms' => json_decode($admin['perms'], true)];
$S = $backup->state;

$list = static fn(mixed $v): array => is_array($v) ? $v : [];
$req = new stdClass();
$req->since = 0;
$req->moves = $list($S->moves ?? []);
$req->coll = (object)[
    'docs'      => (object)['up' => $list($S->docs ?? [])],
    'orders'    => (object)['up' => $list($S->orders ?? [])],
    'pickups'   => (object)['up' => $list($S->pickups ?? [])],
    'sup_items' => (object)['up' => $list($S->sup->items ?? [])],
    'sup_log'   => (object)['up' => $list($S->sup->log ?? [])],
    'closes'    => (object)['up' => $list($S->closes ?? [])],
    'shops'     => (object)['up' => $list($S->shops ?? [])],
    'emps'      => (object)['up' => $list($S->emps ?? [])],
    'archPk'    => (object)['up' => $list($S->archPk ?? [])],
    'archDocs'  => (object)['up' => $list($S->archDocs ?? [])],
];
$req->meta = new stdClass();
foreach (['mid' => $S->mid ?? null, 'did' => $S->did ?? null, 'seq' => $S->seq ?? null, 'sup_eid' => $S->sup->eid ?? null,
          'st' => $S->st ?? null, 'costs' => $S->costs ?? null, 'alias' => $S->alias ?? null, 'img' => $S->img ?? null,
          'cat' => $S->cat ?? null, 'lock' => $S->lock ?? null, 'bk' => $S->bk ?? null] as $k => $v) {
    if ($v !== null) {
        $req->meta->$k = $v;
    }
}
$req->audit = $list($S->audit ?? []);

$result = (new SyncService($user))->push($req);
printf("Imported: %d moves, %d docs, %d orders, %d pickups (revision %d)\n",
    count($req->moves), count($req->coll->docs->up), count($req->coll->orders->up), count($req->coll->pickups->up), $result['rev']);

// Photos (data URLs) → files on disk.
$n = 0;
foreach ((array)($backup->photos ?? []) as $key => $dataUrl) {
    if (!is_string($dataUrl) || !preg_match('#^data:([^;,]+);base64,(.+)$#s', $dataUrl, $m)) {
        continue;
    }
    $tmp = tempnam(sys_get_temp_dir(), 'ph');
    file_put_contents($tmp, base64_decode($m[2]));
    $isCancel = str_starts_with((string)$key, 'cx');
    $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'][$m[1]] ?? 'img';
    try {
        FileStore::saveLocal($tmp, "$key.$ext", $isCancel ? 'cancel' : 'signed_note', $isCancel ? 'order' : 'doc', (string)preg_replace('/^cx:?/', '', (string)$key), $user['id']);
        $n++;
    } catch (\Throwable $e) {
        fwrite(STDERR, "Skipped photo $key: " . $e->getMessage() . "\n");
    }
    @unlink($tmp);
}
echo "Photos imported: $n\n";
