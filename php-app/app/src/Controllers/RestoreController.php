<?php
declare(strict_types=1);

namespace Femini\Controllers;

use Femini\Auth\Auth;
use Femini\Auth\Permissions;
use Femini\Http\HttpError;
use Femini\Http\Request;
use Femini\Http\Response;
use Femini\Sync\Restore;

/**
 * Admin only: put the whole stock data back from a full backup file, or back to a safety copy taken before a restore.
 *   POST /api/admin/restore            file "backup"; mode=check → what it holds; mode=run + confirm="استرجاع" → restore
 *   GET  /api/admin/restore/points     the safety copies kept on the server
 *   POST /api/admin/restore/undo       name=<safety copy>, confirm="استرجاع"
 */
final class RestoreController
{
    private const WORD = 'استرجاع';

    public static function restore(Request $req): never
    {
        $user = self::admin();
        $up = $req->files['backup'] ?? null;
        if (!is_array($up)) {
            throw new HttpError(422, 'no_file', 'اختار ملف النسخة الاحتياطية.');
        }
        if (($up['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file($up['tmp_name'] ?? '')) {
            $big = in_array($up['error'] ?? 0, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true);
            throw new HttpError(422, 'upload_failed', $big ? 'الملف أكبر من الحد المسموح على السيرفر (upload_max_filesize).' : 'رفع الملف فشل.');
        }
        @set_time_limit(300);
        $backup = json_decode((string)file_get_contents($up['tmp_name']));
        if (!$backup instanceof \stdClass) {
            throw new HttpError(422, 'not_backup', 'الملف ده مش JSON سليم.');
        }
        if (($_POST['mode'] ?? 'check') !== 'run') {
            Response::json(['ok' => true, 'summary' => Restore::summary($backup)]);
        }
        if (trim((string)($_POST['confirm'] ?? '')) !== self::WORD) {
            throw new HttpError(422, 'confirm', 'للتأكيد اكتب كلمة «استرجاع».');
        }
        $label = basename((string)($up['name'] ?? 'backup.json'));
        Response::json(['ok' => true] + Restore::run($backup, $user, $label));
    }

    public static function points(Request $req): never
    {
        self::admin();
        Response::json(['ok' => true, 'points' => Restore::points()]);
    }

    public static function undo(Request $req): never
    {
        $user = self::admin();
        $body = $req->json();
        if (trim((string)($body['confirm'] ?? '')) !== self::WORD) {
            throw new HttpError(422, 'confirm', 'للتأكيد اكتب كلمة «استرجاع».');
        }
        @set_time_limit(300);
        Response::json(['ok' => true] + Restore::undo((string)($body['name'] ?? ''), $user));
    }

    private static function admin(): array
    {
        $user = Auth::requireUser();
        if (!Permissions::isAdmin($user)) {
            throw new HttpError(403, 'forbidden', 'الاسترجاع للمدير بس.');
        }
        return $user;
    }
}
