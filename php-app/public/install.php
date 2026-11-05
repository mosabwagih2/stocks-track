<?php
declare(strict_types=1);

/**
 * One-time web installer for hosting without SSH.
 *   1. Fill config/config.php (database + a long random `install_key`).
 *   2. Open https://your-domain/install.php, enter the key, create the first admin.
 *   3. DELETE this file from the server.
 * It refuses to run once any user exists, and without a real install_key.
 */

require dirname(__DIR__) . '/app/bootstrap.php';

use Femini\Auth\UserRepository;
use Femini\Config;
use Femini\Database;
use Femini\Http\HttpError;
use Femini\Migrator;

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');

$key = (string)Config::get('app.install_key', '');
$message = '';
$done = false;

function page(string $body): never
{
    echo '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<title>تثبيت Fémini Stock</title><body style="font-family:system-ui,Tahoma,sans-serif;max-width:460px;margin:40px auto;padding:0 16px;line-height:1.8">'
        . $body . '</body></html>';
    exit;
}

if ($key === '' || str_starts_with($key, 'CHANGE_ME') || strlen($key) < 16) {
    page('<h2>المثبّت مقفول</h2><p>اضبط <code>install_key</code> في <code>config/config.php</code> بقيمة عشوائية طويلة (16 حرف على الأقل)، وبعدين حدّث الصفحة.</p>');
}

try {
    $already = Database::pdo()->query("SHOW TABLES LIKE 'users'")->fetchColumn() && UserRepository::countUsers() > 0;
} catch (\Throwable $e) {
    page('<h2>مفيش اتصال بقاعدة البيانات</h2><p>راجع بيانات <code>db</code> في <code>config/config.php</code>.</p>');
}
if ($already) {
    page('<h2>السيستم متثبّت بالفعل</h2><p>امسح الملف <code>install.php</code> من السيرفر، وادخل على <a href="./">التطبيق</a>.</p>');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        if (!hash_equals($key, (string)($_POST['key'] ?? ''))) {
            throw new HttpError(403, 'bad_key', 'مفتاح التثبيت غلط.');
        }
        Migrator::run(APP_ROOT . '/../sql');
        UserRepository::ensureDefaultRoles();
        UserRepository::create((string)($_POST['username'] ?? ''), (string)($_POST['name'] ?? ''), 'admin', (string)($_POST['password'] ?? ''));
        $done = true;
    } catch (HttpError $e) {
        $message = $e->getMessage();
    }
}

if ($done) {
    page('<h2>تم التثبيت ✔</h2><p>اتعمل المدير وجداول قاعدة البيانات.</p><p><b>دلوقتي امسح الملف <code>install.php</code> من السيرفر</b>، وبعدين <a href="./">ادخل على التطبيق</a>.</p>');
}

$e = static fn(string $s) => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
page('<h2>تثبيت Fémini Stock</h2>' . ($message ? '<p style="color:#a3262c">' . $e($message) . '</p>' : '')
    . '<form method="post" autocomplete="off">'
    . '<label>مفتاح التثبيت (من config.php)<br><input name="key" type="password" required style="width:100%;padding:10px"></label><br>'
    . '<label>اسم المدير<br><input name="name" required style="width:100%;padding:10px"></label><br>'
    . '<label>اسم الدخول (إنجليزي)<br><input name="username" required style="width:100%;padding:10px;direction:ltr"></label><br>'
    . '<label>كلمة السر (8 حروف على الأقل)<br><input name="password" type="password" required minlength="8" style="width:100%;padding:10px"></label><br><br>'
    . '<button style="padding:12px 20px">تثبيت</button></form>');
