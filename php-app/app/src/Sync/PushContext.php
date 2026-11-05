<?php
declare(strict_types=1);

namespace Femini\Sync;

/** Mutable bookkeeping for one push: the new revision, the client's base revision, what happened. */
final class PushContext
{
    public int $changed = 0;
    /** @var array<int,array{coll:string,k:string}> */
    public array $conflicts = [];

    public function __construct(public readonly int $rev, public readonly int $since)
    {
    }
}
