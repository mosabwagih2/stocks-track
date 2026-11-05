<?php
declare(strict_types=1);

namespace Femini\Controllers;

use Femini\Auth\Auth;
use Femini\Auth\UserRepository;
use Femini\Http\HttpError;
use Femini\Http\Request;
use Femini\Http\Response;

/** User administration. Needs the "users" permission. Users are archived, never deleted. */
final class UsersController
{
    public static function index(Request $req): never
    {
        Auth::requirePermission(Auth::requireUser(), 'users');
        Response::json(['ok' => true, 'users' => UserRepository::all(), 'roles' => UserRepository::roles()]);
    }

    public static function create(Request $req): never
    {
        Auth::requirePermission(Auth::requireUser(), 'users');
        $b = $req->json();
        $id = UserRepository::create((string)($b['username'] ?? ''), (string)($b['name'] ?? ''), (string)($b['role'] ?? 'pack'), isset($b['password']) ? (string)$b['password'] : null);
        Response::json(['ok' => true, 'id' => $id], 201);
    }

    public static function update(Request $req, array $p): never
    {
        Auth::requirePermission(Auth::requireUser(), 'users');
        UserRepository::update($p['id'], $req->json());
        Response::json(['ok' => true]);
    }

    /**
     * Own password: the current password is required. Someone else's: needs the "users" permission (admin reset).
     * Every other session of that user ends (the version in the session no longer matches).
     */
    public static function password(Request $req, array $p): never
    {
        $me = Auth::requireUser();
        $b = $req->json();
        $self = $me['id'] === $p['id'];
        if ($self) {
            if (!UserRepository::checkPassword($me['id'], (string)($b['current'] ?? ''))) {
                throw new HttpError(403, 'bad_current', 'كلمة السر الحالية غلط.');
            }
        } else {
            Auth::requirePermission($me, 'users');
        }
        $version = UserRepository::setPassword($p['id'], (string)($b['password'] ?? ''));
        if ($self) {
            $_SESSION['pwv'] = $version;     // keep this browser signed in; all others are signed out
        }
        Response::json(['ok' => true]);
    }

    /** PUT /api/roles/{id} {perms:[...]} */
    public static function role(Request $req, array $p): never
    {
        Auth::requirePermission(Auth::requireUser(), 'users');
        UserRepository::setRolePerms($p['id'], (array)($req->json()['perms'] ?? []));
        Response::json(['ok' => true]);
    }
}
