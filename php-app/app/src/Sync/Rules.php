<?php
declare(strict_types=1);

namespace Femini\Sync;

use Femini\Auth\Permissions;
use Femini\Http\HttpError;

/**
 * Business rules the SERVER enforces on every change, whatever the browser sends:
 * permissions per operation type, the closed-day lock, immutable confirmed documents,
 * and shape checks on ledger rows.
 */
final class Rules
{
    public const LOCATIONS = ['READY', 'DIRTY', 'FACTORY', 'SCRAP', 'LOST', 'EXT_CH', 'EXT_SHOP', 'EXT_FACTORY', 'EXT_OPEN', 'EXT_ADJ', 'EXT_OFF'];
    public const MOVE_TYPES = ['RCV', 'RTN', 'SCN', 'SHP', 'CLN', 'FSD', 'FRC', 'CNT', 'LOS', 'CXL', 'OPN', 'SWP'];

    /** The most a counter (move ids, document ids...) may grow in one push. */
    private const MAX_COUNTER_JUMP = 100000;

    /** Fields of a confirmed document that may still change (delivery proof, attached files, history). */
    private const DOC_MUTABLE_HDR = ['delivered', 'file', 'shpRecv', 'emp'];   // 'emp': a scan sheet's employee name can be corrected (logged in the document's history)
    private const DOC_MUTABLE_TOP = ['log', 'photo'];

    /** @param bool $trustActors true only for the CLI import: documents keep the author recorded in the backup */
    public function __construct(
        private readonly array $user,
        private readonly string $lockDate,
        private readonly string $today,
        private readonly bool $trustActors = false
    ) {
    }

    public function checkMove(array $m): void
    {
        $type = (string)($m['type'] ?? '');
        if (!in_array($type, self::MOVE_TYPES, true)) {
            throw new HttpError(422, 'bad_move', "نوع حركة غير معروف: $type");
        }
        if ($type === 'OPN') {
            if (!Permissions::isAdmin($this->user)) {
                throw new HttpError(403, 'forbidden', 'الرصيد الافتتاحي للمدير بس.', ['needs' => 'admin']);
            }
        } else {
            $this->need(Permissions::DOC[$type]);
        }
        $date = (string)($m['date'] ?? '');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            throw new HttpError(422, 'bad_move', 'تاريخ الحركة غلط.');
        }
        if ($type !== 'OPN') {
            $this->assertOpenDay($date);
        }
        foreach (['from', 'to'] as $f) {
            if (!in_array($m[$f] ?? null, self::LOCATIONS, true)) {
                throw new HttpError(422, 'bad_move', 'مكان الحركة غلط.');
            }
        }
        if (!is_int($m['id'] ?? null) || $m['id'] < 1 || $m['id'] > 9007199254740991
            || !is_int($m['q'] ?? null) || $m['q'] === 0 || abs($m['q']) > 1000000
            || !is_string($m['sku'] ?? null) || !preg_match('/^[A-Za-z0-9_.-]{1,40}$/', $m['sku'])
            || !is_string($m['doc'] ?? null) || strlen($m['doc']) > 40) {
            throw new HttpError(422, 'bad_move', 'بيانات الحركة ناقصة أو غلط.');
        }
    }

    /** @param array<string,mixed>|null $existing the stored row's decoded payload, if any */
    public function checkDoc(array $doc, ?array $existing): void
    {
        $type = (string)($doc['type'] ?? '');
        $perm = Permissions::DOC[$type] ?? null;
        if ($perm === null) {
            throw new HttpError(422, 'bad_doc', "نوع مستند غير معروف: $type");
        }
        $this->checkDocLog($doc, $existing);
        $status = (string)($doc['status'] ?? '');
        $allowed = (Permissions::isAdmin($this->user) || (($existing['status'] ?? '') === 'done' && Permissions::can($this->user, $perm))) ? ['draft', 'done', 'reversed'] : ['draft', 'done'];   // 'reversed' only exists in imported legacy data
        if (!in_array($status, $allowed, true)) {
            throw new HttpError(422, 'bad_doc', 'حالة المستند غير مسموحة.');
        }
        if ($existing === null) {
            $this->need($perm);
            // A document is signed by whoever creates it: it cannot be filed under somebody else's name.
            if (!$this->trustActors && ($doc['by'] ?? null) !== $this->user['name']) {
                throw new HttpError(403, 'forged_actor', 'اسم منفّذ المستند لازم يكون اسمك. حدّث الصفحة.');
            }
            if ($status === 'done') {
                $this->assertOpenDay((string)($doc['date'] ?? ''));
            }
            return;
        }
        // An admin may reverse (cancel) a confirmed document: only its status flips to 'reversed', nothing else changes.
        // The counter-moves are checked separately (filed under "<no> (عكس)" in the same push).
        if (($existing['status'] ?? '') === 'done' && $status === 'reversed' && (Permissions::isAdmin($this->user) || Permissions::can($this->user, $perm))) {
            $was = $existing;
            $was['status'] = 'reversed';
            if (self::core($was) === self::core($doc)) {
                return;
            }
        }
        if (in_array($existing['status'] ?? '', ['done', 'reversed'], true)) {
            // A confirmed document is frozen: only the delivery/file fields and its history may change.
            if ($status !== $existing['status'] || self::core($existing) !== self::core($doc)) {
                throw new HttpError(409, 'immutable', 'المستند اتأكد ومش بيتعدّل.', ['doc' => $doc['id'] ?? null]);
            }
            return;
        }
        $this->need($perm);
        if ($status === 'done') {
            $this->assertOpenDay((string)($doc['date'] ?? ''));
        }
    }

    /** A new or changed "who did it" field must be the signed-in user (or the system's own marker). */
    private function checkActorField(mixed $by, mixed $oldBy): void
    {
        if ($this->trustActors || $by === null || $by === $oldBy) {
            return;
        }
        if ($by !== $this->user['name'] && !in_array($by, ['النظام', 'تلقائي'], true)) {
            throw new HttpError(403, 'forged_actor', 'اسم المنفّذ لازم يكون اسمك. حدّث الصفحة.');
        }
    }

    /** History entries added to a document must carry the signed-in user's name. */
    private function checkDocLog(array $doc, ?array $existing): void
    {
        $old = [];
        foreach ((array)($existing['log'] ?? []) as $e) {
            $old[Collections::encode($e)] = true;
        }
        foreach ((array)($doc['log'] ?? []) as $e) {
            if (!isset($old[Collections::encode($e)]) && is_array($e)) {
                $this->checkActorField($e['by'] ?? null, null);
            }
        }
    }

    /** Archiving (the `gone` flag) is only allowed for drafts. */
    public function checkDocArchive(?array $existing): void
    {
        if ($existing !== null && in_array($existing['status'] ?? '', ['done', 'reversed'], true)) {
            throw new HttpError(409, 'immutable', 'المستند المؤكد مش بيتأرشف.');
        }
    }

    public function checkOrder(): void
    {
        if (!Permissions::canAny($this->user, ['scan', 'cancel', 'returns', 'pickup', 'receive'])) {
            throw new HttpError(403, 'forbidden', 'دورك مش بيسمح بتعديل الأوردرات.', ['needs' => 'scan']);
        }
    }

    public function checkPickup(): void
    {
        $this->need('pickup');
    }

    public function checkRows(string $coll, array $row, ?array $old = null): void
    {
        if (in_array($coll, ['sup_log', 'closes'], true)) {
            $this->checkActorField($row['by'] ?? null, $old['by'] ?? null);
        }
        switch ($coll) {
            case 'sup_items':
                $this->need('supplies');
                break;
            case 'sup_log':
                if (!Permissions::canAny($this->user, ['supplies', 'scan'])) {
                    throw new HttpError(403, 'forbidden', 'دورك مش بيسمح بالمستلزمات.', ['needs' => 'supplies']);
                }
                break;
            case 'closes':
                if (empty($row['auto'])) {
                    $this->need('close');
                } elseif (($row['date'] ?? '') >= $this->today) {
                    throw new HttpError(422, 'bad_close', 'القفل التلقائي لأيام فاتت بس.');
                }
                break;
            case 'shops':
                $this->need('ship');
                break;
            case 'archPk':
                $this->need('pickup');
                break;
            case 'oldOrd':
                if (!Permissions::canAny($this->user, ['pickup', 'returns'])) {
                    throw new HttpError(403, 'forbidden', 'دورك مش بيسمح بالبيك أب القديم.', ['needs' => 'pickup']);
                }
                break;
            default: // emps, archDocs: any signed-in user
                break;
        }
    }

    /** @param mixed $new decoded new value; $old decoded current value (or null) */
    public function checkMeta(string $key, mixed $new, mixed $old): void
    {
        $perm = Collections::META[$key];
        if ($key === 'lock') {
            // Closing a day needs 'close'; the automatic midnight close (a date already in the past) is open to everyone.
            $isAuto = is_string($new) && $new < $this->today && (string)$old <= $new;
            if (!$isAuto) {
                $this->need('close');
            }
            return;
        }
        if ($perm !== null) {
            $this->need($perm);
        }
        if (in_array($key, Collections::COUNTERS, true)) {
            if (!is_int($new) || ($old !== null && $new < $old)) {
                throw new HttpError(409, 'counter_back', "العداد $key ما ينفعش يرجع لورا.");
            }
            // A counter can never be moved back, so a huge value would lock everybody out for good: allow normal growth only
            // (the CLI import, which restores a whole backup, is exempt).
            if (!$this->trustActors && $new > (int)$old + self::MAX_COUNTER_JUMP) {
                throw new HttpError(422, 'counter_jump', "العداد $key قفز قفزة غير طبيعية.");
            }
        }
        if ($key === 'seq') {
            foreach ((array)$old as $prefix => $n) {
                if (!is_array($new) || ($new[$prefix] ?? 0) < $n) {
                    throw new HttpError(409, 'counter_back', 'ترقيم المستندات ما ينفعش يرجع لورا.');
                }
            }
        }
    }

    private function assertOpenDay(string $date): void
    {
        if ($this->lockDate !== '' && $date !== '' && $date <= $this->lockDate) {
            throw new HttpError(409, 'day_locked', "اليوم $date مقفول.", ['date' => $date]);
        }
    }

    private function need(string $perm): void
    {
        if (!Permissions::can($this->user, $perm)) {
            throw new HttpError(403, 'forbidden', 'دورك مش بيسمح بالإجراء ده.', ['needs' => $perm]);
        }
    }

    /** The immutable part of a document, for comparison. */
    private static function core(array $doc): string
    {
        $hdr = $doc['hdr'] ?? [];
        foreach (self::DOC_MUTABLE_HDR as $k) {
            unset($hdr[$k]);
        }
        $core = $doc;
        foreach (self::DOC_MUTABLE_TOP as $k) {
            unset($core[$k]);
        }
        $core['hdr'] = $hdr;
        return Collections::encode(self::sortKeys($core));
    }

    private static function sortKeys(mixed $v): mixed
    {
        if (!is_array($v)) {
            return $v;
        }
        $isList = array_is_list($v);
        $v = array_map([self::class, 'sortKeys'], $v);
        if (!$isList) {
            ksort($v);
        }
        return $v;
    }
}
