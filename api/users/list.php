<?php
/**
 * GET /api/users/list.php   (admin only)
 *
 * Returns every account with its workbook count, for the admin panel.
 *
 * @package XL\Api
 */

require_once __DIR__ . '/../cors.php';   // always first
require_once __DIR__ . '/../auth.php';

require_method('GET');
require_admin();

$rows = db()->query(
    'SELECT u.id, u.email, u.screen_name, u.avatar_path, u.is_admin, u.is_active, u.created_at,
            (SELECT COUNT(*) FROM ' . tbl('workbooks') . ' w WHERE w.user_id = u.id) AS workbook_count
     FROM ' . tbl('users') . ' u
     ORDER BY u.id ASC'
)->fetchAll();

foreach ($rows as &$r) {
    $r['id']             = (int) $r['id'];
    $r['is_admin']       = (int) $r['is_admin'] === 1;
    $r['is_active']      = (int) $r['is_active'] === 1;
    $r['workbook_count'] = (int) $r['workbook_count'];
}

respond(['users' => $rows]);
