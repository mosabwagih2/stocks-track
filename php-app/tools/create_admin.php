<?php
declare(strict_types=1);

/**
 * CLI: php tools/create_admin.php <username> "<Full name>"
 * Prompts for the password (not echoed) — or reads FEMINI_ADMIN_PASSWORD. Creates the first admin.
 */
require dirname(__DIR__) . '/app/bootstrap.php';

use Femini\Auth\UserRepository;

[$self, $username, $name] = $argv + [null, null, null];
if (!$username || !$name) {
    fwrite(STDERR, "Usage: php tools/create_admin.php <username> \"<Full name>\"\n");
    exit(1);
}
UserRepository::ensureDefaultRoles();
$password = getenv('FEMINI_ADMIN_PASSWORD');
if ($password === false || $password === '') {
    fwrite(STDOUT, 'Password (min 8 chars): ');
    if (stripos(PHP_OS, 'WIN') !== 0) {
        system('stty -echo');
    }
    $password = trim((string)fgets(STDIN));
    if (stripos(PHP_OS, 'WIN') !== 0) {
        system('stty echo');
    }
    fwrite(STDOUT, "\n");
}
$id = UserRepository::create($username, $name, 'admin', $password);
echo "Admin created: $username ($id)\n";
