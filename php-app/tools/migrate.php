<?php
declare(strict_types=1);

/** CLI: php tools/migrate.php   — creates / updates the database tables. Safe to run repeatedly. */
require dirname(__DIR__) . '/app/bootstrap.php';

use Femini\Auth\UserRepository;
use Femini\Migrator;

$applied = Migrator::run(dirname(__DIR__) . '/sql');
UserRepository::ensureDefaultRoles();
echo $applied ? 'Applied: ' . implode(', ', $applied) . "\n" : "Database is up to date.\n";
