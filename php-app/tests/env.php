<?php
declare(strict_types=1);

/**
 * Shared test setup: writes a test config, resets the test database and creates the test users.
 * WARNING: drops every table in the test database. Use a throw-away database.
 */
function femini_test_env(): array
{
    $root = dirname(__DIR__);
    $tmp = $root . '/tests/.tmp';
    @mkdir($tmp . '/storage', 0775, true);

    $db = [
        'host' => getenv('FEMINI_TEST_DB_HOST') ?: '127.0.0.1', 'port' => 3306,
        'name' => getenv('FEMINI_TEST_DB_NAME') ?: 'femini_test',
        'user' => getenv('FEMINI_TEST_DB_USER') ?: 'femini', 'pass' => getenv('FEMINI_TEST_DB_PASS') ?: 'femini_pw', 'charset' => 'utf8mb4',
    ];
    file_put_contents($tmp . '/config.php', '<?php return ' . var_export([
        'db' => $db,
        'app' => ['timezone' => 'Africa/Cairo', 'storage_path' => $tmp . '/storage', 'max_upload' => 2 * 1024 * 1024, 'install_key' => 'test', 'debug' => true],
    ], true) . ';');
    putenv('FEMINI_CONFIG=' . $tmp . '/config.php');

    require_once $root . '/app/bootstrap.php';

    $pdo = \Femini\Database::pdo();
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    foreach ($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $t) {
        $pdo->exec("DROP TABLE `$t`");
    }
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
    \Femini\Migrator::run($root . '/sql');
    \Femini\Auth\UserRepository::ensureDefaultRoles();
    return ['root' => $root, 'tmp' => $tmp];
}
