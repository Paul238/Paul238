<?php
declare(strict_types=1);

/**
 * Starea aplicației unui utilizator, salvată ca document JSON.
 * Folosește „optimistic locking”: clientul trimite revizia pe care a pornit-o;
 * dacă între timp alt dispozitiv a salvat, răspunsul este 409 cu versiunea curentă.
 */
final class State
{
    public static function get(): never
    {
        $user = Auth::requireUser();
        $stmt = Database::pdo()->prepare('SELECT data, revision FROM user_state WHERE user_id = ?');
        $stmt->execute([$user['id']]);
        $row = $stmt->fetch();
        if (!$row) {
            Http::json(['data' => null, 'revision' => 0]);
        }
        Http::raw('{"data":' . $row['data'] . ',"revision":' . (int)$row['revision'] . '}');
    }

    public static function put(): never
    {
        $user = Auth::requireUser();
        $body = Http::body();
        $data = $body->data ?? null;
        $base = $body->revision ?? null;

        if (!$data instanceof stdClass || ($data->version ?? null) !== 1 || !is_array($data->tasks ?? null)) {
            Http::error('Format de date invalid.', 422, 'validation');
        }
        if (!is_int($base) || $base < 0) {
            Http::error('Revizie invalidă.', 422, 'validation');
        }

        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('SELECT data, revision FROM user_state WHERE user_id = ? FOR UPDATE');
            $stmt->execute([$user['id']]);
            $row = $stmt->fetch();
            $current = $row ? (int)$row['revision'] : 0;

            if ($current !== $base) {
                $pdo->rollBack();
                Http::raw('{"conflict":true,"data":' . ($row['data'] ?? 'null') . ',"revision":' . $current . '}', 409);
            }

            $next = $current + 1;
            if ($row) {
                $pdo->prepare('UPDATE user_state SET data = ?, revision = ? WHERE user_id = ?')->execute([$json, $next, $user['id']]);
            } else {
                $pdo->prepare('INSERT INTO user_state (user_id, data, revision) VALUES (?, ?, ?)')->execute([$user['id'], $json, $next]);
            }
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
        Http::json(['revision' => $next]);
    }
}
