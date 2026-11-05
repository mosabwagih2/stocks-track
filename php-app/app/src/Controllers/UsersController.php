<?php
declare(strict_types=1);

namespace Femini\Controllers;

use Femini\Auth\Auth;
use Femini\Auth\UserRepository;
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

    public static function password(Request $req, array $p): never
    {
        $me = Auth::requireUser();
        if ($me['id'] !== $p['id']) {
            Auth::requirePermission($me, 'users');
        }
        UserRepository::setPassword($p['id'], (string)($req->json()['password'] ?? ''));
        Response::json(['ok' => true]);
    }
}
