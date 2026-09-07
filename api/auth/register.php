<?php
/**
 * POST /api/auth/register.php
 * Body: { email, screen_name, password }
 *
 * Open registration. Creates a normal (non admin) active account and
 * returns a token plus the user record, so the client is logged straight in.
 *
 * @package XL\Api
 */

require_once __DIR__ . '/../cors.php';   // always first
require_once __DIR__ . '/../auth.php';

require_method('POST');

$in       = json_input();
$email    = strtolower(field($in, 'email'));
$screen   = field($in, 'screen_name');
$password = field($in, 'password');

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fail('That email address does not look valid.', 422);
}
if (strlen($password) < 8) {
    fail('Password must be at least 8 characters.', 422);
}
if (mb_strlen($screen) > 80) {
    fail('Screen name is too long.', 422);
}

$exists = db()->prepare('SELECT id FROM ' . tbl('users') . ' WHERE email = ?');
$exists->execute([$email]);
if ($exists->fetch()) {
    fail('An account with that email already exists.', 409);
}

$hash = password_hash($password, PASSWORD_BCRYPT);
$stmt = db()->prepare(
    'INSERT INTO ' . tbl('users') . ' (email, screen_name, password_hash, is_admin, is_active)
     VALUES (?, ?, ?, 0, 1)'
);
$stmt->execute([$email, $screen, $hash]);
$id = (int) db()->lastInsertId();

$token = jwt_issue(['uid' => $id]);

respond([
    'token' => $token,
    'user'  => [
        'id'          => $id,
        'email'       => $email,
        'screen_name' => $screen,
        'avatar_path' => null,
        'is_admin'    => false,
        'is_active'   => true,
        'preferences' => new stdClass(),
    ],
], 201);
