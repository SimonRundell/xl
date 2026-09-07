<?php
/**
 * Minimal hand rolled JWT (HS256) encode / decode.
 *
 * No Composer dependency. Good enough for a single classroom server.
 *
 * @package XL\Api
 */

require_once __DIR__ . '/config.php';

/**
 * Base64url encode.
 *
 * @param string $data Raw bytes.
 * @return string
 */
function b64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

/**
 * Base64url decode.
 *
 * @param string $data Encoded string.
 * @return string
 */
function b64url_decode(string $data): string
{
    $pad = strlen($data) % 4;
    if ($pad) {
        $data .= str_repeat('=', 4 - $pad);
    }
    return base64_decode(strtr($data, '-_', '+/'));
}

/**
 * Create a signed JWT for the given claims.
 *
 * Adds iat, exp and iss automatically.
 *
 * @param array $claims Custom claims (e.g. ['uid' => 1]).
 * @return string
 */
function jwt_issue(array $claims): string
{
    $cfg = $GLOBALS['XL_CONFIG']['jwt'];
    $now = time();

    $header  = ['alg' => 'HS256', 'typ' => 'JWT'];
    $payload = array_merge($claims, [
        'iss' => $cfg['issuer'] ?? 'xl',
        'iat' => $now,
        'exp' => $now + (int) ($cfg['ttlSeconds'] ?? 604800),
    ]);

    $segments = [
        b64url_encode(json_encode($header)),
        b64url_encode(json_encode($payload)),
    ];
    $signing = implode('.', $segments);
    $sig = hash_hmac('sha256', $signing, $cfg['secret'], true);
    $segments[] = b64url_encode($sig);

    return implode('.', $segments);
}

/**
 * Verify a JWT and return its payload, or null if invalid / expired.
 *
 * @param string $token Compact JWT string.
 * @return array|null
 */
function jwt_verify(string $token): ?array
{
    $cfg = $GLOBALS['XL_CONFIG']['jwt'];
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }
    [$h, $p, $s] = $parts;

    $expected = b64url_encode(hash_hmac('sha256', "{$h}.{$p}", $cfg['secret'], true));
    if (!hash_equals($expected, $s)) {
        return null;
    }

    $payload = json_decode(b64url_decode($p), true);
    if (!is_array($payload)) {
        return null;
    }
    if (isset($payload['exp']) && time() >= (int) $payload['exp']) {
        return null;
    }

    return $payload;
}
