/**
 * HARICHAND STEEL - Google-Compliant Dynamic Product Schema (JSON-LD) Generator & Validator
 * Compatible with Node.js (CommonJS) and Modern Browsers (window.ProductSchema)
 * Compliant with Google Search Central Product Structured Data Guidelines
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ProductSchema = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const BASE_URL = 'https://harichandsteel.com';

  function slugify(text) {
    if (!text) return 'product-' + Date.now();
    return String(text)
      .toLowerCase()
      .replace(/^\/+/, '')
      .replace(/\.html$/i, '')
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'product-' + Date.now();
  }

  /**
   * Generates Google-Compliant JSON-LD Product Schema
   * @param {Object} product Product data object
   * @param {Object} opts Options (e.g. domain override)
   * @returns {Object|null}
   */
  function generateProductSchema(product, opts = {}) {
    if (!product || product.schemaEnabled === false) {
      return null;
    }

    const domain = opts.domain || BASE_URL;
    const rawSlug = product.slug || slugify(product.title || product.name || product.id || '');
    const cleanSlug = rawSlug.replace(/^\/+|\/+$/g, '');
    const canonicalUrl = `${domain}/product/${cleanSlug}/`;

    // 1. Process Absolute Images
    let imgList = [];
    if (Array.isArray(product.images) && product.images.length > 0) {
      imgList = product.images;
    } else if (product.image) {
      imgList = [product.image];
    } else {
      imgList = ['/images/prod-1.png'];
    }

    const absoluteImages = imgList.map(img => {
      if (!img) return `${domain}/images/prod-1.png`;
      if (img.startsWith('data:')) return `${domain}/images/prod-1.png`; // Schema.org disallows data URI for search indexing
      if (img.startsWith('http://') || img.startsWith('https://')) return img;
      return `${domain}${img.startsWith('/') ? '' : '/'}${img}`;
    });

    // 2. Process Numeric Price
    let numericPrice = '';
    if (product.schemaPrice !== undefined && product.schemaPrice !== null && String(product.schemaPrice).trim() !== '') {
      numericPrice = String(product.schemaPrice).replace(/[^0-9.]/g, '');
    } else if (product.price) {
      const matched = String(product.price).replace(/,/g, '').match(/\d+(\.\d+)?/);
      if (matched) numericPrice = matched[0];
    }
    // Fallback base quotation price if none set (Google requires numeric price inside Offer)
    if (!numericPrice || isNaN(parseFloat(numericPrice))) {
      numericPrice = '25000';
    }

    // 3. Identifiers
    const catCode = (product.category || 'GATE').slice(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
    const idCode = String(product.id || cleanSlug).slice(-4).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const sku = (product.schemaSku && String(product.schemaSku).trim()) || `HS-${catCode || 'STEEL'}-${idCode || '001'}`;
    const mpn = (product.schemaMpn && String(product.schemaMpn).trim()) || `HCS-${idCode || '001'}`;
    const brandName = (product.schemaBrand && String(product.schemaBrand).trim()) || 'Harichand Steel';

    const title = product.title || product.name || 'Harichand Steel Gate';
    const description = product.description || `Custom engineered ${title} by Harichand Steel featuring heavy-gauge frame and architectural weatherproofing.`;

    // 4. Construct Product Entity
    const schema = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": title,
      "image": absoluteImages.length === 1 ? absoluteImages[0] : absoluteImages,
      "description": description,
      "sku": sku,
      "mpn": mpn,
      "brand": {
        "@type": "Brand",
        "name": brandName
      },
      "category": product.categoryName || product.category_display || product.category || 'Architectural Gates'
    };

    // GTIN (Barcode)
    if (product.schemaGtin && String(product.schemaGtin).trim()) {
      const gtin = String(product.schemaGtin).trim().replace(/[^0-9]/g, '');
      if (gtin.length === 8) schema.gtin8 = gtin;
      else if (gtin.length === 12) schema.gtin12 = gtin;
      else if (gtin.length === 13) schema.gtin13 = gtin;
      else if (gtin.length === 14) schema.gtin14 = gtin;
      else if (gtin.length > 0) schema.gtin = gtin;
    }

    // 5. Offers Object
    if (product.schemaOfferEnabled !== false) {
      const currency = product.schemaCurrency || 'INR';
      const availability = product.schemaAvailability || 'https://schema.org/InStock';
      const condition = product.schemaCondition || 'https://schema.org/NewCondition';
      const priceValidUntil = product.schemaPriceValidUntil || '2026-12-31';

      schema.offers = {
        "@type": "Offer",
        "url": canonicalUrl,
        "priceCurrency": currency,
        "price": numericPrice,
        "priceValidUntil": priceValidUntil,
        "itemCondition": condition,
        "availability": availability,
        "seller": {
          "@type": "Organization",
          "name": "Harichand Steel",
          "@id": `${domain}/#organization`
        }
      };
    }

    // 6. Reviews and AggregateRating (ONLY if genuine reviews exist and review schema is enabled)
    if (product.schemaReviewEnabled === true) {
      const ratingVal = parseFloat(product.schemaRatingValue);
      const reviewCountVal = parseInt(product.schemaReviewCount, 10);

      if (!isNaN(ratingVal) && ratingVal >= 1 && ratingVal <= 5 && !isNaN(reviewCountVal) && reviewCountVal > 0) {
        schema.aggregateRating = {
          "@type": "AggregateRating",
          "ratingValue": ratingVal.toFixed(1),
          "reviewCount": String(reviewCountVal),
          "bestRating": "5",
          "worstRating": "1"
        };
      }

      if (Array.isArray(product.schemaReviews) && product.schemaReviews.length > 0) {
        const validReviews = product.schemaReviews.filter(r => r && (r.author || r.name) && (r.body || r.reviewBody));
        if (validReviews.length > 0) {
          schema.review = validReviews.map(r => ({
            "@type": "Review",
            "author": {
              "@type": "Person",
              "name": r.author || 'Customer'
            },
            "datePublished": r.date || new Date().toISOString().split('T')[0],
            "reviewBody": r.body || r.reviewBody || 'Verified customer review for Harichand Steel.',
            "name": r.title || 'Verified Purchase Review',
            "reviewRating": {
              "@type": "Rating",
              "ratingValue": String(r.rating || 5),
              "bestRating": "5",
              "worstRating": "1"
            }
          }));
        }
      }
    }

    return schema;
  }

  /**
   * Validates schema against Google Structured Data requirements
   * @param {Object} schema JSON-LD Object
   * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
   */
  function validateProductSchema(schema) {
    const errors = [];
    const warnings = [];

    if (!schema) {
      return { valid: false, errors: ['Schema is disabled or empty.'], warnings: [] };
    }

    if (schema['@type'] !== 'Product') errors.push("Missing @type: 'Product'");
    if (!schema.name) errors.push("Missing required field: 'name'");
    if (!schema.image || (Array.isArray(schema.image) && schema.image.length === 0)) {
      errors.push("Missing required field: 'image'");
    }
    if (!schema.description) warnings.push("Recommended field 'description' is missing.");
    if (!schema.sku) warnings.push("Recommended field 'sku' is missing.");
    if (!schema.mpn) warnings.push("Recommended field 'mpn' is missing.");
    if (!schema.brand) warnings.push("Recommended field 'brand' is missing.");

    if (!schema.offers && !schema.review && !schema.aggregateRating) {
      errors.push("Google requires at least one of: 'offers', 'review', or 'aggregateRating'.");
    }

    if (schema.offers) {
      if (!schema.offers.price) errors.push("Offer is missing 'price'");
      if (!schema.offers.priceCurrency) errors.push("Offer is missing 'priceCurrency'");
      if (!schema.offers.availability) warnings.push("Offer is missing 'availability'");
      if (!schema.offers.priceValidUntil) warnings.push("Offer is missing 'priceValidUntil'");
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      warnings: warnings
    };
  }

  return {
    generateProductSchema,
    validateProductSchema,
    BASE_URL
  };
});
