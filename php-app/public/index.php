<?php
declare(strict_types=1);

/**
 * The app page. Signed out: the login form. Signed in: the app with the whole current state embedded,
 * so it starts instantly with real data (no loading step, no localStorage).
 */

require dirname(__DIR__) . '/app/bootstrap.php';

use Femini\Auth\Auth;
use Femini\Auth\UserRepository;
use Femini\Controllers\AuthController;
use Femini\Http\Request;
use Femini\Http\SecurityHeaders;
use Femini\Sync\Snapshot;

$req = Request::fromGlobals();
SecurityHeaders::page($req);

try {
    if (UserRepository::countUsers() === 0) {
        header('Location: install.php');
        exit;
    }
} catch (\Throwable $e) {
    header('Location: install.php');   // tables are not there yet
    exit;
}

Auth::startSession($req);
$user = Auth::user();
if ($user === null) {
    require APP_ROOT . '/views/login.php';
    exit;
}

$snap = Snapshot::build($user);
$boot = [
    'csrf'  => Auth::csrfToken(),
    'rev'   => $snap['rev'],
    'user'  => AuthController::publicUser($user),
    'state' => $snap['state'],
    'empty' => $snap['empty'],
    'files' => \Femini\Files\FileStore::index(0),
];
// Safe to embed inside <script>: no "</script>", no HTML comments, no JS line terminators.
$json = json_encode($boot, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_PARTIAL_OUTPUT_ON_ERROR);
$json = str_replace(["\u{2028}", "\u{2029}"], [' ', ' '], $json);

header('Content-Type: text/html; charset=utf-8');
$app = str_replace('/*__FEMINI_BOOT__*/', 'window.FEM_BOOT=' . $json . ';', (string)file_get_contents(APP_ROOT . '/views/app.html'));
// app.html is a fragment (it was built to be hosted inside an Artifact page): give it a real document around it.
echo '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">'
    . '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
    . '<meta name="robots" content="noindex,nofollow"></head><body>' . $app . '</body></html>';
