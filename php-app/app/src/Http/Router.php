<?php
declare(strict_types=1);

namespace Femini\Http;

/** Tiny router: add('GET', '/api/files/{id}', fn(Request $r, array $p) => ...). */
final class Router
{
    /** @var array<int,array{0:string,1:string,2:callable}> */
    private array $routes = [];

    public function add(string $method, string $pattern, callable $handler): void
    {
        $regex = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>[^/]+)', $pattern) . '$#';
        $this->routes[] = [$method, $regex, $handler];
    }

    public function dispatch(Request $req): mixed
    {
        $pathMatched = false;
        foreach ($this->routes as [$method, $regex, $handler]) {
            if (preg_match($regex, rtrim($req->path, '/') ?: '/', $m)) {
                $pathMatched = true;
                if ($method === $req->method) {
                    $params = array_filter($m, 'is_string', ARRAY_FILTER_USE_KEY);
                    return $handler($req, $params);
                }
            }
        }
        throw $pathMatched
            ? new HttpError(405, 'method_not_allowed', 'Method not allowed.')
            : new HttpError(404, 'not_found', 'Not found.');
    }
}
