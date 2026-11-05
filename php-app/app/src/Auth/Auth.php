<?php
declare(strict_types=1);

namespace Femini\Auth;

use Femini\Database;
use Femini\Http\HttpError;
use Femini\Http\Request;

/**
 * Session login, CSRF token and brute-force protection.
 * The session only stores the user id; the user and the role's permissions are re-read from the
 * database on every request, so disabling a user or changing a role takes effect immediately.
 */
final class Auth
{
    private const MAX_FAILURES = 5;      // per username or per IP
    private const WINDOW_MINUTES = 15;
    private const IDLE_SECONDS = 12 * 3600;        // signed out after 12 hours without a request
    private const ABSOLUTE_SECONDS = 7 * 86400;    // and always after 7 days

    public static function startSession(Request $req): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.gc_maxlifetime', (string)self::ABSOLUTE_SECONDS);
        session_name('femini');
        session_set_cookie_params([
            'lifetime' => 0,
            'path'     => '/',
            'secure'   => $req->isHttps(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
    }

    /** @return array{id:string,username:string,name:string,role:string,perms:array<int,string>}|null */
    public static function user(): ?array
    {
        $id = $_SESSION['uid'] ?? null;
        if (!is_string($id)) {
            return null;
        }
        $now = time();
        if ($now - (int)($_SESSION['seen'] ?? 0) > self::IDLE_SECONDS || $now - (int)($_SESSION['born'] ?? 0) > self::ABSOLUTE_SECONDS) {
            self::logout();
            return null;
        }
        $row = Database::one(
            'SELECT u.id, u.username, u.name, u.role_id, u.active, u.arch, u.pw_version, r.perms
               FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?',
            [$id]
        );
        // A disabled/archived user, or a password change, ends the session on the very next request.
        if ($row === null || !(int)$row['active'] || (int)$row['arch'] || (int)$row['pw_version'] !== (int)($_SESSION['pwv'] ?? -1)) {
            self::logout();
            return null;
        }
        $_SESSION['seen'] = $now;
        return [
            'id' => $row['id'], 'username' => $row['username'], 'name' => $row['name'],
            'role' => $row['role_id'], 'perms' => json_decode($row['perms'], true) ?: [],
        ];
    }

    public static function requireUser(): array
    {
        $u = self::user();
        if ($u === null) {
            throw new HttpError(401, 'unauthenticated', 'لازم تسجّل دخول.');
        }
        return $u;
    }

    public static function requirePermission(array $user, string $perm): void
    {
        if (!Permissions::can($user, $perm)) {
            throw new HttpError(403, 'forbidden', 'دورك مش بيسمح بالإجراء ده.', ['needs' => $perm]);
        }
    }

    public static function csrfToken(): string
    {
        if (empty($_SESSION['csrf'])) {
            $_SESSION['csrf'] = bin2hex(random_bytes(24));
        }
        return $_SESSION['csrf'];
    }

    /** A browser always sends Origin on cross-site writes; if it is present it must be this site. */
    public static function checkOrigin(Request $req): void
    {
        if (in_array($req->method, ['GET', 'HEAD', 'OPTIONS'], true)) {
            return;
        }
        $origin = $req->header('Origin');
        if ($origin === null || $origin === '' || $origin === 'null') {
            return;
        }
        $host = parse_url($origin, PHP_URL_HOST) . (($p = parse_url($origin, PHP_URL_PORT)) ? ':' . $p : '');
        if (!hash_equals(strtolower((string)$req->header('Host')), strtolower($host))) {
            throw new HttpError(403, 'bad_origin', 'الطلب جاي من موقع تاني.');
        }
    }

    /** Every state-changing request must carry the session's CSRF token. */
    public static function checkCsrf(Request $req): void
    {
        if (in_array($req->method, ['GET', 'HEAD', 'OPTIONS'], true)) {
            return;
        }
        $sent = $req->header('X-CSRF-Token') ?? '';
        $have = $_SESSION['csrf'] ?? '';
        if ($have === '' || !hash_equals($have, $sent)) {
            throw new HttpError(403, 'bad_csrf', 'الجلسة منتهية. حدّث الصفحة.');
        }
    }

    public static function login(Request $req, string $username, string $password): array
    {
        $username = trim($username);
        $ip = $req->ip();
        Database::run('DELETE FROM login_attempts WHERE at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)');   // keep the table small
        self::assertNotLocked($username, $ip);

        $row = Database::one('SELECT id, pass_hash, pw_version, active, arch FROM users WHERE username = ?', [$username]);
        // Always run a hash check (against a dummy when the user is unknown) so timing does not reveal valid usernames.
        $hash = $row['pass_hash'] ?? Passwords::hash('timing-dummy');
        $valid = $row !== null && $row['pass_hash'] !== null && password_verify($password, $hash)
            && (int)$row['active'] === 1 && (int)$row['arch'] === 0;
        if (!$valid && $row === null) {
            password_verify($password, $hash);
        }

        Database::run('INSERT INTO login_attempts (username, ip, ok, at) VALUES (?,?,?,UTC_TIMESTAMP())', [$username, $ip, $valid ? 1 : 0]);
        if (!$valid) {
            throw new HttpError(401, 'bad_credentials', 'اسم المستخدم أو كلمة السر غلط.');
        }
        if (Passwords::needsRehash($hash)) {
            Database::run('UPDATE users SET pass_hash = ? WHERE id = ?', [Passwords::hash($password), $row['id']]);
        }
        session_regenerate_id(true);
        self::bindSession($row['id'], (int)$row['pw_version']);
        unset($_SESSION['csrf']);
        return self::user() ?? throw new HttpError(401, 'bad_credentials', 'اسم المستخدم أو كلمة السر غلط.');
    }

    /** Marks the session as belonging to a user at a given password version. */
    public static function bindSession(string $userId, int $pwVersion): void
    {
        $_SESSION['uid'] = $userId;
        $_SESSION['pwv'] = $pwVersion;
        $_SESSION['born'] = time();
        $_SESSION['seen'] = time();
    }

    public static function logout(): void
    {
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }
    }

    private static function assertNotLocked(string $username, string $ip): void
    {
        $since = sprintf('DATE_SUB(UTC_TIMESTAMP(), INTERVAL %d MINUTE)', self::WINDOW_MINUTES);
        $byUser = (int)Database::value("SELECT COUNT(*) FROM login_attempts WHERE username = ? AND ok = 0 AND at > $since", [$username]);
        $byIp = (int)Database::value("SELECT COUNT(*) FROM login_attempts WHERE ip = ? AND ok = 0 AND at > $since", [$ip]);
        if ($byUser >= self::MAX_FAILURES || $byIp >= self::MAX_FAILURES * 3) {
            throw new HttpError(429, 'too_many_attempts', 'محاولات كتير غلط. جرّب بعد ' . self::WINDOW_MINUTES . ' دقيقة.');
        }
    }

}
