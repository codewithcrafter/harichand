<?php
/**
 * ============================================================================
 * HARICHAND STEEL — CHECK AUTHENTICATION STATUS
 * Route: GET /api/admin/check-auth
 * Target PHP: Core PHP 8.x
 * ============================================================================
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/response.php';
require_once dirname(__DIR__) . '/includes/auth_middleware.php';

use Harichand\Includes\Response;
use Harichand\Includes\AuthMiddleware;

Response::handleCors();

$authenticated = AuthMiddleware::isAuthenticated();
$admin = AuthMiddleware::getCurrentAdmin();

Response::json([
    'authenticated' => $authenticated,
    'username'      => $admin['username'] ?? 'admin'
]);

