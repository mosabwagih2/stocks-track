<?php
declare(strict_types=1);

namespace Femini\Http;

/** Thrown anywhere in a request to end it with a JSON error: new HttpError(403, 'forbidden', 'message'). */
final class HttpError extends \RuntimeException
{
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message = '',
        public readonly array $extra = []
    ) {
        parent::__construct($message !== '' ? $message : $errorCode);
    }
}
