<?php
declare(strict_types=1);

/**
 * API front controller. All /api/* requests land here (see public/.htaccess).
 * Controllers throw HttpError; this file turns every failure into JSON and never leaks internals.
 */

require dirname(__DIR__, 2) . '/app/bootstrap.php';

use Femini\Auth\Auth;
use Femini\Config;
use Femini\Controllers\AuthController;
use Femini\Controllers\FilesController;
use Femini\Controllers\SyncController;
use Femini\Controllers\UsersController;
use Femini\Http\HttpError;
use Femini\Http\Request;
use Femini\Http\Response;
use Femini\Http\Router;
use Femini\Http\SecurityHeaders;

try {
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 64 * 1024 * 1024) {
        throw new HttpError(413, 'too_large', 'الطلب كبير قوي.');
    }
    $req = Request::fromGlobals();
    SecurityHeaders::api($req);
    Auth::startSession($req);

    $router = new Router();
    $router->add('GET',  '/api/health',            static fn() => Response::json(['ok' => true, 'time' => gmdate('c')]));
    $router->add('POST', '/api/auth/login',        [AuthController::class, 'login']);
    $router->add('POST', '/api/auth/logout',       [AuthController::class, 'logout']);
    $router->add('GET',  '/api/auth/me',           [AuthController::class, 'me']);
    $router->add('GET',  '/api/sync/pull',         [SyncController::class, 'pull']);
    $router->add('POST', '/api/sync/push',         [SyncController::class, 'push']);
    $router->add('GET',  '/api/users',             [UsersController::class, 'index']);
    $router->add('POST', '/api/users',             [UsersController::class, 'create']);
    $router->add('PATCH', '/api/users/{id}',       [UsersController::class, 'update']);
    $router->add('POST', '/api/users/{id}/password', [UsersController::class, 'password']);
    $router->add('PUT',  '/api/roles/{id}',        [UsersController::class, 'role']);
    $router->add('POST', '/api/files',             [FilesController::class, 'upload']);
    $router->add('GET',  '/api/files',             [FilesController::class, 'index']);
    $router->add('GET',  '/api/files/{id}',        [FilesController::class, 'download']);

    Auth::checkOrigin($req);
    // Login is the only state-changing endpoint that does not need a session CSRF token yet.
    if ($req->path !== '/api/auth/login') {
        Auth::checkCsrf($req);
    }
    $router->dispatch($req);
} catch (HttpError $e) {
    Response::error($e->status, $e->errorCode, $e->getMessage(), $e->extra);
} catch (\Throwable $e) {
    error_log('[femini] ' . $e::class . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    $msg = Config::get('app.debug', false) ? $e->getMessage() : 'حصل خطأ في السيرفر.';
    Response::error(500, 'server_error', $msg);
}
