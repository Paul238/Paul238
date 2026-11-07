<?php
declare(strict_types=1);

require __DIR__ . '/Config.php';
require __DIR__ . '/Database.php';
require __DIR__ . '/Http.php';
require __DIR__ . '/Auth.php';
require __DIR__ . '/State.php';

ini_set('display_errors', '0');
error_reporting(E_ALL);

set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

set_exception_handler(static function (Throwable $e): void {
    error_log('[ascend] ' . $e::class . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(['error' => 'Eroare internă de server.', 'code' => 'server_error']);
});
