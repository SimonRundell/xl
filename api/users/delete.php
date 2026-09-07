<?php
/**
 * POST /api/users/delete.php   (admin only)
 * Body: { user_id }
 *
 * Permanently removes an account and (via the foreign key) all of its
 * workbooks. An admin cannot delete themselves.
 *
 * @package XL\Api
 */

require_once __DIR__ . '/../cors.php';   // always first
require_once __DIR__ . '/../auth.php';

require_method('POST');
$me = require_admin();

$in     = json_input();
$target = (int) ($in['user_id'] ?? 0);

if ($target <= 0) {
    fail('user_id is required.', 422);
}
if ($target === (int) $me['id']) {
    fail('You cannot delete your own account.', 409);
}

$stmt = db()->prepare('SELECT avatar_path FROM ' . tbl('users') . ' WHERE id = ?');
$stmt->execute([$target]);
$row = $stmt->fetch();
if (!$row) {
    fail('User not found.', 404);
}

if (!empty($row['avatar_path'])) {
    $path = __DIR__ . '/../' . $row['avatar_path'];
    if (is_file($path)) {
        @unlink($path);
    }
}

db()->prepare('DELETE FROM ' . tbl('users') . ' WHERE id = ?')->execute([$target]);
respond(['ok' => true]);
