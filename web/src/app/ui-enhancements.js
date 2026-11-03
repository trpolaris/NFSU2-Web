/** Browser-only enhancements; the visible page and its transitions are owned by React. */
export function setupUIEnhancements() {
  setupInstallExperience();
  setupViewportStability();
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
