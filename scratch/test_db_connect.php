<?php
try {
    $dsn = 'mysql:host=srv1328.hstgr.io;port=3306;dbname=u555726154_harichand_db;charset=utf8mb4';
    $user = 'u555726154_harichand_user';
    $pass = 'Harichand@2026#';
    $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_TIMEOUT => 5, PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    echo "CONNECTED_SUCCESS" . PHP_EOL;
    $stmt = $pdo->query('SELECT count(*) as c FROM products');
    $count = $stmt->fetch(PDO::FETCH_ASSOC)['c'];
    echo "TOTAL_PRODUCTS: " . $count . PHP_EOL;
    $rows = $pdo->query('SELECT id, name, category, created_at FROM products')->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as $r) {
        echo "ID: " . $r['id'] . " | " . $r['name'] . " | " . $r['category'] . PHP_EOL;
    }
} catch (Exception $e) {
    echo "CONNECTION_ERROR: " . $e->getMessage() . PHP_EOL;
}
