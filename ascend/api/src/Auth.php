<?php
declare(strict_types=1);

final class Auth
{
    private const COOKIE = 'ascend_session';
    private const TTL_DAYS = 60;
    private const MAX_FAILS_EMAIL = 8;
    private const MAX_FAILS_IP = 30;
    private const WINDOW_MINUTES = 15;

    /** @return array{id:int,email:string,name:string}|null */
    public static function user(): ?array
    {
        $token = $_COOKIE[self::COOKIE] ?? '';
        if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/', $token)) {
            return null;
        }
        $stmt = Database::pdo()->prepare(
            'SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id
             WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP()'
        );
        $stmt->execute([hash('sha256', $token)]);
        $row = $stmt->fetch();
        return $row ? ['id' => (int)$row['id'], 'email' => $row['email'], 'name' => $row['name']] : null;
    }

    /** @return array{id:int,email:string,name:string} */
    public static function requireUser(): array
    {
        return self::user() ?? Http::error('Trebuie să te autentifici.', 401, 'unauthorized');
    }

    public static function register(): never
    {
        if (!Config::bool('ALLOW_REGISTRATION', true)) {
            Http::error('Înregistrarea conturilor noi este dezactivată pe acest server.', 403, 'registration_closed');
        }
        $body = Http::body();
        $email = mb_strtolower(Http::str($body, 'email', 190));
        $name = Http::str($body, 'name', 80);
        $password = (string)($body->password ?? '');

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Http::error('Adresa de email nu este validă.', 422, 'validation');
        }
        if (mb_strlen($password) < 8 || mb_strlen($password) > 200) {
            Http::error('Parola trebuie să aibă între 8 și 200 de caractere.', 422, 'validation');
        }
        if ($name === '') {
            Http::error('Introdu un nume.', 422, 'validation');
        }

        $pdo = Database::pdo();
        try {
            $pdo->prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)')
                ->execute([$email, $name, password_hash($password, PASSWORD_DEFAULT)]);
        } catch (PDOException $e) {
            if (($e->errorInfo[1] ?? 0) === 1062) {
                Http::error('Există deja un cont cu acest email.', 409, 'email_taken');
            }
            throw $e;
        }
        $id = (int)$pdo->lastInsertId();
        self::startSession($id);
        Http::json(['user' => ['id' => $id, 'email' => $email, 'name' => $name]], 201);
    }

    public static function login(): never
    {
        $body = Http::body();
        $email = mb_strtolower(Http::str($body, 'email', 190));
        $password = (string)($body->password ?? '');
        $pdo = Database::pdo();

        self::guardRateLimit($email);

        $stmt = $pdo->prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            $pdo->prepare('INSERT INTO login_attempts (ip, email) VALUES (?, ?)')->execute([Http::ip(), $email]);
            Http::error('Email sau parolă incorectă.', 401, 'invalid_credentials');
        }

        if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
            $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
                ->execute([password_hash($password, PASSWORD_DEFAULT), $user['id']]);
        }
        $pdo->prepare('DELETE FROM login_attempts WHERE email = ?')->execute([$email]);

        self::startSession((int)$user['id']);
        Http::json(['user' => ['id' => (int)$user['id'], 'email' => $user['email'], 'name' => $user['name']]]);
    }

    public static function logout(): never
    {
        $token = $_COOKIE[self::COOKIE] ?? '';
        if (is_string($token) && $token !== '') {
            Database::pdo()->prepare('DELETE FROM sessions WHERE token_hash = ?')->execute([hash('sha256', $token)]);
        }
        self::setCookie('', time() - 3600);
        Http::json(['ok' => true]);
    }

    public static function me(): never
    {
        $user = self::user();
        $user ? Http::json(['user' => $user]) : Http::error('Neautentificat.', 401, 'unauthorized');
    }

    public static function changePassword(): never
    {
        $user = self::requireUser();
        $body = Http::body();
        $current = (string)($body->currentPassword ?? '');
        $next = (string)($body->newPassword ?? '');
        if (mb_strlen($next) < 8 || mb_strlen($next) > 200) {
            Http::error('Parola nouă trebuie să aibă între 8 și 200 de caractere.', 422, 'validation');
        }
        $pdo = Database::pdo();
        $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
        $stmt->execute([$user['id']]);
        if (!password_verify($current, (string)$stmt->fetchColumn())) {
            Http::error('Parola curentă este greșită.', 403, 'invalid_credentials');
        }
        $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($next, PASSWORD_DEFAULT), $user['id']]);
        // deconectează celelalte dispozitive, păstrează sesiunea curentă
        $pdo->prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?')
            ->execute([$user['id'], hash('sha256', (string)($_COOKIE[self::COOKIE] ?? ''))]);
        Http::json(['ok' => true]);
    }

    private static function guardRateLimit(string $email): void
    {
        $pdo = Database::pdo();
        $since = sprintf('UTC_TIMESTAMP() - INTERVAL %d MINUTE', self::WINDOW_MINUTES);
        $byEmail = $pdo->prepare("SELECT COUNT(*) FROM login_attempts WHERE email = ? AND attempted_at > $since");
        $byEmail->execute([$email]);
        $byIp = $pdo->prepare("SELECT COUNT(*) FROM login_attempts WHERE ip = ? AND attempted_at > $since");
        $byIp->execute([Http::ip()]);
        if ((int)$byEmail->fetchColumn() >= self::MAX_FAILS_EMAIL || (int)$byIp->fetchColumn() >= self::MAX_FAILS_IP) {
            Http::error('Prea multe încercări eșuate. Încearcă din nou peste 15 minute.', 429, 'rate_limited');
        }
    }

    private static function startSession(int $userId): void
    {
        $pdo = Database::pdo();
        $token = bin2hex(random_bytes(32));
        $pdo->prepare(
            'INSERT INTO sessions (token_hash, user_id, expires_at, user_agent)
             VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL ' . self::TTL_DAYS . ' DAY, ?)'
        )->execute([hash('sha256', $token), $userId, substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255)]);

        if (random_int(1, 50) === 1) {
            $pdo->exec('DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP()');
            $pdo->exec('DELETE FROM login_attempts WHERE attempted_at < UTC_TIMESTAMP() - INTERVAL 1 DAY');
        }
        self::setCookie($token, time() + self::TTL_DAYS * 86400);
    }

    private static function setCookie(string $value, int $expires): void
    {
        setcookie(self::COOKIE, $value, [
            'expires' => $expires,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
            'secure' => Http::isHttps(),
        ]);
    }
}
