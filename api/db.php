<?php
/**
 * PDO connection to MySQL, shared by every endpoint.
 *
 * Exposes db() which returns a single lazily created PDO instance.
 *
 * @package XL\Api
 */

require_once __DIR__ . '/config.php';

/**
 * Return the shared PDO connection.
 *
 * @return PDO
 */
function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $c = $GLOBALS['XL_CONFIG']['db'];
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $c['host'],
        $c['port'] ?? 3306,
        $c['name']
    );

    try {
        $pdo = new PDO($dsn, $c['user'], $c['pass'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed.']);
        exit();
    }

    return $pdo;
}

/**
 * Prefix a base table name with the configured table prefix.
 *
 * The prefix (default "xl_") lets these tables share a database with other
 * applications. It comes from config.json ("tablePrefix") and is never built
 * from user input, so it is safe to inline into SQL. If you change it, also
 * change the CREATE TABLE names in schema.sql.
 *
 * @param string $name Base name, e.g. "users".
 * @return string Prefixed name, e.g. "xl_users".
 */
function tbl(string $name): string
{
    $prefix = $GLOBALS['XL_CONFIG']['tablePrefix'] ?? 'xl_';
    return $prefix . $name;
}
