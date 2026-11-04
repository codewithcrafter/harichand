<?php
/**
 * ============================================================================
 * HARICHAND STEEL — SECURE IMAGE UPLOAD CONTROLLER (HARDENED)
 * Route: POST /backend/api/upload.php (or POST /api/upload)
 * Target PHP: Core PHP 8.x
 * Security: Strict MIME validation, raster-only (No SVG/XSS), random naming
 * ============================================================================
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/response.php';
require_once dirname(__DIR__) . '/includes/security.php';
require_once dirname(__DIR__) . '/includes/auth_middleware.php';

use Harichand\Includes\Response;
use Harichand\Includes\Security;
use Harichand\Includes\AuthMiddleware;

Response::handleCors();

// Enforce admin authorization for all image uploads
AuthMiddleware::requireAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method Not Allowed', 405);
}

$uploadDir = dirname(__DIR__) . '/uploads';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

// Strictly allow safe raster image formats.
// SVG is intentionally excluded to permanently eliminate Stored XSS and XML External Entity (XXE) vectors.
$allowedMimes = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp'
];

$maxBytes = 5 * 1024 * 1024; // 5 MB

// ----------------------------------------------------------------------------
// A. HANDLE MULTIPART FORM-DATA FILE UPLOAD
// ----------------------------------------------------------------------------
$uploadedFile = $_FILES['image'] ?? $_FILES['file'] ?? null;

if ($uploadedFile && is_array($uploadedFile) && !empty($uploadedFile['tmp_name'])) {
    if ($uploadedFile['error'] !== UPLOAD_ERR_OK) {
        Response::error('File upload error code: ' . $uploadedFile['error'], 400);
    }

    if ($uploadedFile['size'] > $maxBytes) {
        Response::error('File exceeds maximum size limit of 5MB', 413);
    }

    // Inspect real binary signature MIME type via finfo
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $realMime = finfo_file($finfo, $uploadedFile['tmp_name']);
    finfo_close($finfo);

    if (!array_key_exists($realMime, $allowedMimes)) {
        Response::error('Invalid image file type. Only JPG, PNG, and WebP are permitted. (SVG uploads are disabled for security).', 415);
    }

    // Double check with getimagesize
    $imageInfo = @getimagesize($uploadedFile['tmp_name']);
    if ($imageInfo === false) {
        Response::error('Corrupted or invalid image file detected', 400);
    }

    $safeExt = $allowedMimes[$realMime];

    // Cryptographically secure random filename (never trusts user-provided filename)
    $randomName = bin2hex(random_bytes(16)) . '.' . $safeExt;
    $targetPath = $uploadDir . '/' . $randomName;

    if (!move_uploaded_file($uploadedFile['tmp_name'], $targetPath)) {
        Response::error('Failed to move uploaded file to destination directory', 500);
    }

    // Set non-executable permissions
    chmod($targetPath, 0644);

    $publicUrl = '/backend/uploads/' . $randomName;
    Response::json([
        'success'  => true,
        'message'  => 'Image uploaded successfully',
        'url'      => $publicUrl,
        'filename' => $randomName,
        'size'     => $uploadedFile['size'],
        'mime'     => $realMime
    ], 201);
}

// ----------------------------------------------------------------------------
// B. COMPATIBILITY STRATEGY: CONVERT INCOMING BASE64 DATA STRING TO PHYSICAL FILE
// ----------------------------------------------------------------------------
$jsonBody = Response::getJsonBody();
if (!empty($jsonBody['base64'])) {
    $base64Str = $jsonBody['base64'];
    if (preg_match('/^data:(image\/(jpeg|png|webp));base64,(.*)$/i', $base64Str, $matches)) {
        $mime = $matches[1];
        $ext = $allowedMimes[$mime] ?? 'png';
        $data = base64_decode($matches[3]);

        if ($data === false) {
            Response::error('Failed to decode Base64 image payload', 400);
        }

        if (strlen($data) > $maxBytes) {
            Response::error('Decoded image exceeds maximum size limit of 5MB', 413);
        }

        $randomName = bin2hex(random_bytes(16)) . '.' . $ext;
        $targetPath = $uploadDir . '/' . $randomName;

        if (file_put_contents($targetPath, $data) === false) {
            Response::error('Failed to save decoded Base64 image to disk', 500);
        }

        chmod($targetPath, 0644);
        $publicUrl = '/backend/uploads/' . $randomName;

        Response::json([
            'success'  => true,
            'message'  => 'Base64 image converted to file successfully',
            'url'      => $publicUrl,
            'filename' => $randomName,
            'size'     => strlen($data),
            'mime'     => $mime
        ], 201);
    }
}

Response::error('No valid file or Base64 image payload provided', 400);
