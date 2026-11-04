<?php
/**
 * ============================================================================
 * HARICHAND STEEL — JSON TO MYSQL DATA MIGRATION SCRIPT
 * Target PHP: Core PHP 8.x + PDO
 * Target Engine: MySQL 8.x / MariaDB 10.4+
 * Purpose: One-time idempotent import from data/*.json into normalized tables
 * Non-destructive: Never modifies or deletes source JSON files.
 * Idempotent: Safe to execute multiple times without creating duplicate records.
 * ============================================================================
 */

declare(strict_types=1);

// Prevent memory limits on large image strings
ini_set('memory_limit', '256M');
set_time_limit(180);

// Set UTF-8 header if accessed via browser
if (php_sapi_name() !== 'cli') {
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Harichand Steel — JSON Migration</title>';
    echo '<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;line-height:1.6;padding:0 20px;background:#0d1117;color:#c9d1d9;}';
    echo 'h1{color:#f0f6fc;border-bottom:1px solid #30363d;padding-bottom:12px;}pre{background:#161b22;padding:16px;border-radius:6px;overflow-x:auto;border:1px solid #30363d;color:#58a6ff;}';
    echo '.success{color:#3fb950;font-weight:bold;}.error{color:#f85149;font-weight:bold;}.info{color:#8b949e;}</style></head><body>';
    echo '<h1>Harichand Steel — Database Migration Engine</h1>';
}

function logMsg(string $msg, string $type = 'info'): void {
    $timestamp = date('Y-m-d H:i:s');
    if (php_sapi_name() === 'cli') {
        echo "[$timestamp] $msg" . PHP_EOL;
    } else {
        $class = ($type === 'success') ? 'success' : (($type === 'error') ? 'error' : 'info');
        echo "<div class=\"$class\">[$timestamp] $msg</div>";
    }
}

// ----------------------------------------------------------------------------
// 1. DATABASE CONFIGURATION
// Loads from environment variables or falls back to standard defaults
// ----------------------------------------------------------------------------
$dbHost = getenv('DB_HOST') ?: '127.0.0.1';
$dbPort = getenv('DB_PORT') ?: '3306';
$dbName = getenv('DB_NAME') ?: 'harichand_db';
$dbUser = getenv('DB_USER') ?: 'root';
$dbPass = getenv('DB_PASS') ?: '';
$dbCharset = 'utf8mb4';

// Check if a local config file exists
$configPath = dirname(__DIR__) . '/backend/config/database.php';
if (file_exists($configPath)) {
    try {
        $loadedConfig = require $configPath;
        if (is_array($loadedConfig)) {
            $dbHost = $loadedConfig['host'] ?? $dbHost;
            $dbPort = $loadedConfig['port'] ?? $dbPort;
            $dbName = $loadedConfig['database'] ?? $dbName;
            $dbUser = $loadedConfig['username'] ?? $dbUser;
            $dbPass = $loadedConfig['password'] ?? $dbPass;
        }
    } catch (\Throwable $e) {
        // Continue with defaults
    }
}

logMsg("Configured Database: Host=$dbHost, Port=$dbPort, DB=$dbName, User=$dbUser");

// ----------------------------------------------------------------------------
// 2. CONNECT TO MYSQL VIA PDO
// ----------------------------------------------------------------------------
$dsn = "mysql:host=$dbHost;port=$dbPort;dbname=$dbName;charset=$dbCharset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
    PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
];

try {
    $pdo = new PDO($dsn, $dbUser, $dbPass, $options);
    logMsg("Connected to MySQL successfully!", "success");
} catch (PDOException $e) {
    logMsg("DATABASE CONNECTION FAILED: " . $e->getMessage(), "error");
    logMsg("Please verify that your MySQL server is running and database '$dbName' exists.", "info");
    logMsg("For Hostinger: Create the database in hPanel / cPanel and configure credentials in backend/config/database.php", "info");
    if (php_sapi_name() !== 'cli') echo '</body></html>';
    exit(1);
}

// ----------------------------------------------------------------------------
// 3. SOURCE FILE RESOLUTION & VALIDATION
// ----------------------------------------------------------------------------
$rootDir = dirname(__DIR__);
$productsFile  = $rootDir . '/data/products.json';
$blogsFile     = $rootDir . '/data/blogs.json';
$inquiriesFile = $rootDir . '/data/inquiries.json';

foreach (['products' => $productsFile, 'blogs' => $blogsFile, 'inquiries' => $inquiriesFile] as $label => $file) {
    if (!file_exists($file)) {
        logMsg("FATAL: Source $label file not found at: $file", "error");
        exit(1);
    }
}

// ----------------------------------------------------------------------------
// 4. MIGRATION TRANSACTION
// ----------------------------------------------------------------------------
try {
    $pdo->beginTransaction();

    // ------------------------------------------------------------------------
    // A. MIGRATE PRODUCTS (19 Records)
    // ------------------------------------------------------------------------
    logMsg("Starting Products migration...");
    $productsJson = file_get_contents($productsFile);
    $products = json_decode($productsJson, true);

    if (!is_array($products)) {
        throw new RuntimeException("Invalid JSON format in products.json");
    }

    $prodStmt = $pdo->prepare("
        INSERT INTO `products` (
            `id`, `name`, `title`, `slug`, `category`, `category_display`, `badge`, `price`,
            `image`, `description`, `outer_frame`, `inner_frame`, `usage_area`, `finish`,
            `hardware`, `automation`, `featured`, `specs`, `schema_data`, `created_at`
        ) VALUES (
            :id, :name, :title, :slug, :category, :category_display, :badge, :price,
            :image, :description, :outer_frame, :inner_frame, :usage_area, :finish,
            :hardware, :automation, :featured, :specs, :schema_data, :created_at
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
    ");

    $prodImported = 0;
    $prodUpdated = 0;

    foreach ($products as $p) {
        $id = is_numeric($p['id'] ?? null) ? (int)$p['id'] : null;
        $title = trim($p['title'] ?? $p['name'] ?? 'Untitled Gate');
        $name = trim($p['name'] ?? $title);
        $slug = trim($p['slug'] ?? strtolower(preg_replace('/[^a-z0-9_-]+/i', '-', $title)));
        $slug = trim($slug, '-');

        $category = trim($p['category'] ?? 'aluminum-profile-gate');
        $categoryDisplay = trim($p['category_display'] ?? $p['categoryName'] ?? 'Aluminum Profile Gate');
        $badge = trim($p['badge'] ?? 'New Arrival');
        $price = trim($p['price'] ?? 'On Request');
        $image = trim($p['image'] ?? 'images/prod-1.png');
        $description = trim($p['description'] ?? '');

        $outerFrame = trim($p['outerFrame'] ?? $p['outer_frame'] ?? '14 Gauge (14G) steel frame');
        $innerFrame = trim($p['innerFrame'] ?? $p['inner_frame'] ?? '16 Gauge (16G) steel frame');
        $usage = trim($p['usage'] ?? 'Residential, commercial, industrial entrances');
        $finish = trim($p['finish'] ?? 'AkzoNobel powder coated or painted');
        $hardware = trim($p['hardware'] ?? 'Heavy-duty sealed stainless-steel ball bearing hinges');
        $automation = trim($p['automation'] ?? '100% compatible with motorized remote operators');
        $featured = !empty($p['featured']) ? 1 : 0;

        // Specs array into JSON
        $specsArray = isset($p['specs']) && is_array($p['specs']) ? $p['specs'] : [];
        $specsJson = json_encode($specsArray, JSON_UNESCAPED_UNICODE);

        // Schema data object into JSON
        $schemaObj = [
            'schemaEnabled'        => $p['schemaEnabled'] ?? true,
            'schemaOfferEnabled'   => $p['schemaOfferEnabled'] ?? true,
            'schemaReviewEnabled'  => $p['schemaReviewEnabled'] ?? false,
            'schemaSku'            => $p['schemaSku'] ?? '',
            'schemaMpn'            => $p['schemaMpn'] ?? '',
            'schemaBrand'          => $p['schemaBrand'] ?? 'Harichand Steel',
            'schemaGtin'           => $p['schemaGtin'] ?? '',
            'schemaPrice'          => $p['schemaPrice'] ?? '25000',
            'schemaCurrency'       => $p['schemaCurrency'] ?? 'INR',
            'schemaAvailability'   => $p['schemaAvailability'] ?? 'https://schema.org/InStock',
            'schemaCondition'      => $p['schemaCondition'] ?? 'https://schema.org/NewCondition',
            'schemaPriceValidUntil'=> $p['schemaPriceValidUntil'] ?? '2026-12-31',
            'schemaRatingValue'    => $p['schemaRatingValue'] ?? '',
            'schemaReviewCount'    => $p['schemaReviewCount'] ?? '',
            'schemaReviews'        => isset($p['schemaReviews']) && is_array($p['schemaReviews']) ? $p['schemaReviews'] : []
        ];
        $schemaJson = json_encode($schemaObj, JSON_UNESCAPED_UNICODE);

        // Created date
        $createdAtRaw = $p['created_at'] ?? $p['createdAt'] ?? date('Y-m-d H:i:s');
        $createdTimestamp = date('Y-m-d H:i:s', strtotime($createdAtRaw) ?: time());

        $prodStmt->execute([
            ':id'               => $id,
            ':name'             => $name,
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
            ':schema_data'      => $schemaJson,
            ':created_at'       => $createdTimestamp
        ]);

        $prodImported++;
    }
    logMsg("Products migrated successfully: $prodImported records processed.", "success");

    // ------------------------------------------------------------------------
    // B. MIGRATE BLOGS (4 Records)
    // ------------------------------------------------------------------------
    logMsg("Starting Blogs migration...");
    $blogsJson = file_get_contents($blogsFile);
    $blogs = json_decode($blogsJson, true);

    if (!is_array($blogs)) {
        throw new RuntimeException("Invalid JSON format in blogs.json");
    }

    $blogStmt = $pdo->prepare("
        INSERT INTO `blogs` (
            `code`, `title`, `slug`, `tag`, `author`, `date_published`,
            `image`, `excerpt`, `content`, `published`
        ) VALUES (
            :code, :title, :slug, :tag, :author, :date_published,
            :image, :excerpt, :content, :published
        )
        ON DUPLICATE KEY UPDATE
            `title`          = VALUES(`title`),
            `tag`            = VALUES(`tag`),
            `author`         = VALUES(`author`),
            `date_published` = VALUES(`date_published`),
            `image`          = VALUES(`image`),
            `excerpt`        = VALUES(`excerpt`),
            `content`        = VALUES(`content`),
            `published`      = VALUES(`published`)
    ");

    $blogImported = 0;
    foreach ($blogs as $b) {
        $code = trim($b['id'] ?? 'blog-' . ($blogImported + 1));
        $title = trim($b['title'] ?? 'Untitled Article');
        $slug = trim($b['slug'] ?? '/news.html');
        $tag = trim($b['tag'] ?? 'Guide');
        $author = trim($b['author'] ?? 'Harichand Steel Team');
        $datePublished = trim($b['date'] ?? date('F d, Y'));
        $image = trim($b['image'] ?? 'images/about-3.jpg');
        $excerpt = trim($b['excerpt'] ?? $b['summary'] ?? '');
        $content = trim($b['content'] ?? '');
        $published = !isset($b['published']) || $b['published'] !== false ? 1 : 0;

        $blogStmt->execute([
            ':code'           => $code,
            ':title'          => $title,
            ':slug'           => $slug,
            ':tag'            => $tag,
            ':author'         => $author,
            ':date_published' => $datePublished,
            ':image'          => $image,
            ':excerpt'        => $excerpt,
            ':content'        => $content,
            ':published'      => $published
        ]);

        $blogImported++;
    }
    logMsg("Blogs migrated successfully: $blogImported records processed.", "success");

    // ------------------------------------------------------------------------
    // C. MIGRATE INQUIRIES (4 Records)
    // ------------------------------------------------------------------------
    logMsg("Starting Inquiries migration...");
    $inquiriesJson = file_get_contents($inquiriesFile);
    $inquiries = json_decode($inquiriesJson, true);

    if (!is_array($inquiries)) {
        throw new RuntimeException("Invalid JSON format in inquiries.json");
    }

    $inqCheckStmt = $pdo->prepare("SELECT COUNT(*) FROM `inquiries` WHERE `code` = :code");
    $inqInsertStmt = $pdo->prepare("
        INSERT INTO `inquiries` (
            `code`, `name`, `phone`, `email`, `product_name`, `requirement`, `message`, `created_at`
        ) VALUES (
            :code, :name, :phone, :email, :product_name, :requirement, :message, :created_at
        )
    ");

    $inqImported = 0;
    $inqSkipped = 0;

    foreach ($inquiries as $inq) {
        $code = trim($inq['id'] ?? 'inq-' . time() . '-' . mt_rand(100, 999));
        $name = trim($inq['name'] ?? 'Inquiry Contact');
        $phone = trim($inq['phone'] ?? '');
        $email = trim($inq['email'] ?? '');
        $productName = trim($inq['product_name'] ?? $inq['requirement'] ?? 'Gate Inquiry');
        $requirement = trim($inq['requirement'] ?? $productName);
        $message = trim($inq['message'] ?? '');

        // Convert human timestamp if present
        $timestampRaw = $inq['timestamp'] ?? date('Y-m-d H:i:s');
        $createdAt = date('Y-m-d H:i:s', strtotime($timestampRaw) ?: time());

        // Avoid duplicating inquiries if already present by code
        $inqCheckStmt->execute([':code' => $code]);
        if ((int)$inqCheckStmt->fetchColumn() > 0) {
            $inqSkipped++;
            continue;
        }

        $inqInsertStmt->execute([
            ':code'         => $code,
            ':name'         => $name,
            ':phone'        => $phone,
            ':email'        => $email,
            ':product_name' => $productName,
            ':requirement'  => $requirement,
            ':message'      => $message,
            ':created_at'   => $createdAt
        ]);

        $inqImported++;
    }
    logMsg("Inquiries processed: $inqImported inserted, $inqSkipped existing/skipped.", "success");

    // ------------------------------------------------------------------------
    // D. SEED DEFAULT ADMIN USER
    // ------------------------------------------------------------------------
    logMsg("Seeding initial administrator user...");
    $defaultAdminUser  = 'buzzspire.info@gmail.com';
    $defaultAdminEmail = 'buzzspire.info@gmail.com';
    $defaultAdminPass  = 'Harichand@2004';
    $defaultPasswordHash = password_hash($defaultAdminPass, PASSWORD_BCRYPT, ['cost' => 12]);

    $adminStmt = $pdo->prepare("
        INSERT INTO `admin_users` (
            `username`, `email`, `password_hash`, `role`, `is_active`
        ) VALUES (
            :username, :email, :hash, 'superadmin', 1
        )
        ON DUPLICATE KEY UPDATE
            `password_hash` = VALUES(`password_hash`),
            `is_active`     = 1
    ");

    $adminStmt->execute([
        ':username' => $defaultAdminUser,
        ':email'    => $defaultAdminEmail,
        ':hash'     => $defaultPasswordHash
    ]);
    logMsg("Default admin user verified: $defaultAdminUser (Bcrypt hashed, cost 12).", "success");

    // Commit all changes
    $pdo->commit();
    logMsg("===================================================================", "success");
    logMsg("ALL DATA MIGRATIONS COMMITTED TO MYSQL SUCCESSFULLY!", "success");
    logMsg("Products:  $prodImported records synchronized", "success");
    logMsg("Blogs:     $blogImported records synchronized", "success");
    logMsg("Inquiries: $inqImported records inserted ($inqSkipped skipped)", "success");
    logMsg("Admin:     Initial user provisioned securely", "success");
    logMsg("===================================================================", "success");

} catch (\Throwable $e) {
    if ($pdo && $pdo->inTransaction()) {
        $pdo->rollBack();
        logMsg("TRANSACTION ROLLED BACK DUE TO ERROR.", "error");
    }
    logMsg("MIGRATION FAILED: " . $e->getMessage(), "error");
    logMsg("Trace: " . $e->getTraceAsString(), "error");
    if (php_sapi_name() !== 'cli') echo '</body></html>';
    exit(1);
}

if (php_sapi_name() !== 'cli') {
    echo '<p class="success" style="font-size:1.1rem;margin-top:24px;">✓ Migration completed successfully. You can now close this window or return to the website.</p>';
    echo '</body></html>';
}

