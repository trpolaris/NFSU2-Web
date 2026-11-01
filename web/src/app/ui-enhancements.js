/**
 * TRPOLARIS UI enhancements kept separate from the game shell so upstream game behavior remains intact.
 * Handles navigation, PWA install guidance, orientation resize, and deferred previews only.
 */
const $ = (selector) => document.querySelector(selector);
let motionAnimate = null;

export function setupUIEnhancements() {
  setupNavigation();
  setupMotionTransitions();
  setupLucideIcons();
  setupHeroParticles();
  setupInstallExperience();
  setupViewportStability();
  setupLazyPreviews();
}

function setupNavigation() {
  const nav = $('.quick-nav');
  const home = $('#home-page');
  const grid = $('#app-pages');
  if (!nav || !home || !grid) return;

  const links = [...nav.querySelectorAll('a[href^="#"]')];
  const side = grid.querySelector(':scope > .side');
  const content = grid.querySelector(':scope > .content');
  const sections = [...grid.querySelectorAll(':scope > .side > section, :scope > .content > section')];
  const pageSections = {
    home: [],
    mods: ['mods'],
    saves: ['saves'],
    online: ['online'],
    controls: ['controls'],
    settings: ['settings', 'accessibility'],
    system: ['updates', 'diagnostics', 'game-data'],
    about: ['changes', 'about'],
  };
  const pageForHash = {
    'home-page': 'home', 'play-panel': 'home',
    mods: 'mods', garage: 'mods', saves: 'saves', online: 'online',
    controls: 'controls', settings: 'settings', accessibility: 'settings',
    updates: 'system', diagnostics: 'system', 'game-data': 'system',
    changes: 'about', about: 'about',
  };
  const pageHash = {
    home: 'home-page', mods: 'mods', saves: 'saves', online: 'online',
    controls: 'controls', settings: 'settings', system: 'diagnostics', about: 'about',
  };
  const pageFromHash = (hash) => pageForHash[decodeURIComponent(hash.replace(/^#/, ''))] ?? 'home';
  const wrapperHasContent = (el) => !!el && [...el.children].some(child => child instanceof HTMLElement && !child.hidden);

  const showPage = (requested, push = false) => {
    const page = Object.hasOwn(pageSections, requested) ? requested : 'home';
    const visible = new Set(pageSections[page]);
    const isHome = page === 'home';
    home.hidden = !isHome;
    grid.hidden = isHome;
    for (const section of sections) section.hidden = isHome || !visible.has(section.id);
    if (side) side.hidden = isHome || !wrapperHasContent(side);
    if (content) content.hidden = isHome || !wrapperHasContent(content);
    document.body.dataset.uiPage = page;
    if (motionAnimate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const target = isHome ? home.querySelector('.landing-hero') : sections.find(section => !section.hidden);
      if (target) {
        try {
          motionAnimate(target, { opacity: [0, 1], y: [10, 0] }, {
            duration: .26,
            ease: 'easeOut',
          });
        } catch { /* The page remains fully usable without motion. */ }
      }
    }
    for (const link of links) {
      const active = link.dataset.page === page;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    if (push) {
      const hash = `#${pageHash[page] ?? 'home-page'}`;
      if (location.hash !== hash) history.pushState({ page }, '', hash);
      window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  };
  document.addEventListener('click', event => {
    const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
    if (!link) return;
    const id = link.hash.slice(1);
    const page = link.dataset.page ?? pageForHash[id];
    if (!page || !Object.hasOwn(pageSections, page)) return;
    event.preventDefault();
    showPage(page, true);
  });
  const restore = () => showPage(pageFromHash(location.hash), false);
  window.addEventListener('popstate', restore);
  window.addEventListener('hashchange', restore);
  showPage(location.hash ? pageFromHash(location.hash) : 'home', false);
}

function setupInstallExperience() {
  const button = $('#install-app');
  if (!button) return;
  const label = button.querySelector('[data-i18n]') ?? button;
  let deferred = null;
  let registrationProblem = null;
  let promptBound = false;
  const tr = () => document.documentElement.lang.toLowerCase().startsWith('tr');
  const installed = () => {
    try {
      return matchMedia('(display-mode: standalone)').matches ||
        matchMedia('(display-mode: fullscreen)').matches ||
        navigator.standalone === true;
    } catch { return false; }
  };
  let notice = $('#install-security-notice');
  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'install-security-notice';
    notice.className = 'install-security-notice';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    notice.hidden = true;
    const home = $('#home-page');
    if (home) home.prepend(notice);
  }
  const secureMessage = () => {
    const message = registrationProblem || '';
    const cert = /certificate|ssl|securityerror|failed to register a serviceworker/i.test(message);
    if (!isSecureContext) {
      return tr()
        ? 'Uygulama yüklenemiyor: Bu adres güvenli bağlam değil. Aynı bilgisayarda http://localhost:9093 adresini veya güvenilir HTTPS sertifikası olan bir alan adını kullan.'
        : 'Installation is unavailable because this address is not a secure context. Use http://localhost on this computer or a hostname with a trusted HTTPS certificate.';
    }
    if (cert) {
      return tr()
        ? 'Uygulama yüklenemiyor: HTTPS sertifikası tarayıcı tarafından güvenilir bulunmuyor. Aynı bilgisayarda localhost adresini deneyebilir veya bu ağ adresi için güvenilir bir sertifika kurabilirsin.'
        : 'Installation is unavailable because the HTTPS certificate is not trusted. Try localhost on this computer or install a trusted certificate for this network address.';
    }
    return tr()
      ? 'Tarayıcı şu anda otomatik yükleme penceresi sunmuyor. Tarayıcı menüsündeki “Uygulamayı yükle” seçeneğini kullan. iPhone/iPad’de Paylaş > Ana Ekrana Ekle yolunu izle.'
      : 'The browser has not offered its native install prompt. Use “Install app” in the browser menu. On iPhone or iPad, use Share > Add to Home Screen.';
  };
  const sync = () => {
    const yes = installed();
    const ready = !!deferred && !yes;
    label.textContent = yes ? (tr() ? 'Uygulama yüklü' : 'App installed') : (tr() ? 'Uygulamayı yükle' : 'Install app');
    button.disabled = yes;
    button.dataset.installState = yes ? 'installed' : ready ? 'ready' : 'manual';
    button.classList.toggle('is-installed', yes);
    button.classList.toggle('install-ready', ready);
    button.setAttribute('aria-label', label.textContent);
    const blocked = !isSecureContext || /certificate|ssl|securityerror|failed to register a serviceworker/i.test(registrationProblem || '');
    notice.hidden = !blocked;
    notice.textContent = blocked ? secureMessage() : '';
    if (blocked) button.setAttribute('aria-describedby', notice.id);
    else button.removeAttribute('aria-describedby');
    button.title = ready ? label.textContent : (yes ? label.textContent : secureMessage());
  };
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferred = event;
    sync();
  });
  window.addEventListener('appinstalled', () => { deferred = null; sync(); });
  window.addEventListener('pageshow', sync);
  button.addEventListener('click', async () => {
    if (installed()) return;
    if (deferred) {
      const event = deferred;
      deferred = null;
      try {
        await event.prompt();
        await event.userChoice;
      } catch (error) {
        registrationProblem = String(error);
      }
      sync();
      return;
    }
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) registrationProblem = 'Service Worker is not registered. Check secure origin and certificate.';
      } catch (error) { registrationProblem = String(error); }
    }
    notice.hidden = false;
    notice.textContent = secureMessage();
    notice.focus?.();
    if (typeof window.showToast === 'function') window.showToast(notice.textContent);
  });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('error', event => { registrationProblem = String(event.message || 'Service Worker registration failed'); sync(); });
  }
  sync();
}

function setupViewportStability() {
  let frame = 0;
  const sync = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = 0;
      const height = Math.round(window.visualViewport?.height || window.innerHeight || 0);
      if (height > 0) document.documentElement.style.setProperty('--trp-viewport-height', `${height}px`);
      window.dispatchEvent(new CustomEvent('trpolaris:viewport-settled', { detail: { width: window.innerWidth, height } }));
    });
  };
  window.addEventListener('resize', sync, { passive: true });
  window.addEventListener('orientationchange', () => {
    sync();
    setTimeout(sync, 180);
    setTimeout(sync, 520);
  }, { passive: true });
  window.visualViewport?.addEventListener('resize', sync, { passive: true });
  try { screen.orientation?.addEventListener('change', sync); } catch {}
  sync();
}

function setupLazyPreviews() {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('[data-lazy-src]').forEach(el => {
      el.src = el.dataset.lazySrc;
      el.removeAttribute('data-lazy-src');
    });
    return;
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      if (el instanceof HTMLImageElement && el.dataset.lazySrc) {
        el.src = el.dataset.lazySrc;
        el.removeAttribute('data-lazy-src');
      }
      if (el instanceof HTMLElement && el.dataset.lazyContent === 'true' && el.dataset.lazyMarkup) {
        el.innerHTML = el.dataset.lazyMarkup;
        el.removeAttribute('data-lazy-markup');
      }
      observer.unobserve(el);
    }
  }, { rootMargin: '240px 0px', threshold: 0.01 });
  document.querySelectorAll('[data-lazy-src], [data-lazy-content="true"]').forEach(el => observer.observe(el));
  window.addEventListener('trpolaris:page-shown', () => {
    document.querySelectorAll('[data-lazy-src]:not([data-lazy-observed]), [data-lazy-content="true"]:not([data-lazy-observed])').forEach(el => {
      el.dataset.lazyObserved = 'true'; observer.observe(el);
    });
  });
}


/* Optional visual libraries are progressive enhancements, never application dependencies. */
function setupMotionTransitions() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const moduleUrl = 'https://cdn.jsdelivr.net/npm/motion@14.8.0/+esm';
  import(moduleUrl).then(module => {
    if (typeof module.animate !== 'function') return;
    motionAnimate = module.animate;
  }).catch(() => {
    // CSS transitions remain available when the remote motion module is unavailable.
  });
}

async function setupLucideIcons() {
  const definitions = [
    ['.quick-link[data-page="home"]', 'house', 'House'],
    ['.quick-link[data-page="online"]', 'users', 'Users'],
    ['.quick-link[data-page="mods"]', 'car-front', 'CarFront'],
    ['.quick-link[data-page="saves"]', 'save', 'Save'],
    ['.quick-link[data-page="controls"]', 'gamepad-2', 'Gamepad2'],
    ['.quick-link[data-page="settings"]', 'settings', 'Settings'],
    ['.quick-link[data-page="system"]', 'activity', 'Activity'],
    ['.quick-link[data-page="about"]', 'info', 'Info'],
  ];
  const moduleUrl = 'https://cdn.jsdelivr.net/npm/lucide@1.66.0/+esm';

  try {
    const lucide = await import(moduleUrl);
    if (typeof lucide.createIcons !== 'function') return;

    const icons = {};
    const replaced = [];
    for (const [selector, dataName, exportName] of definitions) {
      const icon = lucide[exportName];
      const link = $(selector);
      const fallback = link?.querySelector(':scope > svg');
      if (!icon || !link || !fallback) continue;

      const placeholder = document.createElement('i');
      placeholder.setAttribute('data-lucide', dataName);
      placeholder.setAttribute('aria-hidden', 'true');
      placeholder.className = 'ui-lucide';
      fallback.replaceWith(placeholder);
      icons[exportName] = icon;
      replaced.push({ placeholder, fallback });
    }

    try {
      lucide.createIcons({ icons });
    } catch {
      for (const item of replaced) {
        if (item.placeholder.isConnected) item.placeholder.replaceWith(item.fallback);
      }
    }
  } catch {
    // The original inline SVG icons remain in the HTML when Lucide cannot load.
  }
}

async function setupHeroParticles() {
  const root = $('#hero-particles');
  const home = $('#home-page');
  if (!root || !home) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const connection = navigator.connection;
  const lowPowerDevice = (navigator.hardwareConcurrency || 8) <= 4;
  if (reducedMotion || connection?.saveData || lowPowerDevice) {
    root.hidden = true;
    return;
  }

  const engineUrl = 'https://cdn.jsdelivr.net/npm/@tsparticles/engine@4.4.0/+esm';
  const slimUrl = 'https://cdn.jsdelivr.net/npm/@tsparticles/slim@4.4.0/+esm';
  try {
    const [engine, slim] = await Promise.all([import(engineUrl), import(slimUrl)]);
    if (!engine.tsParticles || typeof slim.loadSlim !== 'function') return;
    await slim.loadSlim(engine.tsParticles);

    const container = await engine.tsParticles.load({
      id: 'hero-particles',
      options: {
        fullScreen: { enable: false },
        background: { color: { value: 'transparent' } },
        detectRetina: false,
        fpsLimit: 24,
        pauseOnBlur: true,
        particles: {
          number: { value: 24, density: { enable: true, area: 1100 } },
          color: { value: ['#00ffcc', '#10b981'] },
          links: {
            enable: true,
            distance: 128,
            color: '#00ffcc',
            opacity: 0.11,
            width: 1,
          },
          move: {
            enable: true,
            direction: 'none',
            random: true,
            speed: 0.34,
            outModes: { default: 'out' },
          },
          opacity: { value: { min: 0.07, max: 0.22 } },
          size: { value: { min: 1, max: 2 } },
        },
        interactivity: {
          events: {
            onClick: { enable: false },
            onHover: { enable: false },
          },
        },
      },
    });

    if (!container) return;
    const syncPlayback = () => {
      const visible = !document.hidden && !home.hidden && root.getClientRects().length > 0;
      if (visible) container.play?.();
      else container.pause?.();
    };
    document.addEventListener('visibilitychange', syncPlayback);
    if ('MutationObserver' in window) {
      const observer = new MutationObserver(syncPlayback);
      observer.observe(home, { attributes: true, attributeFilter: ['hidden'] });
    }
    syncPlayback();
  } catch {
    // The hero keeps its CSS gradient/grid treatment when tsParticles is unavailable.
    root.hidden = true;
  }
}
