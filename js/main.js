/**
 * HARICHAND STEEL - Redesign Interactive Logic
 * Pure ES6 JavaScript - Zero dependencies
 * Integrated with Harichand Steel CMS Engine
 */

function getAppUrl(subPath) {
  const clean = String(subPath || '').replace(/^\/+/, '');
  const base = (typeof document !== 'undefined' && document.querySelector('base') && document.querySelector('base').getAttribute('href')) || '/';
  if (!base || base === '/') return '/' + clean;
  return base.endsWith('/') ? base + clean : base + '/' + clean;
}

function getImageUrl(imgPath) {
  if (!imgPath) return '/images/prod-1.png';
  if (imgPath.startsWith('http://') || imgPath.startsWith('https://') || imgPath.startsWith('//') || imgPath.startsWith('data:')) {
    return imgPath;
  }
  const clean = String(imgPath).replace(/^\.?\/+/, '');
  return '/' + clean;
}

const BASE_PATH = getAppUrl('');

document.addEventListener('DOMContentLoaded', () => {
  initHeroSlider();
  initStickyHeader();
  initMobileNav();
  initQuoteEstimator();
  initModal();
  initScrollTop();

  // CMS dynamic hydration
  if (typeof CMS !== 'undefined') {
    hydrateProductsFromCMS();
    hydrateNewsFromCMS();
  } else {
    initProductFilter();
  }
});

/* ==========================================================================
   HERO SLIDER
   ========================================================================== */
function initHeroSlider() {
  const slides = document.querySelectorAll('.slide');
  const dots = document.querySelectorAll('.slider-dot');
  const prevBtn = document.querySelector('.slider-btn.prev');
  const nextBtn = document.querySelector('.slider-btn.next');

  if (!slides.length) return;

  let currentIndex = 0;
  let slideInterval = null;
  const slideDuration = 5500;

  function showSlide(index) {
    slides.forEach((s, i) => {
      s.classList.toggle('active', i === index);
    });
    dots.forEach((d, i) => {
      d.classList.toggle('active', i === index);
    });
    currentIndex = index;
  }

  function nextSlide() {
    let next = (currentIndex + 1) % slides.length;
    showSlide(next);
  }

  function prevSlide() {
    let prev = (currentIndex - 1 + slides.length) % slides.length;
    showSlide(prev);
  }

  function startAutoPlay() {
    stopAutoPlay();
    slideInterval = setInterval(nextSlide, slideDuration);
  }

  function stopAutoPlay() {
    if (slideInterval) clearInterval(slideInterval);
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      nextSlide();
      startAutoPlay();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      prevSlide();
      startAutoPlay();
    });
  }

  dots.forEach((dot, idx) => {
    dot.addEventListener('click', () => {
      showSlide(idx);
      startAutoPlay();
    });
  });

  const heroSection = document.querySelector('.hero-slider-section');
  if (heroSection) {
    heroSection.addEventListener('mouseenter', stopAutoPlay);
    heroSection.addEventListener('mouseleave', startAutoPlay);
  }

  startAutoPlay();
}

/* ==========================================================================
   STICKY HEADER SCROLL EFFECT
   ========================================================================== */
function initStickyHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
}

/* ==========================================================================
   MOBILE NAVIGATION DRAWER & DROPDOWNS
   ========================================================================== */
function initMobileNav() {
  const toggleBtn = document.querySelector('.mobile-menu-btn');
  const nav = document.querySelector('.main-nav');
  const dropdownToggles = document.querySelectorAll('.nav-item.has-dropdown > .nav-link');

  if (toggleBtn && nav) {
    toggleBtn.addEventListener('click', () => {
      nav.classList.toggle('open');
      const icon = toggleBtn.querySelector('i');
      if (icon) {
        if (nav.classList.contains('open')) {
          icon.className = 'fas fa-times';
        } else {
          icon.className = 'fas fa-bars';
        }
      }
    });
  }

  dropdownToggles.forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      if (window.innerWidth <= 960) {
        e.preventDefault();
        const parent = toggle.closest('.nav-item');
        const dropdown = parent.querySelector('.dropdown-menu');
        if (dropdown) {
          dropdown.classList.toggle('show');
        }
      }
    });
  });

  // Close nav on click outside
  document.addEventListener('click', (e) => {
    if (nav && nav.classList.contains('open') && !nav.contains(e.target) && !toggleBtn.contains(e.target)) {
      nav.classList.remove('open');
      const icon = toggleBtn.querySelector('i');
      if (icon) icon.className = 'fas fa-bars';
    }
  });
}

/* ==========================================================================
   PRODUCT FILTER TABS & PAGINATION CONTROLLER
   - 9 items per page chunking
   - Full pagination controls: [←] [1] [2] [3] [4] [→] with .active styling
   - Breadcrumb page status: "Home / Product / Page X" when page > 1
   - Results counter: "Showing X–Y of Z results"
   - Clean URL routing: /product/page/:num/ via history.pushState & popstate
   ========================================================================== */
function initProductFilter() {
  const filterContainers = document.querySelectorAll('.product-filters');
  const cards = Array.from(document.querySelectorAll('.product-cards-grid .product-card'));

  if (!filterContainers.length || !cards.length) return;

  // Base URL resolution for GitHub Pages vs Localhost/Production
  const BASE_PATH = (document.querySelector('base') && document.querySelector('base').getAttribute('href')) || '/';

  const PAGE_SIZE = 9;

  // Helper: extract page number from clean URL pathname or query parameters
  function getPageFromUrl() {
    const path = window.location.pathname || '';
    const match = path.match(/\/(?:product|product-category\/[^\/]+)\/page\/(\d+)\/?/i);
    if (match && match[1]) {
      const p = parseInt(match[1], 10);
      if (!isNaN(p) && p >= 1) return p;
    }
    const params = new URLSearchParams(window.location.search || '');
    if (params.has('page')) {
      const p = parseInt(params.get('page'), 10);
      if (!isNaN(p) && p >= 1) return p;
    }
    return 1;
  }

  // Helper: extract category slug from clean URL pathname (/product-category/:slug/) or hash
  function getCategoryFromUrl() {
    const path = window.location.pathname || '';
    const catMatch = path.match(/\/product-category\/([a-zA-Z0-9_-]+)/i);
    if (catMatch && catMatch[1]) {
      return catMatch[1].toLowerCase();
    }
    const hash = window.location.hash ? window.location.hash.substring(1).toLowerCase() : '';
    return hash;
  }

  filterContainers.forEach(container => {
    const filterBtns = container.querySelectorAll('.filter-btn');
    if (!filterBtns.length) return;

    // Detect if this page has pagination elements (product catalogue)
    const paginationContainer = document.getElementById('cataloguePagination') ||
                                document.querySelector('.catalogue-pagination');
    const paginationList = paginationContainer ? paginationContainer.querySelector('.pagination-list') : null;
    const breadcrumbNav = document.getElementById('catalogueBreadcrumbs') ||
                          document.querySelector('.breadcrumb-nav');
    const countSummary = container.parentElement.querySelector('.product-results-count') ||
                         document.querySelector('.product-results-count');

    // 1. Calculate live counts for each category
    const categoryCounts = { all: cards.length };
    cards.forEach(card => {
      const cat = card.getAttribute('data-category');
      if (cat) {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      }
    });

    // 2. Update filter button text with exact count badges
    filterBtns.forEach(btn => {
      const filter = btn.getAttribute('data-filter') || 'all';
      const count = categoryCounts[filter] || 0;

      let baseLabel = btn.getAttribute('data-label');
      if (!baseLabel) {
        baseLabel = btn.textContent.replace(/\s*\(\d+\)\s*$/, '').trim();
        btn.setAttribute('data-label', baseLabel);
      }

      btn.innerHTML = `${baseLabel} <span class="filter-count">(${count})</span>`;
    });

    // Current State
    let currentFilter = 'all';
    let currentPage = paginationContainer ? getPageFromUrl() : 1;

    // Category Metadata Dictionary for dynamic heading, lead text, breadcrumb, and titles
    const CATEGORY_META = {
      'all': {
        title: 'Gate Products Catalogue',
        lead: 'Explore premium handcrafted gate models built for luxury, safety, and longevity.',
        breadcrumb: 'Product',
        docTitle: 'Gate Products Catalogue - HARICHAND STEEL'
      },
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

    // Helper: get display label for category
    function getCategoryLabel(filterKey) {
      if (!filterKey || filterKey === 'all') return 'All Gates';
      const btn = Array.from(filterBtns).find(b => b.getAttribute('data-filter') === filterKey);
      if (btn) {
        return btn.getAttribute('data-label') || btn.textContent.replace(/\s*\(\d+\)\s*$/, '').trim();
      }
      return filterKey.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    // Helper: get full metadata for category
    function getCategoryMeta(filterKey) {
      if (!filterKey || filterKey === 'all') return CATEGORY_META['all'];
      if (CATEGORY_META[filterKey]) return CATEGORY_META[filterKey];
      const fallbackLabel = getCategoryLabel(filterKey);
      return {
        title: fallbackLabel,
        lead: `Explore our premium handcrafted ${fallbackLabel.toLowerCase()} collection built for luxury, safety, and longevity.`,
        breadcrumb: fallbackLabel,
        docTitle: `${fallbackLabel} - HARICHAND STEEL`
      };
    }

    // Helper: update page banner header and subtitle dynamically
    function updateBannerHeader(page) {
      const bannerTitle = document.getElementById('cataloguePageTitle') || document.querySelector('.page-header-banner .page-title');
      const bannerLead = document.getElementById('cataloguePageLead') || document.querySelector('.page-header-banner .page-lead');
      const meta = getCategoryMeta(currentFilter);

      if (bannerTitle) {
        const fullTitle = meta.title + (page > 1 ? ` (Page ${page})` : '');
        if (bannerTitle.textContent !== fullTitle) {
          bannerTitle.textContent = fullTitle;
        }
      }
      if (bannerLead) {
        if (bannerLead.textContent !== meta.lead) {
          bannerLead.textContent = meta.lead;
        }
      }
    }

    // 3. Render Breadcrumbs & Title
    function renderBreadcrumbs(page) {
      if (!breadcrumbNav) return;
      const isFiltered = currentFilter && currentFilter !== 'all';
      const meta = getCategoryMeta(currentFilter);
      const breadcrumbLabel = meta.breadcrumb || getCategoryLabel(currentFilter);

      if (isFiltered) {
        if (page > 1) {
          breadcrumbNav.innerHTML = `
            <a href="./">Home</a>
            <span class="sep"><i class="fas fa-chevron-right"></i></span>
            <a href="product/">Product</a>
            <span class="sep"><i class="fas fa-chevron-right"></i></span>
            <a href="product-category/${currentFilter}/">${breadcrumbLabel}</a>
            <span class="sep"><i class="fas fa-chevron-right"></i></span>
            <span>Page ${page}</span>
          `;
          document.title = `${meta.title} - Page ${page} - HARICHAND STEEL`;
        } else {
          breadcrumbNav.innerHTML = `
            <a href="/">Home</a>
            <span class="sep"><i class="fas fa-chevron-right"></i></span>
            <a href="/product/">Product</a>
            <span class="sep"><i class="fas fa-chevron-right"></i></span>
            <span>${breadcrumbLabel}</span>
          `;
          document.title = `${meta.title} - HARICHAND STEEL`;
        }
      } else {
        if (page > 1) {
          breadcrumbNav.innerHTML = `
            <a href="/">Home</a>
            <span class="sep"><i class="fas fa-chevron-right"></i></span>
            <a href="/product/">Product</a>
            <span class="sep"><i class="fas fa-chevron-right"></i></span>
            <span>Page ${page}</span>
          `;
          document.title = `Product - Page ${page} - HARICHAND STEEL`;
        } else {
          breadcrumbNav.innerHTML = `
            <a href="/">Home</a>
            <span class="sep"><i class="fas fa-chevron-right"></i></span>
            <span>Product</span>
          `;
          document.title = 'Gate Products Catalogue - HARICHAND STEEL';
        }
      }
    }

    // 4. Render Pagination UI
    function renderPaginationUI(totalPages, page) {
      if (!paginationContainer || !paginationList) return;

      if (totalPages <= 1) {
        paginationContainer.style.display = 'none';
        paginationList.innerHTML = '';
        return;
      }

      paginationContainer.style.display = 'flex';
      let html = '';

      // [←] Previous button
      const isFirst = page <= 1;
      let prevUrl;
      if (currentFilter && currentFilter !== 'all') {
        prevUrl = page > 2 ? `/product-category/${currentFilter}/page/${page - 1}/` : `/product-category/${currentFilter}/`;
      } else {
        prevUrl = page > 2 ? `/product/page/${page - 1}/` : '/product/';
      }

      html += `
        <li class="page-item ${isFirst ? 'disabled' : ''}">
          <a href="${isFirst ? '#' : prevUrl}" class="page-link" data-page="${page - 1}" aria-label="Previous Page" ${isFirst ? 'tabindex="-1" aria-disabled="true"' : ''}>
            <i class="fas fa-chevron-left"></i>
          </a>
        </li>
      `;

      // [1] [2] [3] ... [totalPages] Numbered buttons
      for (let p = 1; p <= totalPages; p++) {
        const isActive = p === page;
        let pageUrl;
        if (currentFilter && currentFilter !== 'all') {
          pageUrl = p === 1 ? `/product-category/${currentFilter}/` : `/product-category/${currentFilter}/page/${p}/`;
        } else {
          pageUrl = p === 1 ? '/product/' : `/product/page/${p}/`;
        }
        html += `
          <li class="page-item ${isActive ? 'active' : ''}" ${isActive ? 'aria-current="page"' : ''}>
            <a href="${pageUrl}" class="page-link" data-page="${p}">${p}</a>
          </li>
        `;
      }

      // [→] Next button
      const isLast = page >= totalPages;
      let nextUrl;
      if (currentFilter && currentFilter !== 'all') {
        nextUrl = `/product-category/${currentFilter}/page/${page + 1}/`;
      } else {
        nextUrl = `/product/page/${page + 1}/`;
      }

      html += `
        <li class="page-item ${isLast ? 'disabled' : ''}">
          <a href="${isLast ? '#' : nextUrl}" class="page-link" data-page="${page + 1}" aria-label="Next Page" ${isLast ? 'tabindex="-1" aria-disabled="true"' : ''}>
            <i class="fas fa-chevron-right"></i>
          </a>
        </li>
      `;

      paginationList.innerHTML = html;

      // Attach click listeners to pagination links
      paginationList.querySelectorAll('.page-link').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const pageItem = link.closest('.page-item');
          if (pageItem && (pageItem.classList.contains('disabled') || pageItem.classList.contains('active'))) {
            return;
          }
          const targetPage = parseInt(link.getAttribute('data-page'), 10);
          if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPages && targetPage !== currentPage) {
            currentPage = targetPage;
            applyDisplay(true, true); // pushHistory = true, scrollUp = true
          }
        });
      });
    }

    // 5. Apply Display (Filtering + Pagination Chunking)
    function applyDisplay(pushHistory = false, scrollUp = false) {
      // Find matching cards for the selected category
      const matchingCards = cards.filter(card => {
        const cat = card.getAttribute('data-category');
        return currentFilter === 'all' || cat === currentFilter;
      });

      const totalItems = matchingCards.length;

      if (paginationContainer) {
        const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIndex = (currentPage - 1) * PAGE_SIZE;
        const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);

        // Hide all non-matching cards
        cards.forEach(card => {
          if (!matchingCards.includes(card)) {
            card.style.display = 'none';
            card.style.opacity = '0';
          }
        });

        // Show only matching cards within current page slice
        matchingCards.forEach((card, index) => {
          if (index >= startIndex && index < endIndex) {
            card.style.display = 'flex';
            setTimeout(() => { card.style.opacity = '1'; }, 20);
          } else {
            card.style.display = 'none';
            card.style.opacity = '0';
          }
        });

        // Update Results Counter: "Showing X–Y of Z results"
        if (countSummary) {
          if (totalItems === 0) {
            countSummary.innerHTML = 'Showing 0 results';
          } else {
            countSummary.innerHTML = `Showing <strong>${startIndex + 1}–${endIndex}</strong> of <strong>${totalItems}</strong> results`;
          }
        }

        // Update Banner Heading & Description
        updateBannerHeader(currentPage);

        // Update Breadcrumbs
        renderBreadcrumbs(currentPage);

        // Update Pagination Controls
        renderPaginationUI(totalPages, currentPage);

        // Update Clean URL via history.pushState
        if (pushHistory && window.history && window.history.pushState) {
          let cleanUrl;
          if (currentFilter && currentFilter !== 'all') {
            cleanUrl = currentPage > 1 ? getAppUrl(`product-category/${currentFilter}/page/${currentPage}/`) : getAppUrl(`product-category/${currentFilter}/`);
          } else {
            cleanUrl = currentPage > 1 ? getAppUrl(`product/page/${currentPage}/`) : getAppUrl('product/');
          }
          try {
            const currentFullPath = window.location.pathname + window.location.search;
            if (currentFullPath !== cleanUrl) {
              window.history.pushState({ page: currentPage, filter: currentFilter }, '', cleanUrl);
            }
          } catch (err) {
            console.warn('pushState error:', err);
          }
        }

        // Smooth scroll to top of catalogue grid
        if (scrollUp) {
          const scrollTarget = container.closest('.section') || container;
          if (scrollTarget) {
            const topOffset = scrollTarget.getBoundingClientRect().top + window.pageYOffset - 80;
            window.scrollTo({ top: Math.max(0, topOffset), behavior: 'smooth' });
          }
        }
      } else {
        // Fallback for non-paginated views (e.g. homepage)
        let visibleCount = 0;
        cards.forEach(card => {
          const cat = card.getAttribute('data-category');
          const matches = (currentFilter === 'all' || cat === currentFilter);
          if (matches) {
            visibleCount++;
            card.style.display = 'flex';
            setTimeout(() => { card.style.opacity = '1'; }, 20);
          } else {
            card.style.display = 'none';
            card.style.opacity = '0';
          }
        });

        if (countSummary) {
          if (currentFilter === 'all') {
            countSummary.innerHTML = `Showing all <strong>${visibleCount}</strong> designs in catalogue`;
          } else {
            const activeLabel = getCategoryLabel(currentFilter);
            countSummary.innerHTML = `Showing <strong>${visibleCount}</strong> of <strong>${cards.length}</strong> results in <em>${activeLabel}</em>`;
          }
        }
        updateBannerHeader(1);
      }
    }

    // 6. Category Button Event Listeners
    filterBtns.forEach(btn => {
      if (btn._filterListener) {
        btn.removeEventListener('click', btn._filterListener);
      }
      btn._filterListener = (e) => {
        e.preventDefault();
        const filter = btn.getAttribute('data-filter') || 'all';
        currentFilter = filter;
        currentPage = 1; // Reset to page 1 on filter switch

        filterBtns.forEach(b => b.classList.toggle('active', b === btn));
        applyDisplay(true, false);
      };
      btn.addEventListener('click', btn._filterListener);
    });

    // 7. Initial Active State Selection
    const initialCategory = getCategoryFromUrl();
    let initialBtn = null;
    if (initialCategory) {
      initialBtn = Array.from(filterBtns).find(b => b.getAttribute('data-filter') === initialCategory);
      if (initialBtn) {
        currentFilter = initialCategory;
        // If arrived via old hash URL like /product.html#steel-door or /product#steel-door, cleanly upgrade URL
        if (window.location.hash && window.history && window.history.replaceState) {
          const cleanUrl = `/product-category/${currentFilter}/`;
          window.history.replaceState({ page: currentPage, filter: currentFilter }, '', cleanUrl);
        }
      }
    }
    if (!initialBtn) {
      initialBtn = container.querySelector('.filter-btn.active') || filterBtns[0];
      if (initialBtn) currentFilter = initialBtn.getAttribute('data-filter') || 'all';
    }

    filterBtns.forEach(b => b.classList.toggle('active', b === initialBtn));
    applyDisplay(false, false);

    // 8. Popstate listener for back/forward navigation
    if (!window._cataloguePopstateBound && paginationContainer) {
      window._cataloguePopstateBound = true;
      window.addEventListener('popstate', (e) => {
        const catFromUrl = getCategoryFromUrl();
        const stateFilter = (e.state && e.state.filter) || catFromUrl || 'all';
        const statePage = (e.state && typeof e.state.page === 'number') ? e.state.page : getPageFromUrl();

        currentFilter = stateFilter;
        currentPage = statePage;

        filterBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-filter') === currentFilter));
        applyDisplay(false, false);
      });
    }
  });

  // Global hashchange listener so old anchor links filter and upgrade URL dynamically
  if (!window._catalogueHashListenerBound) {
    window._catalogueHashListenerBound = true;
    window.addEventListener('hashchange', () => {
      const currentHash = window.location.hash ? window.location.hash.substring(1) : '';
      if (!currentHash) return;
      const targetBtn = document.querySelector(`.filter-btn[data-filter="${currentHash}"]`);
      if (targetBtn) {
        targetBtn.click();
      }
    });
  }
}

function initQuoteEstimator() {
  const form = document.getElementById('quoteEstimatorForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnContent = submitBtn ? submitBtn.innerHTML : '';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    }

    try {
      const name = form.querySelector('[name="name"]').value.trim();
      const phone = form.querySelector('[name="phone"]').value.trim();
      const gateType = form.querySelector('[name="gate_type"]').value;
      const size = form.querySelector('[name="gate_size"]').value.trim() || 'Standard';
      const city = form.querySelector('[name="city"]').value.trim() || 'Delhi NCR';

      // Log lead to CMS
      if (typeof CMS !== 'undefined') {
        CMS.saveInquiry({
          name: name,
          phone: phone,
          requirement: `Quote: ${gateType} (${size})`,
          message: `Location: ${city}. Size: ${size}. Requested formal quotation and catalogue.`
        });
      }

      let msg = `*New Website Gate Enquiry - Harichand Steel*%0A%0A`;
      msg += `*Name:* ${encodeURIComponent(name)}%0A`;
      msg += `*Phone:* ${encodeURIComponent(phone)}%0A`;
      msg += `*Product Required:* ${encodeURIComponent(gateType)}%0A`;
      msg += `*Approx Dimension/Size:* ${encodeURIComponent(size)}%0A`;
      msg += `*Location:* ${encodeURIComponent(city)}%0A%0A`;
      msg += `Please provide quotation and catalogue.`;

      const whatsappUrl = `https://wa.me/919870433868?text=${msg}`;
      window.open(whatsappUrl, '_blank');
    } catch (err) {
      console.error('Quote submission error:', err);
    } finally {
      setTimeout(() => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnContent;
        }
      }, 1500);
    }
  });
}

/* ==========================================================================
   INTERACTIVE MODAL FOR PRODUCT INQUIRY
   ========================================================================== */
function initModal() {
  const modal = document.getElementById('inquiryModal');
  const closeBtn = document.querySelector('.modal-close-btn');
  const triggerBtns = document.querySelectorAll('.trigger-inquiry-modal');
  const modalForm = document.getElementById('modalInquiryForm');
  const productInput = document.getElementById('modalProductField');

  if (!modal) return;

  triggerBtns.forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const productTitle = btn.getAttribute('data-product') || 'Aluminium Profile Gate Solution';
      if (productInput) productInput.value = productTitle;
      modal.classList.add('active');
    };
  });

  if (closeBtn) {
    closeBtn.onclick = () => {
      modal.classList.remove('active');
    };
  }

  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  };

  if (modalForm) {
    modalForm.onsubmit = (e) => {
      e.preventDefault();

      const submitBtn = modalForm.querySelector('button[type="submit"]');
      const originalBtnContent = submitBtn ? submitBtn.innerHTML : '';

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
      }

      try {
        const name = modalForm.querySelector('[name="m_name"]').value.trim();
        const phone = modalForm.querySelector('[name="m_phone"]').value.trim();
        const product = modalForm.querySelector('[name="m_product"]').value.trim();
        const note = modalForm.querySelector('[name="m_note"]').value.trim() || 'Interested in price & design options';

        // Log lead to CMS
        if (typeof CMS !== 'undefined') {
          CMS.saveInquiry({
            name: name,
            phone: phone,
            requirement: product,
            message: note
          });
        }

        let msg = `*Instant Product Enquiry - Harichand Steel*%0A%0A`;
        msg += `*Client Name:* ${encodeURIComponent(name)}%0A`;
        msg += `*Phone:* ${encodeURIComponent(phone)}%0A`;
        msg += `*Selected Product:* ${encodeURIComponent(product)}%0A`;
        msg += `*Requirements:* ${encodeURIComponent(note)}%0A`;

        const whatsappUrl = `https://wa.me/919870433868?text=${msg}`;
        window.open(whatsappUrl, '_blank');
        modal.classList.remove('active');
      } catch (err) {
        console.error('Modal inquiry submission error:', err);
      } finally {
        setTimeout(() => {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnContent;
          }
        }, 1500);
      }
    };
  }
}

/* ==========================================================================
   SCROLL TO TOP BUTTON
   ========================================================================== */
function initScrollTop() {
  const scrollBtn = document.querySelector('.floating-btn.scroll-top');
  if (!scrollBtn) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
      scrollBtn.classList.add('visible');
    } else {
      scrollBtn.classList.remove('visible');
    }
  });

  scrollBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

/* ==========================================================================
   CMS HYDRATION - PRODUCTS & BLOGS
   ========================================================================== */
function escapeHtmlSafe(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

function renderProductCards(grid, products) {
  if (!products || !products.length) return;

  function slugify(text) {
    if (!text) return '';
    return text.toString().toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  grid.innerHTML = products.map(prod => {
    const specs = Array.isArray(prod.specs) && prod.specs.length > 0
      ? prod.specs
      : [prod.outerFrame || prod.outer_frame || 'SS304 Grade Hardware', prod.finish || 'Weather Resistant Finish', prod.automation || 'Smart Automation Ready'];

    const specsHtml = specs.slice(0, 3).map(s => `<span class="spec-pill"><i class="fas fa-shield-alt"></i> ${escapeHtmlSafe(s)}</span>`).join('');

    const badge = prod.badge || 'Premium Build';
    const safeTitle = escapeHtmlSafe(prod.title || prod.name || 'Harichand Gate');
    const safeCat = escapeHtmlSafe(prod.category || 'aluminum-profile-gate');
    const safeCatName = escapeHtmlSafe(prod.categoryName || prod.category_display || 'Aluminum Profile Gate');
    const prodSlug = prod.slug || slugify(prod.title || prod.name || prod.id);
    const detailUrl = getAppUrl(`product/${prodSlug}/`);
    const safeImg = escapeHtmlSafe(getImageUrl(prod.image));

    return `
      <article class="product-card" data-category="${safeCat}">
        <div class="product-thumb">
          <span class="product-badge">${escapeHtmlSafe(badge)}</span>
          <a href="${detailUrl}">
            <img src="${safeImg}" alt="${safeTitle}" onerror="this.src='/images/prod-1.png'">
          </a>
        </div>
        <div class="product-body">
          <span class="product-category-link">${safeCatName}</span>
          <h3 class="product-title"><a href="${detailUrl}">${safeTitle}</a></h3>
          <div class="product-specs">
            ${specsHtml}
          </div>
          <div class="product-card-ctas">
            <a href="${detailUrl}" class="btn btn-outline-dark btn-sm btn-view-details">View Details</a>
            <button type="button" class="btn btn-whatsapp btn-sm trigger-inquiry-modal" data-product="${safeTitle}"><i class="fab fa-whatsapp"></i> Enquire</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  // Re-bind product filter tabs and modal handlers
  initProductFilter();
  initModal();
}

function hydrateProductsFromCMS() {
  const grid = document.querySelector('.product-cards-grid');
  if (!grid) return;

  // Stale-While-Revalidate: Instant render from local cache if present
  let initialRendered = false;
  if (typeof CMS !== 'undefined') {
    const cachedProducts = CMS.getProducts();
    if (cachedProducts && cachedProducts.length) {
      renderProductCards(grid, cachedProducts);
      initialRendered = true;
    }
  }

  // Network Fetch: Load fresh catalog from backend / Supabase API
  fetch('/api/products')
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(serverProducts => {
      if (Array.isArray(serverProducts) && serverProducts.length > 0) {
        // Cache canonical server products in localStorage
        try {
          localStorage.setItem('hs_cms_products', JSON.stringify(serverProducts));
        } catch (_) {}
        // Update DOM with fresh server products
        renderProductCards(grid, serverProducts);
      }
    })
    .catch(err => {
      console.warn('API /api/products fetch failed, utilizing localStorage offline fallback:', err);
      // If we couldn't render from cache initially, try localStorage fallback now
      if (!initialRendered && typeof CMS !== 'undefined') {
        const fallbackProducts = CMS.getProducts();
        if (fallbackProducts && fallbackProducts.length) {
          renderProductCards(grid, fallbackProducts);
        }
      }
    });
}

function hydrateNewsFromCMS() {
  const grid = document.querySelector('.news-cards-grid');
  if (!grid || typeof CMS === 'undefined') return;

  const blogs = CMS.getBlogs();
  if (!blogs || !blogs.length) return;

  grid.innerHTML = blogs.map(blog => {
    const safeTitle = escapeHtmlSafe(blog.title);
    const safeTag = escapeHtmlSafe(blog.tag || 'News');
    const safeDate = escapeHtmlSafe(blog.date || '');
    const safeExcerpt = escapeHtmlSafe(blog.excerpt || '');
    const safeSlug = escapeHtmlSafe(blog.slug || 'news.html');
    const waText = encodeURIComponent(`Enquiry regarding ${blog.title}`);

    return `
      <article class="news-card">
        <div class="news-card-body">
          <div class="news-meta">
            <span><i class="fas fa-calendar-alt"></i> ${safeDate}</span>
            <span><i class="fas fa-tag"></i> ${safeTag}</span>
          </div>
          <h3 class="news-title"><a href="${safeSlug}">${safeTitle}</a></h3>
          <p class="news-excerpt">${safeExcerpt}</p>
          <div style="margin-top: auto; display: flex; justify-content: space-between; align-items: center;">
            <a href="${safeSlug}" class="btn btn-outline-dark btn-sm">Read Article &rarr;</a>
            <a href="https://wa.me/919870433868?text=${waText}" class="btn btn-whatsapp btn-sm" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> Ask Expert</a>
          </div>
        </div>
      </article>
    `;
  }).join('');
}
