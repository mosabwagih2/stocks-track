<?php
declare(strict_types=1);

/**
 * Integration tests: boots PHP's built-in server against a real MySQL/MariaDB test database and drives the API over HTTP.
 *
 *   FEMINI_TEST_DB_HOST=127.0.0.1 FEMINI_TEST_DB_NAME=femini_test FEMINI_TEST_DB_USER=femini FEMINI_TEST_DB_PASS=femini_pw php tests/run.php
 *
 * WARNING: it DROPS every table in the test database. Use a throw-away database.
 */

require __DIR__ . '/env.php';
['root' => $root, 'tmp' => $tmp] = femini_test_env();
putenv('FEMINI_TESTING=1');

use Femini\Auth\UserRepository;
use Femini\Database;

UserRepository::create('admin', 'المدير', 'admin', 'Qx7-Lunar-Tide-91');
UserRepository::create('packer', 'موظف شحن', 'pack', 'Rb4-Silver-Reed-62');
UserRepository::create('sup', 'مشرف', 'sup', 'Mv9-Amber-Gate-35');

// ---- server
$port = 8700 + random_int(0, 99);
$proc = proc_open(
    ['php', '-S', "127.0.0.1:$port", '-t', $root . '/public', $root . '/tests/router.php'],
    [1 => ['file', $tmp . '/server.log', 'a'], 2 => ['file', $tmp . '/server.log', 'a']],
    $pipes, $root, ['FEMINI_CONFIG' => $tmp . '/config.php', 'FEMINI_TESTING' => '1'] + $_ENV + ['PATH' => getenv('PATH')]
);
register_shutdown_function(static function () use ($proc) { proc_terminate($proc); });
for ($i = 0; $i < 50; $i++) {
    if (@file_get_contents("http://127.0.0.1:$port/api/health")) {
        break;
    }
    usleep(100000);
}

// ---- tiny test kit
$pass = 0;
$fail = 0;
function ok(string $name, bool $cond, mixed $detail = null): void
{
    global $pass, $fail;
    $cond ? $pass++ : $fail++;
    echo ($cond ? 'PASS ' : 'FAIL ') . $name . ($cond ? '' : '  -> ' . (is_string($detail) ? $detail : json_encode($detail, JSON_UNESCAPED_UNICODE))) . "\n";
}

final class Client
{
    public string $csrf = '';
    private string $jar;

    public function __construct(private int $port)
    {
        $this->jar = tempnam(sys_get_temp_dir(), 'fj');
    }

    /** @return array{0:int,1:array|null,2:string} */
    public function call(string $method, string $path, mixed $body = null, ?array $multipart = null, array $extraHeaders = []): array
    {
        $ch = curl_init("http://127.0.0.1:{$this->port}$path");
        if ($this->autoDoc && $path === '/api/sync/push' && is_array($body)) {
            $body = $this->attachDocs($body);
        }
        $headers = array_merge(['X-CSRF-Token: ' . $this->csrf], $extraHeaders);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_HEADER => false,
            CURLOPT_COOKIEJAR => $this->jar, CURLOPT_COOKIEFILE => $this->jar,
        ]);
        if ($multipart !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $multipart);
        } elseif ($body !== null) {
            $headers[] = 'Content-Type: application/json';
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE));
        }
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        $raw = (string)curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return [$status, json_decode($raw, true), $raw];
    }

    public bool $autoDoc = true;
    public string $userName = '';

    /** Moves must belong to a confirmed document in the same push: give bare test moves one. */
    private function attachDocs(array $b): array
    {
        foreach ($b['moves'] ?? [] as $i => $m) {
            if (($m['type'] ?? '') === 'OPN') {
                continue;
            }
            // one confirmed document per move, numbered after the move id (so a re-sent move maps to the same document)
            $no = $m['type'] . '-T' . $m['id'];
            $b['moves'][$i]['doc'] = $no;
            $b['coll']['docs']['up'][] = ['id' => 'auto-' . $no, 'type' => $m['type'], 'status' => 'done', 'no' => $no, 'date' => $m['date'], 'by' => $this->userName,
                                          'hdr' => ['emp' => 'e', 'refs' => []], 'lines' => [], 'log' => [], 'nMoves' => 1];
        }
        return $b;
    }

    /** The raw response headers of a GET (lower-cased names). */
    public function headers(string $path): array
    {
        $ch = curl_init("http://127.0.0.1:{$this->port}$path");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HEADER => true, CURLOPT_COOKIEJAR => $this->jar, CURLOPT_COOKIEFILE => $this->jar]);
        $raw = (string)curl_exec($ch);
        $head = substr($raw, 0, (int)curl_getinfo($ch, CURLINFO_HEADER_SIZE));
        curl_close($ch);
        $out = [];
        foreach (explode("\n", $head) as $line) {
            if (str_contains($line, ':')) {
                [$k, $v] = explode(':', $line, 2);
                $out[strtolower(trim($k))] = trim($v);
            }
        }
        return $out;
    }

    /** The session id from the cookie jar (to age a session on disk). */
    public function sessionId(): string
    {
        foreach (file($this->jar) as $line) {
            if (preg_match('/\tfemini\t(\S+)\s*$/', $line, $m)) {
                return $m[1];
            }
        }
        return '';
    }

    public function login(string $u, string $p): int
    {
        [$s, $j] = $this->call('POST', '/api/auth/login', ['username' => $u, 'password' => $p]);
        if ($s === 200) {
            $this->userName = (string)($j['user']['name'] ?? '');
            $this->csrf = $j['csrf'];
        }
        return $s;
    }
}

function mv(int $id, string $type = 'SCN', string $sku = 'BR2-BLK-L', int $q = 1, string $from = 'READY', string $to = 'EXT_CH', string $date = null): array
{
    return ['id' => $id, 't' => 1793000000000 + $id, 'date' => $date ?? date('Y-m-d'), 'sku' => $sku, 'q' => $q, 'from' => $from, 'to' => $to,
            'type' => $type, 'doc' => "$type-0001", 'by' => 'x', 'note' => ''];
}

$anon = new Client($port);
$admin = new Client($port);
$packer = new Client($port);
$sup = new Client($port);

// ================= auth
[$s] = $anon->call('GET', '/api/sync/pull');
ok('anonymous pull is refused (401)', $s === 401);
ok('wrong password is refused', $anon->login('admin', 'nope') === 401);
ok('unknown user is refused the same way', $anon->login('ghost', 'whatever1') === 401);
ok('admin logs in', $admin->login('admin', 'Qx7-Lunar-Tide-91') === 200);
ok('packer logs in', $packer->login('packer', 'Rb4-Silver-Reed-62') === 200);
ok('supervisor logs in', $sup->login('sup', 'Mv9-Amber-Gate-35') === 200);
[$s, $j] = $admin->call('GET', '/api/auth/me');
ok('me returns the user and permissions', $s === 200 && $j['user']['username'] === 'admin' && in_array('*', $j['user']['perms'], true), $j);
$saved = $admin->csrf;
$admin->csrf = 'forged';
[$s] = $admin->call('POST', '/api/sync/push', ['since' => 0]);
ok('a write without the CSRF token is refused (403)', $s === 403, $s);
$admin->csrf = $saved;

// ================= initial import by the admin
$seedMoves = [mv(1, 'OPN', 'BR2-BLK-L', 50, 'EXT_OPEN', 'READY', '2026-10-29'), mv(2, 'OPN', 'BR2-RED-L', 30, 'EXT_OPEN', 'READY', '2026-10-29')];
$order = static fn(string $ref, string $st = 'open') => ['ref' => $ref, 'wb' => "WB$ref", 'type' => 'جديد', 'gov' => 'القاهرة', 'total' => 500, 'lines' => ['BR2-BLK-L'], 'pk' => 'P1', 'st' => $st, 'sc' => null, 'bad' => []];
[$s, $j] = $admin->call('POST', '/api/sync/push', [
    'since' => 0,
    'moves' => $seedMoves,
    'coll' => [
        'pickups' => ['up' => [['id' => 'P1', 'label' => 'بيك أب 1', 'date' => date('Y-m-d'), 'channel' => 'VENDOOR', 'src' => 'x']]],
        'orders' => ['up' => [$order('ed1'), $order('ed2'), $order('ed3')]],
        'sup_items' => ['up' => [['id' => 'FLY', 'name' => 'فلاير', 'unit' => 'قطعة', 'pack' => 1, 'min' => 10, 'arch' => false]]],
        'emps' => ['up' => ['عبدالله']],
    ],
    'meta' => ['mid' => 3, 'did' => 1, 'seq' => (object)[], 'st' => ['lookback' => 14], 'cat' => ['skus' => []]],
    'audit' => [['t' => 1793000000000, 'by' => 'FORGED', 'm' => 'استيراد أولي']],
]);
ok('admin imports the initial state', $s === 200 && $j['rev'] === 1, $j);
$rev1 = $j['rev'];

[$s, $j] = $admin->call('GET', '/api/sync/pull?since=0');
ok('full pull returns everything', $s === 200 && count($j['moves']) === 2 && count($j['coll']['orders']) === 3 && $j['meta']['mid']['v'] === 3, $j);
ok('order keeps its JSON shape', $j['coll']['orders'][0]['row']['lines'][0] === 'BR2-BLK-L' && $j['coll']['orders'][0]['row']['wb'] === 'WBed1');
ok('audit actor is written by the server, not the browser', $j['audit'][0]['by'] === 'المدير', $j['audit']);
ok('creation order is preserved', array_column(array_column($j['coll']['orders'], 'row'), 'ref') === ['ed1', 'ed2', 'ed3']);
[$s, $j2] = $admin->call('GET', "/api/sync/pull?since=$rev1");
ok('pull since the latest revision is empty', $s === 200 && !$j2['moves'] && !$j2['coll']['orders'] && !$j2['meta'], $j2);

// ================= ledger rules
[$s, $j] = $packer->call('POST', '/api/sync/push', ['since' => $rev1, 'moves' => [mv(3, 'SCN')], 'meta' => ['mid' => 4]]);
ok('packer can post a scan move', $s === 200, $j);
$rev2 = $j['rev'];
[$s, $j] = $packer->call('POST', '/api/sync/push', ['since' => $rev2, 'moves' => [mv(4, 'RCV', 'BR2-BLK-L', 5, 'EXT_FACTORY', 'READY')]]);
ok('packer cannot post a factory receipt (403)', $s === 403 && $j['error'] === 'forbidden', $j);
[$s, $j] = $packer->call('POST', '/api/sync/push', ['since' => $rev2, 'meta' => ['st' => ['lookback' => 99]]]);
ok('packer cannot change settings (403)', $s === 403, $j);
[$s, $j] = $packer->call('POST', '/api/sync/push', ['since' => $rev2, 'coll' => ['pickups' => ['up' => [['id' => 'P2', 'date' => date('Y-m-d')]]]]]);
ok('packer cannot create a pickup (403)', $s === 403, $j);
[$s, $j] = $packer->call('POST', '/api/sync/push', ['since' => $rev2, 'moves' => [mv(5, 'OPN', 'BR2-BLK-L', 9, 'EXT_OPEN', 'READY')]]);
ok('only an admin can post an opening balance', $s === 403, $j);
[$s, $j] = $packer->call('POST', '/api/sync/push', ['since' => $rev2, 'moves' => [mv(6, 'SCN', 'BR2-BLK-L', 1, 'READY', 'MOON')]]);
ok('an unknown location is refused (422)', $s === 422, $j);

[$s, $j] = $packer->call('POST', '/api/sync/push', ['since' => $rev2, 'moves' => [mv(3, 'SCN')]]);
ok('re-sending the identical move is harmless (retry safe)', $s === 200 && $j['rev'] === $rev2, $j);
[$s, $j] = $packer->call('POST', '/api/sync/push', ['since' => $rev2, 'moves' => [mv(3, 'SCN', 'BR2-RED-L', 7)]]);
ok('a DIFFERENT move with an existing id is a conflict (409) and the ledger is untouched', $s === 409 && $j['error'] === 'stale', $j);
ok('the ledger row is unchanged', (int)Database::value('SELECT q FROM moves WHERE id = 3') === 1);

// ================= counters
[$s, $j] = $packer->call('POST', '/api/sync/push', ['since' => $rev2, 'meta' => ['mid' => 2]]);
ok('a counter cannot go backwards (409)', $s === 409, $j);

// ================= optimistic concurrency
$sinceA = $rev2;
[$s, $j] = $sup->call('POST', '/api/sync/push', ['since' => $rev2, 'coll' => ['orders' => ['up' => [['ref' => 'ed1', 'wb' => 'WBed1', 'st' => 'done', 'lines' => ['BR2-BLK-L'], 'pk' => 'P1', 'sc' => ['date' => date('Y-m-d')], 'bad' => []]]]]]);
ok('supervisor scans order ed1', $s === 200, $j);
$rev3 = $j['rev'];
[$s, $j] = $packer->call('POST', '/api/sync/push', ['since' => $sinceA, 'moves' => [mv(7, 'SCN', 'BR2-RED-L', 1)], 'coll' => ['orders' => ['up' => [['ref' => 'ed1', 'wb' => 'WBed1', 'st' => 'cx', 'lines' => ['BR2-BLK-L'], 'pk' => 'P1', 'bad' => []]]]]]);
ok('two people changing the same order: the late one gets 409', $s === 409 && $j['conflicts'][0]['k'] === 'ed1', $j);
ok('and NOTHING of the rejected push was applied (atomic)', (int)Database::value('SELECT COUNT(*) FROM moves WHERE id = 7') === 0);
[$s, $j] = $packer->call('POST', '/api/sync/push', ['since' => $rev3, 'moves' => [mv(7, 'SCN', 'BR2-RED-L', 1)], 'meta' => ['mid' => 8]]);
ok('after pulling (since = latest) the same person can write', $s === 200, $j);
$rev4 = $j['rev'];

// ================= documents: confirmed documents are frozen
$doc = ['id' => 'd1', 'type' => 'SHP', 'status' => 'done', 'no' => 'SHP-0001', 'date' => date('Y-m-d'), 'by' => 'مشرف', 'hdr' => ['shop' => 'محل'], 'lines' => [['sku' => 'BR2-BLK-L', 'q' => 1]], 'log' => []];
[$s, $j] = $sup->call('POST', '/api/sync/push', ['since' => $rev4, 'coll' => ['docs' => ['up' => [$doc]]]]);
ok('supervisor confirms a shop transfer', $s === 200, $j);
$rev5 = $j['rev'];
$changed = $doc;
$changed['lines'][0]['q'] = 99;
[$s, $j] = $sup->call('POST', '/api/sync/push', ['since' => $rev5, 'coll' => ['docs' => ['up' => [$changed]]]]);
ok('editing a confirmed document is refused (409 immutable)', $s === 409 && $j['error'] === 'immutable', $j);
$delivered = $doc;
$delivered['hdr']['delivered'] = ['by' => 'مشرف'];
$delivered['log'][] = ['m' => 'اتسلّم'];
[$s, $j] = $sup->call('POST', '/api/sync/push', ['since' => $rev5, 'coll' => ['docs' => ['up' => [$delivered]]]]);
ok('but the delivery proof can still be recorded', $s === 200, $j);
$rev6 = $j['rev'];
[$s, $j] = $sup->call('POST', '/api/sync/push', ['since' => $rev6, 'coll' => ['docs' => ['gone' => ['d1']]]]);
ok('a confirmed document cannot be archived', $s === 409, $j);
$draft = ['id' => 'd2', 'type' => 'CLN', 'status' => 'draft', 'no' => null, 'date' => date('Y-m-d'), 'by' => 'مشرف', 'hdr' => [], 'lines' => [], 'log' => []];
[$s, $j] = $packer->call('POST', '/api/sync/push', ['since' => $rev6, 'coll' => ['docs' => ['up' => [$draft]]]]);
ok('packer cannot even draft a status-change document (403)', $s === 403, $j);
[$s, $j] = $sup->call('POST', '/api/sync/push', ['since' => $rev6, 'coll' => ['docs' => ['up' => [$draft]]]]);
$rev7 = $j['rev'] ?? 0;
[$s, $j] = $sup->call('POST', '/api/sync/push', ['since' => $rev7, 'coll' => ['docs' => ['gone' => ['d2']]]]);
ok('a draft can be archived', $s === 200, $j);
[$s, $j] = $sup->call('GET', "/api/sync/pull?since=$rev7");
ok('the archived draft arrives as a tombstone (not deleted)', $j['coll']['docs'][0]['gone'] === true && (int)Database::value("SELECT COUNT(*) FROM docs WHERE id='d2'") === 1, $j['coll']['docs']);

// ================= day close
$today = date('Y-m-d');
$yesterday = date('Y-m-d', strtotime('-1 day'));
$rev = (int)Database::value('SELECT rev FROM sync_state');
[$s, $j] = $packer->call('POST', '/api/sync/push', ['since' => $rev, 'meta' => ['lock' => $today]]);
ok('packer cannot close today (403)', $s === 403, $j);
[$s, $j] = $packer->call('POST', '/api/sync/push', ['since' => $rev, 'meta' => ['lock' => $yesterday]]);
ok('but anyone may apply the automatic close of a PAST day', $s === 200, $j);
$rev = $j['rev'];
[$s, $j] = $packer->call('POST', '/api/sync/push', ['since' => $rev, 'moves' => [mv(8, 'SCN', 'BR2-RED-L', 1, 'READY', 'EXT_CH', $yesterday)], 'meta' => ['mid' => 9]]);
ok('a move dated on a closed day is refused (409 day_locked)', $s === 409 && $j['error'] === 'day_locked', $j);
[$s, $j] = $packer->call('POST', '/api/sync/push', ['since' => $rev, 'moves' => [mv(8, 'SCN', 'BR2-RED-L', 1)], 'meta' => ['mid' => 9]]);
ok('today is still open', $s === 200, $j);

// ================= unknown things
[$s, $j] = $admin->call('POST', '/api/sync/push', ['since' => 0, 'meta' => ['hacker' => 1]]);
ok('unknown setting keys are refused (422)', $s === 422, $j);
[$s, $j] = $admin->call('POST', '/api/sync/push', ['since' => 0, 'coll' => ['users' => ['up' => [['id' => 'x']]]]]);
ok('users cannot be written through sync (422)', $s === 422, $j);

// ================= users admin
[$s, $j] = $packer->call('GET', '/api/users');
ok('packer cannot list users (403)', $s === 403);
[$s, $j] = $admin->call('GET', '/api/users');
ok('admin lists users (no hashes leaked)', $s === 200 && count($j['users']) === 3 && !str_contains(json_encode($j), 'pass_hash') && !str_contains(json_encode($j), '$2y$'), $j);
[$s, $j] = $admin->call('POST', '/api/users', ['username' => 'new1', 'name' => 'جديد', 'role' => 'pack', 'password' => 'abc']);
ok('a short password is refused (422)', $s === 422, $j);
[$s, $j] = $admin->call('POST', '/api/users', ['username' => 'new1', 'name' => 'جديد', 'role' => 'pack', 'password' => 'long-enough-1']);
ok('admin creates a user', $s === 201, $j);
$newId = $j['id'] ?? '';
[$s, $j] = $admin->call('POST', '/api/users', ['username' => 'new1', 'name' => 'تاني', 'role' => 'pack', 'password' => 'long-enough-1']);
ok('duplicate username is refused (409)', $s === 409, $j);
ok('the new user can log in', (new Client($port))->login('new1', 'long-enough-1') === 200);
[$s, $j] = $admin->call('PATCH', "/api/users/$newId", ['arch' => true]);
ok('archiving a user works (never deleted)', $s === 200 && (int)Database::value('SELECT COUNT(*) FROM users WHERE id = ?', [$newId]) === 1);
ok('an archived user cannot log in', (new Client($port))->login('new1', 'long-enough-1') === 401);
$adminId = (string)Database::value("SELECT id FROM users WHERE username = 'admin'");
[$s, $j] = $admin->call('PATCH', "/api/users/$adminId", ['arch' => true]);
ok('the last admin cannot be archived (409)', $s === 409 && (int)Database::value('SELECT arch FROM users WHERE id = ?', [$adminId]) === 0, $j);
[$s] = $packer->call('POST', "/api/users/$adminId/password", ['password' => 'hijacked-1']);
ok('a packer cannot reset the admin password (403)', $s === 403);

// ================= brute force
$bf = new Client($port);
for ($i = 0; $i < 5; $i++) {
    $bf->login('sup', 'wrong-pass-' . $i);
}
ok('after 5 wrong passwords the account is locked for a while (429)', $bf->login('sup', 'Mv9-Amber-Gate-35') === 429);

// ================= files
$png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
file_put_contents($tmp . '/note.png', $png);
file_put_contents($tmp . '/evil.php', '<?php echo 1;');
file_put_contents($tmp . '/pk.csv', "a,b\n1,2\n");
$up = static fn(Client $c, string $file, string $kind, string $name, string $mime) => $c->call('POST', '/api/files', null, [
    'file' => new CURLFile($file, $mime, $name), 'kind' => $kind, 'owner_type' => 'doc', 'owner_id' => 'd1',
]);
[$s, $j] = $up($sup, $tmp . '/note.png', 'doc_photo', 'إذن.png', 'image/png');
ok('supervisor uploads a signed-note photo', $s === 201 && $j['file']['hasThumb'] === true && $j['file']['name'] === 'إذن.png', $j);
$fid = $j['file']['id'] ?? 0;
[$s, $j] = $up($sup, $tmp . '/note.png', 'doc_photo', 'إذن.png', 'image/png');
ok('the same file for the same owner is not stored twice', $s === 201 && $j['file']['id'] === $fid, $j);
[$s, $j] = $up($sup, $tmp . '/evil.php', 'pickup', 'evil.php', 'image/png');
ok('a PHP file renamed as an image is refused (415)', $s === 415, $j);
[$s, $j] = $up($packer, $tmp . '/note.png', 'pickup', 'x.png', 'image/png');
ok('packer may not upload a pickup file (403)', $s === 403, $j);
[$s, $j] = $up($sup, $tmp . '/pk.csv', 'pickup', 'بيك أب.csv', 'text/csv');
ok('csv files are accepted', $s === 201, $j);
[$s, $body, $raw] = $sup->call('GET', "/api/files/$fid");
ok('the original is downloaded byte for byte', $s === 200 && $raw === $png);
[$s, $body, $raw] = $sup->call('GET', "/api/files/$fid?thumb=1");
ok('the display copy is a JPEG', $s === 200 && str_starts_with($raw, "\xFF\xD8"), $s);
[$s] = $anon->call('GET', "/api/files/$fid");
ok('files need a session (401)', $s === 401);
$path = (string)Database::value('SELECT path FROM files WHERE id = ?', [$fid]);
ok('stored under a random name outside the web root', preg_match('#^\d{4}/\d{2}/[0-9a-f]{40}\.png$#', $path) === 1 && !str_contains($path, 'png.') && is_file($tmp . '/storage/files/' . $path), $path);
[$s, $j] = $sup->call('GET', '/api/files?owner_type=doc&owner_id=d1');
ok('files are listed per owner', $s === 200 && count($j['files']) === 2, $j);

// ================= JSON fidelity: empty objects must stay objects (the browser app depends on it)
$rev = (int)Database::value('SELECT rev FROM sync_state');
$rawPush = '{"since":' . $rev . ',"coll":{"docs":{"up":[{"id":"d9","type":"CLN","status":"draft","no":null,"date":"' . $today . '","by":"المدير","hdr":{},"lines":[],"log":[]}]}},"meta":{"alias":{},"costs":{}}}';
$rawRes = static function (Client $c, string $path, string $raw) use ($port): array {
    $r = new ReflectionClass($c);
    $jar = $r->getProperty('jar');
    $jar->setAccessible(true);
    $ch = curl_init("http://127.0.0.1:$port$path");
    curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => 'POST', CURLOPT_RETURNTRANSFER => true, CURLOPT_POSTFIELDS => $raw,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'X-CSRF-Token: ' . $c->csrf], CURLOPT_COOKIEJAR => $jar->getValue($c), CURLOPT_COOKIEFILE => $jar->getValue($c)]);
    $out = (string)curl_exec($ch);
    $st = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$st, $out];
};
[$st, $out] = $rawRes($admin, '/api/sync/push', $rawPush);
ok('a document with an empty hdr object is stored', $st === 200, $out);
[$s, $j, $raw] = $admin->call('GET', '/api/sync/pull?since=' . $rev);
ok('empty objects come back as {} (never as [])', str_contains($raw, '"hdr":{}') && str_contains($raw, '"alias":{"v":{}') , substr($raw, 0, 400));
$snapRaw = json_encode(Femini\Sync\Snapshot::build(['id' => 'x', 'name' => 'x', 'perms' => ['*']])['state'], JSON_UNESCAPED_UNICODE);
ok('the page snapshot keeps {} too', str_contains($snapRaw, '"hdr":{}') && str_contains($snapRaw, '"alias":{}'), substr($snapRaw, 0, 200));

// ================= passwords
foreach ([
    ['abc', 'shorter than the 4-character minimum'],
    ['xyz-short', null], ['Kg4-xqzvnovak-' . str_repeat('z', 70), 'longer than bcrypt reads (72 bytes)'],
] as [$pw, $why]) {
    static $n = 0;
    [$s, $j] = $admin->call('POST', '/api/users', ['username' => $pw === 'Mhoms-bad-password1' ? 'mhoms' : 'weak' . ++$n, 'name' => 'x', 'role' => 'pack', 'password' => $pw]);
    if ($why === null) {   // 'xyz-short' is 9 chars: it is allowed; clean up by using it only once
        ok('a normal 9-character password is accepted', $s === 201, $j);
        continue;
    }
    ok("weak password refused: $why", $s === 422 && $j['error'] === 'weak_password', $j);
}
$bcrypt = (string)Database::value("SELECT pass_hash FROM users WHERE username = 'admin'");
ok('passwords are stored as bcrypt cost 12', str_starts_with($bcrypt, '$2y$12$'), substr($bcrypt, 0, 8));

// own password change needs the current password; it signs OTHER sessions out but not this one
$packerOther = new Client($port);
$packerOther->login('packer', 'Rb4-Silver-Reed-62');
$packerId = (string)Database::value("SELECT id FROM users WHERE username = 'packer'");
[$s, $j] = $packer->call('POST', "/api/users/$packerId/password", ['password' => 'Fresh-Lantern-48', 'current' => 'wrong']);
ok('changing your own password with a wrong current password is refused', $s === 403 && $j['error'] === 'bad_current', $j);
[$s, $j] = $packer->call('POST', "/api/users/$packerId/password", ['password' => 'Fresh-Lantern-48', 'current' => 'Rb4-Silver-Reed-62']);
ok('with the right current password it works', $s === 200, $j);
[$s] = $packer->call('GET', '/api/auth/me');
ok('the browser that changed it stays signed in', $s === 200, $s);
[$s] = $packerOther->call('GET', '/api/auth/me');
ok('the same user\'s other sessions are signed out', $s === 401, $s);
ok('the old password no longer works, the new one does', (new Client($port))->login('packer', 'Rb4-Silver-Reed-62') === 401 && (new Client($port))->login('packer', 'Fresh-Lantern-48') === 200);

// admin reset of someone else's password signs that user out; disabling a user signs them out immediately
$victim = new Client($port);
$victim->login('new1', 'long-enough-1');   // archived earlier: must still fail
ok('an archived user stays locked out', $victim->login('new1', 'long-enough-1') === 401);
[$s, $j] = $admin->call('POST', '/api/users', ['username' => 'temp1', 'name' => 'مؤقت', 'role' => 'pack', 'password' => 'Temp-Orchid-71']);
$tempId = $j['id'] ?? '';
$tempC = new Client($port);
ok('a new user logs in', $tempC->login('temp1', 'Temp-Orchid-71') === 200);
[$s] = $admin->call('PATCH', "/api/users/$tempId", ['active' => false]);
[$s2] = $tempC->call('GET', '/api/auth/me');
ok('disabling a user ends their open session on the very next request', $s === 200 && $s2 === 401, [$s, $s2]);

// ================= sessions age out
$admin->call('POST', '/api/users', ['username' => 'aged1', 'name' => 'قديم', 'role' => 'pack', 'password' => 'Aged-Pelican-83']);
$aged = new Client($port);
$aged->login('aged1', 'Aged-Pelican-83');
$sf = $tmp . '/storage/sessions/sess_' . $aged->sessionId();   // the app keeps sessions in its own folder
$data = (string)@file_get_contents($sf);
ok('the session file exists for the ageing test', $data !== '' && str_contains($data, 'seen|i:'), $sf);
file_put_contents($sf, preg_replace('/seen\|i:\d+;/', 'seen|i:' . (time() - 13 * 3600) . ';', $data));
[$s] = $aged->call('GET', '/api/auth/me');
ok('a session idle for more than 12 hours is signed out', $s === 401, $s);

// ================= browser protections
[$s, $j] = $admin->call('POST', '/api/sync/push', ['since' => 0], null, ['Origin: http://evil.example']);
ok('a write from another origin is refused (403 bad_origin)', $s === 403 && $j['error'] === 'bad_origin', $j);
[$s] = $admin->call('POST', '/api/sync/push', ['since' => (int)Database::value('SELECT rev FROM sync_state')], null, ['Origin: http://127.0.0.1:' . $port]);
ok('the same origin is accepted', $s === 200, $s);
$h = $admin->headers('/api/health');
ok('API responses: nosniff, no framing, a locked-down CSP, no caching', ($h['x-content-type-options'] ?? '') === 'nosniff' && ($h['x-frame-options'] ?? '') === 'DENY'
    && str_contains($h['content-security-policy'] ?? '', "default-src 'none'") && ($h['cache-control'] ?? '') === 'no-store', $h);
$h = $admin->headers('/');
ok('the app page has a CSP (no objects, no framing, same-origin connections) and X-Frame-Options', str_contains($h['content-security-policy'] ?? '', "object-src 'none'") && str_contains($h['content-security-policy'] ?? '', "connect-src 'self'")
    && str_contains($h['content-security-policy'] ?? '', "frame-ancestors 'none'") && ($h['x-frame-options'] ?? '') === 'DENY', $h);
$ch = curl_init("http://127.0.0.1:$port/.htaccess");
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true]);
curl_exec($ch);
ok('only the public folder is served: /app and /config are not even under the web root', is_dir(dirname(__DIR__) . '/public') && !is_file(dirname(__DIR__) . '/public/config.php') && !is_dir(dirname(__DIR__) . '/public/app'));
curl_close($ch);

// ================= roles are editable on the server and take effect immediately
[$s] = $packer->call('PUT', '/api/roles/pack', ['perms' => ['scan', 'returns', 'pickup']]);
ok('a packer cannot edit roles (403)', $s === 403);
[$s, $j] = $admin->call('PUT', '/api/roles/admin', ['perms' => []]);
ok('the admin role is fixed (409)', $s === 409, $j);
[$s, $j] = $admin->call('PUT', '/api/roles/pack', ['perms' => ['scan', 'fly']]);
ok('an unknown permission is refused (422)', $s === 422, $j);
$rev = (int)Database::value('SELECT rev FROM sync_state');
[$s] = $packer->call('POST', '/api/sync/push', ['since' => $rev, 'coll' => ['pickups' => ['up' => [['id' => 'P7', 'date' => date('Y-m-d')]]]]]);
ok('before the change the packer cannot create a pickup', $s === 403, $s);
[$s] = $admin->call('PUT', '/api/roles/pack', ['perms' => ['scan', 'returns', 'pickup']]);
[$s2, $j2] = $packer->call('POST', '/api/sync/push', ['since' => $rev, 'coll' => ['pickups' => ['up' => [['id' => 'P7', 'date' => date('Y-m-d')]]]]]);
ok('right after the admin grants it, the same packer session can', $s === 200 && $s2 === 200, $j2);
$admin->call('PUT', '/api/roles/pack', ['perms' => ['scan', 'returns']]);

// ================= files: index for the browser, delta by id
[$s, $j] = $sup->call('GET', '/api/sync/pull?since=0&fileSince=0');
$keys = array_column($j['files'] ?? [], 'key');
ok('pull lists files by the browser\'s key (ph:, pk:)', in_array('ph:d1', $keys, true), $keys);
$maxId = max(array_column($j['files'], 'id'));
[$s, $j] = $sup->call('GET', "/api/sync/pull?since=0&fileSince=$maxId");
ok('and only the new ones after fileSince', $j['files'] === [], $j['files'] ?? null);
[$s, $j] = $up($packer, $tmp . '/note.png', 'doc_photo', 'ورقة.png', 'image/png');
ok('a packer (returns permission) can attach the paper photo of a return', $s === 201, $j);

// ================= preflight and logs
$checks = Femini\Preflight::run(false);
$names = array_column($checks, 1, 0);
ok('the preflight check runs and sees the database', ($names['الاتصال بقاعدة البيانات'] ?? '') === 'ok' && ($names['محرك InnoDB (transactions)'] ?? '') === 'ok', $names);
$log = (string)@file_get_contents($tmp . '/server.log');
ok('the server log has no PHP warnings, notices or deprecations', !preg_match('/(Warning|Notice|Deprecated|Fatal error)/', $log), substr($log, -600));

// ================= review fixes: actors, read-only accounts, admin-only actions, move validation, thumbnails
$revNow = static fn() => (int)Database::value('SELECT rev FROM sync_state');
// the actor of a move is the signed-in user, whatever the browser says
$midNext = (int)Database::value('SELECT MAX(id) FROM moves') + 1;
[$s, $j] = $packer->call('POST', '/api/sync/push', ['since' => $revNow(), 'moves' => [array_merge(mv($midNext), ['by' => 'FORGED NAME'])], 'meta' => ['mid' => $midNext + 1]]);
ok('a move pushed with a forged author is accepted but stamped with the real user', $s === 200 && Database::value('SELECT by_name FROM moves WHERE id = ?', [$midNext]) === 'موظف شحن', $j);
// documents cannot be filed under somebody else's name
$forged = ['id' => 'd77', 'type' => 'CLN', 'status' => 'draft', 'no' => null, 'date' => date('Y-m-d'), 'by' => 'المدير', 'hdr' => [], 'lines' => [], 'log' => []];
[$s, $j] = $sup->call('POST', '/api/sync/push', ['since' => $revNow(), 'coll' => ['docs' => ['up' => [$forged]]]]);
ok('a document created in somebody else\'s name is refused (403 forged_actor)', $s === 403 && $j['error'] === 'forged_actor', $j);
// correcting the employee on a confirmed scan sheet still works (the app lets you do it), editing its lines does not
$scn = ['id' => 'd78', 'type' => 'SCN', 'status' => 'done', 'no' => 'SCN-0078', 'date' => date('Y-m-d'), 'by' => 'مشرف', 'hdr' => ['emp' => 'عبدالله', 'refs' => []], 'lines' => [], 'log' => []];
[$s, $j] = $sup->call('POST', '/api/sync/push', ['since' => $revNow(), 'coll' => ['docs' => ['up' => [$scn]]]]);
ok('a scan document is confirmed', $s === 200, $j);
$renamed = $scn;
$renamed['hdr']['emp'] = 'محمود';
$renamed['log'][] = ['m' => 'اتغيّر اسم الموظف'];
[$s, $j] = $sup->call('POST', '/api/sync/push', ['since' => $revNow(), 'coll' => ['docs' => ['up' => [$renamed]]]]);
ok('the employee name on a confirmed scan sheet can still be corrected', $s === 200, $j);
// read-only accounts cannot write anything
$admin->call('POST', '/api/users', ['username' => 'viewer1', 'name' => 'مراجع', 'role' => 'view', 'password' => 'Viewer-Cactus-64']);
$viewer = new Client($port);
$viewer->login('viewer1', 'Viewer-Cactus-64');
[$s, $j] = $viewer->call('POST', '/api/sync/push', ['since' => $revNow(), 'coll' => ['emps' => ['up' => ['x']]], 'audit' => [['t' => 1, 'm' => 'spam']]]);
ok('a read-only (view) account cannot push anything (403)', $s === 403 && $j['error'] === 'read_only', $j);
[$s, $j] = $up($viewer, $tmp . '/note.png', 'doc_photo', 'v.png', 'image/png');
ok('and cannot upload files (403)', $s === 403, $j);
[$s] = $viewer->call('GET', '/api/sync/pull?since=0');
ok('but it can read', $s === 200);
[$s, $j] = $up($sup, $tmp . '/note.png', 'other', 'v.png', 'image/png');
ok('the anonymous "other" upload kind no longer exists (422)', $s === 422, $j);
// logins are only visible to people who manage users
[$s, $j] = $packer->call('GET', '/api/sync/pull?since=0');
ok('a packer does not receive other people\'s login names', $s === 200 && !array_filter($j['users'], static fn($u) => isset($u['username'])), $j['users'][0] ?? null);
[$s, $j] = $admin->call('GET', '/api/sync/pull?since=0');
ok('an admin does', $s === 200 && isset($j['users'][0]['username']));
// move validation
foreach ([['sku', 'bad sku!'], ['sku', str_repeat('A', 41)], ['q', 5000000], ['id', 0]] as [$field, $value]) {
    $bad = mv($midNext + 5);
    $bad[$field] = $value;
    [$s] = $packer->call('POST', '/api/sync/push', ['since' => $revNow(), 'moves' => [$bad]]);
    ok("a move with a bad $field is refused (422)", $s === 422, $s);
}
// the "users" permission is not enough to become admin
$admin->call('PUT', '/api/roles/sup', ['perms' => ['scan', 'returns', 'users']]);
$adminId = (string)Database::value("SELECT id FROM users WHERE username = 'admin'");
$supId = (string)Database::value("SELECT id FROM users WHERE username = 'sup'");
[$s, $j] = $sup->call('PATCH', "/api/users/$supId", ['role' => 'admin']);
ok('a user manager cannot promote themselves to admin (403)', $s === 403 && $j['error'] === 'admin_only', $j);
[$s, $j] = $sup->call('POST', "/api/users/$adminId/password", ['password' => 'Takeover-Walrus-19']);
ok('nor reset the admin\'s password (403)', $s === 403 && $j['error'] === 'admin_only', $j);
[$s, $j] = $sup->call('PATCH', "/api/users/$adminId", ['active' => false]);
ok('nor disable the admin (403)', $s === 403, $j);
[$s, $j] = $sup->call('PUT', '/api/roles/pack', ['perms' => ['scan', 'returns', 'close']]);
ok('nor edit what roles can do (403)', $s === 403 && $j['error'] === 'admin_only', $j);
[$s, $j] = $sup->call('POST', '/api/users', ['username' => 'madebysup', 'name' => 'اتعمل', 'role' => 'admin', 'password' => 'Sneaky-Admin-Role-23']);
ok('nor create a new admin (403)', $s === 403, $j);
[$s, $j] = $sup->call('POST', '/api/users', ['username' => 'madebysup', 'name' => 'اتعمل', 'role' => 'pack', 'password' => 'Honest-Packer-Role-23']);
ok('but can create ordinary users (that is what the permission is for)', $s === 201, $j);
$admin->call('PUT', '/api/roles/sup', ['perms' => ['scan', 'returns', 'receive', 'internal', 'ship', 'count', 'pickup', 'cancel', 'catalog', 'supplies', 'close']]);
[$s, $j] = $admin->call('PATCH', "/api/users/$supId", ['name' => '   ']);
ok('a blank name is refused (422)', $s === 422, $j);
// thumbnails: a huge image must not crash the server (the original is kept, no display copy)
$w = 30000; $h = 30000;
$ihdr = pack('N', $w) . pack('N', $h) . "\x08\x00\x00\x00\x00";
$chunk = static fn(string $type, string $data) => pack('N', strlen($data)) . $type . $data . pack('N', crc32($type . $data));
file_put_contents($tmp . '/huge.png', "\x89PNG\r\n\x1a\n" . $chunk('IHDR', $ihdr) . $chunk('IDAT', gzcompress(str_repeat("\x00", 64))) . $chunk('IEND', ''));
[$s, $j] = $up($sup, $tmp . '/huge.png', 'doc_photo', 'huge.png', 'image/png');
ok('a gigantic image is stored without a display copy instead of crashing the server', $s === 201 && $j['file']['hasThumb'] === false, $j);
[$s, $body, $raw] = $sup->call('GET', '/api/files/' . ($j['file']['id'] ?? 0));
ok('and the original is still downloadable', $s === 200 && str_starts_with($raw, "\x89PNG"), $s);

// a phone photo taken in portrait carries EXIF "rotate 90°": the display copy must come out upright
if (function_exists('exif_read_data')) {
    $im = imagecreatetruecolor(40, 20);
    imagefill($im, 0, 0, imagecolorallocate($im, 200, 30, 30));
    ob_start();
    imagejpeg($im);
    $jpg = (string)ob_get_clean();
    $tiff = "II*\x00\x08\x00\x00\x00" . pack('v', 1) . pack('v', 0x0112) . pack('v', 3) . pack('V', 1) . pack('v', 6) . "\x00\x00" . pack('V', 0);
    $app1 = "\xFF\xE1" . pack('n', 2 + 6 + strlen($tiff)) . "Exif\x00\x00" . $tiff;
    file_put_contents($tmp . '/portrait.jpg', substr($jpg, 0, 2) . $app1 . substr($jpg, 2));
    [$s, $j] = $up($sup, $tmp . '/portrait.jpg', 'doc_photo', 'portrait.jpg', 'image/jpeg');
    [$s2, $b2, $raw2] = $sup->call('GET', '/api/files/' . ($j['file']['id'] ?? 0) . '?thumb=1');
    $dim = @getimagesizefromstring($raw2);
    ok('an EXIF-rotated phone photo gets an upright display copy (40x20 landscape → 20x40)', $s === 201 && $dim !== false && $dim[0] === 20 && $dim[1] === 40, $dim);
} else {
    echo "SKIP exif orientation test (exif extension missing)\n";
}

// ================= snapshot
$u = Femini\Auth\Auth::class;
$snap = Femini\Sync\Snapshot::build(['id' => $adminId, 'name' => 'المدير', 'perms' => ['*']]);
$S = $snap['state'];
ok('snapshot has the app state shape', $S['v'] === 3 && count($S['orders']) === 3 && $S['mid'] >= 9 && $S['roles']['admin']['perms'] && count($S['users']) >= 3 && $S['cur'] === $adminId && $S['lock'] === $yesterday && !$snap['empty'], array_keys($S));
ok('snapshot never contains password hashes', !str_contains(json_encode($S), '$2y$') && !str_contains(json_encode($S), 'pass_hash'));
ok('archived docs are not in the snapshot', !in_array('d2', array_column($S['docs'], 'id'), true));


// ================= moves belong to documents (round 2)
$packer->autoDoc = false;
$nid = (int)Database::value('SELECT MAX(id) FROM moves') + 1;
$m1 = mv($nid, 'SCN');
$m1['doc'] = 'SCN-0900';
[$s, $j] = $packer->call('POST', '/api/sync/push', ['since' => $revNow(), 'moves' => [$m1], 'meta' => ['mid' => $nid + 1]]);
ok('a stock move with no document behind it is refused (409 orphan_moves)', $s === 409 && $j['error'] === 'orphan_moves', $j);
ok('and nothing was written', (int)Database::value('SELECT COUNT(*) FROM moves WHERE id = ?', [$nid]) === 0);
$d900 = ['id' => 'd900', 'type' => 'SCN', 'status' => 'done', 'no' => 'SCN-0900', 'date' => date('Y-m-d'), 'by' => 'موظف شحن', 'hdr' => ['emp' => 'e', 'refs' => []], 'lines' => [], 'log' => [], 'nMoves' => 2];
[$s, $j] = $packer->call('POST', '/api/sync/push', ['since' => $revNow(), 'moves' => [$m1], 'coll' => ['docs' => ['up' => [$d900]]], 'meta' => ['mid' => $nid + 1]]);
ok('a document that declares 2 moves but arrives with 1 is refused', $s === 409 && $j['error'] === 'orphan_moves', $j);
$d900['nMoves'] = 1;
[$s, $j] = $packer->call('POST', '/api/sync/push', ['since' => $revNow(), 'moves' => [$m1], 'coll' => ['docs' => ['up' => [$d900]]], 'meta' => ['mid' => $nid + 1]]);
ok('the same move together with its confirmed document is accepted', $s === 200, $j);
$m2 = mv($nid + 1, 'SCN');
$m2['doc'] = 'SCN-0900';
[$s, $j] = $packer->call('POST', '/api/sync/push', ['since' => $revNow(), 'moves' => [$m2], 'meta' => ['mid' => $nid + 2]]);
ok('later moves cannot be added to an already confirmed document', $s === 409 && $j['error'] === 'orphan_moves', $j);
// small rows: the "by" of a log entry is the signed-in user
[$s, $j] = $sup->call('POST', '/api/sync/push', ['since' => $revNow(), 'coll' => ['sup_log' => ['up' => [['id' => 'lg-forge', 'by' => 'المدير', 'item' => 'FLY', 'q' => 1, 'kind' => 'man']]]]]);
ok('a supply-log entry written in the admin\'s name is refused', $s === 403 && $j['error'] === 'forged_actor', $j);
$packer->autoDoc = true;

// ================= review fixes: reversal mirrors the document, costs stay server-side, counters cannot explode
$packer->autoDoc = false;
$nid2 = (int)Database::value('SELECT MAX(id) FROM moves') + 1;
$d900r = $d900;
$d900r['status'] = 'reversed';
$bad = mv($nid2, 'SCN', 'BR2-BLK-L', 1, 'READY', 'EXT_CH');   // same direction as the original, not its opposite
$bad['doc'] = 'SCN-0900 (عكس)';
[$s, $j] = $packer->call('POST', '/api/sync/push', ['since' => $revNow(), 'moves' => [$bad], 'coll' => ['docs' => ['up' => [$d900r]]], 'meta' => ['mid' => $nid2 + 1]]);
ok('a reversal that is not the opposite of the document\'s own move is refused (409 orphan_moves)', $s === 409 && $j['error'] === 'orphan_moves', $j);
ok('and the document stays confirmed', Database::value("SELECT status FROM docs WHERE doc_no = 'SCN-0900'") === 'done');
$good = mv($nid2, 'SCN', 'BR2-BLK-L', 1, 'EXT_CH', 'READY');
$good['doc'] = 'SCN-0900 (عكس)';
[$s, $j] = $packer->call('POST', '/api/sync/push', ['since' => $revNow(), 'moves' => [$good], 'coll' => ['docs' => ['up' => [$d900r]]], 'meta' => ['mid' => $nid2 + 1]]);
ok('the exact opposite move reverses the document', $s === 200 && Database::value("SELECT status FROM docs WHERE doc_no = 'SCN-0900'") === 'reversed', $j);
$packer->autoDoc = true;

// a move type only moves pieces between its own places
$packer->autoDoc = false;
$nid3 = (int)Database::value('SELECT MAX(id) FROM moves') + 1;
$mint = mv($nid3, 'SCN', 'BR2-BLK-L', 5, 'EXT_ADJ', 'READY');
[$s, $j] = $packer->call('POST', '/api/sync/push', ['since' => $revNow(), 'moves' => [$mint], 'meta' => ['mid' => $nid3 + 1]]);
ok('a scan cannot take pieces from "adjustment" into READY (422)', $s === 422 && $j['error'] === 'bad_move', $j);
$packer->autoDoc = true;

[$s, $j] = $admin->call('POST', '/api/sync/push', ['since' => $revNow(), 'meta' => ['costs' => ['BR2' => ['cost' => 10, 'price' => 25]]]]);
ok('admin saves model costs', $s === 200, $j);
[$s, $j] = $admin->call('GET', '/api/sync/pull?since=0');
ok('admin receives the costs', isset($j['meta']['costs']), array_keys($j['meta'] ?? []));
[$s, $j] = $packer->call('GET', '/api/sync/pull?since=0');
ok('a packer never receives the costs', $s === 200 && !isset($j['meta']['costs']), array_keys($j['meta'] ?? []));
$packerSnap = Femini\Sync\Snapshot::build(['id' => 'x', 'name' => 'x', 'perms' => ['scan', 'returns']]);
ok('nor in the page snapshot', $packerSnap['state']['costs'] == new stdClass(), $packerSnap['state']['costs']);

[$s, $j] = $packer->call('POST', '/api/sync/push', ['since' => $revNow(), 'meta' => ['mid' => 9000000000000000]]);
ok('a counter cannot be pushed to a huge value (422 counter_jump)', $s === 422 && $j['error'] === 'counter_jump', $j);

echo "\n$pass passed, $fail failed\n";
exit($fail ? 1 : 0);
