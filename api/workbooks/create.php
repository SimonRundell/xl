<?php
/**
 * POST /api/workbooks/create.php
 * Body: { name, document? }
 *
 * Creates a new workbook for the caller. If no document is supplied a
 * blank single sheet workbook is generated.
 *
 * @package XL\Api
 */

require_once __DIR__ . '/../cors.php';   // always first
require_once __DIR__ . '/../auth.php';

require_method('POST');
$user = require_user();

$body = json_decode(file_get_contents('php://input'));
$name = trim((string) ($body->name ?? ''));
if ($name === '') {
    fail('Missing field: name.', 422);
}
if (mb_strlen($name) > 120) {
    fail('Workbook name is too long.', 422);
}

$document = $body->document ?? null;
if (!is_object($document)) {
    $document = (object) [
        'version'  => 1,
        'settings' => (object) [
            'dateFormat'       => 'dd/MM/yyyy',
            'timeFormat'       => 'HH:mm:ss',
            'dateTimeFormat'   => 'dd/MM/yyyy HH:mm:ss',
            'currencySymbol'   => '£',
            'currencyDecimals' => 2,
        ],
        'sheets' => [
            (object) [
                'id'        => 's1',
                'name'      => 'Sheet1',
                'rows'      => 50,
                'cols'      => 26,
                'cells'     => (object) [],
                'rowStyles' => (object) [],
                'colStyles' => (object) [],
                'colWidths' => (object) [],
            ],
        ],
    ];
}

$stmt = db()->prepare('INSERT INTO ' . tbl('workbooks') . ' (user_id, name, document) VALUES (?, ?, ?)');
$stmt->execute([$user['id'], $name, json_encode($document)]);
$id = (int) db()->lastInsertId();

respond(['id' => $id], 201);
