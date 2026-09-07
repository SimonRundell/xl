<?php
/**
 * Authentication guards.
 *
 * current_user()  - returns the row for the bearer token, or null.
 * require_user()   - returns the row, or sends 401 and stops.
 * require_admin()  - returns the row, or sends 401 / 403 and stops.
 *
 * @package XL\Api
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/jwt.php';
require_once __DIR__ . '/helpers.php';

/**
 * Read the Authorization: Bearer header.
 *
 * @return string
 */
function bearer_token(): string
{
    $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if ($hdr === '' && function_exists('apache_request_headers')) {
        $all = apache_request_headers();
        $hdr = $all['Authorization'] ?? $all['authorization'] ?? '';
    }
    if (preg_match('/Bearer\s+(.+)/i', $hdr, $m)) {
        return trim($m[1]);
    }
    return '';
}

/**
 * Resolve the authenticated user row from the bearer token.
 *
 * @return array|null User row without password_hash, or null.
 */
function current_user(): ?array
{
    $token = bearer_token();
    if ($token === '') {
        return null;
    }
    $payload = jwt_verify($token);
    if ($payload === null || !isset($payload['uid'])) {
        return null;
    }

    $stmt = db()->prepare(
        'SELECT id, email, screen_name, avatar_path, is_admin, is_active, preferences, created_at
         FROM ' . tbl('users') . ' WHERE id = ?'
    );
    $stmt->execute([(int) $payload['uid']]);
    $user = $stmt->fetch();
    if (!$user || (int) $user['is_active'] !== 1) {
        return null;
    }

    $user['is_admin']    = (int) $user['is_admin'] === 1;
    $user['is_active']   = (int) $user['is_active'] === 1;
    $user['preferences'] = $user['preferences'] ? json_decode($user['preferences'], true) : new stdClass();
    return $user;
}

/**
 * Require an authenticated, active user.
 *
 * @return array
 */
function require_user(): array
{
    $user = current_user();
    if ($user === null) {
        fail('Authentication required.', 401);
    }
    return $user;
}

/**
 * Require an authenticated admin user.
 *
 * @return array
 */
function require_admin(): array
{
    $user = require_user();
    if (!$user['is_admin']) {
        fail('Administrator access required.', 403);
    }
    return $user;
}
