<?php
/**
 * Shared CORS handler.
 *
 * Included at the very top of every endpoint, before anything else.
 * Reflects the exact localhost:PORT origin back to the browser so that
 * Vite's dev server is accepted whatever port it happens to run on,
 * and answers the OPTIONS preflight before any real work is done.
 *
 * Usage (always in this order):
 *   require_once __DIR__ . '/cors.php';   // or ../cors.php from a sub folder
 *   require_once __DIR__ . '/db.php';
 *
 * @package XL\Api
 */

require_once __DIR__ . '/config.php';

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

/*
 * Allow any localhost / 127.0.0.1 origin on any port (the Vite dev server),
 * plus a configurable list of production origins from config.json.
 */
$allowed = false;
if (preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#i', $origin)) {
    $allowed = true;
} else {
    $extra = $GLOBALS['XL_CONFIG']['allowedOrigins'] ?? [];
    if (in_array($origin, $extra, true)) {
        $allowed = true;
    }
}

if ($allowed && $origin !== '') {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(200);
    exit();
}
