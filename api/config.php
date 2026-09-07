<?php
/**
 * Loads api/config.json into $GLOBALS['XL_CONFIG'].
 *
 * config.json is git ignored. Copy config.sample.json to config.json and
 * fill in the real values before the API will run.
 *
 * @package XL\Api
 */

if (!isset($GLOBALS['XL_CONFIG'])) {
    // config.local.json wins when present (git ignored), so a machine can
    // override the committed config without touching it.
    $path = is_file(__DIR__ . '/config.local.json')
        ? __DIR__ . '/config.local.json'
        : __DIR__ . '/config.json';
    if (!is_file($path)) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'api/config.json is missing. Copy config.sample.json to config.json.']);
        exit();
    }
    $raw = file_get_contents($path);
    $cfg = json_decode($raw, true);
    if (!is_array($cfg)) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'api/config.json is not valid JSON.']);
        exit();
    }
    $GLOBALS['XL_CONFIG'] = $cfg;
}
