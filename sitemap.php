<?php
/**
 * ============================================================================
 * HARICHAND STEEL — DYNAMIC & STATIC XML SITEMAP HANDLER
 * Target PHP: Core PHP 8.x
 * URL: https://harichandsteel.com/sitemap.xml
 * ============================================================================
 */

declare(strict_types=1);

header('Content-Type: application/xml; charset=utf-8');
header('X-Robots-Tag: noindex, follow', true);
header('Cache-Control: public, max-age=3600');

$sitemapFile = __DIR__ . '/sitemap.xml';

if (file_exists($sitemapFile) && is_readable($sitemapFile)) {
    readfile($sitemapFile);
    exit;
}

// Fallback: Generate dynamically if sitemap.xml is missing
$baseUrl = 'https://harichandsteel.com';
$currentDate = date('Y-m-d');

$products = [];
$productsFile = __DIR__ . '/data/products.json';
if (file_exists($productsFile)) {
    $decoded = json_decode((string)file_get_contents($productsFile), true);
    if (is_array($decoded)) {
        $products = $decoded;
    }
}

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc><?= $baseUrl ?>/</loc>
    <lastmod><?= $currentDate ?></lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0000</priority>
  </url>
  <url>
    <loc><?= $baseUrl ?>/our-products/</loc>
    <lastmod><?= $currentDate ?></lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc><?= $baseUrl ?>/about-us/</loc>
    <lastmod><?= $currentDate ?></lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc><?= $baseUrl ?>/contact/</loc>
    <lastmod><?= $currentDate ?></lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc><?= $baseUrl ?>/news/</loc>
    <lastmod><?= $currentDate ?></lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc><?= $baseUrl ?>/product/</loc>
    <lastmod><?= $currentDate ?></lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc><?= $baseUrl ?>/privacy-policy/</loc>
    <lastmod><?= $currentDate ?></lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc><?= $baseUrl ?>/product-category/aluminum-profile-gate/</loc>
    <lastmod><?= $currentDate ?></lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc><?= $baseUrl ?>/product-category/iron-main-gate/</loc>
    <lastmod><?= $currentDate ?></lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc><?= $baseUrl ?>/product-category/steel-main-gate/</loc>
    <lastmod><?= $currentDate ?></lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc><?= $baseUrl ?>/product-category/steel-door/</loc>
    <lastmod><?= $currentDate ?></lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc><?= $baseUrl ?>/product-category/powder-coated-gates/</loc>
    <lastmod><?= $currentDate ?></lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc><?= $baseUrl ?>/product-category/modern-railings/</loc>
    <lastmod><?= $currentDate ?></lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc><?= $baseUrl ?>/steel-gate-design/</loc>
    <lastmod><?= $currentDate ?></lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc><?= $baseUrl ?>/best-steel-gate-manufacturer-in-delhi/</loc>
    <lastmod><?= $currentDate ?></lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc><?= $baseUrl ?>/aluminium-profile-gate-manufacturer-in-janakpuri/</loc>
    <lastmod><?= $currentDate ?></lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
<?php foreach ($products as $p): ?>
  <?php if (!empty($p['slug'])): ?>
  <url>
    <loc><?= $baseUrl ?>/product/<?= htmlspecialchars((string)$p['slug'], ENT_QUOTES, 'UTF-8') ?>/</loc>
    <lastmod><?= htmlspecialchars((string)($p['updated_at'] ? substr($p['updated_at'], 0, 10) : ($p['createdAt'] ?? $currentDate)), ENT_QUOTES, 'UTF-8') ?></lastmod>
    <changefreq>weekly</changefreq>
    <priority><?= !empty($p['featured']) ? '0.9' : '0.8' ?></priority>
  </url>
  <?php endif; ?>
<?php endforeach; ?>
</urlset>
