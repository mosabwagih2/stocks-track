<?php
declare(strict_types=1);

namespace Femini\Auth;

use Femini\Http\HttpError;

/** Password policy and hashing in one place. */
final class Passwords
{
    private const MIN = 4;
    private const MAX_BYTES = 72;    // bcrypt silently ignores anything after 72 bytes, so refuse longer ones instead
    private const COMMON = [
        '12345678', '123456789', '1234567890', '11111111', '00000000', '87654321', 'password', 'password1', 'password123',
        'qwertyui', 'qwertyuiop', '1q2w3e4r', '1qaz2wsx', 'abc12345', 'abcd1234', 'iloveyou', 'admin123', 'admin1234',
        'welcome1', 'letmein1', 'femini123', 'femini2026', 'stock1234', 'warehouse', 'masrmasr', '12341234',
    ];

    /** @throws HttpError with a message the user can act on */
    public static function validate(string $password, ?string $username = null): void
    {
        if (mb_strlen($password) < self::MIN) {
            throw new HttpError(422, 'weak_password', 'كلمة السر لازم تكون 4 حروف أو أرقام على الأقل.');
        }
        if (strlen($password) > self::MAX_BYTES) {
            throw new HttpError(422, 'weak_password', 'كلمة السر طويلة قوي (الحد الأقصى 72 حرف).');
        }
        // kept simple on purpose (owner's choice): only a minimum length; brute force is still stopped by the login lock-out
    }

    public static function hash(string $password): string
    {
        return password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    }

    public static function needsRehash(string $hash): bool
    {
        return password_needs_rehash($hash, PASSWORD_BCRYPT, ['cost' => 12]);
    }
}
