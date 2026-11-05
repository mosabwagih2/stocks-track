<?php
declare(strict_types=1);

namespace Femini\Http;

/** Browser security headers. The API gets the strictest policy; the app page gets a nonce-based one. */
final class SecurityHeaders
{
    public static function api(Request $req): void
    {
        self::common($req);
        header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
        header('Cache-Control: no-store');
    }

    /**
     * The app page. Scripts: only same-origin files and the inline blocks that carry this request's nonce (no 'unsafe-inline',
     * no CDN: SheetJS, html2canvas, jsPDF and the fonts are served from /assets). Styles keep 'unsafe-inline' because the app
     * sets style="" attributes everywhere.
     */
    public static function page(Request $req, string $nonce): void
    {
        self::common($req);
        header("Content-Security-Policy: default-src 'self'; "
            . "script-src 'self' 'nonce-$nonce'; "
            . "style-src 'self' 'unsafe-inline'; "
            . "font-src 'self' data:; "
            . "img-src 'self' data: blob:; connect-src 'self'; "
            . "frame-src 'self' blob: about:; worker-src 'self' blob:; "
            . "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
        header('Cache-Control: no-store');
    }

    private static function common(Request $req): void
    {
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: same-origin');
        header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()');
        if ($req->isHttps()) {
            header('Strict-Transport-Security: max-age=15552000');   // 180 days
        }
    }
}
