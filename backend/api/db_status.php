<?php
/**
 * ============================================================================
 * HARICHAND STEEL — DATABASE STATUS DIAGNOSTIC
 * Route: GET /api/db-status
 * Target PHP: Core PHP 8.x
 * ============================================================================
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/response.php';
require_once dirname(__DIR__) . '/config/database.php';

use Harichand\Includes\Response;
use Harichand\Config\Database;

Response::handleCors();

$status = Database::getStatus();
Response::json($status);

