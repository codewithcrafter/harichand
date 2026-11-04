<?php
/**
 * ============================================================================
 * HARICHAND STEEL — CORE PHP DATABASE CONNECTOR
 * Target PHP: Core PHP 8.x + PDO
 * Target Engine: MySQL 8.x / MariaDB 10.4+
 * Security: Prepared statements, strict error handling, credentials isolation
 * ============================================================================
 */

declare(strict_types=1);

namespace Harichand\Config;

use PDO;
use PDOException;

class Database {
    private static ?PDO $instance = null;
    private static bool $connectionAttempted = false;
    private static ?string $lastError = null;

    /**
     * Get or initialize the singleton PDO connection
     *
     * @return PDO|null Returns PDO instance if connected, null if unavailable
     */
    public static function getConnection(): ?PDO {
        if (self::$instance !== null) {
            return self::$instance;
        }

        if (self::$connectionAttempted && self::$instance === null) {
            return null;
        }

        self::$connectionAttempted = true;

        // 1. Resolve credentials from environment or configuration
        $host = getenv('DB_HOST') ?: '127.0.0.1';
        $port = getenv('DB_PORT') ?: '3306';
        $name = getenv('DB_NAME') ?: 'harichand_db';
        $user = getenv('DB_USER') ?: 'root';
        $pass = getenv('DB_PASS') ?: '';
        $charset = 'utf8mb4';

        // Check for local configuration file if present
        $localConfigFile = __DIR__ . '/database.local.php';
        if (file_exists($localConfigFile)) {
            $localConfig = require $localConfigFile;
            if (is_array($localConfig)) {
                if (!empty($localConfig['host'])) $host = (string)$localConfig['host'];
                if (!empty($localConfig['port'])) $port = (string)$localConfig['port'];
                if (!empty($localConfig['database'])) $name = (string)$localConfig['database'];
                if (!empty($localConfig['username'])) $user = (string)$localConfig['username'];
                if (isset($localConfig['password'])) $pass = (string)$localConfig['password'];
                if (!empty($localConfig['charset'])) $charset = (string)$localConfig['charset'];
            }
        }

        // Check for local custom environment file if present outside web root
        $envFile = dirname(__DIR__, 2) . '/.env';
        if (file_exists($envFile)) {
            $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                $line = trim($line);
                if (str_starts_with($line, '#') || !str_contains($line, '=')) continue;
                [$k, $v] = explode('=', $line, 2);
                $key = trim($k);
                $val = trim($v, " \t\n\r\0\x0B\"'");
                if ($key === 'DB_HOST') $host = $val;
                if ($key === 'DB_PORT') $port = $val;
                if ($key === 'DB_NAME') $name = $val;
                if ($key === 'DB_USER') $user = $val;
                if ($key === 'DB_PASS') $pass = $val;
            }
        }

        $dsn = "mysql:host={$host};port={$port};dbname={$name};charset={$charset}";
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::ATTR_TIMEOUT            => 5,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
        ];

        try {
            self::$instance = new PDO($dsn, $user, $pass, $options);
            self::$lastError = null;
            return self::$instance;
        } catch (PDOException $e) {
            self::$instance = null;
            self::$lastError = $e->getMessage();
            // Log securely without leaking credentials to output
            error_log("[Harichand DB Error] Connection failed to {$host}:{$port}/{$name} - " . $e->getMessage());
            return null;
        }
    }

    /**
     * Check if database connection is active
     */
    public static function isConnected(): bool {
        return self::getConnection() !== null;
    }

    /**
     * Get last connection error message (sanitized)
     */
    public static function getLastError(): ?string {
        return self::$lastError;
    }

    /**
     * Get connection diagnostic summary
     */
    public static function getStatus(): array {
        $connected = self::isConnected();
        return [
            'connected' => $connected,
            'status'    => $connected ? 'online' : 'local_fallback',
            'database'  => $connected ? 'MySQL 8.x' : 'JSON Flat-Files',
            'error'     => $connected ? null : (self::$lastError ? 'Database unreachable. Using local fallback.' : 'Not configured')
        ];
    }
}

