<?php
/**
 * GET /api/  - health check.
 *
 * @package XL\Api
 */

require_once __DIR__ . '/cors.php';   // always first
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

try {
    db()->query('SELECT 1');
    $dbOk = true;
} catch (Throwable $e) {
    $dbOk = false;
}

respond([
    'service' => 'xl-api',
    'time'    => date('c'),
    'db'      => $dbOk ? 'ok' : 'unavailable',
]);
