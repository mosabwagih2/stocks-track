<?php
declare(strict_types=1);

namespace Femini\Sync;

use Femini\Auth\Permissions;
use Femini\Auth\UserRepository;
use Femini\Database;

/**
 * Builds the browser app's whole state object `S` from the database. The server embeds the result in the
 * page at load time (see public/index.php), so the app starts with real data and no extra round trip.
 */
final class Snapshot
{
    /** @return array{state:array<string,mixed>,rev:int,empty:bool} */
    public static function build(array $user): array
    {
        $data = (new SyncService($user))->pull(0);
        $live = static fn(array $rows): array => array_values(array_map(
            static fn(array $r) => $r['row'],
            array_filter($rows, static fn(array $r) => !$r['gone'])
        ));
        $meta = static fn(string $k, mixed $default = null): mixed => $data['meta'][$k]['v'] ?? $default;

        $moves = $data['moves'];
        $maxMoveId = $moves ? max(array_column($moves, 'id')) : 0;
        $empty = !$moves && !$data['coll']['orders'] && !$data['coll']['docs'] && !$data['coll']['pickups'] && $meta('mid') === null;

        $state = [
            'v'        => 3,
            'moves'    => $moves,
            'mid'      => $meta('mid', $maxMoveId + 1),
            'docs'     => $live($data['coll']['docs']),
            'did'      => $meta('did', 1),
            'seq'      => (object)$meta('seq', []),
            'pickups'  => $live($data['coll']['pickups']),
            'orders'   => $live($data['coll']['orders']),
            'emps'     => $live($data['coll']['emps']),
            'sup'      => ['log' => $live($data['coll']['sup_log']), 'items' => $live($data['coll']['sup_items']), 'eid' => $meta('sup_eid', 1)],
            'st'       => (object)$meta('st', []),
            'costs'    => (object)$meta('costs', []),
            'alias'    => (object)$meta('alias', []),
            'img'      => (object)$meta('img', []),
            'cat'      => $meta('cat'),
            'lock'     => (string)$meta('lock', ''),
            'bk'       => $meta('bk'),
            'shops'    => $live($data['coll']['shops']),
            'closes'   => $live($data['coll']['closes']),
            'archPk'   => $live($data['coll']['archPk']),
            'archDocs' => $live($data['coll']['archDocs']),
            'oldOrd'   => $live($data['coll']['oldOrd']),
            'holds'    => $live($data['coll']['holds']),
            'audit'    => array_slice($data['audit'], -300),
            'roles'    => self::rolesForApp(),
            'users'    => self::usersForApp($user),
            'cur'      => $user['id'],
            'actor'    => $user['name'],
        ];
        if ($state['cat'] === null) {
            unset($state['cat']);   // the app builds its default catalog when it is missing
        }
        if ($state['bk'] === null) {
            unset($state['bk']);
        }
        $epoch = $meta('epoch');
        return ['state' => $state, 'rev' => $data['rev'], 'empty' => $empty, 'epoch' => is_array($epoch) ? (string)($epoch['id'] ?? '') : ''];
    }

    /** Users and roles are managed by the server (UsersController), never by sync. */
    public static function usersForApp(array $viewer): array
    {
        $showLogin = Permissions::can($viewer, 'users');   // login names are only needed on the users screen
        return array_map(static fn(array $u) => [
            'id' => $u['id'], 'name' => $u['name'], 'role' => $u['role'], 'pin' => null,
            'on' => $u['active'] && !$u['arch'], 'arch' => $u['arch'],
        ] + ($showLogin ? ['username' => $u['username']] : []), UserRepository::all());
    }

    public static function rolesForApp(): array
    {
        $out = [];
        foreach (UserRepository::roles() as $id => $r) {
            $perms = in_array('*', $r['perms'], true) ? array_keys(Permissions::ALL) : $r['perms'];
            $out[$id] = ['name' => $r['name'], 'perms' => $perms];
        }
        return $out;
    }
}
