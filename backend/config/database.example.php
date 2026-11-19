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
    'host' => 'srv1328.hstgr.io',

    // Database Server Port (Standard MySQL port is 3306)
    'port' => '3306',

    // MySQL Database Name (e.g. u123456789_harichand)
    'database' => 'u555726154_harichand_db',

    // MySQL Database User (e.g. u123456789_admin)
    'username' => 'u555726154_harichand_user',

    // MySQL Database Password (Set your strong password)
    'password' => 'Harichand@2026#',

    // Character Encoding (Must be utf8mb4 for full emoji & Unicode support)
    'charset' => 'utf8mb4'
];
