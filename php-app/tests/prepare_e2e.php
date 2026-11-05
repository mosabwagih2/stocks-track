<?php
declare(strict_types=1);

// Resets the test database and creates the users used by tests/e2e.js (no business data: the first admin login initialises it).
require __DIR__ . '/env.php';
femini_test_env();
\Femini\Auth\UserRepository::create('admin', 'المدير', 'admin', 'Qx7-Lunar-Tide-91');
\Femini\Auth\UserRepository::create('packer', 'موظف شحن', 'pack', 'Rb4-Silver-Reed-62');
echo "ready\n";
