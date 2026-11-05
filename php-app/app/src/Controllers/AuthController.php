<?php
declare(strict_types=1);

namespace Femini\Controllers;

use Femini\Auth\Auth;
use Femini\Http\HttpError;
use Femini\Http\Request;
use Femini\Http\Response;

final class AuthController
{
    public static function login(Request $req): never
    {
        $b = $req->json();
        $user = Auth::login($req, (string)($b['username'] ?? ''), (string)($b['password'] ?? ''));
        Response::json(['ok' => true, 'user' => self::publicUser($user), 'csrf' => Auth::csrfToken()]);
    }

    public static function logout(Request $req): never
    {
        Auth::logout();
        Response::json(['ok' => true]);
    }

    public static function me(Request $req): never
    {
        $u = Auth::user();
        if ($u === null) {
            throw new HttpError(401, 'unauthenticated', 'مش مسجّل دخول.');
        }
        Response::json(['ok' => true, 'user' => self::publicUser($u), 'csrf' => Auth::csrfToken()]);
    }

    public static function publicUser(array $u): array
    {
        return ['id' => $u['id'], 'username' => $u['username'], 'name' => $u['name'], 'role' => $u['role'], 'perms' => $u['perms']];
    }
}
