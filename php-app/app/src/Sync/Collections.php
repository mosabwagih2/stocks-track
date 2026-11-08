<?php
declare(strict_types=1);

namespace Femini\Sync;

/**
 * Describes how each part of the browser app's state `S` maps to MySQL.
 *
 *  - TABLES: keyed collections with their own table and a few indexed columns copied from the JSON.
 *  - ROWS:   small keyed collections stored in `coll_rows` (the key is the row's id, or the string itself).
 *  - META:   singleton values stored in `meta`.
 *  - moves / audit are append-only tables handled separately.
 */
final class Collections
{
    /** name => [table, key field in the JSON row, indexed column => JSON field] */
    public const TABLES = [
        'docs'    => ['table' => 'docs',    'key' => 'id',  'cols' => ['doc_no' => 'no', 'type' => 'type', 'status' => 'status', 'on_date' => 'date']],
        'orders'  => ['table' => 'orders',  'key' => 'ref', 'cols' => ['waybill' => 'wb', 'pickup_id' => 'pk', 'status' => 'st']],
        'pickups' => ['table' => 'pickups', 'key' => 'id',  'cols' => ['on_date' => 'date']],
    ];

    /** name => JSON field holding the key (null: the row itself is a string and is its own key) */
    public const ROWS = [
        'sup_items' => 'id',
        'sup_log'   => 'id',
        'closes'    => 'id',
        'shops'     => null,
        'emps'      => null,
        'archPk'    => 'p.id',
        'archDocs'  => 'd.id',
        'oldOrd'    => 'ref',     // old pickups (before the system started): a reference for returns, never orders
        'holds'     => 'no',      // pieces out on a hold, with their event log (out / return / write-off)
        'settles'   => 'id',      // the channel's settlement sheets (تسوية): which shipped orders were collected, and the amounts
    ];

    /** meta keys that clients may write, with the permission each needs (null = any signed-in user). */
    public const META = [
        'mid' => null, 'did' => null, 'seq' => null, 'sup_eid' => null, 'bk' => null,
        'st' => 'settings', 'costs' => 'settings',
        'alias' => 'catalog', 'img' => 'catalog', 'cat' => 'catalog',
        'lock' => 'close',
    ];

    /** Counters that may only grow (so ids and document numbers are never reused). */
    public const COUNTERS = ['mid', 'did', 'sup_eid'];

    public const MAX_ROW_BYTES = 4 * 1024 * 1024;

    public static function isCollection(string $name): bool
    {
        return isset(self::TABLES[$name]) || array_key_exists($name, self::ROWS);
    }

    /** Reads a dotted path ("p.id") from a row. */
    public static function keyOf(string $coll, mixed $row): ?string
    {
        if (isset(self::TABLES[$coll])) {
            $v = is_array($row) ? ($row[self::TABLES[$coll]['key']] ?? null) : null;
        } else {
            $path = self::ROWS[$coll];
            if ($path === null) {
                $v = is_string($row) ? $row : null;
            } else {
                $v = $row;
                foreach (explode('.', $path) as $part) {
                    $v = is_array($v) ? ($v[$part] ?? null) : null;
                }
            }
        }
        if (is_int($v) || is_float($v)) {
            $v = (string)$v;
        }
        return is_string($v) && $v !== '' && strlen($v) <= 80 ? $v : null;
    }

    public static function encode(mixed $value): string
    {
        $json = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
        if ($json === false) {
            throw new \InvalidArgumentException('Value cannot be encoded as JSON.');
        }
        return $json;
    }
}
