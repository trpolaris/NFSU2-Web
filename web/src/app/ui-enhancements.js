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
  let deferred = null;
  let registrationProblem = null;
  const tr = () => document.documentElement.lang.toLowerCase().startsWith('tr');
  const installed = () => {
    try { return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true; }
    catch { return false; }
  };
  const secureMessage = () => {
    const cert = /certificate|ssl|securityerror|failed to register a serviceworker/i.test(registrationProblem || '');
    if (!isSecureContext) return tr()
      ? 'Uygulama yüklenemiyor: Bu adres güvenli bağlam değil. Aynı bilgisayarda http://localhost:9093 adresini veya güvenilir HTTPS sertifikası olan bir alan adını kullan.'
      : 'Installation is unavailable because this address is not a secure context. Use http://localhost on this computer or a hostname with a trusted HTTPS certificate.';
    if (cert) return tr()
      ? 'Uygulama yüklenemiyor: HTTPS sertifikası tarayıcı tarafından güvenilir bulunmuyor. Aynı bilgisayarda localhost adresini deneyebilir veya bu ağ adresi için güvenilir bir sertifika kurabilirsin.'
      : 'Installation is unavailable because the HTTPS certificate is not trusted. Try localhost on this computer or install a trusted certificate for this network address.';
    return tr()
      ? 'Tarayıcı şu anda otomatik yükleme penceresi sunmuyor. Tarayıcı menüsündeki “Uygulamayı yükle” seçeneğini kullan. iPhone/iPad’de Paylaş > Ana Ekrana Ekle yolunu izle.'
      : 'The browser has not offered its native install prompt. Use “Install app” in the browser menu. On iPhone or iPad, use Share > Add to Home Screen.';
  };
  const snapshot = () => {
    const yes = installed(), ready = !!deferred && !yes;
    const blocked = !isSecureContext || /certificate|ssl|securityerror|failed to register a serviceworker/i.test(registrationProblem || '');
    return { installed: yes, ready, disabled: yes,
      label: yes ? (tr() ? 'Uygulama yüklü' : 'App installed') : (tr() ? 'Uygulamayı yükle' : 'Install app'),
      notice: blocked ? secureMessage() : '', state: yes ? 'installed' : ready ? 'ready' : 'manual' };
  };
  const sync = () => window.dispatchEvent(new Event('trp-install-changed'));
  const install = async () => {
    if (installed()) return { message: '' };
    if (deferred) {
      const event = deferred; deferred = null;
      try { await event.prompt(); await event.userChoice; }
      catch (error) { registrationProblem = String(error); }
      sync();
      return { message: registrationProblem ? secureMessage() : '' };
    }
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) registrationProblem = 'Service Worker is not registered. Check secure origin and certificate.';
      } catch (error) { registrationProblem = String(error); }
    }
    sync();
    return { message: secureMessage() };
  };
  window.__trpInstallBridge = { snapshot, install };
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferred = event; sync(); });
  window.addEventListener('appinstalled', () => { deferred = null; sync(); });
  window.addEventListener('pageshow', sync);
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('error', event => {
    registrationProblem = String(event.message || 'Service Worker registration failed'); sync();
  });
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

  // Native Web Animations API keeps transitions local and works with the site's strict self-only CSP.
  motionAnimate = (target, frames, options = {}) => {
    if (!(target instanceof Element) || typeof target.animate !== 'function') return null;
    const seconds = Number(options.duration ?? .28);
    return target.animate(frames, {
      duration: Math.max(120, seconds * 1000),
      easing: options.ease === 'easeOut' ? 'cubic-bezier(.2,.7,.25,1)' : 'cubic-bezier(.2,.65,.25,1)',
      fill: 'both',
    });
  };

  const entrance = [
    '.experience-shell > .top',
    '.experience-shell > .quick-nav',
    '.home-page .landing-copy',
    '.home-page .play-console',
    '.home-page .home-status-panel',
    '.home-page .home-quick-section',
  ].flatMap(selector => [...document.querySelectorAll(selector)]);
  entrance.forEach((element, index) => {
    if (element.closest('[hidden]')) return;
    motionAnimate(element, {
      opacity: [0, 1],
      transform: ['translateY(18px) scale(.99)', 'translateY(0) scale(1)'],
    }, { duration: .52 + Math.min(index * .035, .18) });
  });

  // Cards reveal only once as they enter view; no permanent hidden state is added to the DOM.
  if ('IntersectionObserver' in window) {
    const cards = document.querySelectorAll('.home-action-card, .app-grid section.panel');
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target;
        observer.unobserve(element);
        if (!element.closest('[hidden]')) {
          motionAnimate(element, {
            opacity: [0, 1],
            transform: ['translateY(12px)', 'translateY(0)'],
          }, { duration: .34 });
        }
      }
    }, { threshold: .08, rootMargin: '0px 0px -28px 0px' });
    cards.forEach(card => observer.observe(card));
  }
}

function setupLucideIcons() {
  // The project already ships small inline outline SVGs. Keep them local (Lucide-style geometry)
  // rather than fetching a remote module that the production CSP intentionally blocks.
  document.querySelectorAll('.quick-link > svg, .hero-garage-icon svg, .home-action-icon svg').forEach(icon => {
    icon.classList.add('ui-lucide');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');
    icon.setAttribute('stroke-linecap', 'round');
    icon.setAttribute('stroke-linejoin', 'round');
  });
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

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.width = 1;
  canvas.height = 1;
  root.replaceChildren(canvas);
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!ctx) {
    root.hidden = true;
    return;
  }

  const particles = [];
  let width = 1;
  let height = 1;
  let raf = 0;
  let active = false;
  let lastFrame = 0;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const rand = (min, max) => min + Math.random() * (max - min);

  const resize = () => {
    const rect = root.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(38, Math.max(16, Math.round(width * height / 27000)));
    while (particles.length < count) {
      particles.push({
        x: rand(0, width), y: rand(0, height),
        vx: rand(-.12, .12), vy: rand(-.16, .08),
        radius: rand(.7, 1.8), tone: Math.random() > .74 ? 'violet' : 'coral',
      });
    }
    particles.length = count;
    for (const p of particles) {
      p.x = Math.min(p.x, width);
      p.y = Math.min(p.y, height);
    }
  };

  const draw = time => {
    if (!active) return;
    raf = requestAnimationFrame(draw);
    if (time - lastFrame < 32) return;
    lastFrame = time;
    ctx.clearRect(0, 0, width, height);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -8) p.x = width + 8;
      if (p.x > width + 8) p.x = -8;
      if (p.y < -8) p.y = height + 8;
      if (p.y > height + 8) p.y = -8;

      const color = p.tone === 'violet' ? '166,154,255' : '255,105,69';
      ctx.beginPath();
      ctx.fillStyle = 'rgba(' + color + ',.72)';
      ctx.shadowColor = 'rgba(' + color + ',.55)';
      ctx.shadowBlur = 9;
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 142) continue;
        const opacity = (1 - distance / 142) * .16;
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(166,154,255,' + opacity + ')';
        ctx.lineWidth = .7;
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  };

  const syncPlayback = () => {
    const visible = !document.hidden && !home.hidden && root.getClientRects().length > 0;
    if (visible && !active) {
      active = true;
      lastFrame = 0;
      resize();
      raf = requestAnimationFrame(draw);
    } else if (!visible && active) {
      active = false;
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, width, height);
    }
  };

  const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(root);
  document.addEventListener('visibilitychange', syncPlayback);
  const homeObserver = 'MutationObserver' in window ? new MutationObserver(syncPlayback) : null;
  homeObserver?.observe(home, { attributes: true, attributeFilter: ['hidden'] });
  const viewObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver(syncPlayback, { threshold: 0.02 })
    : null;
  viewObserver?.observe(root);
  window.addEventListener('resize', resize, { passive: true });
  syncPlayback();
}
