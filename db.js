/**
 * HARICHAND STEEL - PostgreSQL Database Connector
 * Connects to Supabase PostgreSQL or gracefully falls back to local data/ JSON files
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

let markdownSync = null;
try {
  markdownSync = require('./markdown-sync.js');
} catch (_) {}

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const BLOGS_FILE = path.join(DATA_DIR, 'blogs.json');
const INQUIRIES_FILE = path.join(DATA_DIR, 'inquiries.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let pool = null;
let isConnected = false;
let dbStatusMessage = 'Initializing...';

const dbUrl = process.env.DATABASE_URL || '';
const hasPlaceholderPassword = !dbUrl || 
  dbUrl.includes('[YOUR-PASSWORD]') || 
  dbUrl.includes('[PASSWORD]') || 
  dbUrl.includes('YOUR_ACTUAL_DB_PASSWORD');

// ==========================================
// FILE FALLBACK HELPERS
// ==========================================
function readJsonFile(filePath, defaultVal = []) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e.message);
  }
  return defaultVal;
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`Error writing ${filePath}:`, e.message);
  }
}

// ==========================================
// DATABASE INITIALIZATION & MIGRATIONS
// ==========================================
async function initDatabase() {
  if (hasPlaceholderPassword) {
    isConnected = false;
    dbStatusMessage = 'Awaiting Supabase DB Password in .env file';
    console.log('----------------------------------------------------------------');
    console.log(' [Database Notice] Supabase connection string configured with placeholder password.');
    console.log(' Set your actual Supabase DB password in .env to connect live PostgreSQL.');
    console.log(' System currently running in offline local JSON data mode.');
    console.log('----------------------------------------------------------------');
    return;
  }

  try {
    pool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 20000
    });

    pool.on('error', (err) => {
      console.warn(' [Database Pool Warning] Idle client error:', err.message);
      isConnected = false;
    });

    // Test connection
    const client = await pool.connect();
    console.log('----------------------------------------------------------------');
    console.log(' [Database Connected] Successfully connected to Supabase PostgreSQL!');
    console.log(' Host: ' + (new URL(dbUrl.replace(/^postgresql:\/\//i, 'http://')).hostname || 'Supabase'));
    console.log('----------------------------------------------------------------');

    try {
      // Auto-create tables per schema specification
      await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        slug VARCHAR(255) UNIQUE,
        category VARCHAR(100),
        category_display VARCHAR(100),
        badge VARCHAR(50),
        price VARCHAR(50),
        image TEXT,
        description TEXT,
        outer_frame TEXT,
        inner_frame TEXT,
        usage TEXT,
        finish TEXT,
        hardware TEXT,
        automation TEXT,
        featured BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS blogs (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255),
        slug VARCHAR(255) UNIQUE,
        tag VARCHAR(100),
        author VARCHAR(100),
        date VARCHAR(50),
        image TEXT,
        summary TEXT,
        content TEXT,
        published BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS inquiries (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150),
        phone VARCHAR(50),
        email VARCHAR(150),
        product_name VARCHAR(255),
        message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

      // Ensure columns exist if table was previously created with another schema
      try {
        await client.query(`
        ALTER TABLE products ADD COLUMN IF NOT EXISTS name VARCHAR(255);
        ALTER TABLE products ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
        ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(100);
        ALTER TABLE products ADD COLUMN IF NOT EXISTS category_display VARCHAR(100);
        ALTER TABLE products ADD COLUMN IF NOT EXISTS badge VARCHAR(50);
        ALTER TABLE products ADD COLUMN IF NOT EXISTS price VARCHAR(50);
        ALTER TABLE products ADD COLUMN IF NOT EXISTS image TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS outer_frame TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS inner_frame TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS usage TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS finish TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS hardware TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS automation TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS schema_data JSONB DEFAULT '{}'::jsonb;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

        ALTER TABLE blogs ADD COLUMN IF NOT EXISTS title VARCHAR(255);
        ALTER TABLE blogs ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
        ALTER TABLE blogs ADD COLUMN IF NOT EXISTS tag VARCHAR(100);
        ALTER TABLE blogs ADD COLUMN IF NOT EXISTS author VARCHAR(100);
        ALTER TABLE blogs ADD COLUMN IF NOT EXISTS date VARCHAR(50);
        ALTER TABLE blogs ADD COLUMN IF NOT EXISTS image TEXT;
        ALTER TABLE blogs ADD COLUMN IF NOT EXISTS summary TEXT;
        ALTER TABLE blogs ADD COLUMN IF NOT EXISTS content TEXT;
        ALTER TABLE blogs ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT true;
        ALTER TABLE blogs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

        ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS name VARCHAR(150);
        ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
        ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS email VARCHAR(150);
        ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS product_name VARCHAR(255);
        ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS message TEXT;
        ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
      `);
      } catch (_) {}

      // Sync schema_data for existing products if missing
      try {
        const localProds = readJsonFile(PRODUCTS_FILE, []);
        for (const lp of localProds) {
          if (lp.slug) {
            const sData = {
              schemaEnabled: lp.schemaEnabled !== undefined ? lp.schemaEnabled : true,
              schemaOfferEnabled: lp.schemaOfferEnabled !== undefined ? lp.schemaOfferEnabled : true,
              schemaReviewEnabled: lp.schemaReviewEnabled !== undefined ? lp.schemaReviewEnabled : false,
              schemaSku: lp.schemaSku || '',
              schemaMpn: lp.schemaMpn || '',
              schemaBrand: lp.schemaBrand || 'Harichand Steel',
              schemaGtin: lp.schemaGtin || '',
              schemaPrice: lp.schemaPrice !== undefined ? lp.schemaPrice : '25000',
              schemaCurrency: lp.schemaCurrency || 'INR',
              schemaAvailability: lp.schemaAvailability || 'https://schema.org/InStock',
              schemaCondition: lp.schemaCondition || 'https://schema.org/NewCondition',
              schemaPriceValidUntil: lp.schemaPriceValidUntil || '2026-12-31',
              schemaRatingValue: lp.schemaRatingValue || '',
              schemaReviewCount: lp.schemaReviewCount || '',
              schemaReviews: Array.isArray(lp.schemaReviews) ? lp.schemaReviews : []
            };
            await client.query(`
              UPDATE products 
              SET schema_data = $1 
              WHERE slug = $2 AND (schema_data IS NULL OR schema_data = '{}'::jsonb)
            `, [JSON.stringify(sData), lp.slug]);
          }
        }
      } catch (err) {
        console.warn('schema_data backfill notice:', err.message);
      }

      // Check if products table is empty, seed from local JSON
      const prodCountRes = await client.query('SELECT COUNT(*) FROM products');
      if (parseInt(prodCountRes.rows[0].count, 10) === 0) {
        console.log(' Seeding default products into Supabase PostgreSQL...');
        const seedProducts = readJsonFile(PRODUCTS_FILE, []);
        for (const p of seedProducts) {
          const slug = p.slug || (p.title || p.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          await client.query(`
          INSERT INTO products (name, slug, category, category_display, badge, price, image, description, outer_frame, inner_frame, usage, finish, hardware, automation, featured, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (slug) DO NOTHING
        `, [
            p.name || p.title || 'Untitled Product',
            slug,
            p.category || 'aluminum-profile-gate',
            p.category_display || p.categoryName || 'Aluminum Profile Gate',
            p.badge || 'New Arrival',
            p.price || 'On Request',
            p.image || 'images/prod-1.png',
            p.description || '',
            p.outer_frame || p.outerFrame || '14 Gauge (14G) steel frame',
            p.inner_frame || p.innerFrame || '16 Gauge (16G) steel frame',
            p.usage || 'Residential, commercial, industrial entrances',
            p.finish || 'AkzoNobel powder coated or painted',
            p.hardware || 'Heavy-duty sealed stainless-steel ball bearing hinges',
            p.automation || '100% compatible with motorized remote operators',
            !!p.featured,
            p.created_at || p.createdAt || new Date()
          ]);
        }
        console.log(` Successfully seeded ${seedProducts.length} products into Supabase!`);
      }

      // Check if blogs table is empty, seed from local JSON
      const blogCountRes = await client.query('SELECT COUNT(*) FROM blogs');
      if (parseInt(blogCountRes.rows[0].count, 10) === 0) {
        console.log(' Seeding default blog articles into Supabase PostgreSQL...');
        const seedBlogs = readJsonFile(BLOGS_FILE, []);
        for (const b of seedBlogs) {
          const slug = b.slug || '/news.html';
          await client.query(`
          INSERT INTO blogs (title, slug, tag, author, date, image, summary, content, published, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (slug) DO NOTHING
        `, [
            b.title || 'Untitled Article',
            slug,
            b.tag || 'Guide',
            b.author || 'Harichand Steel Team',
            b.date || 'Oct 30, 2026',
            b.image || 'images/about-3.jpg',
            b.summary || b.excerpt || '',
            b.content || '',
            b.published !== false,
            b.created_at || new Date()
          ]);
        }
        console.log(` Successfully seeded ${seedBlogs.length} articles into Supabase!`);
      }

      isConnected = true;
      dbStatusMessage = 'Connected to Supabase PostgreSQL';
    } finally {
      client.release();
    }
  } catch (err) {
    isConnected = false;
    dbStatusMessage = `PostgreSQL Connection Failed: ${err.message}. Using local file fallback.`;
    console.error(' [Database Error] Could not connect to Supabase PostgreSQL:', err.message);
    console.log(' [Fallback] Continuing in local JSON storage mode.');
  }
}

// Kick off initialization
initDatabase();

// ==========================================
// CRUD REPOSITORY & DUAL-SYNC ENGINE
// ==========================================
module.exports = {
  checkConnection: async function () {
    if (!pool || !isConnected) {
      return { status: "local_fallback", database: "JSON", connected: false };
    }
    try {
      const res = await pool.query('SELECT 1');
      if (res) {
        return { status: "connected", database: "Supabase PostgreSQL", connected: true };
      }
    } catch (err) {
      isConnected = false;
      return { status: "local_fallback", database: "JSON", connected: false };
    }
    return { status: "local_fallback", database: "JSON", connected: false };
  },

  getStatus: function () {
    return {
      status: isConnected ? "connected" : "local_fallback",
      database: isConnected ? "Supabase PostgreSQL" : "JSON",
      connected: isConnected,
      message: dbStatusMessage
    };
  },

  // --- PRODUCTS ---
  getProducts: async function () {
    const localList = readJsonFile(PRODUCTS_FILE, []);
    if (isConnected && pool) {
      try {
        const res = await pool.query('SELECT * FROM products ORDER BY id ASC');
        return res.rows.map(r => {
          let sData = {};
          if (r.schema_data) {
            try {
              sData = typeof r.schema_data === 'string' ? JSON.parse(r.schema_data) : r.schema_data;
            } catch (_) {}
          }
          const localMatch = localList.find(p => p.slug === r.slug || String(p.id) === String(r.id)) || {};

          return {
            id: String(r.id),
            name: r.name || r.title,
            title: r.name || r.title || 'Product',
            slug: r.slug,
            category: r.category,
            categoryName: r.category_display || r.category || 'Aluminum Profile Gate',
            category_display: r.category_display || r.category || 'Aluminum Profile Gate',
            badge: r.badge || 'New Arrival',
            price: r.price || 'On Request',
            image: r.image || 'images/prod-1.png',
            description: r.description || '',
            outerFrame: r.outer_frame || '',
            outer_frame: r.outer_frame || '',
            innerFrame: r.inner_frame || '',
            inner_frame: r.inner_frame || '',
            usage: r.usage || '',
            finish: r.finish || '',
            hardware: r.hardware || '',
            automation: r.automation || '',
            featured: !!r.featured,
            createdAt: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '',
            created_at: r.created_at,

            // Dynamic Schema Fields with Local JSON Fallback
            schemaEnabled: sData.schemaEnabled !== undefined ? sData.schemaEnabled : (localMatch.schemaEnabled !== undefined ? localMatch.schemaEnabled : true),
            schemaOfferEnabled: sData.schemaOfferEnabled !== undefined ? sData.schemaOfferEnabled : (localMatch.schemaOfferEnabled !== undefined ? localMatch.schemaOfferEnabled : true),
            schemaReviewEnabled: sData.schemaReviewEnabled !== undefined ? sData.schemaReviewEnabled : (localMatch.schemaReviewEnabled !== undefined ? localMatch.schemaReviewEnabled : false),
            schemaSku: sData.schemaSku !== undefined && sData.schemaSku !== '' ? sData.schemaSku : localMatch.schemaSku,
            schemaMpn: sData.schemaMpn !== undefined && sData.schemaMpn !== '' ? sData.schemaMpn : localMatch.schemaMpn,
            schemaBrand: sData.schemaBrand !== undefined && sData.schemaBrand !== '' ? sData.schemaBrand : (localMatch.schemaBrand || 'Harichand Steel'),
            schemaGtin: sData.schemaGtin !== undefined && sData.schemaGtin !== '' ? sData.schemaGtin : (localMatch.schemaGtin || ''),
            schemaPrice: sData.schemaPrice !== undefined && sData.schemaPrice !== '' ? sData.schemaPrice : (localMatch.schemaPrice !== undefined ? localMatch.schemaPrice : '25000'),
            schemaCurrency: sData.schemaCurrency || localMatch.schemaCurrency || 'INR',
            schemaAvailability: sData.schemaAvailability || localMatch.schemaAvailability || 'https://schema.org/InStock',
            schemaCondition: sData.schemaCondition || localMatch.schemaCondition || 'https://schema.org/NewCondition',
            schemaPriceValidUntil: sData.schemaPriceValidUntil || localMatch.schemaPriceValidUntil || '2026-12-31',
            schemaRatingValue: sData.schemaRatingValue !== undefined ? sData.schemaRatingValue : localMatch.schemaRatingValue,
            schemaReviewCount: sData.schemaReviewCount !== undefined ? sData.schemaReviewCount : localMatch.schemaReviewCount,
            schemaReviews: Array.isArray(sData.schemaReviews) && sData.schemaReviews.length > 0 ? sData.schemaReviews : (Array.isArray(localMatch.schemaReviews) ? localMatch.schemaReviews : [])
          };
        });
      } catch (err) {
        console.error('getProducts SQL error:', err.message);
      }
    }
    return localList;
  },

  saveProduct: async function (product) {
    if (!product.id) {
      product.id = 'prod-' + Date.now();
      product.createdAt = new Date().toISOString().split('T')[0];
    }
    if (!product.slug && (product.title || product.name)) {
      product.slug = (product.title || product.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }

    // 1. Dual-sync: Always persist to local JSON file
    const localList = readJsonFile(PRODUCTS_FILE, []);
    const idx = localList.findIndex(p => p.id === product.id || (product.slug && p.slug === product.slug));
    if (idx !== -1) {
      localList[idx] = { ...localList[idx], ...product };
    } else {
      localList.unshift(product);
    }
    writeJsonFile(PRODUCTS_FILE, localList);

    // 2. Dual-sync: Persist to Supabase PostgreSQL if connected
    if (isConnected && pool) {
      try {
        const schemaDataObj = {
          schemaEnabled: product.schemaEnabled !== undefined ? product.schemaEnabled : true,
          schemaOfferEnabled: product.schemaOfferEnabled !== undefined ? product.schemaOfferEnabled : true,
          schemaReviewEnabled: product.schemaReviewEnabled !== undefined ? product.schemaReviewEnabled : false,
          schemaSku: product.schemaSku || '',
          schemaMpn: product.schemaMpn || '',
          schemaBrand: product.schemaBrand || 'Harichand Steel',
          schemaGtin: product.schemaGtin || '',
          schemaPrice: product.schemaPrice !== undefined ? product.schemaPrice : '25000',
          schemaCurrency: product.schemaCurrency || 'INR',
          schemaAvailability: product.schemaAvailability || 'https://schema.org/InStock',
          schemaCondition: product.schemaCondition || 'https://schema.org/NewCondition',
          schemaPriceValidUntil: product.schemaPriceValidUntil || '2026-12-31',
          schemaRatingValue: product.schemaRatingValue || '',
          schemaReviewCount: product.schemaReviewCount || '',
          schemaReviews: Array.isArray(product.schemaReviews) ? product.schemaReviews : []
        };

        await pool.query(`
          INSERT INTO products (name, slug, category, category_display, badge, price, image, description, outer_frame, inner_frame, usage, finish, hardware, automation, featured, schema_data)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name,
            category = EXCLUDED.category,
            category_display = EXCLUDED.category_display,
            badge = EXCLUDED.badge,
            price = EXCLUDED.price,
            image = EXCLUDED.image,
            description = EXCLUDED.description,
            outer_frame = EXCLUDED.outer_frame,
            inner_frame = EXCLUDED.inner_frame,
            usage = EXCLUDED.usage,
            finish = EXCLUDED.finish,
            hardware = EXCLUDED.hardware,
            automation = EXCLUDED.automation,
            featured = EXCLUDED.featured,
            schema_data = EXCLUDED.schema_data
        `, [
          product.name || product.title || 'Untitled Product',
          product.slug,
          product.category || 'aluminum-profile-gate',
          product.category_display || product.categoryName || 'Aluminum Profile Gate',
          product.badge || 'New Arrival',
          product.price || 'On Request',
          product.image || 'images/prod-1.png',
          product.description || '',
          product.outer_frame || product.outerFrame || '',
          product.inner_frame || product.innerFrame || '',
          product.usage || '',
          product.finish || '',
          product.hardware || '',
          product.automation || '',
          !!product.featured,
          JSON.stringify(schemaDataObj)
        ]);
      } catch (err) {
        console.error('saveProduct SQL error:', err.message);
      }
    }

    if (markdownSync && typeof markdownSync.generateProductMarkdown === "function") {
      try { markdownSync.generateProductMarkdown(product); } catch (_) {}
    }
    return product;
  },

  deleteProduct: async function (idOrSlug) {
    // 1. Delete from local JSON file
    let localList = readJsonFile(PRODUCTS_FILE, []);
    localList = localList.filter(p => p.id !== idOrSlug && p.slug !== idOrSlug);
    writeJsonFile(PRODUCTS_FILE, localList);

    // 2. Delete from Supabase PostgreSQL
    if (isConnected && pool) {
      try {
        await pool.query('DELETE FROM products WHERE slug = $1 OR id::text = $1', [idOrSlug]);
      } catch (err) {
        console.error('deleteProduct SQL error:', err.message);
      }
    }
    if (markdownSync && typeof markdownSync.deleteProductMarkdown === "function") {
      try { markdownSync.deleteProductMarkdown(idOrSlug); } catch (_) {}
    }
    return true;
  },

  // --- BLOGS ---
  getBlogs: async function () {
    if (isConnected && pool) {
      try {
        const res = await pool.query('SELECT * FROM blogs ORDER BY id ASC');
        return res.rows.map(r => ({
          id: String(r.id),
          title: r.title,
          slug: r.slug,
          tag: r.tag,
          author: r.author,
          date: r.date,
          image: r.image,
          summary: r.summary || '',
          excerpt: r.summary || '',
          content: r.content || '',
          published: r.published !== false,
          created_at: r.created_at
        }));
      } catch (err) {
        console.error('getBlogs SQL error:', err.message);
      }
    }
    return readJsonFile(BLOGS_FILE, []);
  },

  saveBlog: async function (blog) {
    if (!blog.id) {
      blog.id = 'blog-' + Date.now();
      blog.date = blog.date || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
    if (!blog.slug) {
      blog.slug = '/news.html';
    }

    // 1. Dual-sync: Always persist to local JSON file
    const localList = readJsonFile(BLOGS_FILE, []);
    const idx = localList.findIndex(b => b.id === blog.id || (blog.slug && b.slug === blog.slug));
    if (idx !== -1) {
      localList[idx] = { ...localList[idx], ...blog };
    } else {
      localList.unshift(blog);
    }
    writeJsonFile(BLOGS_FILE, localList);

    // 2. Dual-sync: Persist to Supabase PostgreSQL if connected
    if (isConnected && pool) {
      try {
        await pool.query(`
          INSERT INTO blogs (title, slug, tag, author, date, image, summary, content, published)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (slug) DO UPDATE SET
            title = EXCLUDED.title,
            tag = EXCLUDED.tag,
            author = EXCLUDED.author,
            date = EXCLUDED.date,
            image = EXCLUDED.image,
            summary = EXCLUDED.summary,
            content = EXCLUDED.content,
            published = EXCLUDED.published
        `, [
          blog.title || 'Untitled Article',
          blog.slug,
          blog.tag || 'Guide',
          blog.author || 'Harichand Steel Team',
          blog.date || '',
          blog.image || 'images/about-3.jpg',
          blog.summary || blog.excerpt || '',
          blog.content || '',
          blog.published !== false
        ]);
      } catch (err) {
        console.error('saveBlog SQL error:', err.message);
      }
    }

    if (markdownSync && typeof markdownSync.generateBlogMarkdown === "function") {
      try { markdownSync.generateBlogMarkdown(blog); } catch (_) {}
    }
    return blog;
  },

  deleteBlog: async function (idOrSlug) {
    let localList = readJsonFile(BLOGS_FILE, []);
    localList = localList.filter(b => b.id !== idOrSlug && b.slug !== idOrSlug);
    writeJsonFile(BLOGS_FILE, localList);

    if (isConnected && pool) {
      try {
        await pool.query('DELETE FROM blogs WHERE slug = $1 OR id::text = $1', [idOrSlug]);
      } catch (err) {
        console.error('deleteBlog SQL error:', err.message);
      }
    }
    if (markdownSync && typeof markdownSync.deleteBlogMarkdown === "function") {
      try { markdownSync.deleteBlogMarkdown(idOrSlug); } catch (_) {}
    }
    return true;
  },

  // --- INQUIRIES ---
  getInquiries: async function () {
    if (isConnected && pool) {
      try {
        const res = await pool.query('SELECT * FROM inquiries ORDER BY created_at DESC');
        return res.rows.map(r => ({
          id: String(r.id),
          name: r.name,
          phone: r.phone,
          email: r.email,
          product_name: r.product_name,
          requirement: r.product_name,
          message: r.message,
          created_at: r.created_at,
          timestamp: r.created_at ? new Date(r.created_at).toLocaleString() : ''
        }));
      } catch (err) {
        console.error('getInquiries SQL error:', err.message);
      }
    }
    return readJsonFile(INQUIRIES_FILE, []);
  },

  saveInquiry: async function (inq) {
    if (!inq.id) {
      inq.id = 'inq-' + Date.now();
      inq.timestamp = inq.timestamp || new Date().toLocaleString();
    }

    const localList = readJsonFile(INQUIRIES_FILE, []);
    localList.unshift(inq);
    writeJsonFile(INQUIRIES_FILE, localList);

    if (isConnected && pool) {
      try {
        await pool.query(`
          INSERT INTO inquiries (name, phone, email, product_name, message)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          inq.name || '',
          inq.phone || '',
          inq.email || '',
          inq.product_name || inq.requirement || '',
          inq.message || ''
        ]);
      } catch (err) {
        console.error('saveInquiry SQL error:', err.message);
      }
    }

    return inq;
  },

  deleteInquiry: async function (id) {
    let localList = readJsonFile(INQUIRIES_FILE, []);
    localList = localList.filter(i => i.id !== id);
    writeJsonFile(INQUIRIES_FILE, localList);

    if (isConnected && pool) {
      try {
        await pool.query('DELETE FROM inquiries WHERE id::text = $1', [id]);
      } catch (err) {
        console.error('deleteInquiry SQL error:', err.message);
      }
    }
    return true;
  }
};
