<?php
declare(strict_types=1);

namespace Femini;

/**
 * Environment checks run before and after deployment (tools/check.php and the web installer).
 * Each check is [name, status, detail] with status "ok", "warn" or "fail". A "fail" means the system will not work.
 */
final class Preflight
{
    /** @return array<int,array{0:string,1:string,2:string}> */
    public static function run(bool $viaWeb = false): array
    {
        $out = [];
        $add = static function (string $name, string $status, string $detail = '') use (&$out): void {
            $out[] = [$name, $status, $detail];
        };

        $add('PHP 8.1 أو أحدث', version_compare(PHP_VERSION, '8.1.0', '>=') ? 'ok' : 'fail', PHP_VERSION);
        foreach (['pdo_mysql' => 'fail', 'mbstring' => 'fail', 'fileinfo' => 'fail', 'json' => 'fail', 'gd' => 'warn', 'exif' => 'warn'] as $ext => $level) {
            $why = ['gd' => 'من غيرها مفيش صور مصغّرة', 'exif' => 'من غيرها الصور الطولية من الموبايل ممكن تظهر مقلوبة في النسخة المصغّرة'][$ext] ?? '';
            $add("إضافة PHP: $ext", extension_loaded($ext) ? 'ok' : $level, extension_loaded($ext) ? '' : $why);
        }

        $debug = (bool)Config::get('app.debug', false);
        $add('وضع debug مقفول', $debug ? 'fail' : 'ok', $debug ? 'اقفله: app.debug = false (بيعرض تفاصيل الأخطاء للزوار)' : '');

        $key = (string)Config::get('app.install_key', '');
        $weak = $key === '' || str_starts_with($key, 'CHANGE_ME') || strlen($key) < 16;
        $locked = is_file(self::lockFile());
        $add('مفتاح التثبيت', $weak && !$locked ? 'fail' : 'ok', $weak && !$locked ? 'اضبط app.install_key بقيمة عشوائية 16 حرف أو أكتر' : ($locked ? 'التثبيت اتقفل' : ''));

        // database
        try {
            $pdo = Database::pdo();
            $ver = (string)$pdo->query('SELECT VERSION()')->fetchColumn();
            $add('الاتصال بقاعدة البيانات', 'ok', $viaWeb ? '' : $ver);   // versions and paths are not shown to the public installer page
            $charset = (string)$pdo->query("SELECT DEFAULT_CHARACTER_SET_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE()")->fetchColumn();
            $add('ترميز القاعدة utf8mb4', str_starts_with($charset, 'utf8mb4') ? 'ok' : 'warn', $charset ?: 'غير معروف');
            $packet = (int)$pdo->query("SELECT @@max_allowed_packet")->fetchColumn();
            $add('max_allowed_packet', $packet >= 8 * 1048576 ? 'ok' : 'warn', round($packet / 1048576, 1) . ' MB' . ($packet < 8 * 1048576 ? ' (يُفضّل 8MB+ للصفوف الكبيرة)' : ''));
            $engines = $pdo->query("SELECT ENGINE FROM information_schema.ENGINES WHERE ENGINE = 'InnoDB' AND SUPPORT IN ('YES','DEFAULT')")->fetchColumn();
            $add('محرك InnoDB (transactions)', $engines ? 'ok' : 'fail');
            $tables = array_column($pdo->query('SHOW TABLES')->fetchAll(\PDO::FETCH_NUM), 0);
            $need = ['users', 'roles', 'moves', 'docs', 'orders', 'pickups', 'meta', 'coll_rows', 'audit', 'files', 'sync_state'];
            $missing = array_diff($need, $tables);
            $add('جداول قاعدة البيانات', $missing ? 'warn' : 'ok', $missing ? 'ناقص: ' . implode(', ', $missing) . ' (هتتعمل عند التثبيت)' : 'كاملة');
            if (!$missing) {
                $admins = 0;
                foreach (Database::all('SELECT r.perms FROM users u JOIN roles r ON r.id = u.role_id WHERE u.active = 1 AND u.arch = 0 AND u.pass_hash IS NOT NULL') as $r) {
                    $admins += in_array('*', json_decode($r['perms'], true) ?: [], true) ? 1 : 0;
                }
                $add('فيه مدير شغّال', $admins > 0 ? 'ok' : 'warn', $admins > 0 ? '' : 'هيتعمل عند التثبيت');
            }
        } catch (\Throwable $e) {
            $add('الاتصال بقاعدة البيانات', 'fail', 'راجع بيانات db في config.php');
        }

        // storage
        $storage = rtrim((string)Config::get('app.storage_path', ''), '/');
        $files = $storage . '/files';
        $okDir = $storage !== '' && (is_dir($files) || @mkdir($files, 0750, true)) && is_writable($files);
        $add('فولدر الملفات قابل للكتابة', $okDir ? 'ok' : 'fail', $viaWeb ? '' : $storage);
        $docRootRaw = (string)($_SERVER['DOCUMENT_ROOT'] ?? '');
        $docRoot = $docRootRaw !== '' ? (realpath($docRootRaw) ?: '') : '';   // unknown on the command line
        $real = realpath($storage) ?: $storage;
        $inside = $docRoot !== '' && $real !== '' && str_starts_with($real, $docRoot . DIRECTORY_SEPARATOR);
        $add('الملفات برّه الـ web root', $inside ? 'warn' : 'ok', $inside ? 'الأفضل تنقل storage برّه public_html (الـ .htaccess بيمنع الوصول بس)' : '');

        // upload limits
        $max = (int)Config::get('app.max_upload', 20 * 1048576);
        $ini = min(self::bytes((string)ini_get('upload_max_filesize')), self::bytes((string)ini_get('post_max_size')));
        $add('حد الرفع في PHP', $ini >= $max ? 'ok' : 'warn', 'PHP: ' . round($ini / 1048576) . ' MB، التطبيق: ' . round($max / 1048576) . ' MB' . ($ini < $max ? ' (زوّد upload_max_filesize و post_max_size)' : ''));
        $add('session.save_path قابل للكتابة', is_writable(session_save_path() ?: sys_get_temp_dir()) || is_writable($storage . '/sessions') || is_writable($storage) ? 'ok' : 'fail', $viaWeb ? '' : ($storage . '/sessions'));
        $add('عرض الأخطاء للزوار مقفول', in_array(strtolower((string)ini_get('display_errors')), ['0', '', 'off', 'stderr'], true) ? 'ok' : 'warn');

        if ($viaWeb) {
            $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
            $local = in_array($_SERVER['HTTP_HOST'] ?? '', ['localhost', '127.0.0.1'], true) || str_starts_with($_SERVER['HTTP_HOST'] ?? '', 'localhost:') || str_starts_with($_SERVER['HTTP_HOST'] ?? '', '127.0.0.1:');
            $add('HTTPS', $https || $local ? 'ok' : 'fail', $https ? '' : ($local ? 'localhost' : 'فعّل شهادة SSL (AutoSSL) قبل ما تدخل أي كلمة سر'));
        }
        return $out;
    }

    public static function hasFailure(array $checks): bool
    {
        foreach ($checks as $c) {
            if ($c[1] === 'fail') {
                return true;
            }
        }
        return false;
    }

    public static function lockFile(): string
    {
        return rtrim((string)Config::get('app.storage_path', ''), '/') . '/installed.lock';
    }

    private static function bytes(string $v): int
    {
        $n = (int)$v;
        return match (strtolower(substr(trim($v), -1))) { 'g' => $n << 30, 'm' => $n << 20, 'k' => $n << 10, default => $n };
    }
}
