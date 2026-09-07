<?php
/**
 * GET /api/auth/me.php
 *
 * Returns the current user for a valid bearer token. Used on app start to
 * restore the session.
 *
 * @package XL\Api
 */

require_once __DIR__ . '/../cors.php';   // always first
require_once __DIR__ . '/../auth.php';

require_method('GET');

$user = require_user();
respond(['user' => $user]);
