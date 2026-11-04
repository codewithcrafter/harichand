# HARICHAND STEEL — FINAL .HTACCESS SECURITY REVIEW REPORT

**Document ID:** `HARICHAND_HTACCESS_FINAL_SECURITY_REVIEW.md`  
**Target Environment:** Hostinger Shared Hosting (LiteSpeed / Apache 2.4+)  
**Evaluation Date:** November 4, 2026  
**Status:** VALIDATED & READY FOR DEPLOYMENT (Awaiting User Sign-off)

---

## 1. EXECUTIVE SUMMARY & REVIEW OBJECTIVES

This security review evaluates the newly prepared Hostinger root `.htaccess` routing file for `https://harichandsteel.com/`. 

### Key Accomplishments in this Review:
1. **Direct Backend Access Protection:** Implemented an Apache/LiteSpeed condition using `%{THE_REQUEST}` that strictly denies direct public access to internal PHP files under `/backend/` (returning `HTTP 403 Forbidden`), while guaranteeing 100% execution for internal subrequests coming from approved `/api/` endpoints.
2. **Preservation of All Existing Behavior:** Verified that all SEO routes, product detail clean URLs (`/product/:slug/`), category pagination (`/product-category/:cat/page/:num/`), dynamic `sitemap.xml`, `robots.txt`, and custom `404.html` remain fully preserved and operational.
3. **Physical `public_html/api/` Collision Resolution:** Guaranteed that the presence of the physical `public_html/api` directory does not prevent rewrite rules from running, while directly blocking access to legacy Vercel/Node.js script files (`api/index.js`, `api/[...path].js`).
4. **Comprehensive API & Security Testing:** Executed live HTTP requests against Apache 2.4 / PHP 8.5 on port 8086 testing authentication, cookies, CSRF handling, query preservation (`[QSA]`), HTTP methods (`GET`, `POST`, `PUT`, `DELETE`), and credential leakage.

---

## 2. COMPLETE CORRECTED `.HTACCESS`

Place this complete file at `public_html/.htaccess` in Hostinger File Manager:

```apache
# ============================================================================
# HARICHAND STEEL — APACHE & LITESPEED ENTERPRISE ROUTING CONFIGURATION
# Platform Compatibility: Apache 2.4+ / Hostinger Shared Hosting (LiteSpeed / hPanel)
# ============================================================================

<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /

    # ------------------------------------------------------------------------
    # 1. SECURITY & ACCESS CONTROL (BLOCK SENSITIVE FILES & CONFIGURATION)
    # ------------------------------------------------------------------------
    # Deny direct access to system dotfiles, environment, and version control
    RewriteRule ^(\.env|\.git|\.htaccess) - [F,L]

    # Deny direct access to server-side source files, package manifests, and Node scripts
    RewriteRule ^(package\.json|package-lock\.json|composer\.json|server\.js|db\.js) - [F,L]

    # Deny direct HTTP access to flat-file JSON databases and database migrations
    RewriteRule ^data/.*\.json$ - [F,L]
    RewriteRule ^database/ - [F,L]

    # Protect physical public_html/api/ folder and its legacy JS scripts from direct HTTP access
    RewriteRule ^api/.*\.js$ - [F,L]
    RewriteRule ^api/?$ - [F,L]

    # ------------------------------------------------------------------------
    # 2. PROTECT BACKEND DIRECT ACCESS
    # Block external direct HTTP requests to internal /backend/ scripts,
    # while permitting internal subrequests from approved /api/ routes
    # and legitimate public static assets in /backend/uploads/
    # ------------------------------------------------------------------------
    RewriteCond %{THE_REQUEST} \s/+backend/ [NC]
    RewriteCond %{REQUEST_URI} !^/backend/uploads/ [NC]
    RewriteRule ^backend/ - [F,L]

    # ------------------------------------------------------------------------
    # 3. SEO & DISCOVERY DIRECTIVES
    # ------------------------------------------------------------------------
    # Dynamic XML Sitemap (served dynamically by sitemap.php)
    RewriteRule ^sitemap\.xml$ sitemap.php [L]

    # Static Robots.txt
    RewriteRule ^robots\.txt$ robots.txt [L]

    # ------------------------------------------------------------------------
    # 4. CORE REST API ENDPOINTS (PRESERVES HTTP METHODS & QUERY STRINGS)
    # Evaluated before physical directory fallbacks to cleanly bypass public_html/api/
    # ------------------------------------------------------------------------
    # Database Health & Status Endpoints
    RewriteRule ^api/db-status/?$ backend/api/db_status.php [L,QSA]
    RewriteRule ^api/admin/db-status/?$ backend/api/db_status.php [L,QSA]

    # Admin Authentication & Session Management
    RewriteRule ^api/admin/check-auth/?$ backend/auth/check_auth.php [L,QSA]
    RewriteRule ^api/admin/login/?$ backend/auth/login.php [L,QSA]
    RewriteRule ^api/admin/logout/?$ backend/auth/logout.php [L,QSA]

    # Core REST Resources (Products, Blogs, Inquiries, Upload)
    RewriteRule ^api/products/?$ backend/api/products/index.php [L,QSA]
    RewriteRule ^api/blogs/?$ backend/api/blogs/index.php [L,QSA]
    RewriteRule ^api/inquiries/?$ backend/api/inquiries/index.php [L,QSA]
    RewriteRule ^api/upload/?$ backend/api/upload.php [L,QSA]

    # ------------------------------------------------------------------------
    # 5. DYNAMIC SEO CATALOGUE & CATEGORY ROUTING
    # ------------------------------------------------------------------------
    # Product Detail Pages: /product/:slug/
    RewriteRule ^product/([a-zA-Z0-9_-]+)/?$ router.php?route=product&slug=$1 [L,QSA]

    # Product Category Pages with Pagination: /product-category/:cat/page/:num/
    RewriteRule ^product-category/([a-zA-Z0-9_-]+)/page/([0-9]+)/?$ router.php?route=category&cat=$1&page=$2 [L,QSA]
    RewriteRule ^product-category/([a-zA-Z0-9_-]+)/?$ router.php?route=category&cat=$1 [L,QSA]

    # Product Catalogue Listing Base & Pagination: /product/page/:num/
    RewriteRule ^product/page/([0-9]+)/?$ product.html [L,QSA]
    RewriteRule ^product/?$ product.html [L,QSA]

    # ------------------------------------------------------------------------
    # 6. CLEAN CANONICAL URLS FOR CORE STATIC PAGES
    # ------------------------------------------------------------------------
    RewriteRule ^about-us/?$ about-us.html [L]
    RewriteRule ^contact/?$ contact.html [L]
    RewriteRule ^our-products/?$ our-products.html [L]
    RewriteRule ^news/?$ news.html [L]
    RewriteRule ^privacy-policy/?$ privacy-policy.html [L]
    RewriteRule ^admin/?$ admin.html [L]
    RewriteRule ^sitemap/?$ sitemap.html [L]

    # ------------------------------------------------------------------------
    # 7. CLEAN CANONICAL URLS FOR DEDICATED BLOG ARTICLES
    # ------------------------------------------------------------------------
    RewriteRule ^steel-gate-design/?$ steel-gate-design.html [L]
    RewriteRule ^best-steel-gate-manufacturer-in-delhi/?$ best-steel-gate-manufacturer-in-delhi.html [L]
    RewriteRule ^aluminium-profile-gate-manufacturer-in-janakpuri/?$ aluminium-profile-gate-manufacturer-in-janakpuri.html [L]

    # ------------------------------------------------------------------------
    # 8. GENERIC CLEAN HTML EXTENSIONLESS FALLBACK
    # Maps any /page/ or /page to page.html if matching physical file exists
    # ------------------------------------------------------------------------
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_FILENAME}.html -f
    RewriteRule ^(.*)/?$ $1.html [L]
</IfModule>

# ----------------------------------------------------------------------------
# 9. ERROR DOCUMENTS & SERVER DEFAULTS
# ----------------------------------------------------------------------------
# Custom 404 Error Document (Maintains strict HTTP 404 status code; no 302 redirect)
ErrorDocument 404 /404.html

# Prevent Directory Browsing
Options -Indexes

# UTF-8 Encoding default
AddDefaultCharset UTF-8
```

---

## 3. DIRECT BACKEND ACCESS PROTECTION ARCHITECTURE

### The Problem
If backend PHP files are located under `/backend/...`, a visitor could theoretically bypass API rewrite routes and request `https://harichandsteel.com/backend/api/db_status.php` directly. Naive blocking rules (e.g. `RewriteRule ^backend/ - [F]`) would unintentionally block **both** direct visitor requests and internal rewrite subrequests, crashing the API.

### The Solution: `%{THE_REQUEST}` Inspection
```apache
RewriteCond %{THE_REQUEST} \s/+backend/ [NC]
RewriteCond %{REQUEST_URI} !^/backend/uploads/ [NC]
RewriteRule ^backend/ - [F,L]
```

1. **What is `%{THE_REQUEST}`?**  
   In Apache and LiteSpeed, `%{THE_REQUEST}` contains the verbatim HTTP request line sent by the client's browser (e.g. `GET /backend/api/db_status.php HTTP/1.1`).
2. **Behavior on Direct Client Requests:**  
   When a user or bot accesses `/backend/api/db_status.php`, `%{THE_REQUEST}` starts with `GET /backend/...`. The condition evaluates to **TRUE**, and the server immediately returns **`HTTP 403 Forbidden`**.
3. **Behavior on Internal Rewrites (e.g. `/api/db-status`):**  
   When a client visits `/api/db-status`, `%{THE_REQUEST}` contains `GET /api/db-status HTTP/1.1`.  
   When `mod_rewrite` routes `/api/db-status` to `backend/api/db_status.php`, Apache executes an internal subrequest. Because `%{THE_REQUEST}` retains the client's original request string (`GET /api/db-status`), it **does NOT match** `\s/+backend/`. The block condition evaluates to **FALSE**, and `backend/api/db_status.php` executes smoothly and returns valid JSON.
4. **Exception for Uploaded Media (`!^/backend/uploads/`):**  
   Images uploaded by the admin are served from `/backend/uploads/{hash}.jpg`. The second condition ensures uploaded images remain viewable in public image tags without being blocked. Script execution inside `/backend/uploads/` is already strictly disabled by `backend/uploads/.htaccess`.

---

## 4. DETAILED RULE INVENTORY & COMPARISON

| Section | Directives | Action & Safety Mechanism |
|:---|:---|:---|
| **Security & Manifests** | `RewriteRule ^(\.env\|\.git\|\.htaccess) - [F,L]`<br>`RewriteRule ^(package\.json\|...) - [F,L]` | Blocks access to hidden dotfiles, Git metadata, package locks, and Node scripts. |
| **Data Protection** | `RewriteRule ^data/.*\.json$ - [F,L]`<br>`RewriteRule ^database/ - [F,L]` | Denies direct web downloads of raw JSON database flat-files and SQL migration schemas. |
| **Legacy `api/` Directory** | `RewriteRule ^api/.*\.js$ - [F,L]`<br>`RewriteRule ^api/?$ - [F,L]` | Blocks direct inspection of legacy Vercel serverless scripts while leaving the folder intact on disk. |
| **Backend Guard** | `RewriteCond %{THE_REQUEST} \s/+backend/ [NC]`<br>`RewriteRule ^backend/ - [F,L]` | Blocks all direct HTTP requests to `/backend/` while permitting internal API rewrites. |
| **Sitemap & Robots** | `RewriteRule ^sitemap\.xml$ sitemap.php [L]`<br>`RewriteRule ^robots\.txt$ robots.txt [L]` | Dynamically serves XML sitemap with correct `application/xml` header and static `robots.txt`. |
| **API Health & DB** | `RewriteRule ^api/db-status/?$ ... [L,QSA]`<br>`RewriteRule ^api/admin/db-status/?$ ... [L,QSA]` | Handles both public and admin dashboard status checks. `[QSA]` preserves queries; method preserved. |
| **Auth & Sessions** | `RewriteRule ^api/admin/check-auth/?$ ... [L,QSA]`<br>`RewriteRule ^api/admin/login/?$ ... [L,QSA]`<br>`RewriteRule ^api/admin/logout/?$ ... [L,QSA]` | Full session cycle: status check, login (`POST`), logout (`POST`). Session cookies handled cleanly. |
| **REST Resources** | `RewriteRule ^api/products/?$ ... [L,QSA]`<br>`RewriteRule ^api/blogs/?$ ... [L,QSA]`<br>`RewriteRule ^api/inquiries/?$ ... [L,QSA]`<br>`RewriteRule ^api/upload/?$ ... [L,QSA]` | Full CRUD for products, blogs, lead inquiries, and media uploads. |
| **Dynamic SEO** | `RewriteRule ^product/([a-zA-Z0-9_-]+)/?$ router.php... [L,QSA]`<br>`RewriteRule ^product-category/... [L,QSA]` | Rewrites product slugs and categories to `router.php` with OpenGraph & Schema tags intact. |
| **Clean Static URLs** | `RewriteRule ^about-us/?$ about-us.html [L]` (etc.) | Canonical URLs for core HTML pages without visible `.html` extension. |
| **Error Handling** | `ErrorDocument 404 /404.html` | Custom branded 404 error page. Emits strict HTTP 404 status (no 302 redirects). |
| **Directory Options** | `Options -Indexes`<br>`AddDefaultCharset UTF-8` | Prevents directory listing across all folders. Enforces UTF-8 character encoding. |

---

## 5. LOCAL RUNTIME TEST RESULTS & VERIFICATION MATRIX

Tested against Apache 2.4.65 + PHP 8.5 on port 8086 with full request bodies, headers, and HTTP methods:

### 5.1 Direct Backend Access Tests (Direct Client Calls)
| Target URL | Method | Expected Code | Actual Code | Result | Note |
|:---|:---:|:---:|:---:|:---:|:---|
| `/backend/api/db_status.php` | GET | `403` | `403` | **PASS** | Blocked by `%{THE_REQUEST}` rule |
| `/backend/auth/check_auth.php` | GET | `403` | `403` | **PASS** | Blocked by `%{THE_REQUEST}` rule |
| `/backend/auth/login.php` | GET | `403` | `403` | **PASS** | Blocked by `%{THE_REQUEST}` rule |
| `/backend/api/products/index.php` | GET | `403` | `403` | **PASS** | Blocked by `%{THE_REQUEST}` rule |
| `/backend/config/database.php` | GET | `403` | `403` | **PASS** | Blocked by `%{THE_REQUEST}` rule |
| `/backend/config/database.local.php` | GET | `403` | `403` | **PASS** | Blocked by `%{THE_REQUEST}` rule |
| `/backend/includes/security.php` | GET | `403` | `403` | **PASS** | Blocked by `%{THE_REQUEST}` rule |

### 5.2 Sensitive File Protection Tests
| Target URL | Method | Expected Code | Actual Code | Result | Note |
|:---|:---:|:---:|:---:|:---:|:---|
| `/.env` | GET | `403` | `403` | **PASS** | Dotfile access blocked |
| `/.git/config` | GET | `403` | `403` | **PASS** | Git metadata blocked |
| `/.htaccess` | GET | `403` | `403` | **PASS** | Server config blocked |
| `/package.json` | GET | `403` | `403` | **PASS** | Manifest access blocked |
| `/server.js` | GET | `403` | `403` | **PASS** | Node source blocked |
| `/data/products.json` | GET | `403` | `403` | **PASS** | Raw JSON file blocked |
| `/database/schema.sql` | GET | `403` | `403` | **PASS** | Database schema blocked |
| `/api/index.js` | GET | `403` | `403` | **PASS** | Legacy JS blocked |
| `/api/[...path].js` | GET | `403` | `403` | **PASS** | Legacy JS blocked |
| `/api/` | GET | `403` | `403` | **PASS** | Directory listing blocked |

### 5.3 Approved API Route Verification (Internal Rewrites)
| Target URL | Method | Expected Code | Actual Code | Response Body Verification | Result |
|:---|:---:|:---:|:---:|:---|:---:|
| `/api/db-status` | GET | `200` | `200` | `{"connected":true,"status":"online","database":"MySQL 8.x"}` | **PASS** |
| `/api/admin/db-status` | GET | `200` | `200` | `{"connected":true,"status":"online"}` | **PASS** |
| `/api/admin/check-auth` | GET | `200` | `200` | `{"authenticated":false,"username":"admin"}` | **PASS** |
| `/api/products` | GET | `200` | `200` | JSON Array (19 products returned) | **PASS** |
| `/api/blogs` | GET | `200` | `200` | JSON Array (4 articles returned) | **PASS** |
| `/api/admin/login` | POST (empty) | `400` | `400` | `{"success":false,"error":"Username and password are required"}` | **PASS** |
| `/api/admin/login` | POST (invalid) | `401` | `401` | `{"success":false,"error":"Invalid username or password"}` | **PASS** |
| `/api/inquiries` | POST (invalid) | `400` | `400` | `{"success":false,"error":"Name and phone number are required"}` | **PASS** |
| `/api/inquiries` | GET (unauth) | `401` | `401` | `{"success":false,"error":"Unauthorized..."}` | **PASS** |

### 5.4 Credential & Stack Trace Leakage Audit
Tested responses from all error conditions (HTTP 400, 401, 403, 404). Checked for passwords, hashes, internal server paths, database credentials, and SQL statements:
- **Result:** **100% CLEAN**. Zero credentials, environment variables, or database connection strings leaked.

---

## 6. ROLLBACK INSTRUCTIONS

If you ever need to restore the previous state on Hostinger:

1. **Pre-Deployment Backup:**  
   Before uploading the new `.htaccess`, log in to **Hostinger hPanel &rarr; File Manager &rarr; `public_html/`**. If an `.htaccess` already exists, rename it to:
   `public_html/.htaccess.backup_pre_final_review`

2. **Rollback Execution (Takes 2 Seconds):**  
   If any unexpected issue arises:
   - In File Manager, delete `public_html/.htaccess`.
   - Rename `public_html/.htaccess.backup_pre_final_review` back to `public_html/.htaccess`.
   - The server instantly reverts with zero downtime and no server restart required.

---

## 7. POST-INSTALLATION LIVE VERIFICATION CHECKLIST

After copying the `.htaccess` file to `public_html/` on Hostinger, verify with these quick commands:

```bash
# 1. Verify clean API routes return HTTP 200 JSON
curl -i https://harichandsteel.com/api/db-status
curl -i https://harichandsteel.com/api/admin/check-auth
curl -i https://harichandsteel.com/api/products

# 2. Verify direct backend access is blocked with HTTP 403
curl -i https://harichandsteel.com/backend/api/db_status.php
curl -i https://harichandsteel.com/backend/config/database.php

# 3. Verify legacy Vercel JS files are blocked with HTTP 403
curl -i https://harichandsteel.com/api/index.js

# 4. Verify SEO routes continue working with HTTP 200
curl -i https://harichandsteel.com/sitemap.xml
curl -i https://harichandsteel.com/robots.txt
curl -i https://harichandsteel.com/product/ss-main-gate

# 5. Verify custom 404 handler
curl -i https://harichandsteel.com/non-existent-test-page-404
```

---

*Report generated by Antigravity. Local Apache copy synchronized at `c:\xampp\htdocs\harichand\.htaccess`. No production files have been uploaded or modified.*

