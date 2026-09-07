<?php
/**
 * POST /api/users/change_password.php
 * Body: { current_password, new_password }
 *
 * Lets a user change their own password.
 *
 * @package XL\Api
 */

require_once __DIR__ . '/../cors.php';   // always first
require_once __DIR__ . '/../auth.php';

require_method('POST');

$user = require_user();
$in   = json_input();

$current = field($in, 'current_password');
$next    = field($in, 'new_password');

if (strlen($next) < 8) {
    fail('New password must be at least 8 characters.', 422);
}

$stmt = db()->prepare('SELECT password_hash FROM ' . tbl('users') . ' WHERE id = ?');
$stmt->execute([$user['id']]);
$row = $stmt->fetch();

if (!$row || !password_verify($current, $row['password_hash'])) {
    fail('Your current password is incorrect.', 401);
}

$hash = password_hash($next, PASSWORD_BCRYPT);
db()->prepare('UPDATE ' . tbl('users') . ' SET password_hash = ? WHERE id = ?')->execute([$hash, $user['id']]);

respond(['ok' => true]);
