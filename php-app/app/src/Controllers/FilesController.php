<?php
declare(strict_types=1);

namespace Femini\Controllers;

use Femini\Auth\Auth;
use Femini\Auth\Permissions;
use Femini\Files\FileStore;
use Femini\Http\HttpError;
use Femini\Http\Request;
use Femini\Http\Response;

final class FilesController
{
    /** POST /api/files  (multipart: file, kind, owner_type, owner_id) */
    public static function upload(Request $req): never
    {
        $user = Auth::requireUser();
        $kind = (string)($_POST['kind'] ?? 'other');
        $perms = FileStore::permissionsFor($kind);
        if ($perms && !Permissions::canAny($user, $perms)) {
            throw new HttpError(403, 'forbidden', 'دورك مش بيسمح برفع الملف ده.', ['needs' => $perms[0]]);
        }
        $ownerType = (string)($_POST['owner_type'] ?? '');
        $ownerId = (string)($_POST['owner_id'] ?? '');
        if (!preg_match('/^[a-z_]{1,20}$/', $ownerType) || !preg_match('/^[\w.:@+~-]{1,64}$/u', $ownerId)) {
            throw new HttpError(422, 'bad_owner', 'بيانات صاحب الملف غلط.');
        }
        if (!isset($req->files['file'])) {
            throw new HttpError(422, 'no_file', 'مفيش ملف.');
        }
        $file = FileStore::save($req->files['file'], $kind, $ownerType, $ownerId, $user['id']);
        Response::json(['ok' => true, 'file' => $file], 201);
    }

    /** GET /api/files?owner_type=&owner_id= */
    public static function index(Request $req): never
    {
        Auth::requireUser();
        $t = (string)($req->query['owner_type'] ?? '');
        $i = (string)($req->query['owner_id'] ?? '');
        Response::json(['ok' => true, 'files' => FileStore::forOwner($t, $i)]);
    }

    /** GET /api/files/{id}[?thumb=1] — streams the file after checking the session. */
    public static function download(Request $req, array $p): never
    {
        Auth::requireUser();
        $f = FileStore::find((int)$p['id']);
        if ($f === null) {
            throw new HttpError(404, 'not_found', 'الملف مش موجود.');
        }
        $thumb = !empty($req->query['thumb']) && $f['thumb_path'] !== null;
        $abs = FileStore::absolute($thumb ? $f['thumb_path'] : $f['path']);
        if (!is_file($abs)) {
            throw new HttpError(404, 'missing_on_disk', 'الملف مش موجود على السيرفر.');
        }
        $inline = str_starts_with($f['mime'], 'image/') && $f['mime'] !== 'image/svg+xml';
        header('Content-Type: ' . ($thumb ? 'image/jpeg' : $f['mime']));
        header('Content-Length: ' . filesize($abs));
        header('X-Content-Type-Options: nosniff');
        header("Content-Security-Policy: default-src 'none'; sandbox");
        header('Cache-Control: private, max-age=86400');
        $name = $thumb ? 'thumb.jpg' : $f['orig_name'];
        header('Content-Disposition: ' . ($inline ? 'inline' : 'attachment') . "; filename*=UTF-8''" . rawurlencode($name));
        readfile($abs);
        exit;
    }
}
