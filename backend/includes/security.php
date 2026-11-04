<?php
/**
 * ============================================================================
 * HARICHAND STEEL — CORE SECURITY, SESSIONS & CSRF ENGINE
 * Target PHP: Core PHP 8.x
 * ============================================================================
 */

declare(strict_types=1);

namespace Harichand\Includes;

class Security {
    private const RATE_LIMIT_MAX_ATTEMPTS = 5;
    private const RATE_LIMIT_LOCKOUT_SECONDS = 900; // 15 minutes

    /**
     * Start hardened PHP session with modern security headers
     */
    public static function initSession(): void {
        if (session_status() === PHP_SESSION_NONE) {
            $isHttps = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ||
                       (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');

            session_set_cookie_params([
                'lifetime' => 604800, // 7 days
                'path'     => '/',
                'domain'   => '',
                'secure'   => $isHttps,
                'httponly' => true,
                'samesite' => 'Lax'
            ]);

            session_start();
        }
    }

    /**
     * Regenerate session ID safely upon authentication
     */
    public static function regenerateSession(): void {
        self::initSession();
        session_regenerate_id(true);
    }

    /**
     * Generate or retrieve active CSRF token for the current session
     */
    public static function getCsrfToken(): string {
        self::initSession();
        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf_token'];
    }

    /**
     * Validate CSRF token using timing-safe comparison
     */
    public static function validateCsrfToken(?string $token): bool {
        self::initSession();
        $stored = $_SESSION['csrf_token'] ?? '';
        if ($stored === '' || empty($token)) {
            return false;
        }
        return hash_equals($stored, $token);
    }

    /**
     * Get client IP address accurately handling standard proxy headers
     */
    public static function getClientIp(): string {
        $headers = [
            'HTTP_CF_CONNECTING_IP', // Cloudflare
            'HTTP_X_FORWARDED_FOR',  // Standard reverse proxy
            'HTTP_CLIENT_IP',
            'REMOTE_ADDR'
        ];

        foreach ($headers as $header) {
            if (!empty($_SERVER[$header])) {
                $ips = explode(',', $_SERVER[$header]);
                $ip = trim($ips[0]);
                if (filter_var($ip, FILTER_VALIDATE_IP)) {
                    return $ip;
                }
            }
        }
        return '127.0.0.1';
    }

    /**
     * Check if client IP is currently rate-limited for login attempts
     */
    public static function isRateLimited(string $action = 'login'): bool {
        self::initSession();
        $ip = self::getClientIp();
        $key = "rl_{$action}_{$ip}";

        if (isset($_SESSION[$key])) {
            $data = $_SESSION[$key];
            if (time() < $data['lockout_until']) {
                return true;
            }
            if (time() >= $data['reset_at']) {
                unset($_SESSION[$key]);
            }
        }
        return false;
    }

    /**
     * Record a failed login attempt for rate limiting
     */
    public static function recordFailedAttempt(string $action = 'login'): int {
        self::initSession();
        $ip = self::getClientIp();
        $key = "rl_{$action}_{$ip}";
        $now = time();

        if (!isset($_SESSION[$key]) || $now >= $_SESSION[$key]['reset_at']) {
            $_SESSION[$key] = [
                'attempts'      => 1,
                'reset_at'      => $now + 3600, // 1 hour window
                'lockout_until' => 0
            ];
        } else {
            $_SESSION[$key]['attempts']++;
            if ($_SESSION[$key]['attempts'] >= self::RATE_LIMIT_MAX_ATTEMPTS) {
                $_SESSION[$key]['lockout_until'] = $now + self::RATE_LIMIT_LOCKOUT_SECONDS;
            }
        }
        return $_SESSION[$key]['attempts'];
    }

    /**
     * Clear failed login attempts after successful authentication
     */
    public static function clearFailedAttempts(string $action = 'login'): void {
        self::initSession();
        $ip = self::getClientIp();
        unset($_SESSION["rl_{$action}_{$ip}"]);
    }

    /**
     * Sanitize general plain text inputs
     */
    public static function sanitizeString(?string $str): string {
        if ($str === null) return '';
        return trim(strip_tags($str));
    }

    /**
     * Sanitize URL slug
     */
    public static function sanitizeSlug(?string $slug): string {
        if ($slug === null || trim($slug) === '') {
            return 'item-' . time();
        }
        $slug = strtolower(trim($slug));
        $slug = preg_replace('/\.html?$/i', '', $slug);
        $slug = preg_replace('/[^a-z0-9_-]+/i', '-', $slug);
        return trim($slug, '-');
    }

    /**
     * Validate email format
     */
    public static function validateEmail(?string $email): bool {
        if (empty($email)) return false;
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    /**
     * Validate phone number (allows +91, spaces, hyphens, min 7 digits)
     */
    public static function validatePhone(?string $phone): bool {
        if (empty($phone)) return false;
        $digits = preg_replace('/\D/', '', $phone);
        return strlen($digits) >= 7 && strlen($digits) <= 15;
    }
}

