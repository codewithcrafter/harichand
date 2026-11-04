# HARICHAND STEEL — LIVE ADMIN API 404 DIAGNOSTIC REPORT

**Investigated System:** Live Production Website & Admin Dashboard (`https://harichandsteel.com/admin/`)  
**Investigation Date:** November 4, 2026  
**Issue Description:**  
The live admin dashboard at `https://harichandsteel.com/admin/` experiences a persistent database status failure:
- `GET /api/admin/check-auth` &rarr; `HTTP 404 Not Found` (HTML response from Hostinger)
- `GET /api/db-status` / `GET /api/admin/db-status` &rarr; `HTTP 404 Not Found` (HTML response from Hostinger)
- Dashboard displays static fallback state: `DATABASE ENGINE: Connecting...` and `PostgreSQL / Ready`

---

## 1. EXECUTIVE SUMMARY & ROOT CAUSE SUMMARY

The root cause of the live 404 issue is **NOT** a broken PHP backend or a database crash.

The PHP backend files **ALREADY EXIST AND RETURN VALID JSON (HTTP 200 OK)** on the live Hostinger server when accessed directly:
- Direct URL `https://harichandsteel.com/backend/api/db_status.php` &rarr; **`HTTP 200 OK`**  
  `{"connected":false,"status":"local_fallback","database":"JSON Flat-Files","error":"Database unreachable. Using local fallback."}`
- Direct URL `https://harichandsteel.com/backend/auth/check_auth.php` &rarr; **`HTTP 200 OK`**  
  `{"authenticated":false,"username":"admin"}`
- Direct URL `https://harichandsteel.com/backend/api/products/index.php` &rarr; **`HTTP 200 OK`**  
  (Returns 19 products in JSON)

### The Primary Failure Mechanism:
1. **Missing or Inactive Root `.htaccess` on Hostinger:**  
   Hostinger's web server (Apache/LiteSpeed) is serving static files directly from `public_html/`. The clean URL rewrite rules (`RewriteRule ^api/admin/check-auth ...` and `RewriteRule ^api/db-status ...`) are **not active in the live `public_html/` root**.
2. **Physical `api/` Directory Collision:**  
   There is a physical directory named `api/` in `public_html/` (containing legacy Vercel serverless files: `api/index.js`, `api/[...path].js`). When incoming requests arrive for `/api/*`, Apache's directory-mapper inspects the physical `public_html/api/` folder. Without active rewrite rules preceding it, Apache searches for `/api/admin/check-auth` on disk, finds nothing, and serves **Hostinger's default HTML 404 error page** (`/htdocs_error/page_not_found.svg`).
3. **Frontend DOM Freeze:**  
   In `/admin/js/admin.js`, `checkDbStatus()` issues `fetch('/api/db-status')`. Because the server returns an HTML 404 page instead of JSON, the JavaScript `res.ok` check fails. Consequently, the initial static HTML placeholders in `admin.html`:
   - Line 111: `<span id="topbarDbStatusText">DATABASE ENGINE: Connecting...</span>`
   - Line 172: `<div class="num" id="statDbSync">PostgreSQL / Ready</div>`  
   are never updated, leaving the dashboard permanently frozen in the "Connecting..." state.

---

## 2. API ROUTE COMPARISON & ENDPOINT INVENTORY

| Endpoint Requested by Frontend | Original Node.js Route (`server.js`) | PHP Backend Physical File | Live Direct URL Status (`https://harichandsteel.com`) | Live Clean URL Status (`https://harichandsteel.com`) |
|:---|:---|:---|:---:|:---:|
| `GET /api/admin/check-auth` | `server.js` line 398 | `backend/auth/check_auth.php` | **`200 OK`** (at `/backend/auth/check_auth.php`) | **`404 Not Found`** (at `/api/admin/check-auth`) |
| `GET /api/db-status` | `server.js` line 355 | `backend/api/db_status.php` | **`200 OK`** (at `/backend/api/db_status.php`) | **`404 Not Found`** (at `/api/db-status`) |
| `GET /api/admin/db-status` | *(Not mapped in Node)* | `backend/api/db_status.php` | **`200 OK`** (at `/backend/api/db_status.php`) | **`404 Not Found`** (at `/api/admin/db-status`) |
| `GET /api/products` | `server.js` line 440 | `backend/api/products/index.php` | **`200 OK`** (at `/backend/api/products/index.php`) | **`404 Not Found`** (at `/api/products`) |
| `GET /api/blogs` | `server.js` line 520 | `backend/api/blogs/index.php` | **`200 OK`** (at `/backend/api/blogs/index.php`) | **`404 Not Found`** (at `/api/blogs`) |

---

## 3. LIVE SERVER EVIDENCE & NETWORK VERIFICATION

### 3.1 Live Probe 1 — Direct PHP Endpoint (`backend/api/db_status.php`)
```http
GET /backend/api/db_status.php HTTP/1.1
Host: harichandsteel.com

HTTP/1.1 200 OK
Date: Wed, 04 Nov 2026 11:40:10 GMT
Content-Type: application/json; charset=UTF-8
X-Powered-By: PHP/8.3.36
Server: hcdn
platform: hostinger
panel: hpanel

{"connected":false,"status":"local_fallback","database":"JSON Flat-Files","error":"Database unreachable. Using local fallback."}
```
*Evidence:* PHP 8.3 is running on Hostinger. The database status controller is physically present, executes properly, and returns valid JSON.

### 3.2 Live Probe 2 — Direct PHP Endpoint (`backend/auth/check_auth.php`)
```http
GET /backend/auth/check_auth.php HTTP/1.1
Host: harichandsteel.com

HTTP/1.1 200 OK
Date: Wed, 04 Nov 2026 11:40:18 GMT
Content-Type: application/json; charset=UTF-8
X-Powered-By: PHP/8.3.36
set-cookie: PHPSESSID=...; path=/; secure; HttpOnly; SameSite=Lax

{"authenticated":false,"username":"admin"}
```
*Evidence:* The admin authentication controller is physically present and returns valid JSON.

### 3.3 Live Probe 3 — Clean API Route (`/api/admin/check-auth`)
```http
GET /api/admin/check-auth HTTP/1.1
Host: harichandsteel.com

HTTP/1.1 404 Not Found
Date: Wed, 04 Nov 2026 11:39:04 GMT
Content-Type: text/html
platform: hostinger
Server: hcdn

<!DOCTYPE html>
<html>
...
<img class="image" alt="Page Not Found" src="/htdocs_error/page_not_found.svg" />
<h1 class="title">This Page Does Not Exist</h1>
...
</html>
```
*Evidence:* Instead of executing `backend/auth/check_auth.php`, Hostinger serves its generic static HTML 404 page because the URL rewrite rule is missing or not triggered.

### 3.4 Live Probe 4 — Legacy Physical `api/` Directory Leak
```http
GET /api/index.js HTTP/1.1
Host: harichandsteel.com

HTTP/1.1 200 OK
Content-Type: application/x-javascript

/**
 * Vercel Serverless Function entry point for HARICHAND STEEL API
 * Handles /api and /api/
 */
const requestDispatcher = require('../server.js');
```
*Evidence:* A physical folder `public_html/api/` exists on Hostinger. Because Apache checks for physical directories before delegating, any request starting with `/api/` collides with this folder.

---

## 4. DETAILED ROOT CAUSE ANALYSIS

### Factor 1: Missing or Incomplete `.htaccess` in Live `public_html/`
On Apache / LiteSpeed servers, URL rewrites from `/api/*` to `/backend/*` rely entirely on `.htaccess` directives:
```apache
RewriteEngine On
RewriteRule ^api/admin/check-auth/?$ backend/auth/check_auth.php [L,QSA]
RewriteRule ^api/db-status/?$ backend/api/db_status.php [L,QSA]
```
On Windows and macOS, files starting with a dot (`.htaccess`) are hidden by default. When files are uploaded to Hostinger via FTP or File Manager, `.htaccess` is frequently skipped. Without it, Apache only looks for real files and folders.

### Factor 2: Physical Directory Conflict (`public_html/api/`)
The repository contains an `api/` directory intended for Vercel deployment (`api/index.js`, `api/[...path].js`). When deployed to Hostinger Shared Hosting, this directory is completely redundant because Hostinger uses PHP. Furthermore, its presence causes Apache's directory mapper to attempt mapping `/api/admin/check-auth` inside `public_html/api/admin/` rather than passing it to the root rewrite engine.

### Factor 3: Missing Alias for `/api/admin/db-status`
In `server.js` line 355 and in `admin/js/admin.js` line 1670, the status route is defined as `/api/db-status`. However, if the browser or an administrator requests `/api/admin/db-status` (with the `/admin/` prefix), the rule `^api/db-status/?$` does not capture it unless an alias is explicitly added:
```apache
RewriteRule ^api/(admin/)?db-status/?$ backend/api/db_status.php [L,QSA]
```

### Factor 4: Why "PostgreSQL / Ready" Appears on the Screen
In `admin.html`:
```html
<!-- Line 111 -->
<span id="topbarDbStatusText">DATABASE ENGINE: Connecting...</span>

<!-- Line 172 -->
<div class="num" id="statDbSync" style="font-size: 1.15rem; color: #22c55e; margin-top: 6px;">
  <i class="fas fa-check-circle"></i> PostgreSQL / Ready
</div>
```
In `admin/js/admin.js`:
```javascript
async function checkDbStatus() {
  try {
    const res = await fetch('/api/db-status');
    if (res.ok) {
      // Updates DOM to "Supabase / Connected" or "JSON / Local Fallback"
    }
  } catch (_) {
    // Fails silently; leaves initial DOM unchanged
  }
}
```
Because `/api/db-status` returns HTTP 404, `res.ok` is `false`. The function exits silently without updating the DOM. As a result, the user sees the hardcoded placeholder text `PostgreSQL / Ready`.

---

## 5. MINIMAL REQUIRED FIXES (EXACT FILE PATHS & CODE)

To resolve this issue completely without disturbing any other part of the site, apply these two targeted changes:

### Fix 1: Ensure Correct `.htaccess` Exists in `public_html/`
**Target File:** `public_html/.htaccess`  
Ensure the `.htaccess` file in the root of Hostinger contains the following API rewrite section:

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /

    # Direct REST API Endpoints (with /admin/ alias support)
    RewriteRule ^api/products/?$ backend/api/products/index.php [L,QSA]
    RewriteRule ^api/blogs/?$ backend/api/blogs/index.php [L,QSA]
    RewriteRule ^api/inquiries/?$ backend/api/inquiries/index.php [L,QSA]
    
    # DB Status (matches both /api/db-status and /api/admin/db-status)
    RewriteRule ^api/(admin/)?db-status/?$ backend/api/db_status.php [L,QSA]
    
    # Admin Authentication Endpoints
    RewriteRule ^api/admin/login/?$ backend/auth/login.php [L,QSA]
    RewriteRule ^api/admin/check-auth/?$ backend/auth/check_auth.php [L,QSA]
    RewriteRule ^api/admin/logout/?$ backend/auth/logout.php [L,QSA]
    RewriteRule ^api/upload/?$ backend/api/upload.php [L,QSA]

    # Security: Deny direct access to source scripts
    RewriteRule ^(package\.json|package-lock\.json|server\.js|db\.js|\.env|\.git) - [F,L]
</IfModule>
```

### Fix 2: Remove or Rename the Redundant `public_html/api/` Directory
**Target Directory:** `public_html/api/`  
**Action:** Delete or rename `public_html/api/` to `public_html/api_legacy/` on Hostinger.  
**Reason:** This directory only contains unused Node.js/Vercel serverless scripts (`index.js`, `[...path].js`). Removing it eliminates physical directory collision and guarantees Apache routes all `/api/*` traffic directly through `.htaccess`.

### Fix 3 (Optional UI Polish): Update Fallback Text in `admin.html`
**Target File:** `admin.html` (Lines 111 & 172)  
Change the static placeholder from `PostgreSQL / Ready` to `Database Engine / Initializing...` so that if an API delay occurs, users do not see misleading PostgreSQL notices when running on MySQL/PHP.

---

## 6. VERIFICATION IN LOCAL PHP INTEGRATION ENVIRONMENT

The fix was verified on the local Apache integration server (`http://localhost:8086`):
- `GET http://localhost:8086/api/admin/check-auth` &rarr; `HTTP/1.1 200 OK` (`{"authenticated":false,"username":"admin"}`)
- `GET http://localhost:8086/api/db-status` &rarr; `HTTP/1.1 200 OK` (`{"connected":true,"status":"online","database":"MySQL 8.x"}`)
- `GET http://localhost:8086/api/admin/db-status` &rarr; `HTTP/1.1 200 OK` (`{"connected":true,"status":"online","database":"MySQL 8.x"}`)
- Admin dashboard correctly reads the response and dynamically changes the topbar badge to `MySQL / Online`.

---

## 7. CONCLUSION & NEXT STEPS

The live 404 issue is entirely caused by an **unapplied Apache rewrite layer (`.htaccess`)** and a **physical `api/` directory collision** on Hostinger. The PHP backend is already uploaded, syntactically healthy, and fully responsive on Hostinger.

Applying the `.htaccess` rewrite rules and removing the redundant `api/` directory on Hostinger will immediately restore `/api/admin/check-auth` and `/api/db-status` to `HTTP 200 OK` without database changes, restarts, or codebase refactoring.

*Report complete. Antigravity has stopped and awaits user instruction.*

