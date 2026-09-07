<?php
/**
 * Small request/response helpers used by every endpoint.
 *
 * @package XL\Api
 */

/**
 * Decode the JSON request body into an associative array.
 *
 * @return array
 */
function json_input(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/**
 * Send a JSON response and stop.
 *
 * @param mixed $data Payload to encode.
 * @param int   $code HTTP status code.
 * @return never
 */
function respond($data, int $code = 200)
{
    http_response_code($code);
    echo json_encode($data);
    exit();
}

/**
 * Send a JSON error response and stop.
 *
 * @param string $message Human readable message.
 * @param int    $code    HTTP status code.
 * @return never
 */
function fail(string $message, int $code = 400)
{
    respond(['error' => $message], $code);
}

/**
 * Require that the request method is one of the given verbs.
 *
 * @param string ...$methods Allowed verbs, e.g. 'POST'.
 * @return void
 */
function require_method(string ...$methods): void
{
    $m = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($m, $methods, true)) {
        fail('Method not allowed.', 405);
    }
}

/**
 * Fetch a trimmed string field from an input array or fail.
 *
 * @param array  $src   Source array.
 * @param string $key   Field name.
 * @param bool   $required Whether an empty value is an error.
 * @return string
 */
function field(array $src, string $key, bool $required = true): string
{
    $v = isset($src[$key]) ? trim((string) $src[$key]) : '';
    if ($required && $v === '') {
        fail("Missing field: {$key}.", 422);
    }
    return $v;
}
