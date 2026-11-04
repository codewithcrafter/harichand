<?php
/**
 * ============================================================================
 * HARICHAND STEEL — STANDARDIZED API RESPONSE & HARDENED CORS HANDLER
 * Target PHP: Core PHP 8.x
 * ============================================================================
 */

declare(strict_types=1);

namespace Harichand\Includes;

class Response {
    /**
     * Send hardened CORS headers and handle preflight requests
     */
    public static function handleCors(): void {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $allowedOrigins = [
            'https://harichandsteel.com',
            'https://www.harichandsteel.com',
            'http://localhost:8080',
            'http://localhost:3000',
            'http://127.0.0.1:8080',
            'http://127.0.0.1:3000'
        ];

        if ($origin !== '') {
            $isAllowed = in_array(rtrim(strtolower($origin), '/'), $allowedOrigins, true);
            // Also allow local IP addresses for testing
            if (!$isAllowed && preg_match('#^http://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$#i', $origin)) {
                $isAllowed = true;
            }

            if ($isAllowed) {
                header("Access-Control-Allow-Origin: {$origin}");
                header('Access-Control-Allow-Credentials: true');
            } else {
                header('Access-Control-Allow-Origin: https://harichandsteel.com');
            }
        } else {
            // Direct request / Same-origin
            header('Access-Control-Allow-Origin: *');
        }

        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, x-admin-key, X-CSRF-Token');
        header('Access-Control-Max-Age: 86400');

        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(204);
            exit(0);
        }
    }

    /**
     * Send structured JSON response and terminate execution
     *
     * @param mixed $data Response payload
     * @param int $statusCode HTTP response status code
     * @param array $headers Additional HTTP headers
     */
    public static function json($data, int $statusCode = 200, array $headers = []): void {
        self::handleCors();
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=UTF-8');

        foreach ($headers as $key => $val) {
            header("{$key}: {$val}");
        }

        if ($_SERVER['REQUEST_METHOD'] === 'HEAD') {
            exit(0);
        }

        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit(0);
    }

    /**
     * Send successful JSON payload
     */
    public static function success($data = null, string $message = '', int $statusCode = 200): void {
        $payload = ['success' => true];
        if ($message !== '') $payload['message'] = $message;
        if ($data !== null) {
            if (is_array($data) && array_is_list($data)) {
                self::json($data, $statusCode);
            }
            $payload = array_merge($payload, is_array($data) ? $data : ['data' => $data]);
        }
        self::json($payload, $statusCode);
    }

    /**
     * Send standardized JSON error response
     */
    public static function error(string $message, int $statusCode = 400, $details = null): void {
        $payload = [
            'success' => false,
            'error'   => $message
        ];
        if ($details !== null) {
            $payload['details'] = $details;
        }
        self::json($payload, $statusCode);
    }

    /**
     * Read and decode JSON request body safely (safeguards max 2MB payload)
     *
     * @param int $maxBytes Maximum allowed bytes (defaults to 2MB)
     * @return array
     */
    public static function getJsonBody(int $maxBytes = 2097152): array {
        $contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
        if ($contentLength > $maxBytes) {
            self::error('Payload too large (max 2MB)', 413);
        }

        $raw = file_get_contents('php://input');
        if ($raw === false || trim($raw) === '') {
            return [];
        }

        if (strlen($raw) > $maxBytes) {
            self::error('Payload too large (max 2MB)', 413);
        }

        try {
            $data = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
            return is_array($data) ? $data : [];
        } catch (\JsonException $e) {
            self::error('Invalid JSON payload: ' . $e->getMessage(), 400);
        }
        return [];
    }
}
