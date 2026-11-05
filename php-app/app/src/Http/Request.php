<?php
declare(strict_types=1);

namespace Femini\Http;

final class Request
{
    public function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $query,
        public readonly array $headers,
        private readonly string $rawBody,
        public readonly array $files = []
    ) {
    }

    public static function fromGlobals(): self
    {
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $headers = [];
        foreach ($_SERVER as $k => $v) {
            if (strncmp($k, 'HTTP_', 5) === 0) {
                $headers[strtolower(str_replace('_', '-', substr($k, 5)))] = (string)$v;
            }
        }
        if (isset($_SERVER['CONTENT_TYPE'])) {
            $headers['content-type'] = (string)$_SERVER['CONTENT_TYPE'];
        }
        return new self(
            strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'),
            $path,
            $_GET,
            $headers,
            (string)file_get_contents('php://input'),
            $_FILES
        );
    }

    public function header(string $name): ?string
    {
        return $this->headers[strtolower($name)] ?? null;
    }

    /** Decoded JSON body as associative arrays. Throws 400 on malformed JSON. */
    public function json(): array
    {
        return $this->rawBody === '' ? [] : $this->decode(true);
    }

    /**
     * Decoded JSON body as objects. Use this when the data is STORED: with arrays, an empty `{}` would come back
     * as `[]` after re-encoding, which silently breaks the browser app (it treats those values as objects).
     */
    public function jsonObject(): \stdClass
    {
        return $this->rawBody === '' ? new \stdClass() : $this->decode(false);
    }

    private function decode(bool $assoc): mixed
    {
        $data = json_decode($this->rawBody, $assoc, 64);
        if (!is_array($data) && !is_object($data)) {
            throw new HttpError(400, 'bad_json', 'Request body is not valid JSON.');
        }
        return $data;
    }

    /**
     * The client's IP, used for login throttling. Behind a CDN/proxy (e.g. Cloudflare) every visitor would otherwise share the
     * proxy's address: set app.proxy_header to the header your proxy sets (e.g. HTTP_CF_CONNECTING_IP). Never set it when
     * the site is reached directly, because then anyone could forge it.
     */
    public function ip(): string
    {
        $header = \Femini\Config::get('app.proxy_header');
        $ip = $header ? (string)($_SERVER[$header] ?? '') : '';
        if ($ip !== '' && filter_var($ip, FILTER_VALIDATE_IP)) {
            return $ip;
        }
        return (string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    }

    public function isHttps(): bool
    {
        return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    }
}
