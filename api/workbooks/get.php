<?php
/**
 * GET /api/workbooks/get.php?id=123
 *
 * Returns one workbook including its full JSON document. Only the owner
 * (or an admin) may read it.
 *
 * @package XL\Api
 */

require_once __DIR__ . '/../cors.php';   // always first
require_once __DIR__ . '/../auth.php';

require_method('GET');
$user = require_user();

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    fail('id is required.', 422);
}

$stmt = db()->prepare(
    'SELECT id, user_id, name, document, created_at, updated_at FROM ' . tbl('workbooks') . ' WHERE id = ?'
);
$stmt->execute([$id]);
$wb = $stmt->fetch();

if (!$wb) {
    fail('Workbook not found.', 404);
}
if ((int) $wb['user_id'] !== (int) $user['id'] && !$user['is_admin']) {
    fail('You do not have access to that workbook.', 403);
}

respond([
    'workbook' => [
        'id'         => (int) $wb['id'],
        'name'       => $wb['name'],
        // Decoded to objects (not assoc arrays) so an empty cells map stays {}.
        'document'   => json_decode($wb['document']),
        'created_at' => $wb['created_at'],
        'updated_at' => $wb['updated_at'],
    ],
]);
