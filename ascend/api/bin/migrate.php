<?php
declare(strict_types=1);

// Aplică migrațiile SQL care nu au rulat încă. Rulează la fiecare pornire a containerului.
$root = getenv('ASCEND_APP_ROOT') ?: dirname(__DIR__);
require $root . '/src/Config.php';
require $root . '/src/Database.php';

$pdo = null;
for ($i = 1; $i <= 60; $i++) {
    try {
        $pdo = Database::pdo();
        break;
    } catch (PDOException $e) {
        fwrite(STDERR, "[migrate] baza de date nu e gata ($i/60): {$e->getMessage()}\n");
        sleep(2);
    }
}
if (!$pdo) {
    fwrite(STDERR, "[migrate] nu m-am putut conecta la baza de date\n");
    exit(1);
}

$pdo->exec('CREATE TABLE IF NOT EXISTS migrations (name VARCHAR(190) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB');
$done = $pdo->query('SELECT name FROM migrations')->fetchAll(PDO::FETCH_COLUMN);
$files = glob($root . '/migrations/*.sql') ?: [];
sort($files);

foreach ($files as $file) {
    $name = basename($file);
    if (in_array($name, $done, true)) {
        continue;
    }
    $sql = preg_replace('/^\s*--.*$/m', '', (string)file_get_contents($file));
    foreach (array_filter(array_map('trim', explode(';', (string)$sql))) as $statement) {
        $pdo->exec($statement);
    }
    $pdo->prepare('INSERT INTO migrations (name) VALUES (?)')->execute([$name]);
    echo "[migrate] aplicat $name\n";
}
echo "[migrate] baza de date este la zi\n";
