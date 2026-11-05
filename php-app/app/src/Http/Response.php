<?php
declare(strict_types=1);

namespace Femini\Http;

final class Response
{
    public static function json(mixed $data, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
        exit;
    }

    public static function error(int $status, string $code, string $message, array $extra = []): never
    {
        self::json(['ok' => false, 'error' => $code, 'message' => $message] + $extra, $status);
    }
}
