<?php
/**
 * ============================================================================
 * HARICHAND STEEL — ADMIN CMS ENTRY CONTROLLER
 * Target PHP: Core PHP 8.x
 * ============================================================================
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/security.php';
require_once dirname(__DIR__) . '/includes/auth_middleware.php';

use Harichand\Includes\Security;
use Harichand\Includes\AuthMiddleware;

Security::initSession();

// Check if authenticated
if (!AuthMiddleware::isAuthenticated()) {
    $currentUri = $_SERVER['REQUEST_URI'] ?? '/admin/';
    $redirectUrl = '/admin/login/?redirect=' . urlencode($currentUri);
    header("Location: {$redirectUrl}", true, 302);
    exit(0);
}

// Serve the admin dashboard HTML template
$adminHtmlPath = dirname(__DIR__, 2) . '/admin/index.html';
if (file_exists($adminHtmlPath)) {
    header('Content-Type: text/html; charset=UTF-8');
    readfile($adminHtmlPath);
    exit(0);
}

echo "<h1>Admin Dashboard template not found.</h1>";
exit(1);

