<?php
declare(strict_types=1);

namespace Femini\Http;

/** Browser security headers. The API gets the strictest policy; the app page needs inline scripts and a few CDNs. */
final class SecurityHeaders
{
    public static function api(Request $req): void
    {
        self::common($req);
        header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
        header('Cache-Control: no-store');
    }

    public static function page(Request $req): void
    {
        self::common($req);
        // The app is one file with inline script/style. It loads SheetJS / html2canvas / jsPDF from cdnjs and fonts from Google.
        header("Content-Security-Policy: default-src 'self'; "
            . "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; "
            . "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            . "font-src 'self' https://fonts.gstatic.com data:; "
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
