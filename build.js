const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDir(PUBLIC_DIR);

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    for (const f of fs.readdirSync(src)) {
      if (f === 'node_modules' || f === '.git' || f === '_temp_analysis' || f === 'public') continue;
      copyRecursive(path.join(src, f), path.join(dest, f));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

const itemsToCopy = [
  'css',
  'js',
  'images',
  'webfonts',
  'data',
  'admin',
  'about-us',
  'contact',
  'home',
  'news',
  'our-products',
  'privacy-policy',
  'product',
  'product-category',
  'product-detail',
  'sitemap',
  'steel-gate-design',
  'best-steel-gate-manufacturer-in-delhi',
  'aluminium-profile-gate-manufacturer-in-janakpuri',
  '404.html',
  'about-us.html',
  'admin.html',
  'aluminium-profile-gate-manufacturer-in-janakpuri.html',
  'best-steel-gate-manufacturer-in-delhi.html',
  'contact.html',
  'index.html',
  'news.html',
  'our-products.html',
  'privacy-policy.html',
  'product-detail.html',
  'product.html',
  'sitemap.html',
  'steel-gate-design.html',
  'favicon.ico',
  'llms.txt',
  'markdown',
  'content'
];

for (const item of itemsToCopy) {
  const src = path.join(ROOT_DIR, item);
  const dest = path.join(PUBLIC_DIR, item);
  if (fs.existsSync(src)) {
    copyRecursive(src, dest);
  }
}


// Copy product markdown files into product/ and public/product/ for direct static access
const mdProductsDir = path.join(ROOT_DIR, 'markdown', 'products');
if (fs.existsSync(mdProductsDir)) {
  const rootProductDir = path.join(ROOT_DIR, 'product');
  const pubProductDir = path.join(PUBLIC_DIR, 'product');
  ensureDir(rootProductDir);
  ensureDir(pubProductDir);

  for (const f of fs.readdirSync(mdProductsDir)) {
    if (f.endsWith('.md') && f !== 'index.md') {
      fs.copyFileSync(path.join(mdProductsDir, f), path.join(rootProductDir, f));
      fs.copyFileSync(path.join(mdProductsDir, f), path.join(pubProductDir, f));
    }
  }
}

console.log('Build completed successfully: public/ populated with all static assets and routes.');
