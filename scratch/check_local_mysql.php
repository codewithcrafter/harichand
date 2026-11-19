<?php
try {
    $pdo = new PDO('mysql:host=127.0.0.1;port=3306;charset=utf8mb4', 'root', '', [PDO::ATTR_TIMEOUT => 2]);
    echo "MySQL is running locally!\n";
    $dbs = $pdo->query('SHOW DATABASES')->fetchAll(PDO::FETCH_COLUMN);
    echo "Databases: " . implode(', ', $dbs) . "\n";
    
    foreach ($dbs as $db) {
        try {
            $pdo->exec("USE `$db`");
            $tables = $pdo->query("SHOW TABLES LIKE 'products'")->fetchAll(PDO::FETCH_COLUMN);
            if (!empty($tables)) {
                $count = $pdo->query("SELECT count(*) FROM `products`")->fetchColumn();
                echo "Database '$db' has table 'products' with $count rows!\n";
            }
        } catch (\Exception $e) {}
    }
} catch (Exception $e) {
    echo "Local MySQL Error: " . $e->getMessage() . "\n";
}
