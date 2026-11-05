<?php
declare(strict_types=1);

namespace Femini\Files;

use Femini\Config;
use Femini\Database;
use Femini\Http\HttpError;

/**
 * Original uploads live on disk (outside the web root); MySQL keeps only their metadata.
 * Files get random names, are type-checked by content (finfo, not by extension) and are only
 * ever served through the authenticated download endpoint.
 */
final class FileStore
{
    /** Allowed content types => safe extension used for the on-disk name. */
    private const TYPES = [
        'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif',
        'application/pdf' => 'pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
        'application/vnd.ms-excel' => 'xls',
        'text/csv' => 'csv', 'text/plain' => 'csv', 'application/csv' => 'csv',
        'application/zip' => 'zip',   // some xlsx files are reported as zip by finfo
    ];

    /** kind => permission(s) needed to upload it (a list means "any of these"). */
    private const KIND_PERM = [
        'pickup' => ['pickup'], 'scan' => ['scan'], 'cancel' => ['cancel'], 'model_img' => ['catalog'],
        'doc_photo' => ['ship', 'receive', 'internal', 'returns', 'count'],   // the signed paper / photo of a document
    ];

    /** Browser key prefix => [kind, owner type]. The browser addresses a file as "ph:d12", "pk:P3", "dc:d7", "cx:ed4298". */
    public const KEYS = ['ph' => ['doc_photo', 'doc'], 'pk' => ['pickup', 'pickup'], 'dc' => ['scan', 'doc'], 'cx' => ['cancel', 'order']];

    /** @return array<int,string> permissions, any one of which allows the upload */
    public static function permissionsFor(string $kind): array
    {
        if (!array_key_exists($kind, self::KIND_PERM)) {
            throw new HttpError(422, 'bad_kind', 'نوع الملف غير معروف.');
        }
        return self::KIND_PERM[$kind];
    }

    /** The newest file per browser key, for files with id > $sinceId. @return array<int,array<string,mixed>> */
    public static function index(int $sinceId = 0): array
    {
        $byKind = [];
        foreach (self::KEYS as $prefix => [$kind, $ownerType]) {
            $byKind[$kind . '|' . $ownerType] = $prefix;
        }
        $out = [];
        foreach (Database::all('SELECT * FROM files WHERE id > ? ORDER BY id', [$sinceId]) as $r) {
            $prefix = $byKind[$r['kind'] . '|' . $r['owner_type']] ?? null;
            if ($prefix === null) {
                continue;
            }
            $key = $prefix . ':' . $r['owner_id'];
            $out[$key] = self::present($r) + ['key' => $key];   // later rows (higher id) replace earlier ones
        }
        return array_values($out);
    }

    /**
     * Stores a file that arrived as an HTTP upload ($_FILES entry).
     * @return array<string,mixed> the stored file's metadata
     */
    public static function save(array $upload, string $kind, string $ownerType, string $ownerId, string $userId): array
    {
        if (($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file($upload['tmp_name'] ?? '')) {
            throw new HttpError(422, 'upload_failed', 'الرفع فشل. تأكد من حجم الملف.');
        }
        return self::store($upload['tmp_name'], (string)($upload['name'] ?? 'file'), $kind, $ownerType, $ownerId, $userId, true);
    }

    /**
     * Stores a file that already sits on the server's disk (used by tools/import_backup.php).
     * @return array<string,mixed>
     */
    public static function saveLocal(string $path, string $name, string $kind, string $ownerType, string $ownerId, string $userId): array
    {
        return self::store($path, $name, $kind, $ownerType, $ownerId, $userId, false);
    }

    private static function store(string $tmp, string $rawName, string $kind, string $ownerType, string $ownerId, string $userId, bool $uploaded): array
    {
        $max = (int)Config::get('app.max_upload', 20 * 1024 * 1024);
        $size = (int)filesize($tmp);
        if ($size <= 0 || $size > $max) {
            throw new HttpError(413, 'too_large', 'حجم الملف كبير. الحد الأقصى ' . intdiv($max, 1048576) . ' MB.');
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($tmp) ?: 'application/octet-stream';
        $name = self::cleanName($rawName);
        // CSV files are detected as text/plain and xlsx sometimes as zip: for those two cases only, the extension must agree.
        if (($mime === 'text/plain' && !preg_match('/\.csv$/i', $name)) || ($mime === 'application/zip' && !preg_match('/\.xlsx$/i', $name))) {
            throw new HttpError(415, 'bad_type', 'نوع الملف مش مسموح.');
        }
        if (!isset(self::TYPES[$mime])) {
            throw new HttpError(415, 'bad_type', 'نوع الملف مش مسموح.');
        }
        $ext = self::TYPES[$mime];
        $sha = hash_file('sha256', $tmp);

        $same = Database::one('SELECT * FROM files WHERE sha256 = ? AND owner_type = ? AND owner_id = ? AND kind = ?', [$sha, $ownerType, $ownerId, $kind]);
        if ($same !== null) {
            return self::present($same);
        }

        $rel = gmdate('Y/m') . '/' . bin2hex(random_bytes(20)) . '.' . $ext;
        $abs = self::absolute($rel);
        if (!is_dir(dirname($abs)) && !mkdir(dirname($abs), 0750, true) && !is_dir(dirname($abs))) {
            throw new HttpError(500, 'storage_error', 'مش قادر أحفظ الملف.');
        }
        if (!($uploaded ? move_uploaded_file($tmp, $abs) : copy($tmp, $abs))) {
            throw new HttpError(500, 'storage_error', 'مش قادر أحفظ الملف.');
        }
        $thumbRel = str_starts_with($mime, 'image/') && $mime !== 'image/gif' ? self::makeThumb($abs, $rel) : null;

        Database::run(
            'INSERT INTO files (kind, owner_type, owner_id, orig_name, mime, size_bytes, sha256, path, thumb_path, uploaded_by, uploaded_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP())',
            [$kind, $ownerType, $ownerId, $name, $mime, $size, $sha, $rel, $thumbRel, $userId]
        );
        $id = (int)Database::pdo()->lastInsertId();
        return self::present(Database::one('SELECT * FROM files WHERE id = ?', [$id]) ?? []);
    }

    /** @return array<string,mixed>|null */
    public static function find(int $id): ?array
    {
        return Database::one('SELECT * FROM files WHERE id = ?', [$id]);
    }

    /** @return array<int,array<string,mixed>> */
    public static function forOwner(string $ownerType, string $ownerId): array
    {
        return array_map([self::class, 'present'], Database::all(
            'SELECT * FROM files WHERE owner_type = ? AND owner_id = ? ORDER BY id', [$ownerType, $ownerId]
        ));
    }

    public static function absolute(string $rel): string
    {
        if (str_contains($rel, '..')) {
            throw new HttpError(400, 'bad_path', 'Bad path.');
        }
        return rtrim((string)Config::get('app.storage_path'), '/') . '/files/' . $rel;
    }

    /** Public metadata (never the on-disk path). */
    public static function present(array $r): array
    {
        return [
            'id' => (int)$r['id'], 'kind' => $r['kind'], 'ownerType' => $r['owner_type'], 'ownerId' => $r['owner_id'],
            'name' => $r['orig_name'], 'mime' => $r['mime'], 'size' => (int)$r['size_bytes'],
            'hasThumb' => $r['thumb_path'] !== null, 'uploadedAt' => $r['uploaded_at'] ?? null,
        ];
    }

    private static function cleanName(string $name): string
    {
        $name = preg_replace('/[\x00-\x1F\x7F\/\\\\]+/u', '_', basename($name)) ?? 'file';
        return mb_substr($name === '' ? 'file' : $name, 0, 200);
    }

    /**
     * A display copy (max 1400px, JPEG, rotated upright from the EXIF orientation). The original is kept untouched.
     * Skipped (null) when the image would not fit in memory: the app then shows the original instead.
     */
    private static function makeThumb(string $abs, string $rel): ?string
    {
        if (!function_exists('imagecreatefromstring') || !function_exists('getimagesize')) {
            return null;
        }
        $info = @getimagesize($abs);
        if ($info === false) {
            return null;
        }
        [$w, $h] = $info;
        // GD keeps ~5 bytes per pixel for the source and the same again for the copy: refuse what memory_limit cannot hold.
        $limit = self::bytes((string)ini_get('memory_limit'));
        $need = (int)($w * $h * 5 * 1.6) + (int)($w * $h * 0.6 * 4);
        if ($w < 1 || $h < 1 || ($limit > 0 && $need > $limit - memory_get_usage(true) - 8 * 1048576)) {
            return null;
        }
        try {
            $img = @imagecreatefromstring((string)file_get_contents($abs));
            if ($img === false) {
                return null;
            }
            if (($info['mime'] ?? '') === 'image/jpeg' && function_exists('exif_read_data')) {
                $orientation = (int)(@exif_read_data($abs)['Orientation'] ?? 1);
                $angle = [3 => 180, 6 => -90, 8 => 90][$orientation] ?? 0;
                if ($angle !== 0 && ($rot = imagerotate($img, $angle, 0)) !== false) {
                    $img = $rot;
                }
            }
            [$w, $h] = [imagesx($img), imagesy($img)];
            $k = min(1.0, 1400 / max($w, $h));
            $dst = imagecreatetruecolor(max(1, (int)round($w * $k)), max(1, (int)round($h * $k)));
            imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
            imagecopyresampled($dst, $img, 0, 0, 0, 0, imagesx($dst), imagesy($dst), $w, $h);
            $thumbRel = preg_replace('/\.\w+$/', '', $rel) . '_t.jpg';
            return imagejpeg($dst, self::absolute($thumbRel), 82) ? $thumbRel : null;
        } catch (\Throwable $e) {
            error_log('[femini] thumbnail failed: ' . $e->getMessage());
            return null;
        }
    }

    private static function bytes(string $v): int
    {
        $n = (int)$v;
        return match (strtolower(substr(trim($v), -1))) { 'g' => $n << 30, 'm' => $n << 20, 'k' => $n << 10, default => $n };
    }
}
