<?php
declare(strict_types=1);

/** CLI: php tools/check.php — environment and security checklist. Exit code 1 if anything is "fail". */
require dirname(__DIR__) . '/app/bootstrap.php';

use Femini\Preflight;

$checks = Preflight::run(false);
$icon = ['ok' => '[ OK ]', 'warn' => '[WARN]', 'fail' => '[FAIL]'];
foreach ($checks as [$name, $status, $detail]) {
    printf("%s %s%s\n", $icon[$status], $name, $detail !== '' ? "  — $detail" : '');
}
$fails = count(array_filter($checks, static fn($c) => $c[1] === 'fail'));
$warns = count(array_filter($checks, static fn($c) => $c[1] === 'warn'));
echo "\n" . ($fails ? "$fails failed" : 'All required checks passed') . ($warns ? ", $warns warning(s)" : '') . "\n";
exit($fails ? 1 : 0);
