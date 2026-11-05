<?php
declare(strict_types=1);

namespace Femini\Sync;

/** Mutable bookkeeping for one push: the new revision, the client's base revision, what happened. */
final class PushContext
{
    public int $changed = 0;
    /** @var array<int,array{coll:string,k:string}> */
    public array $conflicts = [];
    /** @var array<int,array{doc:string,type:string,date:string}> moves inserted by this push (opening balances excluded) */
    public array $newMoves = [];
    /** @var array<int,array<string,mixed>> order rows written by this push */
    public array $orders = [];

    public function __construct(public readonly int $rev, public readonly int $since)
    {
    }
}
