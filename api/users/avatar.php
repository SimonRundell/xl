<?php
/**
 * POST /api/users/avatar.php   (multipart/form-data, field name "avatar")
 *
 * Uploads and stores the caller's avatar image. Replaces any previous one.
 * Returns { avatar_path } relative to the API root, e.g. "uploads/avatars/12_ab12cd.png".
 *
 * @package XL\Api
 */

require_once __DIR__ . '/../cors.php';   // always first
require_once __DIR__ . '/../auth.php';

require_method('POST');

$user = require_user();
$cfg  = $GLOBALS['XL_CONFIG']['uploads'];

if (!isset($_FILES['avatar']) || $_FILES['avatar']['error'] !== UPLOAD_ERR_OK) {
    fail('No file was uploaded.', 422);
}

$file = $_FILES['avatar'];
if ($file['size'] > (int) $cfg['maxBytes']) {
    fail('Image is too large (max ' . round($cfg['maxBytes'] / 1024) . ' KB).', 422);
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime  = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!in_array($mime, $cfg['allowedTypes'], true)) {
    fail('Only PNG, JPEG, WebP or GIF images are allowed.', 422);
}

$ext = [
    'image/png'  => 'png',
    'image/jpeg' => 'jpg',
    'image/webp' => 'webp',
    'image/gif'  => 'gif',
][$mime];

$dirAbs = __DIR__ . '/../' . $cfg['avatarDir'];
if (!is_dir($dirAbs) && !mkdir($dirAbs, 0775, true) && !is_dir($dirAbs)) {
    fail('Upload directory is not writable.', 500);
}

// Remove the previous avatar file if it lived in our upload dir.
if (!empty($user['avatar_path'])) {
    $old = __DIR__ . '/../' . $user['avatar_path'];
    if (is_file($old) && strpos(realpath($old), realpath($dirAbs)) === 0) {
        @unlink($old);
    }
}

$name = $user['id'] . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
$rel  = $cfg['avatarDir'] . '/' . $name;

if (!move_uploaded_file($file['tmp_name'], $dirAbs . '/' . $name)) {
    fail('Could not save the uploaded file.', 500);
}

db()->prepare('UPDATE ' . tbl('users') . ' SET avatar_path = ? WHERE id = ?')->execute([$rel, $user['id']]);

respond(['avatar_path' => $rel, 'user' => current_user()]);
