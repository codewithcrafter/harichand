/**
 * HARICHAND STEEL - CMS Admin Controller
 * Manages dashboard state, CRUD operations, live modals, search/filtering, and data backups
 */

document.addEventListener('DOMContentLoaded', function () {
  // Check CMS availability
  if (typeof CMS === 'undefined') {
    console.error('CMS module not found! Ensure js/cms-data.js is loaded before js/admin.js.');
    return;
  }


  // ==========================================
  // QUILL WYSIWYG EDITOR SINGLETON
  // ==========================================
  let blogQuillInstance = null;
  function initBlogQuillEditor() {
    if (!blogQuillInstance && window.Quill && document.getElementById('blogQuillEditor')) {
      blogQuillInstance = new Quill('#blogQuillEditor', {
        theme: 'snow',
        placeholder: 'Write your gate guide, fabrication process, or article content here...',
        modules: {
          toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['blockquote', 'code-block'],
            ['link', 'image'],
            ['clean']
          ]
        }
      });
    }
  }

  // --- DOM Elements Cache ---
  const navItems = document.querySelectorAll('.admin-nav-item[data-tab]');
  const tabPanes = document.querySelectorAll('.admin-tab-pane');
  const pageHeading = document.getElementById('pageHeading');
  const globalSearchInput = document.getElementById('globalSearchInput');

  // Mobile Slide-over Drawer Controls
  const sidebarToggle = document.getElementById('sidebarToggle');
  const adminSidebar = document.getElementById('adminSidebar');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');

  function openSidebarDrawer() {
    if (adminSidebar) adminSidebar.classList.add('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebarDrawer() {
    if (adminSidebar) adminSidebar.classList.remove('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      if (adminSidebar && adminSidebar.classList.contains('open')) {
        closeSidebarDrawer();
      } else {
        openSidebarDrawer();
      }
    });
  }

  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', closeSidebarDrawer);
  }

  if (sidebarCloseBtn) {
    sidebarCloseBtn.addEventListener('click', closeSidebarDrawer);
  }

  // Close drawer when any nav link is tapped on mobile
  navItems.forEach(item => {
    item.addEventListener('click', function () {
      if (window.innerWidth <= 768) {
        closeSidebarDrawer();
      }
    });
  });

  // Stats & Badges
  const statTotalProducts = document.getElementById('statTotalProducts');
  const statTotalBlogs = document.getElementById('statTotalBlogs');
  const statTotalInquiries = document.getElementById('statTotalInquiries');
  const badgeProductCount = document.getElementById('badgeProductCount');
  const badgeBlogCount = document.getElementById('badgeBlogCount');
  const badgeInquiryCount = document.getElementById('badgeInquiryCount');

  // Tables
  const dashRecentProductsTable = document.getElementById('dashRecentProductsTable');
  const dashRecentBlogsTable = document.getElementById('dashRecentBlogsTable');
  const productsTableBody = document.getElementById('productsTableBody');
  const blogsTableBody = document.getElementById('blogsTableBody');
  const inquiriesTableBody = document.getElementById('inquiriesTableBody');

  // Filters
  const productSearchInput = document.getElementById('productSearchInput');
  const productCategoryFilter = document.getElementById('productCategoryFilter');
  const productShowingCount = document.getElementById('productShowingCount');

  const blogSearchInput = document.getElementById('blogSearchInput');
  const blogTagFilter = document.getElementById('blogTagFilter');
  const blogShowingCount = document.getElementById('blogShowingCount');

  // Product Modal & Form
  const productModalOverlay = document.getElementById('productModalOverlay');
  const productModalTitle = document.getElementById('productModalTitle');
  const productForm = document.getElementById('productForm');
  const prodInputId = document.getElementById('prodInputId');
  const prodInputTitle = document.getElementById('prodInputTitle');
  const prodInputCategory = document.getElementById('prodInputCategory');
  const prodInputCategoryName = document.getElementById('prodInputCategoryName');
  const prodInputBadge = document.getElementById('prodInputBadge');
  const prodInputPrice = document.getElementById('prodInputPrice');
  const prodInputImage = document.getElementById('prodInputImage');
  const prodFileInput = document.getElementById('prodFileInput');
  const prodImagePreview = document.getElementById('prodImagePreview');
  const prodInputDescription = document.getElementById('prodInputDescription');
  const prodInputSpecs = document.getElementById('prodInputSpecs');
  const prodInputFeatured = document.getElementById('prodInputFeatured');
  const prodInputOuterFrame = document.getElementById('prodInputOuterFrame');
  const prodInputInnerFrame = document.getElementById('prodInputInnerFrame');
  const prodInputUsage = document.getElementById('prodInputUsage');
  const prodInputFinish = document.getElementById('prodInputFinish');
  const prodInputHardware = document.getElementById('prodInputHardware');
  const prodInputAutomation = document.getElementById('prodInputAutomation');

  // Blog modal elements & controls
  const blogModalContainer = document.getElementById('blogModalContainer');
  const btnBlogFullscreen = document.getElementById('btnBlogFullscreen');
  const btnPreviewCurrentBlog = document.getElementById('btnPreviewCurrentBlog');
  const btnBlogOpenFullscreenModal = document.getElementById('btnBlogOpenFullscreenModal');



  // Blog Modal & Form
  const blogModalOverlay = document.getElementById('blogModalOverlay');
  const blogModalTitle = document.getElementById('blogModalTitle');
  const blogForm = document.getElementById('blogForm');
  const blogInputId = document.getElementById('blogInputId');
  const blogInputTitle = document.getElementById('blogInputTitle');
  const blogInputSlug = document.getElementById('blogInputSlug');
  const blogInputTag = document.getElementById('blogInputTag');
  const blogInputAuthor = document.getElementById('blogInputAuthor');
  const blogInputDate = document.getElementById('blogInputDate');
  const blogInputImage = document.getElementById('blogInputImage');
  const blogFileInput = document.getElementById('blogFileInput');
  const blogImagePreview = document.getElementById('blogImagePreview');
  const blogInputExcerpt = document.getElementById('blogInputExcerpt');
  const blogInputContent = document.getElementById('blogInputContent');
  const blogInputPublished = document.getElementById('blogInputPublished');

  // Confirm Modal
  const confirmModalOverlay = document.getElementById('confirmModalOverlay');
  const confirmModalTitle = document.getElementById('confirmModalTitle');
  const confirmModalMessage = document.getElementById('confirmModalMessage');
  const confirmModalExecuteBtn = document.getElementById('confirmModalExecuteBtn');
  let confirmCallback = null;

  // Toast Container
  const toastContainer = document.getElementById('toastContainer');

  // State
  let currentActiveTab = 'dashboard';

    // ==========================================
  // MULTI-PAGE PAGINATION & ROUTING CONTROLLER
  // ==========================================
  const PAGE_SIZE = 10;

  const paginationState = {
    products: 1,
    blogs: 1,
    inquiries: 1
  };

  // Helper: Extract section and page number from clean URL pathname or query parameters
  function parseAdminUrl() {
    const path = window.location.pathname || '';
    let section = 'dashboard';
    let page = 1;

    if (path.includes('/admin/products')) {
      section = 'products';
    } else if (path.includes('/admin/inquiries')) {
      section = 'inquiries';
    } else if (path.includes('/admin/blogs')) {
      section = 'blogs';
    } else if (path.includes('/admin/settings')) {
      section = 'settings';
    }

    const pageMatch = path.match(/\/page\/(\d+)\/?/);
    if (pageMatch && pageMatch[1]) {
      const p = parseInt(pageMatch[1], 10);
      if (!isNaN(p) && p >= 1) page = p;
    }

    const params = new URLSearchParams(window.location.search || '');
    if (params.has('section')) {
      section = params.get('section');
    }
    if (params.has('page')) {
      const p = parseInt(params.get('page'), 10);
      if (!isNaN(p) && p >= 1) page = p;
    }

    return { section, page };
  }

  // Helper: Update browser URL cleanly with history.pushState
  function updateAdminUrl(section, page, push = true) {
    let url = `/admin/${section}`;
    if (section === 'dashboard') {
      url = '/admin';
    } else if (page && page > 1) {
      url = `/admin/${section}/page/${page}`;
    }

    if (push && window.history && window.history.pushState) {
      try {
        const current = window.location.pathname;
        if (current !== url) {
          window.history.pushState({ section, page }, '', url);
        }
      } catch (e) {
        console.warn('pushState error:', e);
      }
    }
  }

  // Reusable Pagination Controls Renderer
  function renderAdminPagination(containerId, totalItems, currentPage, pageSize, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(Math.max(1, currentPage), totalPages);

    const startNum = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const endNum = Math.min(safePage * pageSize, totalItems);
    const summaryText = totalItems === 0 
      ? 'Showing 0 items' 
      : `Showing <strong>${startNum}–${endNum}</strong> of <strong>${totalItems}</strong> items`;

    if (totalPages <= 1) {
      container.innerHTML = `
        <div class="pagination-summary">${summaryText}</div>
        <ul class="pagination-nav"></ul>
      `;
      return;
    }

    let buttonsHtml = '';

    // [←] Previous button
    const isFirst = safePage <= 1;
    buttonsHtml += `
      <li class="page-item ${isFirst ? 'disabled' : ''}">
        <a class="page-link" href="#" data-page="${safePage - 1}" aria-label="Previous Page" ${isFirst ? 'tabindex="-1"' : ''}>
          <i class="fas fa-chevron-left"></i>
        </a>
      </li>
    `;

    // [1] [2] [3] ... [totalPages]
    for (let p = 1; p <= totalPages; p++) {
      const isActive = p === safePage;
      buttonsHtml += `
        <li class="page-item ${isActive ? 'active' : ''}">
          <a class="page-link" href="#" data-page="${p}">${p}</a>
        </li>
      `;
    }

    // [→] Next button
    const isLast = safePage >= totalPages;
    buttonsHtml += `
      <li class="page-item ${isLast ? 'disabled' : ''}">
        <a class="page-link" href="#" data-page="${safePage + 1}" aria-label="Next Page" ${isLast ? 'tabindex="-1"' : ''}>
          <i class="fas fa-chevron-right"></i>
        </a>
      </li>
    `;

    container.innerHTML = `
      <div class="pagination-summary">${summaryText}</div>
      <ul class="pagination-nav">${buttonsHtml}</ul>
    `;

    container.querySelectorAll('.page-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const pageItem = link.closest('.page-item');
        if (pageItem && (pageItem.classList.contains('disabled') || pageItem.classList.contains('active'))) {
          return;
        }
        const targetPage = parseInt(link.getAttribute('data-page'), 10);
        if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPages && targetPage !== safePage) {
          onPageChange(targetPage);
        }
      });
    });
  }

  const categoryTitleMap = {
    'aluminum-profile-gate': 'Aluminum Profile Gate',
    'iron-main-gate': 'Iron Main Gate',
    'steel-main-gate': 'Steel Main Gate',
    'steel-door': 'Steel Door',
    'powder-coated-gates': 'Powder Coated Gates',
    'modern-railings': 'Modern Railings',
    'custom-fabrication': 'Custom Fabrication'
  };

  // ==========================================
  // 1. TAB NAVIGATION & ROUTING
  // ==========================================
  function switchTab(tabId, push = true) {
    currentActiveTab = tabId;
    navItems.forEach(item => {
      if (item.getAttribute('data-tab') === tabId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    tabPanes.forEach(pane => {
      if (pane.id === `pane-${tabId}`) {
        pane.style.display = 'block';
      } else {
        pane.style.display = 'none';
      }
    });

    // Update Topbar Title
    const titleMap = {
      dashboard: 'Dashboard Overview',
      products: 'Products Catalog Management',
      blogs: 'News & Blog Management',
      inquiries: 'Customer Inquiries & Leads',
      settings: 'Backup & Database Tools'
    };
    if (pageHeading) {
      pageHeading.textContent = titleMap[tabId] || 'Dashboard';
    }

    const currentPage = paginationState[tabId] || 1;
    if (push) {
      updateAdminUrl(tabId, currentPage, true);
    }

    // Refresh contents
    if (tabId === 'dashboard') {
      renderDashboard();
    } else if (tabId === 'products') {
      renderProducts();
    } else if (tabId === 'blogs') {
      renderBlogs();
    } else if (tabId === 'inquiries') {
      renderInquiries();
    }
  }

  navItems.forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const tabId = this.getAttribute('data-tab');
      if (tabId) switchTab(tabId, true);
    });
  });

  // Jump from dashboard links
  document.querySelectorAll('[data-goto-tab]').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const target = this.getAttribute('data-goto-tab');
      if (target) switchTab(target, true);
    });
  });

  // Browser Back / Forward navigation
  window.addEventListener('popstate', (e) => {
    let targetSection = 'dashboard';
    let targetPage = 1;

    if (e.state && e.state.section) {
      targetSection = e.state.section;
      targetPage = e.state.page || 1;
    } else {
      const parsed = parseAdminUrl();
      targetSection = parsed.section;
      targetPage = parsed.page;
    }

    if (paginationState[targetSection] !== undefined) {
      paginationState[targetSection] = targetPage;
    }

    switchTab(targetSection, false);
  });

// ==========================================
  // 2. TOAST NOTIFICATIONS
  // ==========================================
  function showToast(message, type = 'success') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  
  function resolveAdminImgPath(src) {
    if (!src) return '../images/prod-1.png';
    if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('../')) {
      return src;
    }
    return '../' + src.replace(/^\/+/, '');
  }

  function slugifyProd(text, id) {
    if (!text) return id || 'gate-product';
    return text.toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // Resolve article / blog links to guaranteed root-relative paths
  function resolveArticleUrl(slug) {
    if (!slug) return '/news.html';
    const s = String(slug).trim();
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    return s.startsWith('/') ? s : '/' + s;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
  }

  // ==========================================
  // 3. CONFIRMATION DIALOG
  // ==========================================
  function openConfirmModal(title, message, onConfirm) {
    confirmModalTitle.textContent = title || 'Confirm Action';
    confirmModalMessage.textContent = message || 'Are you sure you want to proceed?';
    confirmCallback = onConfirm;
    confirmModalOverlay.classList.add('active');
  }

  confirmModalExecuteBtn.addEventListener('click', function () {
    if (confirmCallback) {
      confirmCallback();
      confirmCallback = null;
    }
    confirmModalOverlay.classList.remove('active');
  });

  // Close modals on [data-close-modal] or click on overlay backdrop
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', function () {
      const overlay = this.closest('.admin-modal-overlay');
      if (overlay) overlay.classList.remove('active');
    });
  });

  document.querySelectorAll('.admin-modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', function (e) {
      if (e.target === this) {
        this.classList.remove('active');
      }
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.admin-modal-overlay.active').forEach(m => m.classList.remove('active'));
    }
  });

  // ==========================================
  // 4. DASHBOARD RENDERER
  // ==========================================
  function renderDashboard() {
    const products = CMS.getProducts();
    const blogs = CMS.getBlogs();
    const inquiries = CMS.getInquiries();

    // Stats
    statTotalProducts.textContent = products.length;
    statTotalBlogs.textContent = blogs.length;
    statTotalInquiries.textContent = inquiries.length;

    badgeProductCount.textContent = products.length;
    badgeBlogCount.textContent = blogs.length;
    badgeInquiryCount.textContent = inquiries.length;

    // Recent Products in Dashboard (first 4)
    if (dashRecentProductsTable) {
      if (products.length === 0) {
        dashRecentProductsTable.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--admin-text-muted); padding: 24px;">No products found. Click "Add Product" to create one.</td></tr>`;
      } else {
        dashRecentProductsTable.innerHTML = products.slice(0, 4).map(prod => `
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: 12px;">
                <img src="${escapeHtml(resolveAdminImgPath(prod.image))}" alt="${escapeHtml(prod.title)}" class="table-thumb" onerror="this.src='../images/prod-1.png'">
                <div>
                  <strong style="color: #fff; font-size: 0.92rem;">${escapeHtml(prod.title)}</strong>
                  <div style="font-size: 0.76rem; color: var(--admin-text-muted);">${escapeHtml(prod.price || 'On Request')}</div>
                </div>
              </div>
            </td>
            <td><span class="pill-badge pill-cat">${escapeHtml(prod.categoryName || prod.category)}</span></td>
            <td><span class="pill-badge">${escapeHtml(prod.badge || 'Standard')}</span></td>
            <td>
              <div class="table-actions">
                <a href="/product/${prod.slug || slugifyProd(prod.title, prod.id)}" target="_blank" class="admin-btn admin-btn-outline admin-btn-sm" style="color: #38bdf8; border-color: rgba(56, 189, 248, 0.4);" title="View Live Product Page">
                  <i class="fas fa-external-link-alt"></i>
                </a>
                <button type="button" class="admin-btn admin-btn-outline admin-btn-sm" onclick="window.adminCMS.editProduct('${prod.id}')" title="Edit">
                  <i class="fas fa-edit"></i>
                </button>
                <button type="button" class="admin-btn admin-btn-outline admin-btn-sm" style="color: var(--admin-danger);" onclick="window.adminCMS.deleteProduct('${prod.id}')" title="Delete">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        `).join('');
      }
    }

    // Recent Blogs in Dashboard (first 4)
    if (dashRecentBlogsTable) {
      if (blogs.length === 0) {
        dashRecentBlogsTable.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--admin-text-muted); padding: 24px;">No blog articles found. Click "Add Article" to publish one.</td></tr>`;
      } else {
        dashRecentBlogsTable.innerHTML = blogs.slice(0, 4).map(blog => `
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: 12px;">
                <img src="${escapeHtml(resolveAdminImgPath(blog.image))}" alt="${escapeHtml(blog.title)}" class="table-thumb" onerror="this.src='../images/about-3.jpg'">
                <strong style="color: #fff; font-size: 0.92rem;">${escapeHtml(blog.title)}</strong>
              </div>
            </td>
            <td><span class="pill-badge pill-cat">${escapeHtml(blog.tag || 'News')}</span></td>
            <td style="color: var(--admin-text-muted); font-size: 0.85rem;">${escapeHtml(blog.date || '-')}</td>
            <td style="color: var(--admin-text-muted); font-size: 0.85rem;">${escapeHtml(blog.author || 'Harichand Steel')}</td>
            <td>
              <div class="table-actions">
                <a href="${escapeHtml(resolveArticleUrl(blog.slug))}" target="_blank" class="admin-btn admin-btn-outline admin-btn-sm" style="color: #38bdf8; border-color: rgba(56, 189, 248, 0.4);" title="View Article Page">
                  <i class="fas fa-external-link-alt"></i>
                </a>
                <button type="button" class="admin-btn admin-btn-outline admin-btn-sm" onclick="window.adminCMS.editBlog('${blog.id}')" title="Edit">
                  <i class="fas fa-edit"></i>
                </button>
                <button type="button" class="admin-btn admin-btn-outline admin-btn-sm" style="color: var(--admin-danger);" onclick="window.adminCMS.deleteBlog('${blog.id}')" title="Delete">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        `).join('');
      }
    }
  }

  // ==========================================
  // 5. PRODUCTS MANAGER
  // ==========================================
    function renderProducts(page = null) {
    if (page !== null) {
      paginationState.products = page;
    }
    const products = CMS.getProducts();
    const searchTerm = (productSearchInput ? productSearchInput.value : '').toLowerCase().trim();
    const selectedCategory = productCategoryFilter ? productCategoryFilter.value : 'all';

    let filtered = products.filter(p => {
      const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
      const matchSearch = !searchTerm || 
        p.title.toLowerCase().includes(searchTerm) || 
        (p.description && p.description.toLowerCase().includes(searchTerm)) ||
        (Array.isArray(p.specs) && p.specs.some(s => s.toLowerCase().includes(searchTerm)));
      return matchCat && matchSearch;
    });

    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    if (paginationState.products > totalPages) paginationState.products = totalPages;
    if (paginationState.products < 1) paginationState.products = 1;
    const currentPage = paginationState.products;

    const startNum = totalItems === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const endNum = Math.min(currentPage * PAGE_SIZE, totalItems);

    if (productShowingCount) {
      productShowingCount.innerHTML = totalItems === 0
        ? 'Showing 0 items'
        : `Showing <strong>${startNum}–${endNum}</strong> of <strong>${totalItems}</strong> items`;
    }
    if (badgeProductCount) badgeProductCount.textContent = products.length;
    if (statTotalProducts) statTotalProducts.textContent = products.length;

    if (!productsTableBody) return;

    if (totalItems === 0) {
      productsTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--admin-text-muted); padding: 36px 16px;">
            <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 8px; display: block; opacity: 0.4;"></i>
            No products match your criteria.
          </td>
        </tr>`;
      renderAdminPagination('productsPagination', 0, 1, PAGE_SIZE, () => {});
      return;
    }

    const slice = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    productsTableBody.innerHTML = slice.map(prod => {
      const specsHtml = Array.isArray(prod.specs) && prod.specs.length > 0
        ? prod.specs.slice(0, 3).map(s => `<span class="pill-badge" style="font-size: 0.7rem; background: rgba(255,255,255,0.06); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.1); margin-right: 4px; margin-bottom: 2px;">${escapeHtml(s)}</span>`).join('')
        : '<span style="color: var(--admin-text-muted); font-size: 0.75rem;">-</span>';

      return `
        <tr>
          <td>
            <img src="${escapeHtml(resolveAdminImgPath(prod.image))}" alt="${escapeHtml(prod.title)}" class="table-thumb" onerror="this.src='../images/prod-1.png'">
          </td>
          <td>
            <strong style="color: #fff; font-size: 0.94rem; display: block;">${escapeHtml(prod.title)}</strong>
            <span style="font-size: 0.78rem; color: var(--admin-text-muted); line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;">
              ${escapeHtml(prod.description || '')}
            </span>
          </td>
          <td><span class="pill-badge pill-cat">${escapeHtml(prod.categoryName || prod.category)}</span></td>
          <td><span class="pill-badge">${escapeHtml(prod.badge || 'Standard')}</span></td>
          <td style="max-width: 220px;">${specsHtml}</td>
          <td><strong style="color: var(--admin-accent); font-size: 0.88rem;">${escapeHtml(prod.price || 'On Request')}</strong></td>
          <td style="text-align: right;">
            <div class="table-actions" style="justify-content: flex-end; gap: 6px;">
              <a href="/product/${prod.slug || slugifyProd(prod.title, prod.id)}" target="_blank" class="admin-btn admin-btn-outline admin-btn-sm" style="color: #38bdf8; border-color: rgba(56, 189, 248, 0.4);" title="View Live Product Page">
                <i class="fas fa-external-link-alt"></i> View
              </a>
              <button type="button" class="admin-btn admin-btn-outline admin-btn-sm" onclick="window.adminCMS.editProduct('${prod.id}')" title="Edit Product">
                <i class="fas fa-edit"></i>
              </button>
              <button type="button" class="admin-btn admin-btn-outline admin-btn-sm" style="color: var(--admin-danger);" onclick="window.adminCMS.deleteProduct('${prod.id}')" title="Delete Product">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    renderAdminPagination('productsPagination', totalItems, currentPage, PAGE_SIZE, (newPage) => {
      paginationState.products = newPage;
      updateAdminUrl('products', newPage, true);
      renderProducts();
    });
  }

  if (productSearchInput) productSearchInput.addEventListener("input", () => { paginationState.products = 1; updateAdminUrl("products", 1, false); renderProducts(); });
  if (productCategoryFilter) productCategoryFilter.addEventListener("change", () => { paginationState.products = 1; updateAdminUrl("products", 1, false); renderProducts(); });
  if (productCategoryFilter) productCategoryFilter.addEventListener('change', renderProducts);

  // Open Product Modal
  function openProductModal(prodOrId = null) {
    let prod = prodOrId;
    if (typeof prodOrId === 'string') {
      prod = CMS.getProducts().find(p => p.id === prodOrId || p.slug === prodOrId);
    }
    productForm.reset();
    if (prod) {
      productModalTitle.textContent = 'Edit Product';
      prodInputId.value = prod.id || '';
      prodInputTitle.value = prod.title || '';
      prodInputCategory.value = prod.category || 'aluminum-profile-gate';
      prodInputCategoryName.value = prod.categoryName || categoryTitleMap[prod.category] || 'Aluminum Profile Gate';
      prodInputBadge.value = prod.badge || '';
      prodInputPrice.value = prod.price || 'On Request';
      prodInputImage.value = prod.image || '';
      prodInputDescription.value = prod.description || '';
      prodInputSpecs.value = Array.isArray(prod.specs) ? prod.specs.join(', ') : (prod.specs || '');
      if (prodInputOuterFrame) prodInputOuterFrame.value = prod.outerFrame || '';
      if (prodInputInnerFrame) prodInputInnerFrame.value = prod.innerFrame || '';
      if (prodInputUsage) prodInputUsage.value = prod.usage || '';
      if (prodInputFinish) prodInputFinish.value = prod.finish || '';
      if (prodInputHardware) prodInputHardware.value = prod.hardware || '';
      if (prodInputAutomation) prodInputAutomation.value = prod.automation || '';
      prodInputFeatured.checked = !!prod.featured;
      updateImagePreview(prodImagePreview, prod.image);
    } else {
      productModalTitle.textContent = 'Add New Product';
      prodInputId.value = '';
      prodInputPrice.value = 'On Request';
      prodInputCategory.value = 'aluminum-profile-gate';
      prodInputCategoryName.value = 'Aluminum Profile Gate';
      prodInputBadge.value = 'New Arrival';
      prodInputImage.value = 'images/prod-1.png';
      prodInputDescription.value = '';
      prodInputSpecs.value = '';
      if (prodInputOuterFrame) prodInputOuterFrame.value = '';
      if (prodInputInnerFrame) prodInputInnerFrame.value = '';
      if (prodInputUsage) prodInputUsage.value = '';
      if (prodInputFinish) prodInputFinish.value = '';
      if (prodInputHardware) prodInputHardware.value = '';
      if (prodInputAutomation) prodInputAutomation.value = '';
      prodInputFeatured.checked = false;
      updateImagePreview(prodImagePreview, '../images/prod-1.png');
    }
    productModalOverlay.classList.add('active');
  }

    // Category change automatically syncs display name
  if (prodInputCategory) {
    prodInputCategory.addEventListener('change', function () {
      const selectedOption = this.options[this.selectedIndex];
      const title = categoryTitleMap[this.value] || (selectedOption ? selectedOption.text : '');
      if (prodInputCategoryName) {
        prodInputCategoryName.value = title;
      }
    });
  }

  // Live image preview helper
  function updateImagePreview(container, src) {
    if (!container) return;
    if (src) {
      container.innerHTML = `<img src="${escapeHtml(src)}" alt="Preview" onerror="this.onerror=null; this.src='../images/prod-1.png'">`;
    } else {
      container.innerHTML = `<span style="color: var(--admin-text-muted); font-size: 0.85rem;"><i class="fas fa-image"></i> Image Preview</span>`;
    }
  }

  if (prodInputImage) {
    prodInputImage.addEventListener('input', function () {
      updateImagePreview(prodImagePreview, this.value.trim());
    });
  }

  // File Upload via FileReader for immediate Base64 persistence
  if (prodFileInput) {
    prodFileInput.addEventListener('change', function () {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (e) {
        prodInputImage.value = e.target.result;
        updateImagePreview(prodImagePreview, e.target.result);
      };
      reader.readAsDataURL(file);
    });
  }

  // Submit Product Form
  if (productForm) {
    productForm.addEventListener('submit', function (e) {
      e.preventDefault();

      const title = prodInputTitle.value.trim();
      if (!title) {
        showToast('Please enter a product title', 'error');
        return;
      }

      const specsStr = prodInputSpecs.value.trim();
      const specsArray = specsStr
        ? specsStr.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      const categoryVal = prodInputCategory.value;
      const categoryNameVal = prodInputCategoryName.value.trim() || 
        prodInputCategory.options[prodInputCategory.selectedIndex].text;

      const productPayload = {
        id: prodInputId.value || undefined,
        title: title,
        category: categoryVal,
        categoryName: categoryNameVal,
        badge: prodInputBadge.value.trim() || 'Custom Built',
        price: prodInputPrice.value.trim() || 'On Request',
        image: prodInputImage.value.trim() || 'images/prod-1.png',
        description: prodInputDescription.value.trim(),
        specs: specsArray,
        outerFrame: prodInputOuterFrame ? prodInputOuterFrame.value.trim() : '',
        innerFrame: prodInputInnerFrame ? prodInputInnerFrame.value.trim() : '',
        usage: prodInputUsage ? prodInputUsage.value.trim() : '',
        finish: prodInputFinish ? prodInputFinish.value.trim() : '',
        hardware: prodInputHardware ? prodInputHardware.value.trim() : '',
        automation: prodInputAutomation ? prodInputAutomation.value.trim() : '',
        featured: prodInputFeatured.checked
      };

      CMS.saveProduct(productPayload);
      productModalOverlay.classList.remove('active');
      showToast(prodInputId.value ? 'Product updated successfully!' : 'New product created successfully!');
      renderProducts();
      renderDashboard();
    });
  }

  // Top and pane triggers for Add Product
  const btnOpenProductModal = document.getElementById('btnOpenProductModal');
  const btnOpenProductModalTop = document.getElementById('btnOpenProductModalTop');
  const dashBtnAddProduct = document.getElementById('dashBtnAddProduct');

  if (btnOpenProductModal) btnOpenProductModal.addEventListener('click', () => openProductModal());
  if (btnOpenProductModalTop) btnOpenProductModalTop.addEventListener('click', () => openProductModal());
  if (dashBtnAddProduct) dashBtnAddProduct.addEventListener('click', () => openProductModal());

  // ==========================================
  // 6. BLOGS MANAGER
  // ==========================================
  function getBlogsList() {
    let blogs = [];
    if (typeof CMS !== 'undefined' && typeof CMS.getBlogs === 'function') {
      blogs = CMS.getBlogs();
    } else if (window.CMSData && Array.isArray(window.CMSData.blogs)) {
      blogs = window.CMSData.blogs;
    }
    return Array.isArray(blogs) ? blogs : [];
  }

  let isFetchingBlogs = false;
  async function syncBlogsFromApi() {
    if (isFetchingBlogs) return;
    isFetchingBlogs = true;
    try {
      const res = await fetch('/api/blogs');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          if (typeof CMS !== 'undefined' && typeof CMS.saveBlog === 'function') {
            for (const b of data) {
              CMS.saveBlog(b);
            }
          }
          renderBlogs();
        }
      }
    } catch (_) {}
    finally {
      isFetchingBlogs = false;
    }
  }

  function renderBlogs(page = null) {
    if (page !== null) {
      paginationState.blogs = page;
    }
    const blogs = getBlogsList();
    if (blogs.length === 0) {
      syncBlogsFromApi();
    }

    const searchTerm = (blogSearchInput ? blogSearchInput.value : '').toLowerCase().trim();
    const selectedTag = blogTagFilter ? blogTagFilter.value : 'all';

    let filtered = blogs.filter(b => {
      const matchTag = selectedTag === 'all' || b.tag === selectedTag;
      const matchSearch = !searchTerm || 
        (b.title && b.title.toLowerCase().includes(searchTerm)) || 
        (b.excerpt && b.excerpt.toLowerCase().includes(searchTerm)) ||
        (b.content && b.content.toLowerCase().includes(searchTerm));
      return matchTag && matchSearch;
    });

    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    if (paginationState.blogs > totalPages) paginationState.blogs = totalPages;
    if (paginationState.blogs < 1) paginationState.blogs = 1;
    const currentPage = paginationState.blogs;

    const startNum = totalItems === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const endNum = Math.min(currentPage * PAGE_SIZE, totalItems);

    if (blogShowingCount) {
      blogShowingCount.innerHTML = totalItems === 0
        ? 'Showing 0 items'
        : `Showing <strong>${startNum}–${endNum}</strong> of <strong>${totalItems}</strong> items`;
    }
    if (badgeBlogCount) badgeBlogCount.textContent = blogs.length;
    if (statTotalBlogs) statTotalBlogs.textContent = blogs.length;

    const targetTbody = document.getElementById('blogsTableBody');
    if (!targetTbody) return;

    if (totalItems === 0) {
      targetTbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--admin-text-muted); padding: 36px 16px;">
            <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 8px; display: block; opacity: 0.4;"></i>
            No blog articles match your criteria.
          </td>
        </tr>`;
      renderAdminPagination('blogsPagination', 0, 1, PAGE_SIZE, () => {});
      return;
    }

    const slice = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    targetTbody.innerHTML = slice.map(blog => {
      return `
        <tr>
          <td><img src="${blog.image || '/images/about-3.jpg'}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 4px;"></td>
          <td><strong>${blog.title}</strong><br><small style="color: #888;">${blog.slug || ''}</small></td>
          <td><span class="badge" style="background: rgba(255,255,255,0.08); padding: 4px 8px; border-radius: 4px;">${blog.tag || 'Guide'}</span></td>
          <td>${blog.author || 'Harichand Steel Team'}</td>
          <td>${blog.date || 'Oct 30, 2026'}</td>
          <td>
            <a href="${blog.slug}" target="_blank" style="color: #58a6ff; text-decoration: none; margin-right: 10px;">Preview</a>
            <button type="button" onclick="window.adminCMS.editBlog('${blog.id}')" style="background:none; border:none; color: #f0883e; cursor:pointer; margin-right: 8px;">Edit</button>
            <button type="button" onclick="window.adminCMS.deleteBlog('${blog.id}')" style="background:none; border:none; color: #f85149; cursor:pointer;">Delete</button>
          </td>
        </tr>
      `;
    }).join('');

    renderAdminPagination('blogsPagination', totalItems, currentPage, PAGE_SIZE, (newPage) => {
      paginationState.blogs = newPage;
      updateAdminUrl('blogs', newPage, true);
      renderBlogs();
    });
  }

  if (blogSearchInput) blogSearchInput.addEventListener("input", () => { paginationState.blogs = 1; updateAdminUrl("blogs", 1, false); renderBlogs(); });
  if (blogTagFilter) blogTagFilter.addEventListener("change", () => { paginationState.blogs = 1; updateAdminUrl("blogs", 1, false); renderBlogs(); });

  // Open Blog Modal
  function openBlogModal(blog = null) {
    blogForm.reset();
    initBlogQuillEditor();

    if (blogModalContainer) {
      blogModalContainer.classList.remove('fullscreen');
      if (btnBlogFullscreen) {
        btnBlogFullscreen.innerHTML = '<i class="fas fa-expand"></i> Fullscreen';
      }
    }

    if (blog) {
      blogModalTitle.textContent = 'Edit Blog Article';
      blogInputId.value = blog.id || '';
      blogInputTitle.value = blog.title || '';
      blogInputSlug.value = resolveArticleUrl(blog.slug || '/news.html');
      blogInputTag.value = blog.tag || 'Design Guide';
      blogInputAuthor.value = blog.author || 'Harichand Steel Team';
      blogInputDate.value = blog.date || '';
      blogInputImage.value = blog.image || '';
      blogInputExcerpt.value = blog.excerpt || '';
      if (blogQuillInstance) {
        blogQuillInstance.root.innerHTML = blog.content || '';
      }
      if (blogInputContent) {
        blogInputContent.value = blog.content || '';
      }
      blogInputPublished.checked = blog.published !== false;
      updateImagePreview(blogImagePreview, blog.image);
    } else {
      blogModalTitle.textContent = 'Add New Blog Article';
      blogInputId.value = '';
      blogInputSlug.value = '/news.html';
      blogInputTag.value = 'Design Guide';
      blogInputAuthor.value = 'Harichand Steel Team';
      blogInputDate.value = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      blogInputImage.value = 'images/about-3.jpg';
      if (blogQuillInstance) {
        blogQuillInstance.root.innerHTML = '';
      }
      if (blogInputContent) {
        blogInputContent.value = '';
      }
      blogInputPublished.checked = true;
      updateImagePreview(blogImagePreview, '../images/about-3.jpg');
    }
    blogModalOverlay.classList.add('active');
  }

  if (blogInputImage) {
    blogInputImage.addEventListener('input', function () {
      updateImagePreview(blogImagePreview, this.value.trim());
    });
  }

  if (blogFileInput) {
    blogFileInput.addEventListener('change', function () {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (e) {
        blogInputImage.value = e.target.result;
        updateImagePreview(blogImagePreview, e.target.result);
      };
      reader.readAsDataURL(file);
    });
  }

  if (blogForm) {
    blogForm.addEventListener('submit', function (e) {
      e.preventDefault();

      const title = blogInputTitle.value.trim();
      const excerpt = blogInputExcerpt.value.trim();
      if (!title || !excerpt) {
        showToast('Please enter both article title and excerpt', 'error');
        return;
      }

      if (blogQuillInstance) {
        document.getElementById('blogInputContent').value = blogQuillInstance.root.innerHTML;
      }
      const content = document.getElementById('blogInputContent') ? document.getElementById('blogInputContent').value : (blogQuillInstance ? blogQuillInstance.root.innerHTML : '');

      const blogPayload = {
        id: blogInputId.value || undefined,
        title: title,
        slug: resolveArticleUrl(blogInputSlug.value.trim() || '/news.html'),
        tag: blogInputTag.value.trim() || 'Design Guide',
        author: blogInputAuthor.value.trim() || 'Harichand Steel Team',
        date: blogInputDate.value.trim() || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        image: blogInputImage.value.trim() || 'images/about-3.jpg',
        excerpt: excerpt,
        content: content,
        published: blogInputPublished.checked
      };

      CMS.saveBlog(blogPayload);
      blogModalOverlay.classList.remove('active');
      showToast(blogInputId.value ? 'Article updated successfully!' : 'New article published successfully!');
      renderBlogs();
      renderDashboard();
    });
  }

  const btnOpenBlogModal = document.getElementById('btnOpenBlogModal');
  const btnOpenBlogModalTop = document.getElementById('btnOpenBlogModalTop');
  const dashBtnAddBlog = document.getElementById('dashBtnAddBlog');

  if (btnOpenBlogModal) btnOpenBlogModal.addEventListener('click', () => openBlogModal());
  if (btnOpenBlogModalTop) btnOpenBlogModalTop.addEventListener('click', () => openBlogModal());
  if (dashBtnAddBlog) dashBtnAddBlog.addEventListener('click', () => openBlogModal());

  // Auto-generate slug from blog title
  if (blogInputTitle) {
    blogInputTitle.addEventListener('input', function () {
      if (!blogInputId.value || !blogInputSlug.value || blogInputSlug.value === '/news.html') {
        const slugified = '/' + this.value.toString().toLowerCase().trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') + '.html';
        if (blogInputSlug) {
          blogInputSlug.value = slugified === '/.html' ? '/news.html' : slugified;
        }
      }
    });
  }

  // Blog modal fullscreen focus mode toggle
  if (btnBlogFullscreen && blogModalContainer) {
    btnBlogFullscreen.addEventListener('click', function () {
      blogModalContainer.classList.toggle('fullscreen');
      const isFull = blogModalContainer.classList.contains('fullscreen');
      btnBlogFullscreen.innerHTML = isFull
        ? '<i class="fas fa-compress"></i> Exit Fullscreen'
        : '<i class="fas fa-expand"></i> Fullscreen';
    });
  }

  // Open Fullscreen writer directly from blogs tab header
  if (btnBlogOpenFullscreenModal) {
    btnBlogOpenFullscreenModal.addEventListener('click', function () {
      openBlogModal();
      if (blogModalContainer) {
        blogModalContainer.classList.add('fullscreen');
        if (btnBlogFullscreen) {
          btnBlogFullscreen.innerHTML = '<i class="fas fa-compress"></i> Exit Fullscreen';
        }
      }
    });
  }

  // Preview button inside blog modal (opens in new tab)
  if (btnPreviewCurrentBlog) {
    btnPreviewCurrentBlog.addEventListener('click', function () {
      const slugVal = blogInputSlug ? blogInputSlug.value.trim() : '/news.html';
      const url = resolveArticleUrl(slugVal || '/news.html');
      window.open(url, '_blank');
    });
  }

  // ==========================================
  // 7. INQUIRIES LEADS MANAGER
  // ==========================================
  let isFetchingInquiries = false;
  async function syncInquiriesFromApi() {
    if (isFetchingInquiries) return;
    isFetchingInquiries = true;
    try {
      const adminKey = (typeof window !== 'undefined' && window.ADMIN_API_KEY) || localStorage.getItem('hs_admin_api_key') || 'hs_admin_secret_key_2026';
      const res = await fetch('/api/inquiries', {
        headers: {
          'x-admin-key': adminKey,
          'Authorization': `Bearer ${adminKey}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          localStorage.setItem('hs_cms_inquiries', JSON.stringify(data));
          renderInquiries(false);
        }
      }
    } catch (_) {}
    finally {
      isFetchingInquiries = false;
    }
  }

  function renderInquiries(triggerSync = true) {
    if (triggerSync) {
      syncInquiriesFromApi();
    }
    const inquiries = CMS.getInquiries();
    if (badgeInquiryCount) badgeInquiryCount.textContent = inquiries.length;
    if (statTotalInquiries) statTotalInquiries.textContent = inquiries.length;

    if (!inquiriesTableBody) return;

    if (inquiries.length === 0) {
      inquiriesTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--admin-text-muted); padding: 36px 16px;">
            <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 8px; display: block; opacity: 0.4;"></i>
            No inquiries logged yet. Submissions from Contact Us and Quote Estimator will appear here.
          </td>
        </tr>`;
      return;
    }

    inquiriesTableBody.innerHTML = inquiries.map(inq => {
      const cleanPhone = (inq.phone || '').replace(/[^0-9]/g, '');
      const waLink = cleanPhone ? `https://wa.me/91${cleanPhone.slice(-10)}` : '#';

      return `
        <tr>
          <td style="color: var(--admin-text-muted); font-size: 0.82rem;">${escapeHtml(inq.timestamp || '-')}</td>
          <td><strong style="color: #fff;">${escapeHtml(inq.name || 'Anonymous')}</strong></td>
          <td><a href="tel:${escapeHtml(inq.phone || '')}" style="color: #93c5fd; text-decoration: none;">${escapeHtml(inq.phone || '-')}</a></td>
          <td style="color: var(--admin-text-muted);">${escapeHtml(inq.email || '-')}</td>
          <td><span class="pill-badge pill-cat">${escapeHtml(inq.requirement || inq.service || 'General Inquiry')}</span></td>
          <td style="max-width: 260px; font-size: 0.85rem; color: #cbd5e1;">${escapeHtml(inq.message || '-')}</td>
          <td>
            ${cleanPhone ? `
              <a href="${waLink}" target="_blank" class="admin-btn admin-btn-outline admin-btn-sm" style="color: #22c55e; border-color: rgba(34, 197, 94, 0.4);">
                <i class="fab fa-whatsapp"></i> Chat
              </a>
            ` : '-'}
          </td>
        </tr>
      `;
    }).join('');
  }

  // Export Leads to CSV
  const btnExportInquiries = document.getElementById('btnExportInquiries');
  if (btnExportInquiries) {
    btnExportInquiries.addEventListener('click', function () {
      const inquiries = CMS.getInquiries();
      if (inquiries.length === 0) {
        showToast('No inquiries to export.', 'error');
        return;
      }

      let csv = 'Date,Name,Phone,Email,Requirement,Message\n';
      inquiries.forEach(inq => {
        const row = [
          `"${(inq.timestamp || '').replace(/"/g, '""')}"`,
          `"${(inq.name || '').replace(/"/g, '""')}"`,
          `"${(inq.phone || '').replace(/"/g, '""')}"`,
          `"${(inq.email || '').replace(/"/g, '""')}"`,
          `"${(inq.requirement || inq.service || '').replace(/"/g, '""')}"`,
          `"${(inq.message || '').replace(/"/g, '""')}"`
        ];
        csv += row.join(',') + '\n';
      });

      downloadFile(csv, `harichand-steel-leads-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
      showToast('Leads CSV exported successfully!');
    });
  }

  // Clear Inquiries
  const btnClearInquiries = document.getElementById('btnClearInquiries');
  if (btnClearInquiries) {
    btnClearInquiries.addEventListener('click', function () {
      openConfirmModal(
        'Clear All Inquiries?',
        'Are you sure you want to delete all recorded inquiries? This action cannot be undone.',
        function () {
          localStorage.setItem('hs_cms_inquiries', JSON.stringify([]));
          renderInquiries();
          renderDashboard();
          showToast('Inquiries cleared.');
        }
      );
    });
  }

  // ==========================================
  // 8. BACKUP, RESTORE & RESET
  // ==========================================
  function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  function triggerBackupDownload() {
    const backupJson = CMS.exportData();
    const dateStr = new Date().toISOString().split('T')[0];
    downloadFile(backupJson, `harichand-steel-cms-backup-${dateStr}.json`, 'application/json');
    showToast('CMS backup downloaded successfully!');
  }

  const btnDownloadBackupFile = document.getElementById('btnDownloadBackupFile');
  const dashBtnBackup = document.getElementById('dashBtnBackup');
  if (btnDownloadBackupFile) btnDownloadBackupFile.addEventListener('click', triggerBackupDownload);
  if (dashBtnBackup) dashBtnBackup.addEventListener('click', triggerBackupDownload);

  // Restore Backup
  const btnTriggerImportFile = document.getElementById('btnTriggerImportFile');
  const importFileInput = document.getElementById('importFileInput');

  if (btnTriggerImportFile && importFileInput) {
    btnTriggerImportFile.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', function () {
      const file = this.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function (e) {
        const ok = CMS.importData(e.target.result);
        if (ok) {
          showToast('Data restored successfully!');
          renderDashboard();
          renderProducts();
          renderBlogs();
          renderInquiries();
        } else {
          showToast('Failed to parse backup JSON. Invalid format.', 'error');
        }
      };
      reader.readAsText(file);
    });
  }

  // Reset to default seeds
  const btnResetToDefaults = document.getElementById('btnResetToDefaults');
  if (btnResetToDefaults) {
    btnResetToDefaults.addEventListener('click', function () {
      openConfirmModal(
        'Reset to Default Catalog?',
        'This will replace your current products and blog posts with the official default Harichand Steel live site data. Are you sure?',
        function () {
          CMS.resetToDefault();
          showToast('CMS restored to default live catalog.');
          renderDashboard();
          renderProducts();
          renderBlogs();
        }
      );
    });
  }

  // Global search input in topbar
  if (globalSearchInput) {
    globalSearchInput.addEventListener('input', function () {
      const query = this.value.trim();
      if (!query) return;

      // Automatically route to products or blogs tab depending on context
      if (currentActiveTab === 'dashboard' || currentActiveTab === 'settings') {
        switchTab('products');
      }
      if (currentActiveTab === 'products' && productSearchInput) {
        productSearchInput.value = query;
        renderProducts();
      } else if (currentActiveTab === 'blogs' && blogSearchInput) {
        blogSearchInput.value = query;
        renderBlogs();
      }
    });
  }

  // Global public API for inline table button actions
  window.adminCMS = {
    editProduct: function (id) {
      const prod = CMS.getProducts().find(p => p.id === id);
      if (prod) openProductModal(prod);
    },
    deleteProduct: function (id) {
      const prod = CMS.getProducts().find(p => p.id === id);
      const name = prod ? prod.title : 'this item';
      openConfirmModal(
        'Delete Product?',
        `Are you sure you want to permanently delete "${name}"?`,
        function () {
          CMS.deleteProduct(id);
          showToast(`Product "${name}" deleted.`);
          renderProducts();
          renderDashboard();
        }
      );
    },
    editBlog: function (id) {
      const blogs = getBlogsList();
      const blog = blogs.find(b => b.id === id);
      if (blog) openBlogModal(blog);
    },
    deleteBlog: function (id) {
      const blogs = getBlogsList();
      const blog = blogs.find(b => b.id === id);
      const name = blog ? blog.title : 'this article';
      openConfirmModal(
        'Delete Blog Article?',
        `Are you sure you want to permanently delete "${name}"?`,
        function () {
          CMS.deleteBlog(id);
          showToast(`Article "${name}" deleted.`);
          renderBlogs();
          renderDashboard();
        }
      );
    }
  };

  async function checkDbStatus() {
    try {
      const res = await fetch('/api/db-status');
      if (res.ok) {
        const data = await res.json();
        const statElem = document.getElementById('statDbSync');
        const iconElem = document.getElementById('statDbIcon');
        const badgeElem = document.getElementById('badgeSupabaseStatus');
        const topbarBadge = document.getElementById('topbarDbStatusBadge');
        const topbarText = document.getElementById('topbarDbStatusText');

        const isConnected = data.status === 'connected' || data.connected === true;

        if (isConnected) {
          if (topbarBadge) {
            topbarBadge.style.background = 'rgba(34, 197, 94, 0.15)';
            topbarBadge.style.color = '#22c55e';
            topbarBadge.style.borderColor = 'rgba(34, 197, 94, 0.3)';
            const dot = topbarBadge.querySelector('.db-badge-dot');
            if (dot) dot.style.background = '#22c55e';
          }
          if (topbarText) {
            topbarText.textContent = 'Supabase / Connected';
          }
          if (statElem) {
            statElem.innerHTML = '<i class="fas fa-database" style="color:#22c55e;"></i> Supabase PostgreSQL';
          }
          if (iconElem) {
            iconElem.style.background = 'rgba(34, 197, 94, 0.15)';
            iconElem.style.color = '#22c55e';
          }
          if (badgeElem) {
            badgeElem.textContent = 'Supabase PostgreSQL Connected';
            badgeElem.style.background = 'rgba(34, 197, 94, 0.15)';
            badgeElem.style.color = '#22c55e';
            badgeElem.style.borderColor = 'rgba(34, 197, 94, 0.3)';
          }
        } else {
          // Local fallback / JSON
          if (topbarBadge) {
            topbarBadge.style.background = 'rgba(245, 158, 11, 0.15)';
            topbarBadge.style.color = '#f59e0b';
            topbarBadge.style.borderColor = 'rgba(245, 158, 11, 0.3)';
            const dot = topbarBadge.querySelector('.db-badge-dot');
            if (dot) dot.style.background = '#f59e0b';
          }
          if (topbarText) {
            topbarText.textContent = 'JSON / Local Fallback';
          }
          if (statElem) {
            statElem.innerHTML = '<span style="font-size:0.92rem; color:#f59e0b;"><i class="fas fa-file-code"></i> Local JSON Storage</span>';
          }
          if (iconElem) {
            iconElem.style.background = 'rgba(245, 158, 11, 0.15)';
            iconElem.style.color = '#f59e0b';
          }
          if (badgeElem) {
            badgeElem.textContent = 'Local JSON Fallback Active';
            badgeElem.style.background = 'rgba(245, 158, 11, 0.15)';
            badgeElem.style.color = '#f59e0b';
            badgeElem.style.borderColor = 'rgba(245, 158, 11, 0.3)';
          }
        }
      }
    } catch (_) {
      // offline / file:// mode
    }
  }

  // Initial render
  // Initial active tab & page resolution from URL
  const initial = parseAdminUrl();
  if (paginationState[initial.section] !== undefined) {
    paginationState[initial.section] = initial.page;
  }
  switchTab(initial.section, false);
  renderBlogs();
  checkDbStatus();
});
