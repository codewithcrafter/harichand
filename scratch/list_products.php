<?php
$data = json_decode(file_get_contents(__DIR__ . '/../data/products.json'), true);
echo "Total products in data/products.json: " . count($data) . "\n\n";
foreach ($data as $i => $p) {
    $id = $p['id'] ?? 'no-id';
    $title = $p['title'] ?? $p['name'] ?? 'no-title';
    $cat = $p['category'] ?? 'no-cat';
    $badge = $p['badge'] ?? '';
    $price = $p['price'] ?? '';
    echo sprintf("%2d. ID: %-5s | %-55s | %-22s | %s\n", $i + 1, $id, mb_substr($title, 0, 55), $cat, $badge);
}
