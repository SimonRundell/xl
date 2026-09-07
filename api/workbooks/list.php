<?php
/**
 * GET /api/workbooks/list.php
 *
 * Returns the caller's workbooks (metadata only, no document body).
 *
 * @package XL\Api
 */

require_once __DIR__ . '/../cors.php';   // always first
require_once __DIR__ . '/../auth.php';

require_method('GET');
$user = require_user();

$stmt = db()->prepare(
    'SELECT id, name, created_at, updated_at
     FROM ' . tbl('workbooks') . ' WHERE user_id = ? ORDER BY updated_at DESC'
);
$stmt->execute([$user['id']]);
$rows = $stmt->fetchAll();
foreach ($rows as &$r) {
    $r['id'] = (int) $r['id'];
}

respond(['workbooks' => $rows]);
