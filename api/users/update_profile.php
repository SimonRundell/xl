<?php
/**
 * POST /api/users/update_profile.php
 * Body: { screen_name?, preferences? }
 *
 * Updates the caller's own screen name and/or preference object
 * (date and number format defaults, etc). Avatar is handled by avatar.php.
 *
 * @package XL\Api
 */

require_once __DIR__ . '/../cors.php';   // always first
require_once __DIR__ . '/../auth.php';

require_method('POST');

$user = require_user();
$in   = json_input();

$sets   = [];
$params = [];

if (array_key_exists('screen_name', $in)) {
    $screen = trim((string) $in['screen_name']);
    if ($screen === '' || mb_strlen($screen) > 80) {
        fail('Screen name must be 1 to 80 characters.', 422);
    }
    $sets[]   = 'screen_name = ?';
    $params[] = $screen;
}

if (array_key_exists('preferences', $in)) {
    if (!is_array($in['preferences'])) {
        fail('preferences must be an object.', 422);
    }
    $sets[]   = 'preferences = ?';
    $params[] = json_encode($in['preferences']);
}

if (!$sets) {
    fail('Nothing to update.', 422);
}

$params[] = $user['id'];
db()->prepare('UPDATE ' . tbl('users') . ' SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);

respond(['user' => current_user()]);
