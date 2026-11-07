<?php
declare(strict_types=1);

final class Http
{
    /** limită pentru corpul cererilor (starea completă a unui utilizator) */
    public const MAX_BODY = 16 * 1024 * 1024;

    public static function json(mixed $data, int $status = 200): never
    {
        self::raw(json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), $status);
    }

    public static function raw(string $json, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo $json;
        exit;
    }

    public static function error(string $message, int $status, string $code = 'error'): never
    {
        self::json(['error' => $message, 'code' => $code], $status);
    }

    public static function body(): stdClass
    {
        $raw = file_get_contents('php://input', false, null, 0, self::MAX_BODY + 1);
        if ($raw === false || strlen($raw) > self::MAX_BODY) {
            self::error('Cererea este prea mare.', 413, 'too_large');
        }
        if ($raw === '') {
            return new stdClass();
        }
        try {
            $data = json_decode($raw, false, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            self::error('JSON invalid.', 400, 'invalid_json');
        }
        if (!$data instanceof stdClass) {
            self::error('Se aștepta un obiect JSON.', 400, 'invalid_json');
        }
        return $data;
    }

    public static function str(stdClass $body, string $key, int $max = 255): string
    {
        $v = $body->{$key} ?? '';
        if (!is_string($v)) {
            self::error("Câmpul $key este invalid.", 422, 'validation');
        }
        $v = trim($v);
        if (mb_strlen($v) > $max) {
            self::error("Câmpul $key este prea lung.", 422, 'validation');
        }
        return $v;
    }

    public static function isHttps(): bool
    {
        return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    }

    public static function ip(): string
    {
        return substr((string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 0, 45);
    }
}
