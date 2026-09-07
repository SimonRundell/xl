<?php
/**
 * POST /api/workbooks/save.php
 * Body: { id, name?, document }
 *
 * Overwrites an existing workbook's document (and optionally its name).
 * Only the owner may save.
 *
 * The body is decoded to objects (not associative arrays) so that an empty
 * cells map stays a JSON object rather than becoming [].
 *
 * @package XL\Api
 */

require_once __DIR__ . '/../cors.php';   // always first
require_once __DIR__ . '/../auth.php';

require_method('POST');
$user = require_user();

$body = json_decode(file_get_contents('php://input'));
if (!is_object($body)) {
    fail('Invalid request body.', 422);
}

$id = (int) ($body->id ?? 0);
if ($id <= 0) {
    fail('id is required.', 422);
}
if (!isset($body->document) || !is_object($body->document)) {
    fail('document (object) is required.', 422);
}

$stmt = db()->prepare('SELECT user_id, name FROM ' . tbl('workbooks') . ' WHERE id = ?');
$stmt->execute([$id]);
$wb = $stmt->fetch();
if (!$wb) {
    fail('Workbook not found.', 404);
}
if ((int) $wb['user_id'] !== (int) $user['id']) {
    fail('You do not have access to that workbook.', 403);
}

$name = isset($body->name) && trim((string) $body->name) !== ''
    ? mb_substr(trim((string) $body->name), 0, 120)
    : $wb['name'];

$json = json_encode($body->document);
if ($json === false) {
    fail('document could not be encoded.', 422);
}

db()->prepare('UPDATE ' . tbl('workbooks') . ' SET name = ?, document = ? WHERE id = ?')
    ->execute([$name, $json, $id]);

$updated = db()->prepare('SELECT updated_at FROM ' . tbl('workbooks') . ' WHERE id = ?');
$updated->execute([$id]);

respond(['ok' => true, 'name' => $name, 'updated_at' => $updated->fetchColumn()]);
