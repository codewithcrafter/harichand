<?php
/**
 * ============================================================================
 * HARICHAND STEEL — PRODUCTS REST API CONTROLLER
 * Routes:
 *   GET    /api/products          (Public: list catalogue)
 *   POST   /api/products          (Admin: create product)
 *   PUT    /api/products          (Admin: update product)
 *   DELETE /api/products?id={id}  (Admin: delete product)
 * Target PHP: Core PHP 8.x + PDO
 * ============================================================================
 */

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/includes/response.php';
require_once dirname(__DIR__, 2) . '/includes/security.php';
require_once dirname(__DIR__, 2) . '/includes/auth_middleware.php';
require_once dirname(__DIR__, 2) . '/config/database.php';

use Harichand\Includes\Response;
use Harichand\Includes\Security;
use Harichand\Includes\AuthMiddleware;
use Harichand\Config\Database;

Response::handleCors();

$method = $_SERVER['REQUEST_METHOD'];
$pdo = Database::getConnection();
$productsFile = dirname(__DIR__, 3) . '/data/products.json';

// Helper to read local JSON fallback
function readLocalProducts(string $path): array {
    if (file_exists($path)) {
        try {
            $data = json_decode(file_get_contents($path), true);
            return is_array($data) ? $data : [];
        } catch (\Throwable $e) {}
    }
    return [];
}

// Helper to write local JSON fallback
function writeLocalProducts(string $path, array $data): void {
    try {
        file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    } catch (\Throwable $e) {
        error_log("[Product API] Failed to write fallback JSON: " . $e->getMessage());
    }
}

// ----------------------------------------------------------------------------
// 1. GET /api/products (Catalogue Query)
// ----------------------------------------------------------------------------
if ($method === 'GET' || $method === 'HEAD') {
    if ($pdo !== null) {
        try {
            $stmt = $pdo->query("SELECT * FROM `products` ORDER BY `id` ASC");
            $rows = $stmt->fetchAll();

            $products = array_map(function ($r) {
                $specs = !empty($r['specs']) ? json_decode($r['specs'], true) : [];
                $schemaData = !empty($r['schema_data']) ? json_decode($r['schema_data'], true) : [];

                $p = [
                    'id'               => (string)$r['id'],
                    'name'             => $r['name'],
                    'title'            => $r['title'] ?: $r['name'],
                    'slug'             => $r['slug'],
                    'category'         => $r['category'],
                    'categoryName'     => $r['category_display'],
                    'category_display' => $r['category_display'],
                    'badge'            => $r['badge'] ?: 'New Arrival',
                    'price'            => $r['price'] ?: 'On Request',
                    'image'            => $r['image'] ?: 'images/prod-1.png',
                    'description'      => $r['description'] ?: '',
                    'outerFrame'       => $r['outer_frame'] ?: '',
                    'outer_frame'      => $r['outer_frame'] ?: '',
                    'innerFrame'       => $r['inner_frame'] ?: '',
                    'inner_frame'      => $r['inner_frame'] ?: '',
                    'usage'            => $r['usage_area'] ?: '',
                    'finish'           => $r['finish'] ?: '',
                    'hardware'         => $r['hardware'] ?: '',
                    'automation'       => $r['automation'] ?: '',
                    'featured'         => (bool)$r['featured'],
                    'createdAt'        => !empty($r['created_at']) ? substr($r['created_at'], 0, 10) : '',
                    'created_at'       => $r['created_at'],
                    'specs'            => is_array($specs) ? $specs : []
                ];

                // Merge Google Schema Data
                if (is_array($schemaData)) {
                    $p = array_merge($p, $schemaData);
                }

                return $p;
            }, $rows);

            Response::json($products);
        } catch (\Throwable $e) {
            error_log("[Product API] SQL Error: " . $e->getMessage());
        }
    }

    // Fallback to local JSON
    $local = readLocalProducts($productsFile);
    Response::json($local);
}

// ----------------------------------------------------------------------------
// 2. POST / PUT /api/products (Create or Update Product - Admin Only)
// ----------------------------------------------------------------------------
if ($method === 'POST' || $method === 'PUT') {
    AuthMiddleware::requireAdmin();

    $payload = Response::getJsonBody();
    if (empty($payload)) {
        Response::error('Empty or invalid product payload', 400);
    }

    $items = array_is_list($payload) ? $payload : [$payload];
    $localProducts = readLocalProducts($productsFile);

    foreach ($items as &$item) {
        $title = Security::sanitizeString($item['title'] ?? $item['name'] ?? 'Custom Gate');
        $slug = Security::sanitizeSlug($item['slug'] ?? $title);
        $id = isset($item['id']) && is_numeric($item['id']) ? (int)$item['id'] : null;

        $category = Security::sanitizeString($item['category'] ?? 'aluminum-profile-gate');
        $categoryDisplay = Security::sanitizeString($item['category_display'] ?? $item['categoryName'] ?? 'Aluminum Profile Gate');
        $badge = Security::sanitizeString($item['badge'] ?? 'New Arrival');
        $price = Security::sanitizeString($item['price'] ?? 'On Request');
        $image = trim($item['image'] ?? 'images/prod-1.png');
        $description = trim($item['description'] ?? '');

        $outerFrame = Security::sanitizeString($item['outerFrame'] ?? $item['outer_frame'] ?? '14 Gauge (14G) steel frame');
        $innerFrame = Security::sanitizeString($item['innerFrame'] ?? $item['inner_frame'] ?? '16 Gauge (16G) steel frame');
        $usage = Security::sanitizeString($item['usage'] ?? 'Residential, commercial, industrial entrances');
        $finish = Security::sanitizeString($item['finish'] ?? 'AkzoNobel powder coated or painted');
        $hardware = Security::sanitizeString($item['hardware'] ?? 'Heavy-duty sealed stainless-steel ball bearing hinges');
        $automation = Security::sanitizeString($item['automation'] ?? '100% compatible with motorized remote operators');
        $featured = !empty($item['featured']) ? 1 : 0;

        $specs = isset($item['specs']) && is_array($item['specs']) ? $item['specs'] : [];
        $specsJson = json_encode($specs, JSON_UNESCAPED_UNICODE);

        $schemaData = [
            'schemaEnabled'        => $item['schemaEnabled'] ?? true,
            'schemaOfferEnabled'   => $item['schemaOfferEnabled'] ?? true,
            'schemaReviewEnabled'  => $item['schemaReviewEnabled'] ?? false,
            'schemaSku'            => Security::sanitizeString($item['schemaSku'] ?? ''),
            'schemaMpn'            => Security::sanitizeString($item['schemaMpn'] ?? ''),
            'schemaBrand'          => Security::sanitizeString($item['schemaBrand'] ?? 'Harichand Steel'),
            'schemaGtin'           => Security::sanitizeString($item['schemaGtin'] ?? ''),
            'schemaPrice'          => $item['schemaPrice'] ?? '25000',
            'schemaCurrency'       => Security::sanitizeString($item['schemaCurrency'] ?? 'INR'),
            'schemaAvailability'   => Security::sanitizeString($item['schemaAvailability'] ?? 'https://schema.org/InStock'),
            'schemaCondition'      => Security::sanitizeString($item['schemaCondition'] ?? 'https://schema.org/NewCondition'),
            'schemaPriceValidUntil'=> Security::sanitizeString($item['schemaPriceValidUntil'] ?? '2026-12-31'),
            'schemaRatingValue'    => $item['schemaRatingValue'] ?? '',
            'schemaReviewCount'    => $item['schemaReviewCount'] ?? '',
            'schemaReviews'        => isset($item['schemaReviews']) && is_array($item['schemaReviews']) ? $item['schemaReviews'] : []
        ];
        $schemaJson = json_encode($schemaData, JSON_UNESCAPED_UNICODE);

        // 2a. Persist to MySQL
        if ($pdo !== null) {
            try {
                $sql = "
                    INSERT INTO `products` (
                        `id`, `name`, `title`, `slug`, `category`, `category_display`, `badge`, `price`,
                        `image`, `description`, `outer_frame`, `inner_frame`, `usage_area`, `finish`,
                        `hardware`, `automation`, `featured`, `specs`, `schema_data`
                    ) VALUES (
                        :id, :name, :title, :slug, :category, :category_display, :badge, :price,
                        :image, :description, :outer_frame, :inner_frame, :usage_area, :finish,
                        :hardware, :automation, :featured, :specs, :schema_data
                    )
                    ON DUPLICATE KEY UPDATE
                        `name`             = VALUES(`name`),
                        `title`            = VALUES(`title`),
                        `category`         = VALUES(`category`),
                        `category_display` = VALUES(`category_display`),
                        `badge`            = VALUES(`badge`),
                        `price`            = VALUES(`price`),
                        `image`            = VALUES(`image`),
                        `description`      = VALUES(`description`),
                        `outer_frame`      = VALUES(`outer_frame`),
                        `inner_frame`      = VALUES(`inner_frame`),
                        `usage_area`       = VALUES(`usage_area`),
                        `finish`           = VALUES(`finish`),
                        `hardware`         = VALUES(`hardware`),
                        `automation`       = VALUES(`automation`),
                        `featured`         = VALUES(`featured`),
                        `specs`            = VALUES(`specs`),
                        `schema_data`      = VALUES(`schema_data`)
                ";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
                    ':id'               => $id,
                    ':name'             => $title,
                    ':title'            => $title,
                    ':slug'             => $slug,
                    ':category'         => $category,
                    ':category_display' => $categoryDisplay,
                    ':badge'            => $badge,
                    ':price'            => $price,
                    ':image'            => $image,
                    ':description'      => $description,
                    ':outer_frame'      => $outerFrame,
                    ':inner_frame'      => $innerFrame,
                    ':usage_area'       => $usage,
                    ':finish'           => $finish,
                    ':hardware'         => $hardware,
                    ':automation'       => $automation,
                    ':featured'         => $featured,
                    ':specs'            => $specsJson,
                    ':schema_data'      => $schemaJson
                ]);

                if (!$id) {
                    $item['id'] = (string)$pdo->lastInsertId();
                }
            } catch (\Throwable $e) {
                error_log("[Product API] Save SQL error: " . $e->getMessage());
            }
        }

        // 2b. Dual-sync to Local JSON
        $item['slug'] = $slug;
        $item['title'] = $title;
        $existingIdx = -1;
        foreach ($localProducts as $idx => $lp) {
            if ((isset($item['id']) && (string)$lp['id'] === (string)$item['id']) ||
                (isset($lp['slug']) && $lp['slug'] === $slug)) {
                $existingIdx = $idx;
                break;
            }
        }

        if ($existingIdx !== -1) {
            $localProducts[$existingIdx] = array_merge($localProducts[$existingIdx], $item);
        } else {
            if (empty($item['id'])) $item['id'] = 'prod-' . time();
            array_unshift($localProducts, $item);
        }
    }

    writeLocalProducts($productsFile, $localProducts);

    if (array_is_list($payload)) {
        Response::json(['success' => true, 'count' => count($items)]);
    } else {
        Response::json(['success' => true, 'product' => $items[0]]);
    }
}

// ----------------------------------------------------------------------------
// 3. DELETE /api/products?id={id} (Delete Product - Admin Only)
// ----------------------------------------------------------------------------
if ($method === 'DELETE') {
    AuthMiddleware::requireAdmin();

    $id = $_GET['id'] ?? null;
    if (!$id) {
        $body = Response::getJsonBody();
        $id = $body['id'] ?? null;
    }

    if (!$id) {
        Response::error('Product ID required', 400);
    }

    $idStr = (string)$id;

    // 3a. Delete from MySQL
    if ($pdo !== null) {
        try {
            $stmt = $pdo->prepare("DELETE FROM `products` WHERE `id` = :id OR `slug` = :slug");
            $stmt->execute([':id' => $idStr, ':slug' => $idStr]);
        } catch (\Throwable $e) {
            error_log("[Product API] Delete SQL error: " . $e->getMessage());
        }
    }

    // 3b. Delete from local JSON
    $localProducts = readLocalProducts($productsFile);
    $localProducts = array_values(array_filter($localProducts, function ($p) use ($idStr) {
        return (string)($p['id'] ?? '') !== $idStr && ($p['slug'] ?? '') !== $idStr;
    }));
    writeLocalProducts($productsFile, $localProducts);

    Response::json(['success' => true, 'id' => $idStr]);
}

Response::error('Method Not Allowed', 405);

