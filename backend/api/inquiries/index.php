<?php
/**
 * ============================================================================
 * HARICHAND STEEL — INQUIRIES & LEADS REST API CONTROLLER
 * Routes:
 *   POST   /api/inquiries          (Public: submit quote/contact lead)
 *   GET    /api/inquiries          (Admin Only: view private leads list)
 *   DELETE /api/inquiries?id={id}  (Admin Only: delete lead record)
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
$inquiriesFile = dirname(__DIR__, 3) . '/data/inquiries.json';

function readLocalInquiries(string $path): array {
    if (file_exists($path)) {
        try {
            $data = json_decode(file_get_contents($path), true);
            return is_array($data) ? $data : [];
        } catch (\Throwable $e) {}
    }
    return [];
}

function writeLocalInquiries(string $path, array $data): void {
    try {
        file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    } catch (\Throwable $e) {
        error_log("[Inquiry API] Failed to write fallback JSON: " . $e->getMessage());
    }
}

// ----------------------------------------------------------------------------
// 1. GET /api/inquiries (Admin Only - View Private Leads)
// ----------------------------------------------------------------------------
if ($method === 'GET' || $method === 'HEAD') {
    // Strictly block public access to client leads
    AuthMiddleware::requireAdmin();

    if ($pdo !== null) {
        try {
            $stmt = $pdo->query("SELECT * FROM `inquiries` ORDER BY `created_at` DESC");
            $rows = $stmt->fetchAll();

            $inquiries = array_map(function ($r) {
                return [
                    'id'           => (string)$r['id'],
                    'code'         => $r['code'],
                    'name'         => $r['name'],
                    'phone'        => $r['phone'],
                    'email'        => $r['email'],
                    'product_name' => $r['product_name'],
                    'requirement'  => $r['requirement'] ?: $r['product_name'],
                    'message'      => $r['message'],
                    'status'       => $r['status'],
                    'created_at'   => $r['created_at'],
                    'timestamp'    => $r['created_at'] ? date('d/m/Y, g:i:s a', strtotime($r['created_at'])) : ''
                ];
            }, $rows);

            Response::json($inquiries);
        } catch (\Throwable $e) {
            error_log("[Inquiry API] SQL Error: " . $e->getMessage());
        }
    }

    $local = readLocalInquiries($inquiriesFile);
    Response::json($local);
}

// ----------------------------------------------------------------------------
// 2. POST /api/inquiries (Public: Submit Lead from Quote Form or Contact Modal)
// ----------------------------------------------------------------------------
if ($method === 'POST') {
    $payload = Response::getJsonBody();
    if (empty($payload)) {
        Response::error('Invalid inquiry payload', 400);
    }

    $items = array_is_list($payload) ? $payload : [$payload];
    $localInquiries = readLocalInquiries($inquiriesFile);
    $ip = Security::getClientIp();
    $userAgent = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255);

    foreach ($items as &$inq) {
        $name = Security::sanitizeString($inq['name'] ?? '');
        $phone = Security::sanitizeString($inq['phone'] ?? '');
        $email = Security::sanitizeString($inq['email'] ?? '');
        $productName = Security::sanitizeString($inq['product_name'] ?? $inq['requirement'] ?? 'Gate Inquiry');
        $requirement = Security::sanitizeString($inq['requirement'] ?? $productName);
        $message = Security::sanitizeString($inq['message'] ?? '');
        $code = trim($inq['id'] ?? 'inq-' . round(microtime(true) * 1000));
        $now = date('Y-m-d H:i:s');

        if ($name === '' || $phone === '') {
            Response::error('Name and phone number are required', 400);
        }

        // 2a. Insert into MySQL
        if ($pdo !== null) {
            try {
                $sql = "
                    INSERT INTO `inquiries` (
                        `code`, `name`, `phone`, `email`, `product_name`,
                        `requirement`, `message`, `status`, `ip_address`, `user_agent`, `created_at`
                    ) VALUES (
                        :code, :name, :phone, :email, :product_name,
                        :requirement, :message, 'new', :ip, :ua, :created_at
                    )
                ";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
                    ':code'         => $code,
                    ':name'         => $name,
                    ':phone'        => $phone,
                    ':email'        => $email,
                    ':product_name' => $productName,
                    ':requirement'  => $requirement,
                    ':message'      => $message,
                    ':ip'           => $ip,
                    ':ua'           => $userAgent,
                    ':created_at'   => $now
                ]);
                $inq['id'] = (string)$pdo->lastInsertId();
            } catch (\Throwable $e) {
                error_log("[Inquiry API] Save SQL error: " . $e->getMessage());
            }
        }

        // 2b. Prepend to local JSON fallback
        $inq['id'] = $code;
        $inq['timestamp'] = date('d/m/Y, g:i:s a');
        array_unshift($localInquiries, $inq);
    }

    writeLocalInquiries($inquiriesFile, $localInquiries);

    if (array_is_list($payload)) {
        Response::json(['success' => true, 'count' => count($items)]);
    } else {
        Response::json(['success' => true, 'inquiry' => $items[0]]);
    }
}

// ----------------------------------------------------------------------------
// 3. DELETE /api/inquiries?id={id} (Admin Only: Delete Lead)
// ----------------------------------------------------------------------------
if ($method === 'DELETE') {
    AuthMiddleware::requireAdmin();

    $id = $_GET['id'] ?? null;
    if (!$id) {
        $body = Response::getJsonBody();
        $id = $body['id'] ?? null;
    }

    if (!$id) {
        Response::error('Inquiry ID required', 400);
    }

    $idStr = (string)$id;

    if ($pdo !== null) {
        try {
            $stmt = $pdo->prepare("DELETE FROM `inquiries` WHERE `id` = :id OR `code` = :code");
            $num = is_numeric($idStr) ? (int)$idStr : -1;
            $stmt->execute([':id' => $num, ':code' => $idStr]);
        } catch (\Throwable $e) {
            error_log("[Inquiry API] Delete SQL error: " . $e->getMessage());
        }
    }

    $localInquiries = readLocalInquiries($inquiriesFile);
    $localInquiries = array_values(array_filter($localInquiries, function ($i) use ($idStr) {
        return ($i['id'] ?? '') !== $idStr;
    }));
    writeLocalInquiries($inquiriesFile, $localInquiries);

    Response::json(['success' => true, 'id' => $idStr]);
}

Response::error('Method Not Allowed', 405);

