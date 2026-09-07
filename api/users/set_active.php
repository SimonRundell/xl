<?php
/**
 * POST /api/users/set_active.php   (admin only)
 * Body: { user_id, is_active }
 *
 * Enables or disables an account. A disabled account cannot log in and its
 * existing tokens stop working. An admin cannot disable themselves.
 *
 * @package XL\Api
 */

require_once __DIR__ . '/../cors.php';   // always first
require_once __DIR__ . '/../auth.php';

require_method('POST');
$me = require_admin();

$in     = json_input();
$target = (int) ($in['user_id'] ?? 0);
$flag   = !empty($in['is_active']) ? 1 : 0;

if ($target <= 0) {
    fail('user_id is required.', 422);
}
if ($target === (int) $me['id'] && $flag === 0) {
    fail('You cannot disable your own account.', 409);
}

$stmt = db()->prepare('SELECT id FROM ' . tbl('users') . ' WHERE id = ?');
$stmt->execute([$target]);
if (!$stmt->fetch()) {
    fail('User not found.', 404);
}

db()->prepare('UPDATE ' . tbl('users') . ' SET is_active = ? WHERE id = ?')->execute([$flag, $target]);
respond(['ok' => true]);
