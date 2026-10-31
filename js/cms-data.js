/**
 * HARICHAND STEEL - Unified CMS Data Manager
 * Supports LocalStorage caching, direct JSON syncing, and server API fallback
 * Isomorphic: works seamlessly in both modern web browsers and Node.js runtimes.
 */

const CMS = (function () {
  const STORAGE_KEYS = {
    PRODUCTS: 'hs_cms_products',
    BLOGS: 'hs_cms_blogs',
    INQUIRIES: 'hs_cms_inquiries',
    AUTH: 'hs_cms_auth_session'
  };

  // Safe storage adapter
  const store = {
    _mem: {},
    getItem: function (key) {
      try {
        if (typeof localStorage !== 'undefined') {
          return localStorage.getItem(key);
        }
      } catch (_) {}
      return this._mem[key] || null;
    },
    setItem: function (key, value) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, value);
          return;
        }
      } catch (_) {}
      this._mem[key] = value;
    }
  };

  function triggerEvent(name, detail) {
    if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    }
  }

  // Default seed products
  const defaultProducts = [
    {
      id: "prod-1",
      title: "Aluminium Door Profile Gate",
      category: "aluminum-profile-gate",
      categoryName: "Aluminum Profile Gate",
      badge: "Top Rated",
      image: '/images/prod-1.png',
      description: "Premium aluminium door profile gate designed for high security, weather resistance, and sleek modern architecture.",
      specs: ["SS304 Grade Hardware", "Custom Sizing Available", "Smart Lock Ready"],
      price: "On Request",
      featured: true,
      createdAt: "2026-02-24"
    },
    {
      id: "prod-2",
      title: "Aluminium Profile Gate For Home",
      category: "aluminum-profile-gate",
      categoryName: "Aluminum Profile Gate",
      badge: "Modern",
      image: '/images/Aluminium-Profile-Main-Gate_2851615169991_product-jpeg-300x300.jpg',
      description: "Architectural aluminium slat gate suitable for contemporary residential driveways and villas.",
      specs: ["Rust Proof Alloy", "Matte Charcoal Powder Coat", "Low Maintenance"],
      price: "On Request",
      featured: false,
      createdAt: "2026-02-20"
    },
    {
      id: "prod-3",
      title: "Aluminium Profile Main Gate",
      category: "aluminum-profile-gate",
      categoryName: "Aluminum Profile Gate",
      badge: "Popular",
      image: '/images/ChatGPT-Image-Feb-23-2026-12_37_41-PM-300x300.png',
      description: "Full-width main entrance gate featuring heavy-gauge aluminium profiles and integrated safety locks.",
      specs: ["Heavy Extrusion Slat", "Motorized Sliding Compatible", "High Durability"],
      price: "On Request",
      featured: false,
      createdAt: "2026-02-18"
    },
    {
      id: "prod-4",
      title: "Aluminium Sliding Main Entrance Gate",
      category: "aluminum-profile-gate",
      categoryName: "Aluminum Profile Gate",
      badge: "Motorized",
      image: '/images/WhatsApp-Image-2026-02-23-at-12.55.26-PM-300x300.jpeg',
      description: "Smooth gliding bottom-track sliding gate engineered for silent, effortless motorized movement.",
      specs: ["Italian Motor Compatible", "Tough Alloy Frame", "Wind Resilient"],
      price: "On Request",
      featured: false,
      createdAt: "2026-02-15"
    },
    {
      id: "prod-5",
      title: "Aluminum Profile Gate With Rose Gold Handle",
      category: "aluminum-profile-gate",
      categoryName: "Aluminum Profile Gate",
      badge: "Rose Gold Pull",
      image: '/images/prod-2.jpeg',
      description: "Luxury entrance gate featuring bespoke rose-gold vertical pull handles and matte black aluminium slats.",
      specs: ["Rose Gold PVD Coating", "Heavy-Gauge Profiles", "Anti-Rust Protection"],
      price: "On Request",
      featured: true,
      createdAt: "2026-02-10"
    },
    {
      id: "prod-6",
      title: "Aluminum Profile Gate With Steel Frame",
      category: "aluminum-profile-gate",
      categoryName: "Aluminum Profile Gate",
      badge: "Reinforced",
      image: '/images/prod-3.jpeg',
      description: "Hybrid construction combining the strength of an internal steel framework with the rust-proof aesthetics of aluminium cladding.",
      specs: ["Steel Reinforced Sub-frame", "Lightweight Slat Cladding", "Double Anti-Corrosion Barrier"],
      price: "On Request",
      featured: true,
      createdAt: "2026-02-05"
    },
    {
      id: "prod-7",
      title: "Aluminum Profile Swing Gate for Home",
      category: "aluminum-profile-gate",
      categoryName: "Aluminum Profile Gate",
      badge: "Classic Swing",
      image: '/images/WhatsApp-Image-2026-02-23-at-1.07.57-PM-300x300.jpeg',
      description: "Dual-leaf swing gate suitable for residential driveways, equipped with heavy-duty ball-bearing hinges.",
      specs: ["Heavy Duty Pivot Hinges", "Weather Resilient", "Clean Minimal Slat Spacing"],
      price: "On Request",
      featured: false,
      createdAt: "2026-01-28"
    },
    {
      id: "prod-8",
      title: "Double Door Steel Gate",
      category: "steel-main-gate",
      categoryName: "Steel Main Gate",
      badge: "SS304",
      image: '/images/ChatGPT-Image-Feb-23-2026-04_42_39-PM-300x300.png',
      description: "Grand stainless steel entrance gate with decorative CNC vertical panels and mirror stainless finish.",
      specs: ["100% SS304 Stainless Steel", "Argon TIG Welded Joints", "Sag-Proof Heavy Posts"],
      price: "On Request",
      featured: false,
      createdAt: "2026-01-20"
    },
    {
      id: "prod-9",
      title: "Entrance Steel Door For Home",
      category: "steel-door",
      categoryName: "Steel Door",
      badge: "High Security",
      image: '/images/ChatGPT-Image-Feb-23-2026-04_22_55-PM-300x300.png',
      description: "Heavy-duty security steel door designed for bungalows and apartments with multi-point perimeter locks.",
      specs: ["Internal Steel Ribbing", "Multi-Point Deadbolt Locking", "Sound & Weather Insulated"],
      price: "On Request",
      featured: false,
      createdAt: "2026-01-15"
    },
    {
      id: "prod-iron-1",
      title: "Wrought Iron Luxury Main Gate",
      category: "iron-main-gate",
      categoryName: "Iron Main Gate",
      badge: "Hand Forged",
      image: '/images/Main-Entrance-Gate_2850083224362_stainless-steel-window-grills-576x1024.jpg',
      description: "Classic heavy wrought iron entrance gate with hand-forged scrollwork, spearhead finials, and multi-stage rust-resistant primer.",
      specs: ["Heavy Solid Iron Stock", "Hand-Crafted Floral Finials", "Anti-Corrosion Red Oxide Coating"],
      price: "On Request",
      featured: true,
      createdAt: "2026-02-12"
    },
    {
      id: "prod-iron-2",
      title: "Modern Cast Iron Sliding Gate",
      category: "iron-main-gate",
      categoryName: "Iron Main Gate",
      badge: "Heavy Duty",
      image: '/images/20231103_094312-scaled.jpg',
      description: "Industrial strength decorative iron sliding gate designed for wide bungalow entrances, high security estates, and villa perimeters.",
      specs: ["Reinforced Iron Channel Frame", "Heavy Duty Bottom Rollers", "Weather Seal Coating"],
      price: "On Request",
      featured: false,
      createdAt: "2026-02-08"
    },
    {
      id: "prod-iron-3",
      title: "Decorative Wrought Iron Double Gate",
      category: "iron-main-gate",
      categoryName: "Iron Main Gate",
      badge: "Artisanal Build",
      image: '/images/download-5.jpg',
      description: "Timeless dual-swing wrought iron gate with intricate center crest medallion, heavy-duty pivot bushings, and motorized opener bracket.",
      specs: ["Traditional Forged Iron", "Anti-Sag Heavy Pivot Bushings", "Custom Crest Monogram"],
      price: "On Request",
      featured: false,
      createdAt: "2026-01-25"
    },
    {
      id: "prod-powder-1",
      title: "Matte Black Powder Coated Modern Gate",
      category: "powder-coated-gates",
      categoryName: "Powder Coated Gates",
      badge: "Scratch Proof",
      image: '/images/golden-brown-profile-gate-1024x461.jpg',
      description: "Sleek architectural steel gate coated with 80-micron electrostatically applied matte black thermoset powder.",
      specs: ["80 Micron Electrostatic Coat", "UV Fade & Weatherproof", "Smooth Architectural Finish"],
      price: "On Request",
      featured: true,
      createdAt: "2026-02-14"
    },
    {
      id: "prod-powder-2",
      title: "Antique Bronze Powder Coated Steel Gate",
      category: "powder-coated-gates",
      categoryName: "Powder Coated Gates",
      badge: "Luxury Finish",
      image: '/images/20231029_141009-1024x768.jpg',
      description: "Premium metallic antique bronze textured powder coating over galvanized rust-resistant steel frame with motorized dual swing.",
      specs: ["10-Year Coating Guarantee", "Impact & Scratch Resistant", "Dual Swing Automated"],
      price: "On Request",
      featured: false,
      createdAt: "2026-02-02"
    },
    {
      id: "prod-powder-3",
      title: "Wood-Grain Powder Coated Profile Gate",
      category: "powder-coated-gates",
      categoryName: "Powder Coated Gates",
      badge: "Wood Texture",
      image: '/images/aluminuim-profile-box-1-1-1024x576.jpg',
      description: "Innovative heat-sublimated wood grain powder coating providing natural timber warm aesthetics with zero rot and zero maintenance.",
      specs: ["Sublimation Wood Finish", "Zero Rot & Termite Proof", "Marine Grade Substrate"],
      price: "On Request",
      featured: true,
      createdAt: "2026-01-18"
    },
    {
      id: "prod-10",
      title: "SS304 Modern Laser Cut Steel Gate",
      category: "steel-main-gate",
      categoryName: "Steel Main Gate",
      badge: "CNC Laser",
      image: '/images/20230723_115650-768x1024.jpg',
      description: "Architectural grade SS304 stainless steel entrance gate with geometric laser cut privacy grilles and mirror polish accents.",
      specs: ["100% Certified SS304", "CNC Fiber Laser Precision", "Mirror Polish Accents"],
      price: "On Request",
      featured: false,
      createdAt: "2026-01-22"
    },
    {
      id: "prod-11",
      title: "Heavy Security Exterior Steel Door",
      category: "steel-door",
      categoryName: "Steel Door",
      badge: "Impact Rated",
      image: '/images/Interior-Door_24388653330_product-jpeg-768x1024.jpg',
      description: "Double-walled reinforced steel perimeter door with multi-point biometric deadbolt locking system and weatherstrip insulation.",
      specs: ["Double Galvanized Steel Skin", "High Security Multi-Bolt", "Weatherstrip Sound Insulation"],
      price: "On Request",
      featured: false,
      createdAt: "2026-01-12"
    }
  ];

  // Default seed blogs
  const defaultBlogs = [
    {
      id: "blog-1",
      title: "Latest Steel Gate Design (2025) – Ultimate Modern Guide",
      slug: "/steel-gate-design.html",
      tag: "Design Guide",
      image: '/images/about-3.jpg',
      author: "Harichand Steel Team",
      date: "January 19, 2026",
      excerpt: "Explore the most popular steel gate designs for modern homes, villas, and commercial properties, including laser-cut CNC patterns, SS304 durability, and motorized options.",
      content: "Premium steel gate designs crafted for security, style, and durability. Stainless steel (SS304) represents the peak of gate engineering in Delhi NCR.\n\nKey Styles:\n- Modern Steel Gates with horizontal louvres\n- Laser Cut CNC Decorative Panels\n- Reinforced Aluminium & SS Hybrid gates\n- Automated Sliding and Double Swing Entrances",
      published: true
    },
    {
      id: "blog-2",
      title: "Best Steel Gate Manufacturer In Delhi – Complete Buyer's Guide",
      slug: "/best-steel-gate-manufacturer-in-delhi.html",
      tag: "Manufacturing",
      image: '/images/about-2.jpg',
      author: "Harichand Steel Team",
      date: "February 10, 2026",
      excerpt: "Why Harichand Steel is recognized as Delhi's #1 steel gate manufacturer. Insights on material grades, SS304 vs SS202, order processes, and custom fabrication.",
      content: "Harichand Steel is appreciated for exceptional craftsmanship, timely delivery, and dependable service. Established in 2004, our workshop produces custom main gates for homes across Janakpuri, Dwarka, and Delhi NCR.",
      published: true
    },
    {
      id: "blog-3",
      title: "Aluminium Profile Gate Manufacturer in Janakpuri – Innovation & Strength",
      slug: "/aluminium-profile-gate-manufacturer-in-janakpuri.html",
      tag: "Case Study",
      image: '/images/profile-box.jpg',
      author: "Harichand Steel Team",
      date: "November 6, 2024",
      excerpt: "How aluminium profile gates have revolutionized residential entrances in Janakpuri and Delhi NCR with lightweight operation, weather immunity, and wood-finish styling.",
      content: "Aluminium profile gates solve the rust problem of traditional metal gates while offering 60% less weight, zero corrosion, and sleek European styling.",
      published: true
    },
    {
      id: "blog-4",
      title: "Aluminum Profile Gate Manufacturer in Prithviraj Road",
      slug: "/news.html#prithviraj-road",
      tag: "Luxury Projects",
      image: '/images/hero-slide-2.jpg',
      author: "Harichand Steel Team",
      date: "November 6, 2024",
      excerpt: "High-end bespoke architectural gate installations tailored for premium residences and diplomatic areas across Central Delhi and Prithviraj Road.",
      content: "Luxury gate design engineered specifically for diplomatic and bungalow entrances requiring maximum privacy, sound dampening, and automated sensors.",
      published: true
    }
  ];

  // Initialize data in store
  function initStorage() {
    const existing = store.getItem(STORAGE_KEYS.PRODUCTS);
    if (!existing) {
      store.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(defaultProducts));
    } else {
      try {
        const parsed = JSON.parse(existing);
        const hasIron = parsed.some(p => p.category === 'iron-main-gate');
        const hasPowder = parsed.some(p => p.category === 'powder-coated-gates');
        if (!hasIron || !hasPowder) {
          const missing = defaultProducts.filter(dp => !parsed.some(ep => ep.id === dp.id));
          if (missing.length) {
            store.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify([...parsed, ...missing]));
          }
        }
      } catch (_) {}
    }
    if (!store.getItem(STORAGE_KEYS.BLOGS)) {
      store.setItem(STORAGE_KEYS.BLOGS, JSON.stringify(defaultBlogs));
    }
    if (!store.getItem(STORAGE_KEYS.INQUIRIES)) {
      store.setItem(STORAGE_KEYS.INQUIRIES, JSON.stringify([]));
    }
  }

  initStorage();

  // Admin API Secret Key configuration
  const ADMIN_API_KEY = (typeof window !== 'undefined' && window.ADMIN_API_KEY) ||
                        (typeof localStorage !== 'undefined' && localStorage.getItem('hs_admin_api_key')) ||
                        'hs_admin_secret_key_2026';

  // Helper to sync with local Node server if running
  async function syncToServer(endpoint, data, method = 'POST') {
    try {
      if (typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http')) {
        const headers = {
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_API_KEY,
          'Authorization': `Bearer ${ADMIN_API_KEY}`
        };
        await fetch(`/api/${endpoint}`, {
          method: method,
          headers: headers,
          body: JSON.stringify(data)
        });
      }
    } catch (e) {
      // offline or static file mode; store is primary
    }
  }

  return {
    // --- Products API ---
    getProducts: function () {
      try {
        const stored = store.getItem(STORAGE_KEYS.PRODUCTS);
        return stored ? JSON.parse(stored) : defaultProducts;
      } catch (e) {
        return defaultProducts;
      }
    },

    saveProduct: function (product) {
      const products = this.getProducts();
      if (!product.id) {
        product.id = 'prod-' + Date.now();
        product.createdAt = new Date().toISOString().split('T')[0];
        products.unshift(product);
      } else {
        const index = products.findIndex(p => p.id === product.id);
        if (index !== -1) {
          products[index] = { ...products[index], ...product, updatedAt: new Date().toISOString().split('T')[0] };
        } else {
          products.unshift(product);
        }
      }
      store.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
      syncToServer('products', products);
      triggerEvent('cms:products:updated', products);
      return product;
    },

    deleteProduct: function (id) {
      let products = this.getProducts();
      products = products.filter(p => p.id !== id);
      store.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
      syncToServer('products', products);
      if (typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http')) {
        try {
          fetch(`/api/products?id=${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: {
              'x-admin-key': ADMIN_API_KEY,
              'Authorization': `Bearer ${ADMIN_API_KEY}`
            }
          }).catch(() => {});
        } catch (_) {}
      }
      triggerEvent('cms:products:updated', products);
      return true;
    },

    // --- Blogs API ---
    getBlogs: function () {
      try {
        const stored = store.getItem(STORAGE_KEYS.BLOGS);
        return stored ? JSON.parse(stored) : defaultBlogs;
      } catch (e) {
        return defaultBlogs;
      }
    },

    saveBlog: function (blog) {
      const blogs = this.getBlogs();
      if (!blog.id) {
        blog.id = 'blog-' + Date.now();
        blog.date = blog.date || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        blogs.unshift(blog);
      } else {
        const index = blogs.findIndex(b => b.id === blog.id);
        if (index !== -1) {
          blogs[index] = { ...blogs[index], ...blog };
        } else {
          blogs.unshift(blog);
        }
      }
      store.setItem(STORAGE_KEYS.BLOGS, JSON.stringify(blogs));
      syncToServer('blogs', blogs);
      triggerEvent('cms:blogs:updated', blogs);
      return blog;
    },

    deleteBlog: function (id) {
      let blogs = this.getBlogs();
      blogs = blogs.filter(b => b.id !== id);
      store.setItem(STORAGE_KEYS.BLOGS, JSON.stringify(blogs));
      syncToServer('blogs', blogs);
      if (typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http')) {
        try {
          fetch(`/api/blogs?id=${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: {
              'x-admin-key': ADMIN_API_KEY,
              'Authorization': `Bearer ${ADMIN_API_KEY}`
            }
          }).catch(() => {});
        } catch (_) {}
      }
      triggerEvent('cms:blogs:updated', blogs);
      return true;
    },

    // --- Inquiries Log API ---
    getInquiries: function () {
      try {
        const stored = store.getItem(STORAGE_KEYS.INQUIRIES);
        return stored ? JSON.parse(stored) : [];
      } catch (e) {
        return [];
      }
    },

    saveInquiry: function (inquiry) {
      const inquiries = this.getInquiries();
      inquiry.id = 'inq-' + Date.now();
      inquiry.timestamp = new Date().toLocaleString();
      inquiries.unshift(inquiry);
      store.setItem(STORAGE_KEYS.INQUIRIES, JSON.stringify(inquiries));
      syncToServer('inquiries', inquiries);
      return inquiry;
    },

    // --- Backup & Restore ---
    exportData: function () {
      return JSON.stringify({
        products: this.getProducts(),
        blogs: this.getBlogs(),
        inquiries: this.getInquiries(),
        exportedAt: new Date().toISOString()
      }, null, 2);
    },

    importData: function (jsonStr) {
      try {
        const data = JSON.parse(jsonStr);
        if (data.products && Array.isArray(data.products)) {
          store.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(data.products));
        }
        if (data.blogs && Array.isArray(data.blogs)) {
          store.setItem(STORAGE_KEYS.BLOGS, JSON.stringify(data.blogs));
        }
        if (data.inquiries && Array.isArray(data.inquiries)) {
          store.setItem(STORAGE_KEYS.INQUIRIES, JSON.stringify(data.inquiries));
        }
        triggerEvent('cms:products:updated');
        triggerEvent('cms:blogs:updated');
        return true;
      } catch (e) {
        console.error('Import error:', e);
        return false;
      }
    },

    resetToDefault: function () {
      store.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(defaultProducts));
      store.setItem(STORAGE_KEYS.BLOGS, JSON.stringify(defaultBlogs));
      triggerEvent('cms:products:updated');
      triggerEvent('cms:blogs:updated');
      return true;
    }
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CMS;
}
