<?php
/**
 * POST /api/auth/login.php
 * Body: { email, password }
 *
 * Returns { token, user } on success.
 *
 * @package XL\Api
 */

require_once __DIR__ . '/../cors.php';   // always first
require_once __DIR__ . '/../auth.php';

require_method('POST');

$in       = json_input();
$email    = strtolower(field($in, 'email'));
$password = field($in, 'password');

$stmt = db()->prepare(
    'SELECT id, email, screen_name, password_hash, avatar_path, is_admin, is_active, preferences
     FROM ' . tbl('users') . ' WHERE email = ?'
);
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    fail('Email or password is incorrect.', 401);
}
if ((int) $user['is_active'] !== 1) {
    fail('This account has been disabled. Ask an administrator.', 403);
}

$token = jwt_issue(['uid' => (int) $user['id']]);

respond([
    'token' => $token,
    'user'  => [
        'id'          => (int) $user['id'],
        'email'       => $user['email'],
        'screen_name' => $user['screen_name'],
        'avatar_path' => $user['avatar_path'],
        'is_admin'    => (int) $user['is_admin'] === 1,
        'is_active'   => true,
        'preferences' => $user['preferences'] ? json_decode($user['preferences'], true) : new stdClass(),
    ],
]);
