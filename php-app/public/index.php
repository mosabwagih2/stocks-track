<?php
declare(strict_types=1);

/**
 * The app page, for every app path (/, /stock, /orders ...: see .htaccess). Signed out: the login form.
 * Signed in: the app with the whole current state embedded, so it starts instantly with real data.
 */

require dirname(__DIR__) . '/app/bootstrap.php';

use Femini\Auth\Auth;
use Femini\Auth\UserRepository;
use Femini\Controllers\AuthController;
use Femini\Http\Request;
use Femini\Http\SecurityHeaders;
use Femini\Sync\Snapshot;

$req = Request::fromGlobals();
$nonce = rtrim(strtr(base64_encode(random_bytes(16)), '+/', '-_'), '=');   // fresh for every response
SecurityHeaders::page($req, $nonce);

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
    'epoch' => $snap['epoch'],   // changes on every restore: the page sends it with each save
    'files' => \Femini\Files\FileStore::index(0),
];
// Safe to embed inside <script>: no "</script>", no HTML comments, no JS line terminators.
$json = json_encode($boot, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR);
$json = str_replace(["\u{2028}", "\u{2029}"], [' ', ' '], $json);

// The app: the static build of lovable-v2 (npm run build:cpanel → public/app/cpanel.html + assets).
// The whole state goes in before the app's script, in an inline block that carries this response's CSP nonce.
$page = @file_get_contents(__DIR__ . '/app/cpanel.html');
if ($page === false) {
    http_response_code(500);
    exit('The app build is missing (public/app/cpanel.html). Run: cd lovable-v2 && npm run build:cpanel');
}
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');   // the page carries the live state and the session's CSRF token
echo str_replace('<!--FEMINI_BOOT-->', '<script nonce="' . $nonce . '">window.FEM_BOOT=' . $json . ';</script>', $page);
