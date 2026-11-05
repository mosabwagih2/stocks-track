<?php
/**
 * Copy this file to config.php and fill in the values from cPanel
 * (MySQL Databases: create a database, a user, and add the user to the database).
 * NEVER commit config.php and never expose it through the web server.
 */
return [
    'db' => [
        'host'    => 'localhost',
        'port'    => 3306,
        'name'    => 'cpaneluser_femini',
        'user'    => 'cpaneluser_femini',
        'pass'    => 'CHANGE_ME',
        'charset' => 'utf8mb4',
    ],
    'app' => [
        'timezone'     => 'Africa/Cairo',
        // Files (original uploads) are stored here. Keep it OUTSIDE public_html.
        'storage_path' => dirname(__DIR__) . '/storage',
        // Max upload size in bytes (also limited by PHP upload_max_filesize / post_max_size).
        'max_upload'   => 20 * 1024 * 1024,
        // The web installer (public/install.php) refuses to run without this key. Delete the installer afterwards.
        'install_key'  => 'CHANGE_ME_TO_A_LONG_RANDOM_STRING',
        // Only if the site sits behind a proxy/CDN: the server variable holding the real client IP (e.g. 'HTTP_CF_CONNECTING_IP').
        // Leave null when visitors reach the server directly.
        'proxy_header' => null,
        'debug'        => false,
    ],
];
