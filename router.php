<?php
/**
 * ============================================================================
 * HARICHAND STEEL — DYNAMIC PAGE ROUTER & SEO SCHEMA INJECTOR
 * Target PHP: Core PHP 8.x + PDO
 * Replaces: Node.js server.js dynamic page routes
 * Handled Routes:
 *   - /product/:slug/              -> product-detail.html + Dynamic Product Schema
 *   - /product-category/:cat/      -> product.html + Dynamic Category Schema & Titles
 *   - Clean Static URLs fallback
 * ============================================================================
 */

declare(strict_types=1);

require_once __DIR__ . '/backend/config/database.php';
require_once __DIR__ . '/backend/services/SchemaGenerator.php';

use Harichand\Config\Database;
use Harichand\Services\SchemaGenerator;

$route = $_GET['route'] ?? '';
$rootDir = __DIR__;

// Helper to query product by slug from MySQL (or JSON fallback)
function getProductBySlug(string $slug): ?array {
    $cleanSlug = strtolower(trim($slug, '/'));
    $pdo = Database::getConnection();
    if ($pdo !== null) {
        try {
            $stmt = $pdo->prepare("SELECT * FROM `products` WHERE LOWER(`slug`) = :s1 OR CAST(`id` AS CHAR) = :s2 LIMIT 1");
            $stmt->execute([':s1' => $cleanSlug, ':s2' => $cleanSlug]);
            $row = $stmt->fetch();
            if ($row) {
                $specs = !empty($row['specs']) ? json_decode($row['specs'], true) : [];
                $schemaData = !empty($row['schema_data']) ? json_decode($row['schema_data'], true) : [];
                
                return array_merge([
                    'id'               => (string)$row['id'],
                    'name'             => $row['name'],
                    'title'            => $row['title'] ?: $row['name'],
                    'slug'             => $row['slug'],
                    'category'         => $row['category'],
                    'categoryName'     => $row['category_display'],
                    'category_display' => $row['category_display'],
                    'badge'            => $row['badge'] ?: 'New Arrival',
                    'price'            => $row['price'] ?: 'On Request',
                    'image'            => $row['image'] ?: 'images/prod-1.png',
                    'description'      => $row['description'],
                    'specs'            => $specs,
                    'outerFrame'       => $row['outer_frame'],
                    'innerFrame'       => $row['inner_frame'],
                    'usage'            => $row['usage_area'] ?? $row['usage_desc'] ?? '',
                    'finish'           => $row['finish'],
                    'hardware'         => $row['hardware'],
                    'automation'       => $row['automation'],
                    'featured'         => (bool)$row['featured'],
                ], $schemaData);
            }
        } catch (\Throwable $e) {
            error_log("[Router Error] DB query failed: " . $e->getMessage());
        }
    }

    // Fallback to data/products.json
    $jsonFile = __DIR__ . '/data/products.json';
    if (file_exists($jsonFile)) {
        $products = json_decode(file_get_contents($jsonFile), true);
        if (is_array($products)) {
            foreach ($products as $p) {
                if (strtolower(trim($p['slug'] ?? '', '/')) === $cleanSlug || strtolower(strval($p['id'] ?? '')) === $cleanSlug) {
                    return $p;
                }
            }
        }
    }
    return null;
}

// ----------------------------------------------------------------------------
// 1. DYNAMIC PRODUCT DETAIL: /product/:slug/
// ----------------------------------------------------------------------------
if ($route === 'product') {
    $slug = $_GET['slug'] ?? '';
    $detailHtmlPath = $rootDir . '/product-detail.html';
    
    if (!file_exists($detailHtmlPath)) {
        http_response_code(404);
        echo "404 Not Found";
        exit;
    }

    $product = getProductBySlug($slug);

    // If product not found in DB or JSON fallback, issue a genuine HTTP 404
    if (!$product) {
        http_response_code(404);
        $notFoundHtmlPath = $rootDir . '/404.html';
        if (file_exists($notFoundHtmlPath)) {
            header('Content-Type: text/html; charset=utf-8');
            include $notFoundHtmlPath;
        } else {
            echo "404 Product Not Found";
        }
        exit;
    }

    $html = file_get_contents($detailHtmlPath);

    $canonicalSlug = $product['slug'] ?? $slug;
    $canonicalUrl = "https://harichandsteel.com/product/" . rawurlencode($canonicalSlug) . "/";

    // Canonical tag injection/replacement
    $canonicalTag = "  <link rel=\"canonical\" href=\"{$canonicalUrl}\">";
    if (str_contains($html, '<link rel="canonical"')) {
        $html = preg_replace('/<link rel="canonical"[^>]*>/i', $canonicalTag, $html);
    } else {
        $html = str_replace('</head>', "{$canonicalTag}\n</head>", $html);
    }

    // Title tag update
    if (!empty($product['name']) || !empty($product['title'])) {
        $displayTitle = $product['title'] ?: $product['name'];
        $prodTitle = htmlspecialchars($displayTitle . ' - HARICHAND STEEL', ENT_QUOTES, 'UTF-8');
        $html = preg_replace('/<title>[\s\S]*?<\/title>/i', "<title>{$prodTitle}</title>", $html);
    }

    // Generate Google-Compliant Product Schema (JSON-LD)
    $domain = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
    $prodSchema = SchemaGenerator::generateProductSchema($product, $domain);

    if ($prodSchema) {
        $schemaJson = json_encode($prodSchema, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $schemaTag = "  <!-- Google Product Schema (JSON-LD) -->\n  <script type=\"application/ld+json\" id=\"schemaProduct\">\n{$schemaJson}\n  </script>";

        if (str_contains($html, 'id="schemaProduct"')) {
            $html = preg_replace('/<!--\s*Product Schema[^>]*-->\s*<script type="application\/ld\+json"[^>]*id="schemaProduct"[^>]*>[\s\S]*?<\/script>/i', $schemaTag, $html);
            if (str_contains($html, 'id="schemaProduct"')) {
                $html = preg_replace('/<script type="application\/ld\+json"[^>]*id="schemaProduct"[^>]*>[\s\S]*?<\/script>/i', $schemaTag, $html);
            }
        } elseif (str_contains($html, '<!-- Favicons -->')) {
            $html = str_replace('<!-- Favicons -->', "{$schemaTag}\n\n  <!-- Favicons -->", $html);
        } elseif (str_contains($html, '</head>')) {
            $html = str_replace('</head>', "{$schemaTag}\n</head>", $html);
        }
    }

    // Inject window.__INITIAL_PRODUCT__ for instant client-side hydration from MySQL
    $initialProductJson = json_encode($product, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $initialProductScript = "  <script>\n    window.__INITIAL_PRODUCT__ = {$initialProductJson};\n  </script>";
    if (str_contains($html, '</head>')) {
        $html = str_replace('</head>', "{$initialProductScript}\n</head>", $html);
    }

    header('Content-Type: text/html; charset=utf-8');
    echo $html;
    exit;
}

// ----------------------------------------------------------------------------
// 2. DYNAMIC PRODUCT CATEGORY: /product-category/:category/
// ----------------------------------------------------------------------------
if ($route === 'category') {
    $category = strtolower(trim($_GET['cat'] ?? ''));
    $pageNum = isset($_GET['page']) ? (int)$_GET['page'] : 1;
    $productHtmlPath = $rootDir . '/product.html';

    if (!file_exists($productHtmlPath)) {
        http_response_code(404);
        echo "404 Not Found";
        exit;
    }

    $html = file_get_contents($productHtmlPath);

    $metaMap = [
        'steel-door' => [
            'title'      => 'Steel Doors',
            'lead'       => 'Heavy-duty security doors designed for main entrances, back doors, and security partitions with multi-point locking systems and weatherproofing.',
            'breadcrumb' => 'Steel Doors',
            'docTitle'   => 'Steel Doors - HARICHAND STEEL'
        ],
        'aluminum-profile-gate' => [
            'title'      => 'Aluminum Profile Gates',
            'lead'       => 'Engineered with lightweight yet rigid aluminium extrusions, offering modern luxury styling, rust-proof longevity, and effortless automation capability.',
            'breadcrumb' => 'Aluminum Profile Gate',
            'docTitle'   => 'Aluminum Profile Gates - HARICHAND STEEL'
        ],
        'iron-main-gate' => [
            'title'      => 'Iron Main Gates',
            'lead'       => 'Heavy-duty wrought iron main entrance gates crafted with traditional forged strength, security spikes, and timeless aesthetic designs.',
            'breadcrumb' => 'Iron Main Gate',
            'docTitle'   => 'Iron Main Gates - HARICHAND STEEL'
        ],
        'steel-main-gate' => [
            'title'      => 'Steel Main Gates',
            'lead'       => 'Fabricated from genuine SS304 grade stainless steel and heavy-gauge mild steel featuring intricate CNC laser-cut designs with polished mirror or matte finishes.',
            'breadcrumb' => 'Steel Main Gate',
            'docTitle'   => 'Steel Main Gates - HARICHAND STEEL'
        ],
        'powder-coated-gates' => [
            'title'      => 'Powder Coated Gates',
            'lead'       => 'Superior rust-resistant powder-coated gate systems offering vibrant long-lasting exterior colors, UV protection, and minimal maintenance.',
            'breadcrumb' => 'Powder Coated Gates',
            'docTitle'   => 'Powder Coated Gates - HARICHAND STEEL'
        ]
    ];

    $meta = $metaMap[$category] ?? [
        'title'      => ucwords(str_replace('-', ' ', $category)),
        'lead'       => "Explore our premium handcrafted " . str_replace('-', ' ', $category) . " models built for luxury, safety, and longevity.",
        'breadcrumb' => ucwords(str_replace('-', ' ', $category)),
        'docTitle'   => ucwords(str_replace('-', ' ', $category)) . " - HARICHAND STEEL"
    ];

    $fullTitle = $pageNum > 1 ? "{$meta['title']} (Page {$pageNum})" : $meta['title'];
    $fullDocTitle = $pageNum > 1 ? "{$meta['title']} - Page {$pageNum} - HARICHAND STEEL" : $meta['docTitle'];

    // Update <title>
    $html = preg_replace('/<title>.*?<\/title>/i', "<title>{$fullDocTitle}</title>", $html);
    
    // Update Canonical URL
    $canonicalCatUrl = "https://harichandsteel.com/product-category/" . rawurlencode($category) . "/" . ($pageNum > 1 ? "?page=" . $pageNum : "");
    if (str_contains($html, '<link rel="canonical"')) {
        $html = preg_replace('/<link rel="canonical"[^>]*>/i', '<link rel="canonical" href="' . $canonicalCatUrl . '">', $html);
    } else {
        $html = str_replace('</head>', "  <link rel=\"canonical\" href=\"{$canonicalCatUrl}\">\n</head>", $html);
    }

    // Update Page Title H1
    $html = preg_replace('/(<h1[^>]*class="[^"]*page-title[^"]*"[^>]*>).*?(<\/h1>)/i', "\${1}{$fullTitle}\${2}", $html);
    // Update Page Lead P
    $html = preg_replace('/(<p[^>]*class="[^"]*page-lead[^"]*"[^>]*>).*?(<\/p>)/i', "\${1}{$meta['lead']}\${2}", $html);

    // Switch active filter button
    $html = preg_replace('/(<button[^>]*class="[^"]*filter-btn)\s+active([^"]*"[^>]*data-filter="all")/i', '$1$2', $html);
    $html = preg_replace('/(<button[^>]*class="[^"]*filter-btn)([^"]*"[^>]*data-filter="' . preg_quote($category, '/') . '")/i', '$1 active$2', $html);

    header('Content-Type: text/html; charset=utf-8');
    echo $html;
    exit;
}

// Fallback to index.html
include $rootDir . '/index.html';
