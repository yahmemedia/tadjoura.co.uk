(function () {
  function buildIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v2H4V7zm0 6h16v2H4v-2zm0 6h16v2H4v-2z"/></svg>';
  }

  function ensureMobileMenu() {
    const nav = document.querySelector('nav');
    if (!nav) return;

    const navInner = nav.querySelector('.nav-inner');
    if (!navInner) return;

    if (!navInner.querySelector('.nav-burger')) {
      const burger = document.createElement('button');
      burger.type = 'button';
      burger.className = 'nav-burger';
      burger.setAttribute('aria-label', 'Menu');
      burger.setAttribute('aria-expanded', 'false');
      burger.innerHTML = buildIcon();
      navInner.appendChild(burger);
    }

    if (document.querySelector('.mobile-menu')) return;

    const logo = nav.querySelector('.logo');
    const logoHref = logo && logo.getAttribute('href') ? logo.getAttribute('href') : 'tadjoura-index.html';
    const logoText = logo ? (logo.textContent || 'Tadjoura') : 'Tadjoura';

    const navLinks = nav.querySelector('.nav-links');
    const anchorEls = navLinks ? Array.from(navLinks.querySelectorAll('a[href]')) : [];

    const cleanLinks = anchorEls
      .map(a => ({ href: a.getAttribute('href'), text: (a.textContent || '').trim() }))
      .filter(l => l.href && l.href !== '#' && !l.href.startsWith('http'));

    const unique = [];
    const seen = new Set();
    for (const l of cleanLinks) {
      const key = (l.href + '|' + l.text).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(l);
    }

    const menu = document.createElement('div');
    menu.className = 'mobile-menu';
    menu.setAttribute('aria-hidden', 'true');

    menu.innerHTML = `
      <div class="mobile-menu-top">
        <div class="container mobile-menu-head">
          <a class="logo" href="${logoHref}">${logoText}</a>
          <button type="button" class="mobile-close" aria-label="Close">×</button>
        </div>
      </div>
      <div class="mobile-menu-body">
        <div class="container">
          <div class="mobile-links"></div>
          <div class="mobile-collection" id="mobileCollection">
            <button type="button" class="mobile-collection-btn" aria-expanded="false">
              <span>Collection</span>
              <span>+</span>
            </button>
            <div class="mobile-collection-panel"></div>
          </div>
        </div>
      </div>
    `;

    const linksWrap = menu.querySelector('.mobile-links');
    if (linksWrap) {
      for (const l of unique) {
        const a = document.createElement('a');
        a.className = 'nav-link';
        a.href = l.href;
        a.textContent = l.text || l.href;
        linksWrap.appendChild(a);
      }

      const hasCart = unique.some(l => (l.href || '').toLowerCase().includes('cart'));
      if (!hasCart) {
        const cartLink = document.createElement('a');
        cartLink.className = 'nav-link';
        cartLink.href = 'cart.html';
        cartLink.textContent = 'Cart';
        linksWrap.appendChild(cartLink);
      }
    }

    const dropdown = document.getElementById('collectionDropdown');
    const list = dropdown ? dropdown.querySelector('.collection-list') : null;
    const panel = menu.querySelector('.mobile-collection-panel');
    if (list && panel) {
      panel.appendChild(list.cloneNode(true));
    }

    document.body.appendChild(menu);

    const burger = navInner.querySelector('.nav-burger');
    const closeBtn = menu.querySelector('.mobile-close');
    const collectionWrap = menu.querySelector('#mobileCollection');
    const collectionBtn = menu.querySelector('.mobile-collection-btn');

    const setOpen = (open) => {
      document.body.classList.toggle('mobile-menu-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      if (burger) burger.setAttribute('aria-expanded', String(open));
    };

    if (burger) burger.addEventListener('click', () => setOpen(true));
    if (closeBtn) closeBtn.addEventListener('click', () => setOpen(false));

    menu.addEventListener('click', (e) => {
      const target = e.target;
      if (target && target.tagName === 'A') setOpen(false);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setOpen(false);
    });

    if (collectionBtn && collectionWrap) {
      collectionBtn.addEventListener('click', () => {
        const open = collectionWrap.classList.toggle('open');
        collectionBtn.setAttribute('aria-expanded', String(open));
        const marker = collectionBtn.querySelector('span:last-child');
        if (marker) marker.textContent = open ? '−' : '+';
      });
    }

    setOpen(false);
  }

  function init() {
    if (window.matchMedia && window.matchMedia('(max-width: 700px)').matches) {
      ensureMobileMenu();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('resize', init);
})();






