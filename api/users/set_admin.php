<?php
/**
 * POST /api/users/set_admin.php   (admin only)
 * Body: { user_id, is_admin }
 *
 * Raises or lowers another account's admin flag. An admin cannot remove
 * their own admin rights (avoids locking everyone out).
 *
 * @package XL\Api
 */

require_once __DIR__ . '/../cors.php';   // always first
require_once __DIR__ . '/../auth.php';

require_method('POST');
$me = require_admin();

$in     = json_input();
$target = (int) ($in['user_id'] ?? 0);
$flag   = !empty($in['is_admin']) ? 1 : 0;

if ($target <= 0) {
    fail('user_id is required.', 422);
}
if ($target === (int) $me['id'] && $flag === 0) {
    fail('You cannot remove your own admin rights.', 409);
}

$stmt = db()->prepare('SELECT id FROM ' . tbl('users') . ' WHERE id = ?');
$stmt->execute([$target]);
if (!$stmt->fetch()) {
    fail('User not found.', 404);
}

db()->prepare('UPDATE ' . tbl('users') . ' SET is_admin = ? WHERE id = ?')->execute([$flag, $target]);
respond(['ok' => true]);
