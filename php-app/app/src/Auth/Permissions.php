<?php
declare(strict_types=1);

namespace Femini\Auth;

/** The permission vocabulary. Mirrors PERMS / ROLE_DEFAULT / DOC_PERM in the browser app. */
final class Permissions
{
    /** key => Arabic label */
    public const ALL = [
        'money' => 'يشوف الفلوس والتكلفة',
        'scan' => 'شحن بالسكان',
        'returns' => 'استلام المرتجع',
        'receive' => 'استلام من المصنع',
        'internal' => 'هالك / غسيل / مفقود',
        'ship' => 'توريد للمحل',
        'count' => 'الجرد',
        'pickup' => 'رفع بيك أب',
        'cancel' => 'إلغاء أوردر',
        'catalog' => 'تعديل الأصناف والموديلات',
        'supplies' => 'المستلزمات',
        'close' => 'قفل اليوم وفتحه',
        'settings' => 'الإعدادات',
        'users' => 'المستخدمين والصلاحيات',
    ];

    /** Document / move type => permission needed to post it. */
    public const DOC = [
        'SCN' => 'scan', 'RTN' => 'returns', 'RCV' => 'receive', 'FRC' => 'internal',
        'FSD' => 'internal', 'CLN' => 'internal', 'LOS' => 'internal', 'SHP' => 'ship',
        'CNT' => 'count', 'CXL' => 'cancel', 'SWP' => 'count',
    ];

    public const DEFAULT_ROLES = [
        'admin' => ['name' => 'مدير', 'perms' => ['*']],
        'sup'   => ['name' => 'مشرف مخزن', 'perms' => ['scan', 'returns', 'receive', 'internal', 'ship', 'count', 'pickup', 'cancel', 'catalog', 'supplies', 'close']],
        'pack'  => ['name' => 'موظف شحن', 'perms' => ['scan', 'returns']],
        'view'  => ['name' => 'مراجعة (قراءة فقط)', 'perms' => ['money']],
    ];

    public static function can(array $user, string $perm): bool
    {
        $perms = $user['perms'] ?? [];
        return in_array('*', $perms, true) || in_array($perm, $perms, true);
    }

    public static function canAny(array $user, array $perms): bool
    {
        foreach ($perms as $p) {
            if (self::can($user, $p)) {
                return true;
            }
        }
        return false;
    }

    /** True for anyone who may change something at all ("view" users hold only the read-only "money" permission). */
    public static function canWrite(array $user): bool
    {
        foreach ($user['perms'] ?? [] as $p) {
            if ($p === '*' || ($p !== 'money' && isset(self::ALL[$p]))) {
                return true;
            }
        }
        return false;
    }

    public static function isAdmin(array $user): bool
    {
        return in_array('*', $user['perms'] ?? [], true);
    }
}
