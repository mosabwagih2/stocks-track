<?php
declare(strict_types=1);

namespace Femini\Controllers;

use Femini\Auth\Auth;
use Femini\Auth\Permissions;
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

    /** Managing the admin role, or an admin account, is for admins only (the "users" permission is not enough). */
    private static function guardAdminTarget(array $me, ?string $targetUserId, ?string $newRole): void
    {
        if (Permissions::isAdmin($me)) {
            return;
        }
        if (($newRole !== null && UserRepository::isAdminRole($newRole)) || ($targetUserId !== null && UserRepository::isAdminUser($targetUserId))) {
            throw new HttpError(403, 'admin_only', 'ده للمدير بس.');
        }
    }

    public static function create(Request $req): never
    {
        $me = Auth::requireUser();
        Auth::requirePermission($me, 'users');
        $b = $req->json();
        self::guardAdminTarget($me, null, (string)($b['role'] ?? 'pack'));
        $id = UserRepository::create((string)($b['username'] ?? ''), (string)($b['name'] ?? ''), (string)($b['role'] ?? 'pack'), isset($b['password']) ? (string)$b['password'] : null);
        Response::json(['ok' => true, 'id' => $id], 201);
    }

    public static function update(Request $req, array $p): never
    {
        $me = Auth::requireUser();
        Auth::requirePermission($me, 'users');
        $b = $req->json();
        self::guardAdminTarget($me, $p['id'], isset($b['role']) ? (string)$b['role'] : null);
        UserRepository::update($p['id'], $b);
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
            self::guardAdminTarget($me, $p['id'], null);
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
        $me = Auth::requireUser();
        if (!Permissions::isAdmin($me)) {      // changing what a role may do is an admin decision
            throw new HttpError(403, 'admin_only', 'تعديل صلاحيات الأدوار للمدير بس.');
        }
        UserRepository::setRolePerms($p['id'], (array)($req->json()['perms'] ?? []));
        Response::json(['ok' => true]);
    }
}
