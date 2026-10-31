/**
 * HARICHAND STEEL - Enterprise Clean URL Server & Supabase CMS Backend
 * Built with native Node.js (http, fs, path) and Supabase PostgreSQL (pg)
 * Run: node server.js
 */

require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./db.js');
const markdownSync = require('./markdown-sync.js');

const PORT = process.env.PORT || 8080;
const ALT_PORT = 3000;
const ROOT_DIR = __dirname;
const crypto = require('crypto');
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'hs_admin_secret_key_2026';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'buzzspire.info@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Harichand@2004';

// Helper to dynamically read admin credentials from .env or memory on every request
function getAdminCredentials() {
  try {
    const envPath = path.join(ROOT_DIR, '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
        const [k, ...v] = trimmed.split('=');
        const key = k.trim();
        const val = v.join('=').trim().replace(/^['"](.*)['"]$/, '$1');
        if (key === 'ADMIN_USERNAME') process.env.ADMIN_USERNAME = val;
        if (key === 'ADMIN_PASSWORD') process.env.ADMIN_PASSWORD = val;
      }
    }
  } catch (_) {}

  return {
    username: (process.env.ADMIN_USERNAME || 'buzzspire.info@gmail.com').trim(),
    password: (process.env.ADMIN_PASSWORD || 'Harichand@2004').trim()
  };
}

// In-memory active admin sessions: token -> { username, createdAt }
const activeAdminSessions = new Map();

// Helper to parse cookies from request
function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
  }
  return list;
}

// Helper to validate administrative access (API key OR active session token/cookie)
function isAuthorized(req) {
  const headerKey = req.headers['x-admin-key'];
  const authHeader = req.headers['authorization'];
  
  if (headerKey) {
    if (headerKey === ADMIN_API_KEY) return true;
    if (activeAdminSessions.has(headerKey)) return true;
  }
  
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && (parts[0] === 'Bearer' || parts[0] === 'ApiKey')) {
      if (parts[1] === ADMIN_API_KEY) return true;
      if (activeAdminSessions.has(parts[1])) return true;
    }
  }

  // Check session cookie
  const cookies = parseCookies(req);
  if (cookies.hs_admin_session && activeAdminSessions.has(cookies.hs_admin_session)) {
    return true;
  }

  return false;
}

// MIME types dictionary
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=UTF-8',
  '.xml': 'application/xml; charset=UTF-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

// Helper to read JSON request body (DOS-01: max 2MB payload safeguard)
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      // Safeguard max 2MB payload to prevent heap exhaustion / OOM
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// Helper to send JSON responses
function sendJson(res, statusCode, data, method = 'GET') {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key'
  });
  if (method === 'HEAD') {
    res.end();
  } else {
    res.end(JSON.stringify(data));
  }
}

// Central Request Dispatcher
async function requestDispatcher(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key'
    });
    res.end();
    return;
  }

  // ==========================================
  // 1. GLOBAL CLEAN URL & TRAILING SLASH MIDDLEWARE (HTTP 301)
  // Enforces removal of .html and presence of trailing slash for all page URLs.
  // Example: /about-us.html -> /about-us/
  // Example: /about-us -> /about-us/
  // Example: /product/aluminium-door-profile-gate -> /product/aluminium-door-profile-gate/
  // ==========================================
  const isStaticAsset = /\.(css|js|png|jpg|jpeg|svg|ico|webp|json|txt|woff2?|ttf|eot|xml)$/i.test(pathname);
  if (!isStaticAsset && !pathname.startsWith('/api')) {
    // A. Strip .html / .htm and redirect with trailing slash (301)
    if (/\.html?$/i.test(pathname)) {
      const cleanPath = pathname.replace(/\.html?$/i, '');
      const redirectTarget = (cleanPath === '/index' || cleanPath === '') ? '/' : `${cleanPath}/`;
      const redirectUrl = redirectTarget + (parsedUrl.search || '') + (parsedUrl.hash || '');
      res.writeHead(301, { 'Location': redirectUrl });
      res.end();
      return;
    }

    // B. Enforce trailing slash for all non-root page paths missing trailing slash (301)
    if (pathname !== '/' && !pathname.endsWith('/')) {
      const redirectUrl = `${pathname}/` + (parsedUrl.search || '') + (parsedUrl.hash || '');
      res.writeHead(301, { 'Location': redirectUrl });
      res.end();
      return;
    }
  }

  // ==========================================
  // 2. ASSET ALIASING
  // ==========================================
  // Handle favicon requests (/images/favicon.ico, /favicon.ico, etc.)
  if (pathname === '/images/favicon.ico' || pathname === '/favicon.ico' || pathname.endsWith('/favicon.ico')) {
    const faviconIco = path.join(ROOT_DIR, 'images', 'favicon.ico');
    const faviconJpeg = path.join(ROOT_DIR, 'images', 'favicon-32.jpeg');
    let faviconPath = null;
    let faviconType = 'image/x-icon';

    if (fs.existsSync(faviconIco)) {
      faviconPath = faviconIco;
      faviconType = 'image/x-icon';
    } else if (fs.existsSync(faviconJpeg)) {
      faviconPath = faviconJpeg;
      faviconType = 'image/jpeg';
    }

    if (faviconPath) {
      res.writeHead(200, { 'Content-Type': faviconType });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      fs.createReadStream(faviconPath).pipe(res);
      return;
    } else {
      res.writeHead(204);
      res.end();
      return;
    }
  }

  // Map /images/logo.png -> images/logo.jpeg
  if (pathname === '/images/logo.png' || pathname.endsWith('/images/logo.png') || pathname.endsWith('/logo.png')) {
    const logoJpeg = path.join(ROOT_DIR, 'images', 'logo.jpeg');
    if (fs.existsSync(logoJpeg)) {
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      fs.createReadStream(logoJpeg).pipe(res);
      return;
    }
  }

  // ==========================================
  // 3. API ROUTES (Powered by db.js & Supabase)
  // ==========================================
  const apiPath = (pathname.endsWith('/') && pathname.length > 1) ? pathname.slice(0, -1) : pathname;

  // --- /api or /api/ root endpoint ---
  if ((apiPath === '/api' || apiPath === '') && (req.method === 'GET' || req.method === 'HEAD')) {
    sendJson(res, 200, { name: "Harichand Steel API", status: "online", version: "1.0.0", debug: { url: req.url, pathname, apiPath } }, req.method);
    return;
  }

  // --- /api/db-status ---
  if (apiPath === '/api/db-status' && (req.method === 'GET' || req.method === 'HEAD')) {
    try {
      const dbStatus = await db.checkConnection();
      sendJson(res, 200, dbStatus, req.method);
    } catch (err) {
      sendJson(res, 200, { status: "local_fallback", database: "JSON" }, req.method);
    }
    return;
  }

  // --- /api/admin/login ---
  if (apiPath === '/api/admin/login' && req.method === 'POST') {
    try {
      const data = await parseJsonBody(req);
      const user = (data.username || '').trim();
      const pass = (data.password || '').trim();
      const creds = getAdminCredentials();

      if (user.toLowerCase() === creds.username.toLowerCase() && pass === creds.password) {
        const sessionToken = 'hs_sess_' + crypto.randomBytes(24).toString('hex');
        activeAdminSessions.set(sessionToken, { username: user, createdAt: Date.now() });

        // Set secure HTTP cookie valid for 7 days
        res.setHeader('Set-Cookie', `hs_admin_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
        return sendJson(res, 200, {
          success: true,
          message: 'Login successful',
          token: sessionToken,
          apiKey: ADMIN_API_KEY,
          username: user
        });
      } else {
        return sendJson(res, 401, {
          success: false,
          error: 'Invalid username or password'
        });
      }
    } catch (e) {
      return sendJson(res, 400, { success: false, error: 'Invalid request body' });
    }
  }

  // --- /api/admin/check-auth ---
  if (apiPath === '/api/admin/check-auth' && (req.method === 'GET' || req.method === 'HEAD')) {
    const authorized = isAuthorized(req);
    let username = 'admin';
    const cookies = parseCookies(req);
    if (cookies.hs_admin_session && activeAdminSessions.has(cookies.hs_admin_session)) {
      username = activeAdminSessions.get(cookies.hs_admin_session).username;
    }
    return sendJson(res, 200, { authenticated: authorized, username }, req.method);
  }

  // --- /api/admin/logout ---
  if (apiPath === '/api/admin/logout' && req.method === 'POST') {
    const cookies = parseCookies(req);
    if (cookies.hs_admin_session) {
      activeAdminSessions.delete(cookies.hs_admin_session);
    }
    const headerKey = req.headers['x-admin-key'];
    if (headerKey && activeAdminSessions.has(headerKey)) {
      activeAdminSessions.delete(headerKey);
    }
    res.setHeader('Set-Cookie', 'hs_admin_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax');
    return sendJson(res, 200, { success: true, message: 'Logged out successfully' });
  }

  // --- /api/markdown/sync ---
  if (apiPath === '/api/markdown/sync') {
    if (!isAuthorized(req)) {
      return sendJson(res, 401, { error: 'Unauthorized: Valid x-admin-key or Bearer token required' });
    }
    try {
      const summary = markdownSync.syncAll();
      sendJson(res, 200, { success: true, message: 'All markdown files synchronized successfully', summary });
    } catch (e) {
      sendJson(res, 500, { error: 'Failed to sync markdown files: ' + e.message });
    }
    return;
  }

  // --- /api/products ---
  if (apiPath === '/api/products') {
    if (req.method === 'GET' || req.method === 'HEAD') {
      try {
        const products = await db.getProducts();
        sendJson(res, 200, products, req.method);
      } catch (e) {
        sendJson(res, 500, { error: 'Failed to read products' }, req.method);
      }
      return;
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      if (!isAuthorized(req)) {
        return sendJson(res, 401, { error: 'Unauthorized: Valid x-admin-key or Bearer token required' });
      }
      try {
        const data = await parseJsonBody(req);
        const productsFile = path.join(ROOT_DIR, 'data', 'products.json');
        let currentProducts = [];
        try {
          if (fs.existsSync(productsFile)) {
            currentProducts = JSON.parse(fs.readFileSync(productsFile, 'utf8'));
          }
        } catch (e) {
          currentProducts = [];
        }

        function normalizeItem(item) {
          if (!item.id) item.id = 'prod-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
          if (!item.createdAt) item.createdAt = new Date().toISOString().split('T')[0];
          if (!item.slug && item.title) {
            item.slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          }
          if (!item.outerFrame) item.outerFrame = '14 Gauge (14G) steel frame';
          if (!item.innerFrame) item.innerFrame = '16 Gauge (16G) steel frame';
          if (!item.usage) item.usage = 'Residential, commercial, industrial entrances';
          if (!item.finish) item.finish = 'Powder coated or painted';
          if (!item.hardware) item.hardware = 'Heavy-duty sealed stainless-steel ball bearing hinges / Italian rolling track';
          if (!item.automation) item.automation = '100% compatible with motorized remote swing & sliding gate operators';
          return item;
        }

        if (Array.isArray(data)) {
          for (let item of data) {
            item = normalizeItem(item);
            const idx = currentProducts.findIndex(p => p.id === item.id || (item.slug && p.slug === item.slug));
            if (idx !== -1) {
              currentProducts[idx] = { ...currentProducts[idx], ...item };
            } else {
              currentProducts.unshift(item);
            }
            if (db && typeof db.saveProduct === 'function') {
              try { await db.saveProduct(item); } catch (_) { }
            }
            try { markdownSync.generateProductMarkdown(item); } catch (_) { }
          }
          try { fs.writeFileSync(productsFile, JSON.stringify(currentProducts, null, 2), 'utf8'); } catch (_) {}
          sendJson(res, 200, { success: true, count: data.length });
        } else if (data && typeof data === 'object') {
          const item = normalizeItem(data);
          const idx = currentProducts.findIndex(p => p.id === item.id || (item.slug && p.slug === item.slug));
          if (idx !== -1) {
            currentProducts[idx] = { ...currentProducts[idx], ...item };
          } else {
            currentProducts.unshift(item);
          }
          try { fs.writeFileSync(productsFile, JSON.stringify(currentProducts, null, 2), 'utf8'); } catch (_) {}
          if (db && typeof db.saveProduct === 'function') {
            try { await db.saveProduct(item); } catch (_) { }
          }
          try { markdownSync.generateProductMarkdown(item); } catch (_) { }
          sendJson(res, 200, { success: true, product: item });
        } else {
          sendJson(res, 400, { error: 'Invalid product payload' });
        }
      } catch (e) {
        if (e.message === 'Payload too large') {
          return sendJson(res, 400, { error: 'Payload too large (max 2MB)' });
        }
        sendJson(res, 400, { error: 'Invalid JSON or database save error' });
      }
      return;
    }

    if (req.method === 'DELETE') {
      if (!isAuthorized(req)) {
        return sendJson(res, 401, { error: 'Unauthorized: Valid x-admin-key or Bearer token required' });
      }
      try {
        const id = parsedUrl.searchParams.get('id');
        if (id) {
          await db.deleteProduct(id);
          try { markdownSync.deleteProductMarkdown(id); } catch (_) { }
          sendJson(res, 200, { success: true, id });
        } else {
          sendJson(res, 400, { error: 'Product ID required' });
        }
      } catch (e) {
        sendJson(res, 500, { error: 'Failed to delete product' });
      }
      return;
    }
  }

  // --- /api/blogs ---
  if (apiPath === '/api/blogs') {
    if (req.method === 'GET' || req.method === 'HEAD') {
      try {
        const blogs = await db.getBlogs();
        sendJson(res, 200, blogs, req.method);
      } catch (e) {
        sendJson(res, 500, { error: 'Failed to read blogs' }, req.method);
      }
      return;
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      if (!isAuthorized(req)) {
        return sendJson(res, 401, { error: 'Unauthorized: Valid x-admin-key or Bearer token required' });
      }
      try {
        const data = await parseJsonBody(req);
        if (Array.isArray(data)) {
          for (const item of data) {
            await db.saveBlog(item);
            try { markdownSync.generateBlogMarkdown(item); } catch (_) { }
          }
          sendJson(res, 200, { success: true, count: data.length });
        } else {
          const saved = await db.saveBlog(data);
          try { markdownSync.generateBlogMarkdown(saved || data); } catch (_) { }
          sendJson(res, 200, { success: true, blog: saved });
        }
      } catch (e) {
        if (e.message === 'Payload too large') {
          return sendJson(res, 400, { error: 'Payload too large (max 2MB)' });
        }
        sendJson(res, 400, { error: 'Invalid JSON or database save error' });
      }
      return;
    }

    if (req.method === 'DELETE') {
      if (!isAuthorized(req)) {
        return sendJson(res, 401, { error: 'Unauthorized: Valid x-admin-key or Bearer token required' });
      }
      try {
        const id = parsedUrl.searchParams.get('id');
        if (id) {
          await db.deleteBlog(id);
          try { markdownSync.deleteBlogMarkdown(id); } catch (_) { }
          sendJson(res, 200, { success: true, id });
        } else {
          sendJson(res, 400, { error: 'Blog ID required' });
        }
      } catch (e) {
        sendJson(res, 500, { error: 'Failed to delete blog' });
      }
      return;
    }
  }

  // --- /api/inquiries ---
  if (apiPath === '/api/inquiries') {
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (!isAuthorized(req)) {
        return sendJson(res, 401, { error: 'Unauthorized: Valid x-admin-key or Bearer token required' }, req.method);
      }
      try {
        const inquiries = await db.getInquiries();
        sendJson(res, 200, inquiries, req.method);
      } catch (e) {
        sendJson(res, 500, { error: 'Failed to read inquiries' }, req.method);
      }
      return;
    }

    if (req.method === 'POST') {
      try {
        const newInq = await parseJsonBody(req);
        if (Array.isArray(newInq)) {
          for (const item of newInq) {
            await db.saveInquiry(item);
          }
          sendJson(res, 200, { success: true, count: newInq.length });
        } else {
          const saved = await db.saveInquiry(newInq);
          sendJson(res, 200, { success: true, inquiry: saved });
        }
      } catch (e) {
        if (e.message === 'Payload too large') {
          return sendJson(res, 400, { error: 'Payload too large (max 2MB)' });
        }
        sendJson(res, 400, { error: 'Invalid inquiry payload' });
      }
      return;
    }

    if (req.method === 'DELETE') {
      if (!isAuthorized(req)) {
        return sendJson(res, 401, { error: 'Unauthorized: Valid x-admin-key or Bearer token required' });
      }
      try {
        const id = parsedUrl.searchParams.get('id');
        if (id) {
          await db.deleteInquiry(id);
          sendJson(res, 200, { success: true, id });
        } else {
          sendJson(res, 400, { error: 'Inquiry ID required' });
        }
      } catch (e) {
        sendJson(res, 500, { error: 'Failed to delete inquiry' });
      }
      return;
    }
  }

  // ==========================================
  // 4. UNIVERSAL ASSET SERVING (HANDLES ANY PATH DEPTH)
  // ==========================================
  const isAsset = /\.(css|js|png|jpg|jpeg|svg|ico|webp|json|txt|woff2?|ttf|eot|xml)$/i.test(pathname);
  if (isAsset) {
    // 1. Direct path check from root
    let assetPath = path.join(ROOT_DIR, pathname.replace(/^\/+/, ''));
    if (fs.existsSync(assetPath) && !fs.statSync(assetPath).isDirectory()) {
      const ext = path.extname(assetPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      if (req.method === 'HEAD') { res.end(); return; }
      fs.createReadStream(assetPath).pipe(res);
      return;
    }

    // 1b. Direct path check from public/
    let publicAssetPath = path.join(ROOT_DIR, 'public', pathname.replace(/^\/+/, ''));
    if (fs.existsSync(publicAssetPath) && !fs.statSync(publicAssetPath).isDirectory()) {
      const ext = path.extname(publicAssetPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      if (req.method === 'HEAD') { res.end(); return; }
      fs.createReadStream(publicAssetPath).pipe(res);
      return;
    }

    // 2. Nested asset extraction from sub-path (e.g. /about-us/css/style.css, /product/category/images/logo.jpeg, /admin/css/admin.css)
    const subMatch = pathname.match(/(admin\/css\/[^\/]+|admin\/js\/[^\/]+|css\/[^\/]+|js\/[^\/]+|images\/[^\/]+|webfonts\/[^\/]+)$/i);
    if (subMatch) {
      const nestedPath = path.join(ROOT_DIR, subMatch[1]);
      if (fs.existsSync(nestedPath) && !fs.statSync(nestedPath).isDirectory()) {
        const ext = path.extname(nestedPath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        if (req.method === 'HEAD') { res.end(); return; }
        fs.createReadStream(nestedPath).pipe(res);
        return;
      }
    }
  }

  // ==========================================
  // 6. ROUTER ENDPOINTS (CANONICAL TRAILING-SLASH CLEAN URLS)
  // ==========================================

  // --- A. Root Homepage: / ---
  if (pathname === '/') {
    const indexHtmlPath = path.join(ROOT_DIR, 'index.html');
    if (fs.existsSync(indexHtmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(indexHtmlPath).pipe(res);
      return;
    }
  }

  // --- B. Public Catalogue: /product/ and /product/page/:num/ ---
  const catalogueMatch = pathname.match(/^\/product\/(?:page\/(\d+)\/)?$/i);
  if (catalogueMatch) {
    const productHtmlPath = path.join(ROOT_DIR, 'product.html');
    if (fs.existsSync(productHtmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(productHtmlPath).pipe(res);
      return;
    }
  }

  // --- C. Product Category Catalogue: /product-category/:category/ and /product-category/:category/page/:num/ ---
  const categoryMatch = pathname.match(/^\/product-category\/([a-zA-Z0-9_-]+)\/(?:page\/(\d+)\/)?$/i);
  if (categoryMatch) {
    const category = categoryMatch[1].toLowerCase();
    const pageNum = categoryMatch[2] ? parseInt(categoryMatch[2], 10) : 1;
    const productHtmlPath = path.join(ROOT_DIR, 'product.html');
    if (fs.existsSync(productHtmlPath)) {
      try {
        let html = fs.readFileSync(productHtmlPath, 'utf8');

        const metaMap = {
          'steel-door': {
            title: 'Steel Doors',
            lead: 'Heavy-duty security doors designed for main entrances, back doors, and security partitions with multi-point locking systems and weatherproofing.',
            breadcrumb: 'Steel Doors',
            docTitle: 'Steel Doors - HARICHAND STEEL'
          },
          'aluminum-profile-gate': {
            title: 'Aluminum Profile Gates',
            lead: 'Engineered with lightweight yet rigid aluminium extrusions, offering modern luxury styling, rust-proof longevity, and effortless automation capability.',
            breadcrumb: 'Aluminum Profile Gate',
            docTitle: 'Aluminum Profile Gates - HARICHAND STEEL'
          },
          'iron-main-gate': {
            title: 'Iron Main Gates',
            lead: 'Heavy-duty wrought iron main entrance gates crafted with traditional forged strength, security spikes, and timeless aesthetic designs.',
            breadcrumb: 'Iron Main Gate',
            docTitle: 'Iron Main Gates - HARICHAND STEEL'
          },
          'steel-main-gate': {
            title: 'Steel Main Gates',
            lead: 'Fabricated from genuine SS304 grade stainless steel and heavy-gauge mild steel featuring intricate CNC laser-cut designs with polished mirror or matte finishes.',
            breadcrumb: 'Steel Main Gate',
            docTitle: 'Steel Main Gates - HARICHAND STEEL'
          },
          'powder-coated-gates': {
            title: 'Powder Coated Gates',
            lead: 'Superior rust-resistant powder-coated gate systems offering vibrant long-lasting exterior colors, UV protection, and minimal maintenance.',
            breadcrumb: 'Powder Coated Gates',
            docTitle: 'Powder Coated Gates - HARICHAND STEEL'
          }
        };

        const meta = metaMap[category] || {
          title: category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          lead: `Explore our premium handcrafted ${category.replace(/-/g, ' ')} models built for luxury, safety, and longevity.`,
          breadcrumb: category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          docTitle: `${category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} - HARICHAND STEEL`
        };

        const fullTitle = pageNum > 1 ? `${meta.title} (Page ${pageNum})` : meta.title;
        const fullDocTitle = pageNum > 1 ? `${meta.title} - Page ${pageNum} - HARICHAND STEEL` : meta.docTitle;

        // Replace <title>
        html = html.replace(/<title>.*?<\/title>/i, `<title>${fullDocTitle}</title>`);

        // Replace Page Title H1
        html = html.replace(/(<h1[^>]*class="[^"]*page-title[^"]*"[^>]*>).*?(<\/h1>)/i, `$1${fullTitle}$2`);

        // Replace Page Lead P
        html = html.replace(/(<p[^>]*class="[^"]*page-lead[^"]*"[^>]*>).*?(<\/p>)/i, `$1${meta.lead}$2`);

        // Pre-render breadcrumb navigation
        const breadcrumbHtml = pageNum > 1 ? `
        <a href="/">Home</a>
        <span class="sep"><i class="fas fa-chevron-right"></i></span>
        <a href="/product/">Product</a>
        <span class="sep"><i class="fas fa-chevron-right"></i></span>
        <a href="/product-category/${category}/">${meta.breadcrumb}</a>
        <span class="sep"><i class="fas fa-chevron-right"></i></span>
        <span>Page ${pageNum}</span>
      ` : `
        <a href="/">Home</a>
        <span class="sep"><i class="fas fa-chevron-right"></i></span>
        <a href="/product/">Product</a>
        <span class="sep"><i class="fas fa-chevron-right"></i></span>
        <span>${meta.breadcrumb}</span>
      `;
        html = html.replace(/(<nav[^>]*id="catalogueBreadcrumbs"[^>]*>)([\s\S]*?)(<\/nav>)/i, `$1${breadcrumbHtml}$3`);

        // Switch active filter button
        html = html.replace(/(<button[^>]*class="[^"]*filter-btn)\s+active([^"]*"[^>]*data-filter="all")/i, '$1$2');
        html = html.replace(new RegExp(`(<button[^>]*class="[^"]*filter-btn)([^"]*"[^>]*data-filter="${category}")`, 'i'), '$1 active$2');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      } catch (err) {
        console.error('Error serving category page:', err);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(productHtmlPath).pipe(res);
        return;
      }
    }
  }

  // --- D. Dynamic Product Slug Page: /product/:slug/ -> serves product-detail.html ---
  const productSlugMatch = pathname.match(/^\/product\/([a-zA-Z0-9_-]+)\/$/i);
  if (productSlugMatch) {
    const slug = productSlugMatch[1];
    if (slug.toLowerCase() !== 'page') {
      const detailHtmlPath = path.join(ROOT_DIR, 'product-detail.html');
      if (fs.existsSync(detailHtmlPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(detailHtmlPath).pipe(res);
        return;
      }
    }
  }

  // --- E. Admin Authentication & Subpages: /admin/ and /admin/login/ ---
  if (pathname.toLowerCase() === '/admin/login/') {
    if (isAuthorized(req)) {
      res.writeHead(302, { 'Location': '/admin/' });
      res.end();
      return;
    }
    const loginHtmlPath = path.join(ROOT_DIR, 'admin', 'login.html');
    if (fs.existsSync(loginHtmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
      fs.createReadStream(loginHtmlPath).pipe(res);
      return;
    }
  }

  const adminMatch = pathname.match(/^\/admin\/(?:([a-zA-Z0-9_-]+)\/)?(?:page\/(\d+)\/)?$/i);
  if (adminMatch && !isAsset) {
    if (!isAuthorized(req)) {
      const redirectParam = pathname !== '/admin/' ? `?redirect=${encodeURIComponent(pathname + (parsedUrl.search || ''))}` : '';
      res.writeHead(302, { 'Location': `/admin/login/${redirectParam}` });
      res.end();
      return;
    }

    const adminIndexHtml = path.join(ROOT_DIR, 'admin', 'index.html');
    if (fs.existsSync(adminIndexHtml)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
      fs.createReadStream(adminIndexHtml).pipe(res);
      return;
    }
  }

  // --- F. Standard Site Pages: /:pageName/ -> serves :pageName.html or :pageName/index.html ---
  const sitePageMatch = pathname.match(/^\/([a-zA-Z0-9_-]+)\/$/i);
  if (sitePageMatch) {
    const pageName = sitePageMatch[1].toLowerCase();
    const directHtml = path.join(ROOT_DIR, `${pageName}.html`);
    const mirrorHtml = path.join(ROOT_DIR, pageName, 'index.html');
    const targetHtml = fs.existsSync(directHtml) ? directHtml : (fs.existsSync(mirrorHtml) ? mirrorHtml : null);

    if (targetHtml) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(targetHtml).pipe(res);
      return;
    }
  }

  // ==========================================
  // 7. 404 NOT FOUND FALLBACK
  // ==========================================
  res.writeHead(404, { 'Content-Type': 'text/html; charset=UTF-8' });
  res.end(`<!DOCTYPE html><html><head><title>404 Not Found</title></head><body style="font-family:sans-serif;text-align:center;padding:50px;"><h1>404 - Page Not Found</h1><p>The requested file <code>${pathname}</code> does not exist.</p><a href="/" style="color:#d32f2f;">Return to Homepage</a></body></html>`);
}

// Create Main Server & Export for Vercel Serverless Function
const server = http.createServer(requestDispatcher);

// Only start standalone HTTP listeners when executed directly (node server.js)
if (require.main === module) {
  server.on('error', (err) => {
    console.error(' [Server Guard] Primary Server Error:', err.message);
  });

  process.on('uncaughtException', (err) => {
    console.error(' [Server Guard] Uncaught Exception:', err.message);
  });

  process.on('unhandledRejection', (reason) => {
    console.error(' [Server Guard] Unhandled Rejection:', reason && reason.message ? reason.message : reason);
  });

  // Start Server on 0.0.0.0 (Port 8080)
  server.listen(PORT, '0.0.0.0', () => {
    console.log('================================================================');
    console.log('   HARICHAND STEEL - ENTERPRISE CLEAN URL SERVER RUNNING        ');
    console.log('================================================================');
    console.log(` > Primary Server:  http://0.0.0.0:${PORT}/ (Port ${PORT})`);
    console.log(` > Localhost URL:   http://localhost:${PORT}/`);
    console.log(` > CMS Dashboard:   http://localhost:${PORT}/admin/`);
    console.log(` > Products Page:   http://localhost:${PORT}/product/`);
    console.log(` > Single Product:  http://localhost:${PORT}/product/aluminium-door-profile-gate/`);
    try {
      const mdSummary = markdownSync.syncAll();
      console.log(` > Markdown Content: ${mdSummary.pages.length} Pages, ${mdSummary.products.length} Products, ${mdSummary.blogs.length} Blogs`);
    } catch (_) {}
    console.log('----------------------------------------------------------------');
    const dbHost = process.env.DATABASE_URL ? (new URL(process.env.DATABASE_URL.replace(/^postgresql:\/\//i, 'http://')).host || 'Supabase') : 'Local JSON';
    console.log(` Database Target:   ${dbHost}`);
    console.log('================================================================');
  });

  // Also start secondary listener on port 3000 if PORT is 8080
  if (PORT != ALT_PORT) {
    try {
      const altServer = http.createServer(requestDispatcher);
      altServer.listen(ALT_PORT, '0.0.0.0', () => {
        console.log(` > Secondary Server: http://localhost:${ALT_PORT}/ (Port ${ALT_PORT})`);
      });
      altServer.on('error', (err) => {
        console.log(` [Notice] Port ${ALT_PORT} not bound: ${err.message}`);
      });
    } catch (_) { }
  }
}

module.exports = requestDispatcher;
