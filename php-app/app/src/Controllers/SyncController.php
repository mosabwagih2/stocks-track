<?php
declare(strict_types=1);

namespace Femini\Controllers;

use Femini\Auth\Auth;
use Femini\Http\Request;
use Femini\Http\Response;
use Femini\Sync\Snapshot;
use Femini\Sync\SyncService;

final class SyncController
{
    public static function pull(Request $req): never
    {
        $user = Auth::requireUser();
        $since = max(0, (int)($req->query['since'] ?? 0));
        $data = (new SyncService($user))->pull($since);
        $data["ok"] = true;
        $data["meta"] = (object)$data["meta"];   // an empty map must be {} in JSON
        $data['users'] = Snapshot::usersForApp();
        $data['roles'] = Snapshot::rolesForApp();
        Response::json($data);
    }

    public static function push(Request $req): never
    {
        $user = Auth::requireUser();
        $result = (new SyncService($user))->push($req->jsonObject());
        Response::json(['ok' => true] + $result);
    }
}
