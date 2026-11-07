<?php
declare(strict_types=1);

final class Config
{
    public static function get(string $key, ?string $default = null): string
    {
        $value = getenv($key);
        if ($value === false || $value === '') {
            if ($default === null) {
                throw new RuntimeException("Lipsește variabila de mediu $key");
            }
            return $default;
        }
        return $value;
    }

    public static function bool(string $key, bool $default): bool
    {
        $value = getenv($key);
        if ($value === false || $value === '') {
            return $default;
        }
        return in_array(strtolower($value), ['1', 'true', 'yes', 'da', 'on'], true);
    }
}
