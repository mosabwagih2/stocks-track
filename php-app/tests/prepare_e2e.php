<?php
declare(strict_types=1);

// Resets the test database and creates the users used by tests/e2e.js (no business data: the first admin login initialises it).
require __DIR__ . '/env.php';
femini_test_env();
\Femini\Auth\UserRepository::create('admin', 'المدير', 'admin', 'admin-pass-1');
\Femini\Auth\UserRepository::create('packer', 'موظف شحن', 'pack', 'packer-pass-1');
echo "ready\n";
