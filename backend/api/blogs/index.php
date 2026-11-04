<?php
/**
 * ============================================================================
 * HARICHAND STEEL — BLOGS REST API CONTROLLER
 * Routes:
 *   GET    /api/blogs          (Public: list articles)
 *   POST   /api/blogs          (Admin: create article)
 *   PUT    /api/blogs          (Admin: update article)
 *   DELETE /api/blogs?id={id}  (Admin: delete article)
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
$blogsFile = dirname(__DIR__, 3) . '/data/blogs.json';

function readLocalBlogs(string $path): array {
    if (file_exists($path)) {
        try {
            $data = json_decode(file_get_contents($path), true);
            return is_array($data) ? $data : [];
        } catch (\Throwable $e) {}
    }
    return [];
}

function writeLocalBlogs(string $path, array $data): void {
    try {
        file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    } catch (\Throwable $e) {
        error_log("[Blog API] Failed to write fallback JSON: " . $e->getMessage());
    }
}

// ----------------------------------------------------------------------------
// 1. GET /api/blogs (Public listing)
// ----------------------------------------------------------------------------
if ($method === 'GET' || $method === 'HEAD') {
    $isAdmin = AuthMiddleware::isAuthenticated();

    if ($pdo !== null) {
        try {
            $sql = $isAdmin ? "SELECT * FROM `blogs` ORDER BY `id` ASC" : "SELECT * FROM `blogs` WHERE `published` = 1 ORDER BY `id` ASC";
            $stmt = $pdo->query($sql);
            $rows = $stmt->fetchAll();

            $blogs = array_map(function ($r) {
                return [
                    'id'        => $r['code'] ?: 'blog-' . $r['id'],
                    'title'     => $r['title'],
                    'slug'      => $r['slug'],
                    'tag'       => $r['tag'] ?: 'Guide',
                    'author'    => $r['author'] ?: 'Harichand Steel Team',
                    'date'      => $r['date_published'] ?: '',
                    'image'     => $r['image'] ?: 'images/about-3.jpg',
                    'excerpt'   => $r['excerpt'] ?: '',
                    'summary'   => $r['excerpt'] ?: '',
                    'content'   => $r['content'] ?: '',
                    'published' => (bool)$r['published']
                ];
            }, $rows);

            Response::json($blogs);
        } catch (\Throwable $e) {
            error_log("[Blog API] SQL Error: " . $e->getMessage());
        }
    }

    $local = readLocalBlogs($blogsFile);
    if (!$isAdmin) {
        $local = array_values(array_filter($local, fn($b) => !isset($b['published']) || $b['published'] !== false));
    }
    Response::json($local);
}

// ----------------------------------------------------------------------------
// 2. POST / PUT /api/blogs (Admin Only)
// ----------------------------------------------------------------------------
if ($method === 'POST' || $method === 'PUT') {
    AuthMiddleware::requireAdmin();

    $payload = Response::getJsonBody();
    if (empty($payload)) {
        Response::error('Empty or invalid blog payload', 400);
    }

    $items = array_is_list($payload) ? $payload : [$payload];
    $localBlogs = readLocalBlogs($blogsFile);

    foreach ($items as &$item) {
        $title = Security::sanitizeString($item['title'] ?? 'Untitled Article');
        $code = trim($item['id'] ?? 'blog-' . time());
        $slug = trim($item['slug'] ?? ('/news/' . Security::sanitizeSlug($title) . '/'));
        $tag = Security::sanitizeString($item['tag'] ?? 'Guide');
        $author = Security::sanitizeString($item['author'] ?? 'Harichand Steel Team');
        $datePublished = Security::sanitizeString($item['date'] ?? date('F d, Y'));
        $image = trim($item['image'] ?? 'images/about-3.jpg');
        $excerpt = trim($item['excerpt'] ?? $item['summary'] ?? '');
        $content = trim($item['content'] ?? '');
        $published = !isset($item['published']) || $item['published'] !== false ? 1 : 0;

        if ($pdo !== null) {
            try {
                $sql = "
                    INSERT INTO `blogs` (
                        `code`, `title`, `slug`, `tag`, `author`, `date_published`,
                        `image`, `excerpt`, `content`, `published`
                    ) VALUES (
                        :code, :title, :slug, :tag, :author, :date_published,
                        :image, :excerpt, :content, :published
                    )
                    ON DUPLICATE KEY UPDATE
                        `title`          = VALUES(`title`),
                        `slug`           = VALUES(`slug`),
                        `tag`            = VALUES(`tag`),
                        `author`         = VALUES(`author`),
                        `date_published` = VALUES(`date_published`),
                        `image`          = VALUES(`image`),
                        `excerpt`        = VALUES(`excerpt`),
                        `content`        = VALUES(`content`),
                        `published`      = VALUES(`published`)
                ";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
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
            } catch (\Throwable $e) {
                error_log("[Blog API] Save SQL error: " . $e->getMessage());
            }
        }

        // Dual-sync to JSON
        $item['id'] = $code;
        $item['title'] = $title;
        $item['slug'] = $slug;
        $existingIdx = -1;
        foreach ($localBlogs as $idx => $lb) {
            if (($lb['id'] ?? '') === $code || ($lb['slug'] ?? '') === $slug) {
                $existingIdx = $idx;
                break;
            }
        }

        if ($existingIdx !== -1) {
            $localBlogs[$existingIdx] = array_merge($localBlogs[$existingIdx], $item);
        } else {
            array_unshift($localBlogs, $item);
        }
    }

    writeLocalBlogs($blogsFile, $localBlogs);

    if (array_is_list($payload)) {
        Response::json(['success' => true, 'count' => count($items)]);
    } else {
        Response::json(['success' => true, 'blog' => $items[0]]);
    }
}

// ----------------------------------------------------------------------------
// 3. DELETE /api/blogs?id={id} (Admin Only)
// ----------------------------------------------------------------------------
if ($method === 'DELETE') {
    AuthMiddleware::requireAdmin();

    $id = $_GET['id'] ?? null;
    if (!$id) {
        $body = Response::getJsonBody();
        $id = $body['id'] ?? null;
    }

    if (!$id) {
        Response::error('Blog ID required', 400);
    }

    $idStr = (string)$id;

    if ($pdo !== null) {
        try {
            $stmt = $pdo->prepare("DELETE FROM `blogs` WHERE `code` = :id OR `slug` = :id OR `id` = :num");
            $num = is_numeric($idStr) ? (int)$idStr : -1;
            $stmt->execute([':id' => $idStr, ':num' => $num]);
        } catch (\Throwable $e) {
            error_log("[Blog API] Delete SQL error: " . $e->getMessage());
        }
    }

    $localBlogs = readLocalBlogs($blogsFile);
    $localBlogs = array_values(array_filter($localBlogs, function ($b) use ($idStr) {
        return ($b['id'] ?? '') !== $idStr && ($b['slug'] ?? '') !== $idStr;
    }));
    writeLocalBlogs($blogsFile, $localBlogs);

    Response::json(['success' => true, 'id' => $idStr]);
}

Response::error('Method Not Allowed', 405);

