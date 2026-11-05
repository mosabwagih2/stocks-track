<?php
declare(strict_types=1);

namespace Femini;

/** Applies sql/NNN_*.sql files once each, in order, and records them in schema_migrations. */
final class Migrator
{
    /** @return array<int,string> names of the migrations applied by this call */
    public static function run(string $dir): array
    {
        $pdo = Database::pdo();
        $pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR(64) NOT NULL PRIMARY KEY, applied_at DATETIME NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

        $done = array_column(Database::all('SELECT version FROM schema_migrations'), 'version');
        $files = glob(rtrim($dir, '/') . '/*.sql') ?: [];
        sort($files);

        $applied = [];
        foreach ($files as $file) {
            $name = basename($file);
            if (in_array($name, $done, true)) {
                continue;
            }
            foreach (self::statements((string)file_get_contents($file)) as $sql) {
                $pdo->exec($sql);   // DDL auto-commits in MySQL, so no wrapping transaction here
            }
            Database::run('INSERT INTO schema_migrations (version, applied_at) VALUES (?, UTC_TIMESTAMP())', [$name]);
            $applied[] = $name;
        }
        return $applied;
    }

    /** Splits a SQL file on ";" at line ends, dropping "--" comment lines. */
    private static function statements(string $sql): array
    {
        $clean = preg_replace('/^\s*--.*$/m', '', $sql) ?? $sql;
        $parts = preg_split('/;\s*(?:\r?\n|$)/', $clean) ?: [];
        return array_values(array_filter(array_map('trim', $parts), static fn($s) => $s !== ''));
    }
}
