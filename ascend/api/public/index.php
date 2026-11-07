<?php
declare(strict_types=1);

$root = getenv('ASCEND_APP_ROOT') ?: dirname(__DIR__);
require $root . '/src/bootstrap.php';

header('X-Content-Type-Options: nosniff');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = (string)parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$path = preg_replace('#^.*?/api(?=/|$)#', '', $path) ?? '';
$path = '/' . trim($path, '/');

// protecție CSRF: cererile care modifică date trebuie să vină din aplicație
if ($method !== 'GET' && ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'ascend') {
    Http::error('Cerere respinsă.', 403, 'csrf');
}

match ("$method $path") {
    'GET /health' => Http::json([
        'ok' => true,
        'service' => 'ascend',
        'registration' => Config::bool('ALLOW_REGISTRATION', true),
    ]),
    'POST /auth/register' => Auth::register(),
    'POST /auth/login' => Auth::login(),
    'POST /auth/logout' => Auth::logout(),
    'GET /auth/me' => Auth::me(),
    'POST /auth/password' => Auth::changePassword(),
    'GET /state' => State::get(),
    'PUT /state' => State::put(),
    default => Http::error('Ruta nu există.', 404, 'not_found'),
};
