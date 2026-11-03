import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Activity, ArrowUpRight, CarFront, ChevronRight, Gamepad2, Gauge,
  Info, LayoutDashboard, LibraryBig, Save, Settings, Users,
} from 'lucide-react';

const NAV = [
  { id: 'home', label: 'Oyna', detail: 'Başlangıç ekranı', icon: LayoutDashboard },
  { id: 'online', label: 'Çevrimiçi', detail: 'Free Roam ve Online', icon: Users },
  { id: 'mods', label: 'Mod kitaplığı', detail: 'Topluluk paketleri', icon: LibraryBig },
  { id: 'saves', label: 'Kayıtlar', detail: 'Yerel ve bulut kayıtları', icon: Save },
  { id: 'controls', label: 'Kontroller', detail: 'Klavye ve gamepad', icon: Gamepad2 },
  { id: 'settings', label: 'Ayarlar', detail: 'Oyun ve arayüz ayarları', icon: Settings },
  { id: 'system', label: 'Tanılama', detail: 'Tarayıcı ve sistem kontrolü', icon: Gauge },
  { id: 'about', label: 'Proje', detail: 'TRPOLARIS hakkında', icon: Info },
];

const PHASE_LABELS = {
  boot: 'SİSTEM KONTROLÜ',
  ready: 'OYUN HAZIR',
  waiting: 'SEKME BEKLİYOR',
  error: 'KONTROL GEREKİYOR',
  starting: 'BAŞLATILIYOR',
  playing: 'OYUN AÇIK',
  exited: 'OTURUM TAMAMLANDI',
};

function LegacyNode({ selector, className = '' }) {
  const [slot, setSlot] = useState(null);
  useLayoutEffect(() => {
    if (!slot) return undefined;
    const node = document.querySelector(selector);
    if (!node || node.parentNode === slot) return undefined;
    const placeholder = document.createComment('TRPOLARIS legacy control');
    node.parentNode?.insertBefore(placeholder, node);
    slot.appendChild(node);
    return () => {
      if (placeholder.parentNode) placeholder.parentNode.insertBefore(node, placeholder);
      placeholder.remove();
    };
  }, [selector, slot]);
  return <div className={'trp-legacy-control ' + className} ref={setSlot} />;
}

function LegacyAppHost({ app }) {
  const [slot, setSlot] = useState(null);
  useLayoutEffect(() => {
    if (!slot || !app || app.parentNode === slot) return undefined;
    const placeholder = document.createComment('TRPOLARIS legacy application');
    app.parentNode?.insertBefore(placeholder, app);
    slot.appendChild(app);
    return () => {
      if (placeholder.parentNode) placeholder.parentNode.insertBefore(app, placeholder);
      placeholder.remove();
    };
  }, [app, slot]);
  return <div className="trp-legacy-slot" ref={setSlot} />;
}

function App({ legacyApp }) {
  const reduceMotion = useReducedMotion();
  const initialHash = location.hash.replace(/^#\/?/, '').replace(/-page$/, '');
  const [active, setActive] = useState(() => NAV.some(item => item.id === initialHash) ? initialHash : 'home');
  const [phase, setPhase] = useState(document.body.dataset.phase || 'boot');
  const [statusText, setStatusText] = useState('');
  const [transitioning, setTransitioning] = useState(false);
  const activeItem = useMemo(() => NAV.find(item => item.id === active) || NAV[0], [active]);

  const syncStatus = useCallback(() => {
    setPhase(document.body.dataset.phase || 'boot');
    setStatusText(document.getElementById('status')?.textContent?.trim() || '');
  }, []);

  const navigate = useCallback((id) => {
    if (!NAV.some(item => item.id === id)) return;
    const legacyLink = legacyApp?.querySelector('.quick-nav [data-page="' + id + '"]');
    if (legacyLink instanceof HTMLElement) legacyLink.click();
    setActive(id);
  }, [legacyApp]);

  useEffect(() => {
    const onLegacyClick = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest('[data-page]');
      const id = link?.getAttribute('data-page');
      if (NAV.some(item => item.id === id)) setActive(id);
    };
    const onHashChange = () => {
      const hash = location.hash.replace(/^#\/?/, '').replace(/-page$/, '');
      const item = NAV.find(entry => entry.id === hash);
      if (item) setActive(item.id);
    };
    legacyApp?.addEventListener('click', onLegacyClick, true);
    window.addEventListener('hashchange', onHashChange);
    const bodyObserver = new MutationObserver(syncStatus);
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['data-phase'] });
    const statusNode = document.getElementById('status');
    const statusObserver = statusNode ? new MutationObserver(syncStatus) : null;
    if (statusNode && statusObserver) statusObserver.observe(statusNode, { childList: true, subtree: true, characterData: true });
    syncStatus();
    return () => {
      legacyApp?.removeEventListener('click', onLegacyClick, true);
      window.removeEventListener('hashchange', onHashChange);
      bodyObserver.disconnect();
      statusObserver?.disconnect();
    };
  }, [legacyApp, syncStatus]);

  useEffect(() => {
    if (reduceMotion) return undefined;
    setTransitioning(true);
    const timer = window.setTimeout(() => setTransitioning(false), 170);
    return () => window.clearTimeout(timer);
  }, [active, reduceMotion]);

  const phaseLabel = PHASE_LABELS[phase] || 'TRPOLARIS';
  const connectedTone = phase === 'ready' || phase === 'playing';

  return (
    <div className="trp-react-shell">
      <div className="trp-shell-atmosphere" aria-hidden="true">
        <span className="trp-atmosphere-orb trp-orb-coral" />
        <span className="trp-atmosphere-orb trp-orb-violet" />
        <span className="trp-atmosphere-grid" />
      </div>

      <aside className="trp-sidebar" aria-label="Ana gezinme">
        <a className="trp-brand" href="/" aria-label="TRPOLARIS ana sayfa">
          <span className="trp-brand-mark"><b>T</b><i /></span>
          <span className="trp-brand-copy"><strong>TRPOLARIS</strong><small>NFSU2 / WEB EDITION</small></span>
        </a>
        <div className="trp-sidebar-label">UNDERGROUND NETWORK</div>
        <nav className="trp-navigation">
          {NAV.map(item => {
            const Icon = item.icon;
            const selected = item.id === active;
            return (
              <button className={'trp-nav-link' + (selected ? ' is-active' : '')}
                type="button" key={item.id} onClick={() => navigate(item.id)}
                aria-current={selected ? 'page' : undefined} title={item.detail}>
                <Icon size={18} strokeWidth={1.8} />
                <span className="trp-nav-copy"><strong>{item.label}</strong><small>{item.detail}</small></span>
                {selected && <motion.span className="trp-nav-active" layoutId="trp-nav-active"
                  transition={{ type: 'spring', stiffness: 430, damping: 36 }} />}
              </button>
            );
          })}
        </nav>
        <div className="trp-sidebar-spacer" />
        <section className="trp-sidebar-status" aria-live="polite">
          <div className="trp-status-heading"><span className={'trp-live-indicator' + (connectedTone ? ' is-live' : '')} /> SİSTEM DURUMU</div>
          <strong>{phaseLabel}</strong>
          <p>{statusText || 'Tarayıcı, grafik ve oyun verileri denetleniyor.'}</p>
        </section>
        <a className="trp-sidebar-hub" href="/hub/"><Users size={17} /> Player Hub <ArrowUpRight size={15} /></a>
        <div className="trp-sidebar-foot">YOUR CITY. YOUR RULES.</div>
      </aside>

      <div className="trp-main-column">
        <header className="trp-topbar">
          <div className="trp-breadcrumb">
            <span className="trp-breadcrumb-mark"><Activity size={14} /></span>
            <span>TRPOLARIS</span><ChevronRight size={14} /><strong>{activeItem.label.toUpperCase()}</strong>
          </div>
          <div className="trp-topbar-actions">
            <div className="trp-build-label"><span className={'trp-live-indicator' + (connectedTone ? ' is-live' : '')} /> {phaseLabel}</div>
            <LegacyNode selector=".lang-pick" className="trp-language-slot" />
            <LegacyNode selector="#install-app" className="trp-install-slot" />
            <a className="trp-top-hub" href="/hub/"><Users size={16} /><span>Player Hub</span><ArrowUpRight size={14} /></a>
          </div>
        </header>

        <div className="trp-content">
          <div className="trp-content-heading">
            <div>
              <div className="trp-eyebrow">BAYVIEW / NIGHT DRIVER SYSTEM</div>
              <h1>{activeItem.label}<span>.</span></h1>
              <p>{activeItem.detail} <span>·</span> TRPOLARIS NFSU2 Web</p>
            </div>
            <div className="trp-heading-index" aria-hidden="true"><span>EXPERIENCE</span><strong>02</strong></div>
          </div>

          <motion.div className="trp-page-frame" initial={false}
            animate={transitioning ? { opacity: .78, y: 7, filter: 'blur(1.5px)' } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: reduceMotion ? 0 : .19, ease: [0.2, 0.75, 0.25, 1] }}>
            <LegacyAppHost app={legacyApp} />
          </motion.div>

          <footer className="trp-shell-footer">
            <span>TRPOLARIS / NEED FOR SPEED UNDERGROUND 2</span>
            <span>WEB EXPERIENCE <i /> SAME-ORIGIN SERVICES</span>
          </footer>
        </div>
      </div>
    </div>
  );
}

const rootNode = document.getElementById('trp-react-root');
const legacyApp = document.getElementById('app');
if (rootNode && legacyApp) {
  const root = createRoot(rootNode);
  flushSync(() => root.render(<App legacyApp={legacyApp} />));
}
