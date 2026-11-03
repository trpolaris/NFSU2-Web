import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Activity, ArrowUpRight, CarFront, ChevronRight, Gamepad2, Gauge,
  Info, LayoutDashboard, LibraryBig, Save, Settings, Users,
} from 'lucide-react';

const NAV = [
  { id: 'home', label: 'Play', detail: 'Start page', icon: LayoutDashboard },
  { id: 'online', label: 'Online', detail: 'Free roam and online play', icon: Users },
  { id: 'mods', label: 'Mod library', detail: 'Community vehicle packages', icon: LibraryBig },
  { id: 'saves', label: 'Saves', detail: 'Local and cloud saves', icon: Save },
  { id: 'controls', label: 'Controls', detail: 'Keyboard and gamepad', icon: Gamepad2 },
  { id: 'settings', label: 'Settings', detail: 'Game and interface', icon: Settings },
  { id: 'system', label: 'System diagnostics', detail: 'Browser and system health', icon: Gauge },
  { id: 'about', label: 'About this project', detail: 'About TRPOLARIS', icon: Info },
];

const PHASE_LABELS = {
  boot: 'Checking system',
  ready: 'Game ready',
  waiting: 'Waiting for tab',
  error: 'Action required',
  starting: 'Starting',
  playing: 'Playing',
  exited: 'Session ended',
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

function pageFromHash(value) {
  const page = value.replace(/^#\/?/, '').replace(/-page$/, '');
  return page === 'diagnostics' ? 'system' : page;
}


const HOME_LINKS = [
  { id: 'online', label: 'Online', detail: 'Free roam + online play', icon: Users },
  { id: 'mods', label: 'Mod library', detail: 'Community vehicle packages', icon: CarFront },
  { id: 'saves', label: 'Saves', detail: 'Local + cloud saves', icon: Save },
  { id: 'controls', label: 'Controls', detail: 'Keyboard + controller', icon: Gamepad2 },
  { id: 'settings', label: 'Settings', detail: 'Display and accessibility', icon: Settings },
];

function HomeDashboard({ onNavigate }) {
  const reduceMotion = useReducedMotion();
  const enter = reduceMotion ? false : { opacity: 0, y: 16 };
  const shown = { opacity: 1, y: 0 };
  const transition = { duration: reduceMotion ? 0 : .34, ease: [.2, .75, .25, 1] };

  const jump = (event, id) => {
    event.preventDefault();
    onNavigate(id);
  };

  return (
    <motion.div className="home-page trp-react-home experience-shell" initial={enter} animate={shown} transition={transition}>
      <motion.section className="landing-hero" aria-labelledby="landing-heading" initial={enter} animate={shown} transition={transition}>
        <LegacyNode selector="#hero-particles" className="trp-home-particles-slot" />
        <LegacyNode selector=".hero-visual" className="trp-home-art-slot" />

        <div className="landing-copy">
          <div className="hero-kicker">
            <span className="signal-dot" aria-hidden="true" />
            <span className="kicker-brand">TRPOLARIS <i>/</i> NFSU2</span>
            <span className="kicker-tag" data-i18n>STREET RACING / 2004</span>
          </div>
          <p className="hero-overline" data-i18n>THE CITY NEVER SLEEPS</p>
          <motion.h1 className="landing-title" id="landing-heading" initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={shown} transition={{ ...transition, delay: reduceMotion ? 0 : .08 }}>
            <span data-i18n>Own the night.</span>
            <em data-i18n>The streets are yours.</em>
          </motion.h1>
          <p className="landing-description" data-i18n>A new home for your Underground 2 experience.</p>
          <div className="hero-capabilities" aria-label="Game features">
            <span><b className="cap-dot cyan" aria-hidden="true" /><span data-i18n>WebGPU rendering</span></span>
            <span><b className="cap-dot violet" aria-hidden="true" /><span data-i18n>CONTROLLER READY</span></span>
            <span><b className="cap-dot lime" aria-hidden="true" /><span data-i18n>LOCAL + CLOUD SAVES</span></span>
          </div>
          <div className="hero-shortcuts">
            <a className="hero-garage-link" href="#controls" onClick={event => jump(event, 'controls')}>
              <span className="hero-garage-icon" aria-hidden="true"><Gamepad2 size={17} /></span>
              <span data-i18n>Controls</span><span className="hero-link-arrow" aria-hidden="true">↗</span>
            </a>
            <a className="hero-garage-link" href="#online" onClick={event => jump(event, 'online')}>
              <span className="hero-garage-icon" aria-hidden="true"><Users size={17} /></span>
              <span data-i18n>Online</span><span className="hero-link-arrow" aria-hidden="true">↗</span>
            </a>
          </div>
        </div>

        <LegacyNode selector="#play-panel" className="trp-home-play-slot" />
      </motion.section>

      <div className="home-overview-grid">
        <LegacyNode selector="#home-status-panel" className="trp-home-status-slot" />
        <motion.section className="home-quick-section" initial={enter} animate={shown} transition={{ ...transition, delay: reduceMotion ? 0 : .1 }} aria-labelledby="home-quick-title">
          <div className="home-quick-heading">
            <div><span className="home-status-eyebrow" data-i18n>GARAGE / QUICK ACCESS</span><h2 id="home-quick-title" data-i18n>Quick access</h2></div>
            <span className="home-quick-mark" aria-hidden="true">02</span>
          </div>
          <div className="home-action-grid">
            {HOME_LINKS.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.a key={item.id} className="home-action-card" href={'#' + item.id}
                  onClick={event => jump(event, item.id)}
                  initial={reduceMotion ? false : { opacity: 0, y: 9 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduceMotion ? 0 : .22, delay: reduceMotion ? 0 : .07 + index * .045 }}>
                  <span className="home-action-icon" aria-hidden="true"><Icon size={19} strokeWidth={1.8} /></span>
                  <span className="home-action-copy"><strong data-i18n>{item.label}</strong><small data-i18n>{item.detail}</small></span>
                  <span className="home-action-arrow" aria-hidden="true"><ArrowUpRight size={16} /></span>
                </motion.a>
              );
            })}
          </div>
        </motion.section>
      </div>
    </motion.div>
  );
}

function App({ legacyApp }) {
  const reduceMotion = useReducedMotion();
  const initialHash = pageFromHash(location.hash);
  const [active, setActive] = useState(() => NAV.some(item => item.id === initialHash) ? initialHash : 'home');
  const [phase, setPhase] = useState(document.body.dataset.phase || 'boot');
  const [statusText, setStatusText] = useState('');
  const [runtimeLocked, setRuntimeLocked] = useState(() => Boolean(legacyApp?.inert));
  const [transitioning, setTransitioning] = useState(false);
  const rootRef = useRef(null);
  const activeItem = useMemo(() => NAV.find(item => item.id === active) || NAV[0], [active]);

  const syncStatus = useCallback(() => {
    setPhase(document.body.dataset.phase || 'boot');
    setStatusText(document.getElementById('status')?.textContent?.trim() || '');
    setRuntimeLocked(Boolean(legacyApp?.inert));
  }, [legacyApp]);

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
      const hash = pageFromHash(location.hash);
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
    const runtimeObserver = legacyApp ? new MutationObserver(syncStatus) : null;
    if (legacyApp && runtimeObserver) runtimeObserver.observe(legacyApp, { attributes: true, attributeFilter: ['inert'] });
    syncStatus();
    return () => {
      legacyApp?.removeEventListener('click', onLegacyClick, true);
      window.removeEventListener('hashchange', onHashChange);
      bodyObserver.disconnect();
      statusObserver?.disconnect();
      runtimeObserver?.disconnect();
    };
  }, [legacyApp, syncStatus]);

  useLayoutEffect(() => {
    if (rootRef.current && typeof window.__trpTranslateReact === 'function') {
      window.__trpTranslateReact(rootRef.current);
    }
  }, [active, phase, statusText, runtimeLocked]);

  useEffect(() => {
    if (reduceMotion) return undefined;
    setTransitioning(true);
    const timer = window.setTimeout(() => setTransitioning(false), 170);
    return () => window.clearTimeout(timer);
  }, [active, reduceMotion]);

  const phaseLabel = PHASE_LABELS[phase] || 'TRPOLARIS';
  const connectedTone = phase === 'ready' || phase === 'playing';
  const gameActive = runtimeLocked || Boolean(legacyApp?.inert) || phase === 'playing' || phase === 'starting';

  return (
    <div ref={rootRef} className={'trp-react-shell' + (active === 'home' ? ' is-home' : '')}>
      <div className="trp-shell-atmosphere" aria-hidden="true">
        <span className="trp-atmosphere-orb trp-orb-coral" />
        <span className="trp-atmosphere-orb trp-orb-violet" />
        <span className="trp-atmosphere-grid" />
      </div>

      <aside className="trp-sidebar" aria-label="Ana gezinme" inert={gameActive}>
        <a className="trp-brand" href="/" aria-label="TRPOLARIS ana sayfa">
          <span className="trp-brand-mark"><b>T</b><i /></span>
          <span className="trp-brand-copy"><strong>TRPOLARIS</strong><small>NFSU2 / WEB EDITION</small></span>
        </a>
        <div className="trp-sidebar-label" data-i18n>UNDERGROUND NETWORK</div>
        <nav className="trp-navigation">
          {NAV.map(item => {
            const Icon = item.icon;
            const selected = item.id === active;
            return (
              <button className={'trp-nav-link' + (selected ? ' is-active' : '')}
                type="button" key={item.id} onClick={() => navigate(item.id)}
                aria-current={selected ? 'page' : undefined} title={item.detail}>
                <Icon size={18} strokeWidth={1.8} />
                <span className="trp-nav-copy"><strong data-i18n>{item.label}</strong><small data-i18n>{item.detail}</small></span>
                {selected && <motion.span className="trp-nav-active" layoutId="trp-nav-active"
                  transition={{ type: 'spring', stiffness: 430, damping: 36 }} />}
              </button>
            );
          })}
        </nav>
        <div className="trp-sidebar-spacer" />
        <section className="trp-sidebar-status" aria-live="polite">
          <div className="trp-status-heading"><span className={'trp-live-indicator' + (connectedTone ? ' is-live' : '')} /> <span data-i18n>SYSTEM STATUS</span></div>
          <strong key={phase} data-i18n>{phaseLabel}</strong>
          <p>{statusText || 'Tarayıcı, grafik ve oyun verileri denetleniyor.'}</p>
        </section>
        <a className="trp-sidebar-hub" href="/hub/"><Users size={17} /> Player Hub <ArrowUpRight size={15} /></a>
        <div className="trp-sidebar-foot">YOUR CITY. YOUR RULES.</div>
      </aside>

      <div className="trp-main-column">
        <header className="trp-topbar" inert={gameActive}>
          <div className="trp-breadcrumb">
            <span className="trp-breadcrumb-mark"><Activity size={14} /></span>
            <span>TRPOLARIS</span><ChevronRight size={14} /><strong key={activeItem.id} data-i18n>{activeItem.label}</strong>
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
              <div className="trp-eyebrow" data-i18n>BAYVIEW / NIGHT DRIVER SYSTEM</div>
              <h1 key={activeItem.id}><span data-i18n>{activeItem.label}</span><span>.</span></h1>
              <p key={activeItem.id}><span data-i18n>{activeItem.detail}</span> <span>·</span> TRPOLARIS NFSU2 Web</p>
            </div>
            <div className="trp-heading-index" aria-hidden="true"><span>EXPERIENCE</span><strong>02</strong></div>
          </div>

          <motion.div className="trp-page-frame" initial={false}
            animate={transitioning ? { opacity: .78, y: 7, filter: 'blur(1.5px)' } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: reduceMotion ? 0 : .19, ease: [0.2, 0.75, 0.25, 1] }}>
            {active === 'home' && !gameActive && <HomeDashboard onNavigate={navigate} />}
            <LegacyAppHost app={legacyApp} />
          </motion.div>

          <footer className="trp-shell-footer">
            <span>TRPOLARIS / NEED FOR SPEED UNDERGROUND 2</span>
            <span><span data-i18n>WEB EXPERIENCE</span> <i /> <span data-i18n>SAME-ORIGIN SERVICES</span></span>
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
