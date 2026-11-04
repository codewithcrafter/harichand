<?php
/**
 * ============================================================================
 * HARICHAND STEEL — ADMIN LOGOUT ENDPOINT
 * Route: POST /api/admin/logout
 * Target PHP: Core PHP 8.x
 * ============================================================================
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/response.php';
require_once dirname(__DIR__) . '/includes/security.php';

use Harichand\Includes\Response;
use Harichand\Includes\Security;

Response::handleCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method Not Allowed', 405);
}

Security::initSession();

// Clear and destroy session
$_SESSION = [];
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], $params["domain"],
        $params["secure"], $params["httponly"]
    );
}
session_destroy();

// Expire custom auth cookie
$isHttps = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ||
           (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');

setcookie('hs_admin_session', '', [
    'expires'  => time() - 3600,
    'path'     => '/',
    'domain'   => '',
    'secure'   => $isHttps,
    'httponly' => true,
    'samesite' => 'Lax'
]);

Response::json([
    'success' => true,
    'message' => 'Logged out successfully'
]);

