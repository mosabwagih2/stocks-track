<?php
declare(strict_types=1);

namespace Femini\Auth;

use Femini\Database;
use Femini\Http\HttpError;

/** Users and roles. Users are archived, never deleted. */
final class UserRepository
{
    public static function ensureDefaultRoles(): void
    {
        foreach (Permissions::DEFAULT_ROLES as $id => $r) {
            Database::run(
                'INSERT IGNORE INTO roles (id, name, perms, rev) VALUES (?,?,?,0)',
                [$id, $r['name'], json_encode($r['perms'])]
            );
        }
    }

    public static function countUsers(): int
    {
        return (int)Database::value('SELECT COUNT(*) FROM users');
    }

    /** @return array<int,array<string,mixed>> without password hashes */
    public static function all(): array
    {
        $rows = Database::all('SELECT id, username, name, role_id, active, arch, (pass_hash IS NOT NULL) AS has_password FROM users ORDER BY created_at, id');
        return array_map(static fn(array $r) => [
            'id' => $r['id'], 'username' => $r['username'], 'name' => $r['name'], 'role' => $r['role_id'],
            'active' => (bool)$r['active'], 'arch' => (bool)$r['arch'], 'hasPassword' => (bool)$r['has_password'],
        ], $rows);
    }

    /** @return array<string,array{name:string,perms:array<int,string>}> */
    public static function roles(): array
    {
        $out = [];
        foreach (Database::all('SELECT id, name, perms FROM roles ORDER BY id') as $r) {
            $out[$r['id']] = ['name' => $r['name'], 'perms' => json_decode($r['perms'], true) ?: []];
        }
        return $out;
    }

    public static function create(string $username, string $name, string $roleId, ?string $password): string
    {
        $username = trim($username);
        if (!preg_match('/^[A-Za-z0-9_.@-]{3,60}$/', $username)) {
            throw new HttpError(422, 'bad_username', 'اسم المستخدم 3 إلى 60 حرف إنجليزي أو أرقام.');
        }
        if (trim($name) === '') {
            throw new HttpError(422, 'bad_name', 'اكتب الاسم.');
        }
        if (Database::value('SELECT 1 FROM roles WHERE id = ?', [$roleId]) === null) {
            throw new HttpError(422, 'bad_role', 'الدور مش موجود.');
        }
        if (Database::value('SELECT 1 FROM users WHERE username = ?', [$username]) !== null) {
            throw new HttpError(409, 'username_taken', 'اسم المستخدم مستخدم قبل كده.');
        }
        if ($password !== null) {
            Passwords::validate($password, $username);
        }
        $id = 'u' . bin2hex(random_bytes(5));
        Database::run(
            'INSERT INTO users (id, username, name, role_id, pass_hash, active, arch, created_at) VALUES (?,?,?,?,?,1,0,UTC_TIMESTAMP())',
            [$id, $username, trim($name), $roleId, $password === null ? null : Passwords::hash($password)]
        );
        return $id;
    }

    public static function update(string $id, array $patch): void
    {
        Database::transaction(static function () use ($id, $patch): void {
            $u = Database::one('SELECT id, role_id, active, arch FROM users WHERE id = ?', [$id]);
            if ($u === null) {
                throw new HttpError(404, 'not_found', 'المستخدم مش موجود.');
            }
            $sets = [];
            $args = [];
            foreach (['name' => 'name', 'role' => 'role_id'] as $in => $col) {
                if (array_key_exists($in, $patch)) {
                    $sets[] = "$col = ?";
                    $args[] = trim((string)$patch[$in]);
                }
            }
            foreach (['active', 'arch'] as $flag) {
                if (array_key_exists($flag, $patch)) {
                    $sets[] = "$flag = ?";
                    $args[] = $patch[$flag] ? 1 : 0;
                }
            }
            if (isset($patch['role']) && Database::value('SELECT 1 FROM roles WHERE id = ?', [$patch['role']]) === null) {
                throw new HttpError(422, 'bad_role', 'الدور مش موجود.');
            }
            if ($sets) {
                $args[] = $id;
                Database::run('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?', $args);
            }
            if (self::activeAdmins() < 1) {
                throw new HttpError(409, 'last_admin', 'لازم يفضل مدير واحد شغّال على الأقل.');
            }
        });
    }

    /** Sets a new password and ends every other session of that user (pw_version). Returns the new version. */
    public static function setPassword(string $id, string $password): int
    {
        $u = Database::one('SELECT username FROM users WHERE id = ?', [$id]);
        if ($u === null) {
            throw new HttpError(404, 'not_found', 'المستخدم مش موجود.');
        }
        Passwords::validate($password, $u['username']);
        Database::run('UPDATE users SET pass_hash = ?, pw_version = pw_version + 1 WHERE id = ?', [Passwords::hash($password), $id]);
        return (int)Database::value('SELECT pw_version FROM users WHERE id = ?', [$id]);
    }

    public static function checkPassword(string $id, string $password): bool
    {
        $hash = Database::value('SELECT pass_hash FROM users WHERE id = ?', [$id]);
        return is_string($hash) && password_verify($password, $hash);
    }

    /** Replaces the permissions of a role. The admin role is fixed. */
    public static function setRolePerms(string $roleId, array $perms): void
    {
        if ($roleId === 'admin') {
            throw new HttpError(409, 'admin_fixed', 'صلاحيات المدير ثابتة.');
        }
        if (Database::value('SELECT 1 FROM roles WHERE id = ?', [$roleId]) === null) {
            throw new HttpError(404, 'not_found', 'الدور مش موجود.');
        }
        $clean = [];
        foreach ($perms as $p) {
            if (!is_string($p) || !array_key_exists($p, Permissions::ALL)) {
                throw new HttpError(422, 'bad_perm', 'صلاحية غير معروفة.');
            }
            $clean[$p] = true;
        }
        Database::run('UPDATE roles SET perms = ? WHERE id = ?', [json_encode(array_keys($clean)), $roleId]);
    }

    private static function activeAdmins(): int
    {
        $n = 0;
        foreach (Database::all('SELECT r.perms FROM users u JOIN roles r ON r.id = u.role_id WHERE u.active = 1 AND u.arch = 0 AND u.pass_hash IS NOT NULL') as $r) {
            if (in_array('*', json_decode($r['perms'], true) ?: [], true)) {
                $n++;
            }
        }
        return $n;
    }
}
