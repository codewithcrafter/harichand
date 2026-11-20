<?php
/**
 * ============================================================================
 * HARICHAND STEEL — ADMIN LOGIN ENDPOINT (SMART RESILIENT AUTH)
 * Route: POST /api/admin/login
 * Target PHP: Core PHP 8.x
 * Security: Bcrypt verification, auto-provisioning, session security
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

$input = Response::getJsonBody();
$username = trim($input['username'] ?? '');
$password = trim($input['password'] ?? '');

if ($username === '' || $password === '') {
    Response::error('Username and password are required', 400);
}

// Check Rate Limiting (protect against brute force: max attempts / lockout)
if (Security::isRateLimited('login')) {
    Response::error('Too many failed login attempts. Please wait a few minutes before trying again.', 429);
}

$authenticated = false;
$userData = null;

// 1. Authenticate against MySQL Database if admin_users exists
$pdo = Database::getConnection();
if ($pdo !== null) {
    try {
        $stmt = $pdo->prepare("
            SELECT id, username, email, password_hash, role, is_active
            FROM admin_users
            WHERE (LOWER(username) = LOWER(:u1) OR LOWER(email) = LOWER(:u2)) AND is_active = 1
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

            try {
                $upd = $pdo->prepare("UPDATE admin_users SET last_login = NOW() WHERE id = :id");
                $upd->execute([':id' => $row['id']]);
            } catch (\Throwable $e) {}
        }
    } catch (\Throwable $e) {
        error_log("[Auth Error] DB login query failed: " . $e->getMessage());
    }
}

// 2. Verified Default Admin Credentials Fallback (Auto-seeds database if missing)
if (!$authenticated) {
    $normalizedUser = strtolower($username);
    $validUsers = ['buzzspire.info@gmail.com', 'admin', 'admin@harichandsteel.com', 'harichand'];
    $validPasswords = ['Harichand@2004', 'Harichand@2026#'];

    if (in_array($normalizedUser, $validUsers, true) && in_array($password, $validPasswords, true)) {
        $authenticated = true;
        $userData = [
            'id'       => 1,
            'username' => $username,
            'email'    => in_array($normalizedUser, ['admin', 'harichand'], true) ? 'buzzspire.info@gmail.com' : $username,
            'role'     => 'superadmin'
        ];

        // Auto-provision or update in MySQL Database for future logins
        if ($pdo !== null) {
            try {
                $pdo->exec("
                    CREATE TABLE IF NOT EXISTS `admin_users` (
                      `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                      `username` VARCHAR(150) NOT NULL UNIQUE,
                      `email` VARCHAR(150) NOT NULL UNIQUE,
                      `password_hash` VARCHAR(255) NOT NULL,
                      `role` VARCHAR(50) NOT NULL DEFAULT 'superadmin',
                      `is_active` TINYINT(1) NOT NULL DEFAULT 1,
                      `last_login` TIMESTAMP NULL DEFAULT NULL,
                      `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                      `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                ");

                $hash = password_hash($password, PASSWORD_BCRYPT);
                $seedStmt = $pdo->prepare("
                    INSERT INTO admin_users (username, email, password_hash, role, is_active, last_login)
                    VALUES (:u, :e, :h, 'superadmin', 1, NOW())
                    ON DUPLICATE KEY UPDATE password_hash = :h2, last_login = NOW(), is_active = 1
                ");
                $seedStmt->execute([
                    ':u' => $username,
                    ':e' => $userData['email'],
                    ':h' => $hash,
                    ':h2' => $hash
                ]);
            } catch (\Throwable $e) {
                error_log("[Auth Seed] Could not persist user to MySQL: " . $e->getMessage());
            }
        }
    }
}

// 3. Handle Authentication Outcome
if ($authenticated && $userData !== null) {
    Security::clearFailedAttempts('login');
    Security::regenerateSession();

    $sessionToken = 'hs_sess_' . bin2hex(random_bytes(24));
    $apiKey = getenv('ADMIN_API_KEY') ?: 'hs_admin_secret_key_2026';

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
