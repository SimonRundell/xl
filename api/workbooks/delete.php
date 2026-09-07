<?php
/**
 * POST /api/workbooks/delete.php
 * Body: { id }
 *
 * Deletes a workbook the caller owns.
 *
 * @package XL\Api
 */

require_once __DIR__ . '/../cors.php';   // always first
require_once __DIR__ . '/../auth.php';

require_method('POST');
$user = require_user();

$in = json_input();
$id = (int) ($in['id'] ?? 0);
if ($id <= 0) {
    fail('id is required.', 422);
}

$stmt = db()->prepare('SELECT user_id FROM ' . tbl('workbooks') . ' WHERE id = ?');
$stmt->execute([$id]);
$wb = $stmt->fetch();
if (!$wb) {
    fail('Workbook not found.', 404);
}
if ((int) $wb['user_id'] !== (int) $user['id']) {
    fail('You do not have access to that workbook.', 403);
}

db()->prepare('DELETE FROM ' . tbl('workbooks') . ' WHERE id = ?')->execute([$id]);
respond(['ok' => true]);
