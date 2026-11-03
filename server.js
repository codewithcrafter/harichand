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
  '.md': 'text/markdown; charset=UTF-8',
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


// Helper to dynamically build comprehensive product markdown
function buildProductMarkdown(product) {
  if (!product) return '';
  const title = product.title || product.name || 'Custom Gate Product';
  const rawSlug = product.slug || title.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  const slug = rawSlug.replace(/^\/+|\/+$/g, '');
  const category = product.category || 'aluminum-profile-gate';
  const categoryName = product.categoryName || product.category_display || category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const badge = product.badge || 'Premium';
  const price = product.price || 'On Request (Custom Sized)';
  const image = product.image 
    ? (product.image.startsWith('http') ? product.image : `https://harichandsteel.com${product.image.startsWith('/') ? '' : '/'}${product.image}`)
    : 'https://harichandsteel.com/images/prod-1.png';
  const desc = product.description || 'Premium architectural gate designed and manufactured by Harichand Steel.';
  const specs = Array.isArray(product.specs) ? product.specs : [];
  const outerFrame = product.outerFrame || product.outer_frame || 'Heavy-duty extruded alloy profile';
  const innerFrame = product.innerFrame || product.inner_frame || 'Interlocking 16 Gauge (16G) structural cross-members';
  const materialGrade = (category === 'steel-main-gate')
    ? 'Certified SS304 Grade Stainless Steel (18% Cr, 8% Ni)'
    : (category === 'aluminum-profile-gate')
      ? 'Architectural 6063-T6 Grade Aluminium Extrusions'
      : (category === 'iron-main-gate')
        ? 'Forged Heavy Wrought Iron / Solid Cast Iron'
        : (category === 'steel-door')
          ? 'Heavy-Duty Carbon Steel with Fire-Resistant Core'
          : 'High-Durability Electrostatic Powder-Coated Steel';
  const usage = product.usage || 'Residential entrances, luxury villas, bungalows, and commercial properties';
  const finish = product.finish || 'High-durability architectural powder coated or weather-resistant industrial finish';
  const hardware = product.hardware || 'SS304 stainless steel ball bearing hinges & concealed locks';
  const automation = product.automation || '100% compatible with motorized remote swing & sliding gate operators (Sommer, Nice, BFT)';
  const canonicalUrl = `https://harichandsteel.com/product/${slug}/`;
  const categoryUrl = `https://harichandsteel.com/product-category/${category}/`;

  return `---
title: "${title} | Harichand Steel"
original_url: "${canonicalUrl}"
meta_description: "${desc.replace(/"/g, '\\"')}"
product_id: "${product.id || slug}"
category: "${categoryName}"
category_slug: "${category}"
price: "${price}"
badge: "${badge}"
image: "${image}"
updated_at: "2026-11-03"
---

# ${title}

> ${desc}

- **Original Page URL:** [${canonicalUrl}](${canonicalUrl})
- **Product Category:** [${categoryName}](${categoryUrl})
- **Pricing:** ${price}
- **Quality Grade Badge:** ${badge}

![${title}](${image})

## Product Overview & Architecture

The **${title}** is precision-engineered by Harichand Steel for luxury residences, modern bungalows, and high-security commercial entrances across Delhi and Delhi NCR. Built with premium structural materials, this gate combines effortless operation, enduring corrosion resistance, and striking architectural aesthetics.

## Key Features & Specifications

| Technical Specification | Engineering Details |
| :--- | :--- |
| **Outer Frame Construction** | ${outerFrame} |
| **Inner Frame & Cross Members** | ${innerFrame} |
| **Primary Material Grade** | ${materialGrade} |
| **Recommended Usage** | ${usage} |
| **Surface Finish & Coating** | ${finish} |
| **Hardware & Bearing Setup** | ${hardware} |
| **Automation Compatibility** | ${automation} |

${specs.length > 0 ? `## Core Features & Inclusions\n\n${specs.map(s => `- **${s}:** Engineered to meet strict industrial safety and durability criteria.`).join('\n')}\n` : ''}
## Benefits & Advantages

- **Zero Rust & Weather Immunity:** High-durability weather-resistant metallurgy protects against heavy monsoon moisture, seasonal humidity, and direct UV solar exposure without rusting or peeling.
- **Lightweight Gliding & Reduced Strain:** Reduces structural load on hinges and automated motor actuators by up to 60%, preventing post sagging and prolonging mechanical lifespan.
- **Smart Security Integration:** Fully compatible with remote Italian motorized actuators (Sommer, Nice, BFT), optical fingerprint biometric locks, RFID access cards, and smartphone mobile control.
- **Low Maintenance Longevity:** Factory-cured protective coating eliminates periodic painting or rust scrape treatments, retaining high-end luster with minimal maintenance.
- **Turnkey Sizing & Architectural Symmetry:** Every model is precision-fabricated to the millimeter to seamlessly complement villa facade geometry and property boundary aesthetics.

## Custom Fabrication & Site Measurement Services

Harichand Steel provides turnkey metal fabrication services across Delhi & Delhi NCR:
1. **Free Doorstep Site Visit:** Our technical engineers inspect post alignments, ground levels, and opening clearances anywhere in Delhi NCR.
2. **CAD Design Customization:** Tailor infill patterns, louver spacing, glass inserts, and metallic accent colors (rose gold, matte black, wood-grain).
3. **Turnkey Installation:** Delivered and installed by our certified in-house fabrication team with complete warranty and support.

## Direct Inquiries & Ordering Information

- **Direct Calling:** [+91 98704 33868](tel:+919870433868)
- **WhatsApp Consultation:** [Chat on WhatsApp](https://wa.me/919870433868?text=${encodeURIComponent('Enquiry regarding ' + title)})
- **Official Email:** [Admin@HARICHANDSTEEL.COM](mailto:Admin@HARICHANDSTEEL.COM)
- **Factory Address:** 27B, Street, New Jankipuri, Anup Nagar, Uttam Nagar, Bindapur, New Delhi, Delhi, 110059, India

## Related Internal Pages

- **Parent Category:** [${categoryName}](${categoryUrl})
- **Full Products Catalogue:** [Gate Products Catalogue](https://harichandsteel.com/product/)
- **Company Profile:** [About Harichand Steel](https://harichandsteel.com/about-us/)
- **Contact Us:** [Contact Harichand Steel](https://harichandsteel.com/contact/)
- **Latest Gate Guides:** [News & Architectural Insights](https://harichandsteel.com/news/)
`;
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
  const isStaticAsset = /\.(css|js|png|jpg|jpeg|svg|ico|webp|json|txt|md|woff2?|ttf|eot|xml)\/?$/i.test(pathname);
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
    sendJson(res, 200, { name: "Harichand Steel API", status: "online", version: "1.0.0" }, req.method);
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
  const isAsset = /\.(css|js|png|jpg|jpeg|svg|ico|webp|json|txt|md|woff2?|ttf|eot|xml)\/?$/i.test(pathname);
  if (isAsset) {
    // 1. Direct path check from root
    const cleanAssetUrl = pathname.replace(/\/+$/, '').replace(/^\/+/, '');
    let assetPath = path.join(ROOT_DIR, cleanAssetUrl);
    if (fs.existsSync(assetPath) && !fs.statSync(assetPath).isDirectory()) {
      const ext = path.extname(assetPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      if (req.method === 'HEAD') { res.end(); return; }
      fs.createReadStream(assetPath).pipe(res);
      return;
    }

    // 1b. Direct path check from public/
    let publicAssetPath = path.join(ROOT_DIR, 'public', cleanAssetUrl);
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

        // Dynamically update BreadcrumbList schema for category
        const catBreadcrumbSchema = {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://harichandsteel.com/" },
            { "@type": "ListItem", "position": 2, "name": "Product", "item": "https://harichandsteel.com/product/" },
            { "@type": "ListItem", "position": 3, "name": meta.breadcrumb, "item": `https://harichandsteel.com/product-category/${category}/` }
          ]
        };
        html = html.replace(/<script type="application\/ld\+json"[^>]*id="schemaBreadcrumbs"[^>]*>[\s\S]*?<\/script>/i, `<script type="application/ld+json" id="schemaBreadcrumbs">\n${JSON.stringify(catBreadcrumbSchema, null, 2)}\n  </script>`);

        // Dynamically update WebPage schema for category
        const catWebPageSchema = {
          "@context": "https://schema.org",
          "@type": "WebPage",
          "@id": `https://harichandsteel.com/product-category/${category}/#webpage`,
          "url": `https://harichandsteel.com/product-category/${category}/`,
          "name": fullDocTitle,
          "description": meta.lead,
          "isPartOf": {
            "@id": "https://harichandsteel.com/#website"
          },
          "about": {
            "@id": "https://harichandsteel.com/#organization"
          },
          "inLanguage": "en-US"
        };
        html = html.replace(/<script type="application\/ld\+json"[^>]*id="schemaWebPage"[^>]*>[\s\S]*?<\/script>/i, `<script type="application/ld+json" id="schemaWebPage">\n${JSON.stringify(catWebPageSchema, null, 2)}\n  </script>`);

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

    // --- D1. Dynamic Product Markdown Document: /product/:slug.md and /product/:slug.md/ ---
  const productMdMatch = pathname.match(/^\/product\/([a-zA-Z0-9_-]+)\.md\/?$/i);
  if (productMdMatch) {
    const rawSlug = productMdMatch[1].toLowerCase();
    if (rawSlug !== 'page') {
      try {
        const products = await db.getProducts();
        const product = Array.isArray(products)
          ? products.find(p => p && (
              (p.slug && p.slug.toLowerCase().replace(/^\/+|\/+$/g, '') === rawSlug) ||
              String(p.id).toLowerCase() === rawSlug
            ))
          : null;

        if (!product) {
          res.writeHead(404, { 'Content-Type': 'text/markdown; charset=utf-8' });
          res.end(`# 404 - Product Not Found\n\nThe requested product \`${rawSlug}\` was not found in our catalogue.\n\nPlease visit the [Gate Products Catalogue](https://harichandsteel.com/product/) to explore all available models.\n`);
          return;
        }

        // Check if pre-rendered markdown exists on disk
        const preRenderedPath1 = path.join(ROOT_DIR, 'markdown', 'products', `${rawSlug}.md`);
        const preRenderedPath2 = path.join(ROOT_DIR, 'content', 'products', `${rawSlug}.md`);
        let markdownContent = null;

        if (fs.existsSync(preRenderedPath1)) {
          markdownContent = fs.readFileSync(preRenderedPath1, 'utf8');
        } else if (fs.existsSync(preRenderedPath2)) {
          markdownContent = fs.readFileSync(preRenderedPath2, 'utf8');
        } else {
          markdownContent = buildProductMarkdown(product);
        }

        res.writeHead(200, {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Cache-Control': 'public, max-age=3600, must-revalidate'
        });
        res.end(markdownContent);
        return;
      } catch (err) {
        console.error('Error serving product markdown for', rawSlug, err);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Internal Server Error generating product markdown.');
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
      if (pageName === 'news') {
        try {
          let html = fs.readFileSync(targetHtml, 'utf8');
          const blogs = await db.getBlogs();
          if (Array.isArray(blogs) && blogs.length > 0) {
            const activeBlogs = blogs.filter(b => b && b.published !== false && b.title && b.title !== 'abd');
            const escapeHtml = (str) => {
              if (!str) return '';
              return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]);
            };
            const cardsHtml = activeBlogs.map(blog => {
              const rawSlug = blog.slug || '/news/';
              const blogUrl = rawSlug.startsWith('http://') || rawSlug.startsWith('https://') || rawSlug.startsWith('/') ? rawSlug : '/' + rawSlug;
              const blogTitle = escapeHtml(blog.title || 'Untitled Article');
              const blogExcerpt = escapeHtml(blog.excerpt || '');
              const blogTag = escapeHtml(blog.tag || 'Design Guide');
              const blogDate = escapeHtml(blog.date || '');
              const waText = encodeURIComponent('Enquiry regarding ' + (blog.title || 'Gate Design'));
              const imgHtml = blog.image ? `<div style="margin-bottom: 14px; border-radius: 8px; overflow: hidden; max-height: 190px;"><img src="${escapeHtml(blog.image)}" alt="${blogTitle}" style="width: 100%; height: 190px; object-fit: cover;" onerror="this.parentElement.style.display='none'"></div>` : '';

              return `<article class="news-card" data-blog-id="${escapeHtml(blog.id || '')}">
          <div class="news-card-body">
            ${imgHtml}
            <div class="news-meta">
              <span><i class="fas fa-calendar-alt"></i> ${blogDate}</span>
              <span><i class="fas fa-tag"></i> ${blogTag}</span>
            </div>
            <h3 class="news-title"><a href="${blogUrl}">${blogTitle}</a></h3>
            <p class="news-excerpt">${blogExcerpt}</p>
            <div style="margin-top: auto; display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
              <a href="${blogUrl}" class="btn btn-outline-dark btn-sm">Read Article &rarr;</a>
              <a href="https://wa.me/919870433868?text=${waText}" class="btn btn-whatsapp btn-sm" target="_blank" rel="noopener">
                <i class="fab fa-whatsapp"></i> Ask Expert
              </a>
            </div>
          </div>
        </article>`;
            }).join('\n        ');

            html = html.replace(/<div class="news-cards-grid"[^>]*>[\s\S]*?<\/div>/i, `<div class="news-cards-grid" id="newsCardsGrid">\n        ${cardsHtml}\n      </div>`);
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
          return;
        } catch (e) {
          console.error('Error pre-rendering news:', e);
        }
      }

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
