-- ============================================================================
-- HARICHAND STEEL — PRODUCTION DATABASE SCHEMA
-- Target Engine: MySQL 8.x / MariaDB 10.4+ (InnoDB Engine)
-- Character Set: utf8mb4 (Unicode 5.2.0 or higher compliant)
-- Collation:     utf8mb4_unicode_ci
-- Created:       November 4, 2026 (Phase 2 Architecture)
-- Rules:         Non-destructive DDL only (No DROP/TRUNCATE)
-- ============================================================================

-- Ensure character set settings for session
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- 1. TABLE: products
-- Stores all architectural gate products, specifications, and schema parameters
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `products` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL COMMENT 'Canonical product model name',
  `title` VARCHAR(255) NOT NULL COMMENT 'Display headline title for catalogue',
  `slug` VARCHAR(255) NOT NULL COMMENT 'Clean URL slug e.g. aluminium-door-profile-gate',
  `category` VARCHAR(100) NOT NULL DEFAULT 'aluminum-profile-gate' COMMENT 'Category identifier key',
  `category_display` VARCHAR(100) NOT NULL DEFAULT 'Aluminum Profile Gate' COMMENT 'Human-readable category label',
  `badge` VARCHAR(50) DEFAULT 'New Arrival' COMMENT 'Marketing badge (Top Rated, Modern, Custom Built)',
  `price` VARCHAR(100) DEFAULT 'On Request' COMMENT 'Formatted pricing label e.g. On Request, Rs 5,000/sqft',
  `image` MEDIUMTEXT COMMENT 'Relative path (images/prod-1.png), absolute URL, or Base64 data string',
  `description` TEXT COMMENT 'Detailed architectural summary & overview',
  `outer_frame` VARCHAR(255) DEFAULT '14 Gauge (14G) steel frame' COMMENT 'Outer structural frame material specification',
  `inner_frame` VARCHAR(255) DEFAULT '16 Gauge (16G) steel frame' COMMENT 'Inner core & structural cross-member specification',
  `usage_area` VARCHAR(255) DEFAULT 'Residential, commercial, industrial entrances' COMMENT 'Recommended installation usage',
  `finish` VARCHAR(255) DEFAULT 'AkzoNobel powder coated or painted' COMMENT 'Surface coating & anti-corrosion finish',
  `hardware` VARCHAR(255) DEFAULT 'Heavy-duty sealed stainless-steel ball bearing hinges' COMMENT 'Hinges, locks, and bearing setup',
  `automation` VARCHAR(255) DEFAULT '100% compatible with motorized remote operators' COMMENT 'Motorized remote automation compatibility',
  `featured` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = Featured on Homepage showcase, 0 = Standard',
  `specs` JSON DEFAULT NULL COMMENT 'JSON array of bulleted technical inclusions',
  `schema_data` JSON DEFAULT NULL COMMENT 'JSON object containing Google Search JSON-LD properties',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Creation timestamp',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last modification timestamp',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_products_slug` (`slug`),
  KEY `idx_products_category` (`category`),
  KEY `idx_products_featured` (`featured`),
  KEY `idx_products_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Architectural gate catalogue records';

-- ----------------------------------------------------------------------------
-- 2. TABLE: blogs
-- Stores news articles, architectural design guides, and local case studies
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `blogs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(50) NOT NULL COMMENT 'Legacy/String identifier e.g. blog-1',
  `title` VARCHAR(255) NOT NULL COMMENT 'Article headline title',
  `slug` VARCHAR(255) NOT NULL COMMENT 'Target URL or hashtag slug e.g. /steel-gate-design/',
  `tag` VARCHAR(100) DEFAULT 'Guide' COMMENT 'Category tag label (Design Guide, Manufacturing, Case Study)',
  `author` VARCHAR(100) DEFAULT 'Harichand Steel Team' COMMENT 'Author display name',
  `date_published` VARCHAR(50) DEFAULT '' COMMENT 'Formatted publishing date string e.g. January 19, 2026',
  `image` MEDIUMTEXT COMMENT 'Cover image path or URL',
  `excerpt` TEXT COMMENT 'Short summary for card previews',
  `content` LONGTEXT COMMENT 'Full article markdown or HTML body content',
  `published` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = Active & visible on site, 0 = Draft/Hidden',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_blogs_code` (`code`),
  UNIQUE KEY `uk_blogs_slug` (`slug`),
  KEY `idx_blogs_published` (`published`),
  KEY `idx_blogs_tag` (`tag`),
  KEY `idx_blogs_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Articles and design guide publications';

-- ----------------------------------------------------------------------------
-- 3. TABLE: inquiries
-- Captures customer quotation requests, modal submissions, and contact leads
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `inquiries` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(100) DEFAULT NULL COMMENT 'Legacy client reference code e.g. inq-1793349470239',
  `name` VARCHAR(150) NOT NULL COMMENT 'Customer full name',
  `phone` VARCHAR(50) NOT NULL COMMENT 'Contact telephone or WhatsApp number',
  `email` VARCHAR(150) DEFAULT NULL COMMENT 'Contact email address',
  `product_name` VARCHAR(255) DEFAULT NULL COMMENT 'Selected gate model or general quotation requirement',
  `requirement` VARCHAR(255) DEFAULT NULL COMMENT 'Normalized requirement summary',
  `message` TEXT COMMENT 'Custom specifications, site measurements, location details',
  `status` VARCHAR(50) NOT NULL DEFAULT 'new' COMMENT 'Lead status: new, contacted, in_progress, closed',
  `ip_address` VARCHAR(45) DEFAULT NULL COMMENT 'Client IPv4 or IPv6 address for spam protection',
  `user_agent` VARCHAR(255) DEFAULT NULL COMMENT 'Client browser user agent string',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Submission timestamp',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Status change timestamp',
  PRIMARY KEY (`id`),
  KEY `idx_inquiries_status` (`status`),
  KEY `idx_inquiries_phone` (`phone`),
  KEY `idx_inquiries_email` (`email`),
  KEY `idx_inquiries_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Customer quote and consultation leads';

-- ----------------------------------------------------------------------------
-- 4. TABLE: admin_users
-- Secure administrative credentials with bcrypt password hashing
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(150) NOT NULL COMMENT 'Admin login username or email',
  `email` VARCHAR(150) NOT NULL COMMENT 'Official admin alert email address',
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'Bcrypt cryptographic hash (cost 12)',
  `role` VARCHAR(50) NOT NULL DEFAULT 'superadmin' COMMENT 'Authorization tier: superadmin, editor',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = Active, 0 = Suspended',
  `last_login` TIMESTAMP NULL DEFAULT NULL COMMENT 'Timestamp of last verified session',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Account creation date',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Account update date',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_admin_username` (`username`),
  UNIQUE KEY `uk_admin_email` (`email`),
  KEY `idx_admin_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Administrative authentication and credentials';

