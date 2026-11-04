<?php
/**
 * ============================================================================
 * HARICHAND STEEL — ADMIN LOGIN ENDPOINT (HARDENED)
 * Route: POST /api/admin/login
 * Target PHP: Core PHP 8.x
 * Security: Strict bcrypt verification, zero hardcoded credentials, rate limiting
 * ============================================================================
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/response.php';
require_once dirname(__DIR__) . '/includes/security.php';
require_once dirname(__DIR__) . '/config/database.php';

use Harichand\Includes\Response;
use Harichand\Includes\Security;
use Harichand\Config\Database;

Response::handleCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method Not Allowed', 405);
}

// 1. Check Rate Limiting (5 attempts / 15 minutes)
if (Security::isRateLimited('login')) {
    Response::error('Too many failed login attempts. Please wait 15 minutes before trying again.', 429);
}

$input = Response::getJsonBody();
$username = trim($input['username'] ?? '');
$password = trim($input['password'] ?? '');

if ($username === '' || $password === '') {
    Response::error('Username and password are required', 400);
}

$authenticated = false;
$userData = null;

// 2. Authenticate against MySQL Database (Bcrypt hashed)
$pdo = Database::getConnection();
if ($pdo !== null) {
    try {
        $stmt = $pdo->prepare("
            SELECT id, username, email, password_hash, role, is_active
            FROM admin_users
            WHERE (username = :u1 OR email = :u2) AND is_active = 1
            LIMIT 1
        ");
        $stmt->execute([':u1' => $username, ':u2' => $username]);
        $row = $stmt->fetch();

        if ($row && !empty($row['password_hash']) && password_verify($password, $row['password_hash'])) {
            $authenticated = true;
            $userData = [
                'id'       => (int)$row['id'],
                'username' => $row['username'],
                'email'    => $row['email'],
                'role'     => $row['role']
            ];

            // Update last login timestamp
            $upd = $pdo->prepare("UPDATE admin_users SET last_login = NOW() WHERE id = :id");
            $upd->execute([':id' => $row['id']]);
        }
    } catch (\Throwable $e) {
        error_log("[Auth Error] DB login query failed: " . $e->getMessage());
    }
} else {
    // Database connection failed
    error_log("[Auth Error] Admin login rejected because database is unreachable.");
}

// 3. Optional Environment Hash Override (Strictly requires pre-computed bcrypt hash; zero plaintext)
if (!$authenticated) {
    $envUser = getenv('ADMIN_USERNAME');
    $envHash = getenv('ADMIN_PASSWORD_HASH');

    if (!empty($envUser) && !empty($envHash) && strtolower($username) === strtolower($envUser)) {
        if (password_verify($password, $envHash)) {
            $authenticated = true;
            $userData = [
                'id'       => 1,
                'username' => $envUser,
                'email'    => $envUser,
                'role'     => 'superadmin'
            ];
        }
    }
}

// 4. Handle Authentication Outcome
if ($authenticated && $userData !== null) {
    Security::clearFailedAttempts('login');
    Security::regenerateSession();

    $sessionToken = 'hs_sess_' . bin2hex(random_bytes(24));
    $apiKey = getenv('ADMIN_API_KEY') ?: $sessionToken;

    $_SESSION['admin_logged_in'] = true;
    $_SESSION['admin_user_id']   = $userData['id'];
    $_SESSION['admin_username']  = $userData['username'];
    $_SESSION['admin_email']     = $userData['email'];
    $_SESSION['admin_role']      = $userData['role'];
    $_SESSION['hs_admin_token']  = $sessionToken;

    // Issue secure cookie valid for 7 days
    $isHttps = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ||
               (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');

    setcookie('hs_admin_session', $sessionToken, [
        'expires'  => time() + 604800,
        'path'     => '/',
        'domain'   => '',
        'secure'   => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);

    Response::json([
        'success'  => true,
        'message'  => 'Login successful',
        'token'    => $sessionToken,
        'apiKey'   => $apiKey,
        'username' => $userData['username']
    ]);
} else {
    Security::recordFailedAttempt('login');
    Response::error('Invalid username or password', 401);
}
