<?php
/**
 * ============================================================================
 * HARICHAND STEEL — DATABASE CONFIGURATION TEMPLATE (EXAMPLE)
 * 
 * Instructions:
 * 1. For local development or Hostinger Shared Hosting deployment:
 *    Copy this file to: backend/config/database.local.php (or set environment variables)
 * 2. Fill in your actual MySQL database credentials created in Hostinger hPanel.
 * 3. Never commit actual passwords or credentials to version control.
 * ============================================================================
 */

return [
    // Database Server Host (Usually 'localhost' or '127.0.0.1' on Hostinger Shared Hosting)
    'host' => '127.0.0.1',

    // Database Server Port (Standard MySQL port is 3306)
    'port' => '3306',

    // MySQL Database Name (e.g. u123456789_harichand)
    'database' => 'harichand_db',

    // MySQL Database User (e.g. u123456789_admin)
    'username' => 'root',

    // MySQL Database Password (Set your strong password)
    'password' => '',

    // Character Encoding (Must be utf8mb4 for full emoji & Unicode support)
    'charset' => 'utf8mb4'
];

