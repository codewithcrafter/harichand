const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'db.js');
let content = fs.readFileSync(dbPath, 'utf8');

// 1. Add schema_data column alter
const target1 = `ALTER TABLE products ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;`;
const replacement1 = `ALTER TABLE products ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS schema_data JSONB DEFAULT '{}'::jsonb;`;

if (!content.includes('ALTER TABLE products ADD COLUMN IF NOT EXISTS schema_data JSONB')) {
  content = content.replace(target1, replacement1);
  console.log('Added schema_data column ALTER statement.');
}

// 2. Add seeding/syncing schema_data into existing rows after table alter
const targetSeed = `// Check if products table is empty, seed from local JSON`;
const replacementSeed = `// Sync schema_data for existing products if missing
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
            await client.query(\`
              UPDATE products 
              SET schema_data = $1 
              WHERE slug = $2 AND (schema_data IS NULL OR schema_data = '{}'::jsonb)
            \`, [JSON.stringify(sData), lp.slug]);
          }
        }
      } catch (err) {
        console.warn('schema_data backfill notice:', err.message);
      }

      // Check if products table is empty, seed from local JSON`;

if (!content.includes('schema_data backfill notice:')) {
  content = content.replace(targetSeed, replacementSeed);
  console.log('Added schema_data backfill logic.');
}

// 3. Update getProducts to include schema fields
const targetGetProducts = `  getProducts: async function () {
    if (isConnected && pool) {
      try {
        const res = await pool.query('SELECT * FROM products ORDER BY id ASC');
        return res.rows.map(r => ({
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
          created_at: r.created_at
        }));
      } catch (err) {
        console.error('getProducts SQL error:', err.message);
      }
    }
    return readJsonFile(PRODUCTS_FILE, []);
  },`;

const replacementGetProducts = `  getProducts: async function () {
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
  },`;

// Replace targetGetProducts handling CRLF/LF
const normalizeEol = str => str.replace(/\r\n/g, '\n');
let normContent = normalizeEol(content);
let normTarget = normalizeEol(targetGetProducts);

if (normContent.includes(normTarget)) {
  normContent = normContent.replace(normTarget, replacementGetProducts);
  content = normContent;
  console.log('Updated getProducts in db.js.');
} else {
  console.log('getProducts target not matched directly, checking...');
}

// 4. Update saveProduct to insert/update schema_data
const targetSave = `        await pool.query(\`
          INSERT INTO products (name, slug, category, category_display, badge, price, image, description, outer_frame, inner_frame, usage, finish, hardware, automation, featured)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
            featured = EXCLUDED.featured
        \`, [
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
          !!product.featured
        ]);`;

const replacementSave = `        const schemaDataObj = {
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

        await pool.query(\`
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
        \`, [
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
        ]);`;

normContent = normalizeEol(content);
let normTargetSave = normalizeEol(targetSave);
if (normContent.includes(normTargetSave)) {
  normContent = normContent.replace(normTargetSave, replacementSave);
  content = normContent;
  console.log('Updated saveProduct in db.js.');
} else {
  console.log('saveProduct target not matched directly, checking...');
}

fs.writeFileSync(dbPath, content, 'utf8');
console.log('Successfully wrote updated db.js!');
