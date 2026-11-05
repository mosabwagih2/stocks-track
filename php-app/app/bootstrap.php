<?php
declare(strict_types=1);

/**
 * Loads configuration and registers the class autoloader.
 * Every entry point (public/api/index.php, public/index.php, tools/*.php, tests) starts here.
 */

define('APP_ROOT', __DIR__);

spl_autoload_register(static function (string $class): void {
    $prefix = 'Femini\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;
    }
    $file = APP_ROOT . '/src/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

/** Where config.php lives: FEMINI_CONFIG env var (handy for tests) or ../config/config.php. */
function femini_config_path(): string
{
    $env = getenv('FEMINI_CONFIG');
    return $env !== false && $env !== '' ? $env : dirname(APP_ROOT) . '/config/config.php';
}

$configFile = femini_config_path();
if (!is_file($configFile)) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    exit("config.php missing. Copy config/config.example.php to config/config.php and fill it in.\n");
}

\Femini\Config::load(require $configFile);
date_default_timezone_set(\Femini\Config::get('app.timezone', 'Africa/Cairo'));
// Never print PHP errors to visitors (they leak paths); they go to the server error log instead.
ini_set('display_errors', \Femini\Config::get('app.debug', false) ? '1' : '0');
ini_set('log_errors', '1');
