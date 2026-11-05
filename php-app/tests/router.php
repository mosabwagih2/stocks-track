<?php
// Router script for PHP's built-in web server (tests only). Apache uses public/.htaccess instead.
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (str_starts_with($path, '/api/')) {
    require dirname(__DIR__) . '/public/api/index.php';
    return true;
}
return false;
