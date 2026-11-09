import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { checkCrew, CREW_BIG, CREW_COLOUR_NAMES, CREW_MAX, CREW_PALETTE, freeColour } from '../app/crews';
import { dateLocale, language, LANGUAGES, NATIVE, onLanguage, setLanguage, t } from '../app/i18n';
import { fmtBytes } from '../app/checks';
import { askWorlds, roomHash } from '../app/players';
import { isMain, isOwn, noGhost, WORLDS, worldName, worldOf, worldRooms } from '../app/worlds';
import { TEST_NOTICE_TEXT } from '../app/test-notice';
import { CATS, DEFAULT_GROUPS, DEFAULT_PHRASES, PHRASES } from '../app/phrases';
import { createPortal, flushSync } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Activity, AlertTriangle, ArrowRight, ArrowUpRight, CarFront, ChevronRight, Gamepad2, Gauge, Info,
  LayoutDashboard, LibraryBig, MessageCircle, Save, Settings, ShieldCheck, Users,
} from 'lucide-react';

function downloadJsonExport(file) {
  const blob = new Blob([file.content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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

function pageFromHash(value) {
  const raw = decodeURIComponent(value.replace(/^#\/?/, ''));
  const aliases = {
    'home-page': 'home', 'play-panel': 'home', garage: 'mods',
    accessibility: 'settings', updates: 'system', diagnostics: 'system',
    'game-data': 'system', changes: 'about',
  };
  const page = aliases[raw] ?? raw.replace(/-page$/, '');
  return NAV.some(item => item.id === page) ? page : 'home';
}


const HOME_LINKS = [
  { id: 'online', label: 'Online', detail: 'Free roam + online play', icon: Users },
  { id: 'mods', label: 'Mod library', detail: 'Community vehicle packages', icon: CarFront },
  { id: 'saves', label: 'Saves', detail: 'Local + cloud saves', icon: Save },
  { id: 'controls', label: 'Controls', detail: 'Keyboard + controller', icon: Gamepad2 },
  { id: 'settings', label: 'Settings', detail: 'Display and accessibility', icon: Settings },
];

function RuntimePlayControls() {
  const [state, setState] = useState({ phase: 'boot', progress: 0, canPlay: false, detail: 'Loading the game.' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const update = () => {
      const next = window.__trpRuntimeBridge?.snapshot();
      if (next) setState(next);
    };
    window.addEventListener('trp-runtime-ready', update);
    window.addEventListener('trp-runtime-changed', update);
    update();
    return () => {
      window.removeEventListener('trp-runtime-ready', update);
      window.removeEventListener('trp-runtime-changed', update);
    };
  }, []);
  const play = async () => {
    if (!state.canPlay || busy) return;
    setBusy(true);
    try { await window.__trpRuntimeBridge?.play(); }
    finally {
      const next = window.__trpRuntimeBridge?.snapshot();
      if (next) setState(next);
      setBusy(false);
    }
  };
  const pct = Math.max(0, Math.min(100, state.progress ?? 0));
  return (
    <section className="panel hero play-console trp-runtime-play" aria-label="Play">
      <div className="play-console-head"><div><span className="play-console-eyebrow">01 / START YOUR ENGINE</span><h2 data-i18n>Play</h2></div><span className="play-console-mark">NFSU2 / WEB</span></div>
      <button type="button" className="play" disabled={!state.canPlay || busy} onClick={() => void play()}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z" /></svg>
        <span className="play-label" data-i18n>Play</span>
      </button>
      <div className="launch-progress-row"><span data-i18n>Game loading</span><span className="launch-progress-note" data-i18n>RUNTIME STATUS</span></div>
      <div className="bar launch-progress" role="progressbar" aria-label="Game loading" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="bar-fill" style={{ width: pct + '%' }} />
      </div>
      <div className="module-download-meta"><p role="status" aria-live="polite">{state.detail}</p><span aria-hidden="true">{pct}%</span></div>
    </section>
  );
}

function RuntimeHomeStatus({ onNavigate }) {
  const [state, setState] = useState({
    phase: 'boot', headline: 'Loading', detail: 'Loading the game.', progress: 0,
    canPlay: false, retryAvailable: false, reloadAvailable: false, logAvailable: false,
    lastGameMessage: '', reportMessage: '', updateMessage: '', overrideMessage: '', problems: [], storageWarning: '',
  });
  useEffect(() => {
    const update = () => {
      const next = window.__trpRuntimeBridge?.snapshot();
      if (next) setState(next);
    };
    window.addEventListener('trp-runtime-ready', update);
    window.addEventListener('trp-runtime-changed', update);
    update();
    return () => {
      window.removeEventListener('trp-runtime-ready', update);
      window.removeEventListener('trp-runtime-changed', update);
    };
  }, []);
  const act = async action => { await action?.(); };
  return (
    <section className="panel home-status-panel trp-runtime-status" aria-labelledby="home-status-title">
      <div className="home-status-head">
        <div className="home-status-title-wrap"><span className="home-status-eyebrow" data-i18n>LIVE / CONNECTION</span><h2 id="home-status-title" data-i18n>System diagnostics</h2></div>
        <p className="status" role="status">{state.headline}</p>
      </div>
      <p className="status-sub">{state.detail}</p>
      <div className="home-status-details">
        {state.lastGameMessage && <p className="msg">{state.lastGameMessage}</p>}
        {state.reportMessage && <p className="msg">{state.reportMessage}</p>}
        {state.updateMessage && <p className="msg" aria-live="polite">{state.updateMessage}</p>}
        {state.overrideMessage && <p className="msg">{state.overrideMessage}</p>}
        {state.storageWarning && <p className="msg warn">{state.storageWarning}</p>}
        <ul className="problems" aria-live="polite">
          {state.problems.map(problem => (
            <li className={problem.state} key={problem.id} data-id={problem.id}>
              <strong>{problem.label}</strong><p>{problem.detail}{problem.code ? ' ' + problem.code : ''}</p>
            </li>
          ))}
        </ul>
      </div>
      <div className="home-status-actions">
        {state.retryAvailable && <button type="button" className="btn" onClick={() => void act(() => window.__trpRuntimeBridge?.retry())}><span data-i18n>Retry</span></button>}
        {state.reloadAvailable && <button type="button" className="btn" onClick={() => void act(() => window.__trpRuntimeBridge?.reload())}><span data-i18n>Reload</span></button>}
        {state.logAvailable && <button type="button" className="btn" onClick={() => void act(() => window.__trpRuntimeBridge?.downloadLog())}><span data-i18n>Download log</span></button>}
        <button type="button" className="btn status-details-link" onClick={() => onNavigate('system')}><span data-i18n>System diagnostics</span></button>
      </div>
    </section>
  );
}

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
        <div className="trp-home-particle-field" aria-hidden="true" />
        <div className="hero-visual trp-home-react-visual" aria-hidden="true">
          <div className="hero-visual-grid" />
          <div className="hero-visual-glow" />
          <div className="hero-visual-index"><span>MIDNIGHT RUN</span><strong>02 / 04</strong></div>
          <svg className="hero-vehicle-art" viewBox="0 0 1100 560" role="presentation" focusable="false">
            <ellipse cx="550" cy="435" rx="440" ry="54" className="trp-home-car-floor" />
            <g className="vehicle-motion-lines"><path d="M80 300H320M25 330H235M755 185H1010M830 215H1080M110 455H365M780 470H1035" /></g>
            <path d="M132 365 179 317 310 286 395 213Q427 184 482 179L628 186Q682 190 733 238L816 273 923 302 970 351 954 389 883 414 210 418 150 397Z" className="vehicle-shell" />
            <path d="M329 285 407 211Q432 190 480 190L617 197Q661 202 704 244L754 284Z" className="vehicle-glass" />
            <path d="M474 193 470 283M623 201 670 283M393 216 358 284M176 357 329 337 472 344 632 340 795 347 925 358" className="vehicle-detail" />
            <path d="M187 319 312 292 355 294 329 329 183 352Z" className="vehicle-dark-detail" />
            <path d="M778 282 883 308 930 337 910 351 785 332Z" className="vehicle-light-detail" />
            <path d="M300 365Q356 333 412 365L435 406H280ZM715 366Q773 332 821 366L848 407H697Z" className="vehicle-wheel-arch" />
            <circle cx="360" cy="382" r="54" className="vehicle-wheel" /><circle cx="360" cy="382" r="30" className="vehicle-rim" />
            <circle cx="774" cy="382" r="54" className="vehicle-wheel" /><circle cx="774" cy="382" r="30" className="vehicle-rim" />
            <path d="M164 354 247 339 270 348 252 363 166 373ZM877 321 927 337 946 350 911 354 870 342Z" className="vehicle-lights" />
            <path d="M208 398 340 405 472 405 618 403 792 405 908 392" className="vehicle-accent" />
          </svg>
        </div>

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

        <RuntimePlayControls />
      </motion.section>

      <div className="home-overview-grid">
        <RuntimeHomeStatus onNavigate={onNavigate} />
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


const ONLINE_FEATURES = [
  { title: 'Free Roam', detail: 'Meet other drivers in the city and see their names above their cars.', icon: CarFront, tone: 'coral' },
  { title: 'Online mode', detail: 'Enter the game’s Online menu for lobbies, chat and races on this server.', icon: Gamepad2, tone: 'violet' },
  { title: 'Rooms and crews', detail: 'Use room names and crews to organize who appears together in Free Roam.', icon: Users, tone: 'green' },
];


function OnlineReactControls() {
  const statusRoot = useRef(null);
  const claimHostRef = useRef(null);
  const [values, setValues] = useState({ roam: 'off', online: 'off', roam_collide: 'off', quick_chat: 'off', roam_max_cars: '32' });
  const [textValues, setTextValues] = useState({ roam_name: '', roam_room: '', roam_block: '' });
  const [worldCounts, setWorldCounts] = useState(new Map());
  const [ownWorldOpen, setOwnWorldOpen] = useState(false);
  const [ownWorldDraft, setOwnWorldDraft] = useState('');
  const [crewList, setCrewListState] = useState([]);
  const [crewDraft, setCrewDraft] = useState('');
  const [quickChatDraft, setQuickChatDraft] = useState({ phrases: [...DEFAULT_PHRASES], groups: [...DEFAULT_GROUPS] });
  const [ready, setReady] = useState(false);
  const [readOnly, setReadOnly] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [onlineStatus, setOnlineStatus] = useState('');
  const [nameClaim, setNameClaim] = useState({ ready: false, line: '', tone: 'free', lineVisible: false, claimVisible: false, claimLabel: '', claimDisabled: true, alternativeVisible: false, alternativeLabel: '', checking: false });

  const statusText = !ready ? 'Loading' : readOnly ? 'Read only' : '';

  useLayoutEffect(() => {
    if (statusRoot.current && typeof window.__trpTranslateReact === 'function') {
      window.__trpTranslateReact(statusRoot.current);
    }
  }, [values, textValues, crewList, crewDraft, quickChatDraft, message, ready, readOnly, busy, statusText, onlineStatus, nameClaim]);

  const sync = useCallback(() => {
    const bridge = window.__trpSettingsBridge;
    if (!bridge) return;
    try {
      setValues({
        roam: bridge.current('roam'), online: bridge.current('online'),
        roam_collide: bridge.current('roam_collide'), quick_chat: bridge.current('quick_chat'),
        roam_max_cars: bridge.current('roam_max_cars'),
      });
      const nextTextValues = {
        roam_name: bridge.current('roam_name'), roam_room: bridge.current('roam_room'),
        roam_block: bridge.current('roam_block'),
      };
      setTextValues(nextTextValues);
      const customWorld = isOwn(nextTextValues.roam_room);
      setOwnWorldOpen(customWorld);
      setOwnWorldDraft(customWorld ? nextTextValues.roam_room : '');
      const nameBridge = window.__trpNameRowBridge;
      if (nameBridge) setNameClaim(nameBridge.updateName(nextTextValues.roam_name));
      setCrewListState(bridge.crews());
      setQuickChatDraft(bridge.quickChat());
      setOnlineStatus(bridge.onlineStatus());
      setReadOnly(bridge.readOnly());
      setReady(true);
    } catch { setReady(false); }
  }, []);

  useEffect(() => {
    const onSettings = () => sync();
    const onClaim = () => {
      const bridge = window.__trpNameRowBridge;
      if (!bridge) return;
      setNameClaim(bridge.snapshot());
      bridge.mountChallenge(claimHostRef.current);
    };
    window.addEventListener('trp-settings-ready', onSettings);
    window.addEventListener('trp-settings-changed', onSettings);
    window.addEventListener('trp-name-row-ready', onClaim);
    window.addEventListener('trp-name-row-changed', onClaim);
    sync();
    onClaim();
    const bridge = window.__trpSettingsBridge;
    if (bridge) void bridge.refresh().then(sync).catch(error => setMessage(String(error)));
    return () => {
      window.removeEventListener('trp-settings-ready', onSettings);
      window.removeEventListener('trp-settings-changed', onSettings);
      window.removeEventListener('trp-name-row-ready', onClaim);
      window.removeEventListener('trp-name-row-changed', onClaim);
    };
  }, [sync]);

  const saveValidated = async (key, value) => {
    const bridge = window.__trpSettingsBridge;
    if (!bridge || readOnly || busy) return;
    setBusy(key);
    setMessage('');
    try {
      await bridge.setValidated(key, value);
      sync();
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy('');
    }
  };

  const saveText = async key => saveValidated(key, textValues[key]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    const refreshWorlds = async () => {
      if (document.visibilityState !== 'visible') return;
      const counts = await askWorlds(worldRooms(textValues.roam_room), 4000);
      if (active && counts) setWorldCounts(counts);
    };
    void refreshWorlds();
    const timer = window.setInterval(() => void refreshWorlds(), 15_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshWorlds(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ready, textValues.roam_room]);

  const worldCountLabel = room => {
    const n = worldCounts.get(roomHash(room));
    return Number.isInteger(n) ? `${worldName(room)} · ${t('{n} in free roam', { n })}` : worldName(room);
  };

  const saveCrewList = async next => {
    const bridge = window.__trpSettingsBridge;
    if (!bridge || readOnly || busy) return;
    setBusy('crews');
    setMessage('');
    try {
      await bridge.setCrews(next);
      setCrewDraft('');
      sync();
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy('');
    }
  };

  const joinCrew = () => {
    const result = checkCrew(crewDraft, crewList);
    if (!result.ok) {
      setMessage(result.why ? t(result.why, { name: result.name || '' }) : '');
      return;
    }
    void saveCrewList([...crewList, { name: result.name, rgb: freeColour(crewList) }]);
  };

  const leaveCrew = index => void saveCrewList(crewList.filter((_, i) => i !== index));
  const setCrewColour = (index, rgb) => void saveCrewList(crewList.map((crew, i) => i === index ? { ...crew, rgb } : crew));

  const saveQuickChat = async () => {
    const bridge = window.__trpSettingsBridge;
    if (!bridge || readOnly || busy) return;
    setBusy('phrases');
    setMessage('');
    try {
      await bridge.saveQuickChat(quickChatDraft.phrases, quickChatDraft.groups);
      sync();
      setMessage(t('Saved.'));
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy('');
    }
  };

  const chooseQuickChatGroup = (groupIndex, category) => {
    setQuickChatDraft(current => {
      const phrases = [...current.phrases];
      const available = PHRASES.map((phrase, index) => phrase.cat === category ? index : -1).filter(index => index >= 0);
      for (let slot = 0; slot < 4; slot++) {
        const at = groupIndex * 4 + slot;
        if (PHRASES[phrases[at]]?.cat !== category) phrases[at] = available[slot] ?? available[0] ?? 0;
      }
      return { groups: current.groups.map((value, index) => index === groupIndex ? category : value), phrases };
    });
  };

  const chooseQuickChatPhrase = (slot, phrase) => {
    setQuickChatDraft(current => ({ ...current, phrases: current.phrases.map((value, index) => index === slot ? Number(phrase) : value) }));
  };

  const update = async (key, enabled) => {
    const bridge = window.__trpSettingsBridge;
    if (!bridge || readOnly || busy) return;
    const previous = values[key];
    const next = enabled ? 'on' : 'off';
    setValues(current => ({ ...current, [key]: next }));
    setBusy(key);
    setMessage('');
    try {
      await bridge.set(key, next);
      sync();
    } catch (error) {
      setValues(current => ({ ...current, [key]: previous }));
      setMessage(String(error));
    } finally {
      setBusy('');
    }
  };

  return (
    <div ref={statusRoot} className="trp-online-react-controls">
      <label className="trp-online-toggle-card" data-key="roam">
        <span className="trp-online-toggle-icon"><CarFront size={19} /></span>
        <span className="trp-online-toggle-copy">
          <strong data-i18n>Free roam with others</strong>
          <small data-i18n>Show your car to other players and see theirs in career free roam.</small>
          <em data-i18n data-i18n-src={!ready ? 'Loading' : readOnly ? 'Read only' : values.roam === 'on' ? 'On' : 'Off'}>{!ready ? 'Loading' : readOnly ? 'Read only' : values.roam === 'on' ? 'On' : 'Off'}</em>
        </span>
        <input type="checkbox" role="switch" checked={values.roam === 'on'} disabled={!ready || readOnly || !!busy}
          aria-label="Free roam with others" onChange={event => void update('roam', event.target.checked)} />
      </label>
      <label className="trp-online-toggle-card trp-online-toggle-violet" data-key="online">
        <span className="trp-online-toggle-icon"><Gamepad2 size={19} /></span>
        <span className="trp-online-toggle-copy">
          <strong data-i18n>Online mode</strong>
          <small data-i18n>Open the game’s Online menu for lobbies, chat and races on this server.</small>
          <em data-i18n data-i18n-src={!ready ? 'Loading' : readOnly ? 'Read only' : values.online === 'on' ? 'On' : 'Off'}>{!ready ? 'Loading' : readOnly ? 'Read only' : values.online === 'on' ? 'On' : 'Off'}</em>
        </span>
        <input type="checkbox" role="switch" checked={values.online === 'on'} disabled={!ready || readOnly || !!busy}
          aria-label="Online mode" onChange={event => void update('online', event.target.checked)} />
      </label>
      <div className="trp-online-secondary-controls">
        <label className="trp-online-toggle-card">
          <span className="trp-online-toggle-icon"><ShieldCheck size={19} /></span>
          <span className="trp-online-toggle-copy">
            <strong data-i18n>Ghost mode</strong>
            <small data-i18n>Drive through other players' cars instead of colliding with them.</small>
            <em data-i18n data-i18n-src={!ready ? 'Loading' : readOnly ? 'Read only' : values.roam_collide !== 'on' ? 'On' : 'Off'}>{!ready ? 'Loading' : readOnly ? 'Read only' : values.roam_collide !== 'on' ? 'On' : 'Off'}</em>
          </span>
          <input type="checkbox" role="switch" checked={values.roam_collide !== 'on'} disabled={!ready || readOnly || !!busy}
            aria-label="Ghost mode" onChange={event => void update('roam_collide', !event.target.checked)} />
        </label>
        <label className="trp-online-toggle-card trp-online-toggle-violet">
          <span className="trp-online-toggle-icon"><MessageCircle size={19} /></span>
          <span className="trp-online-toggle-copy">
            <strong data-i18n>Quick chat</strong>
            <small data-i18n>Use your sixteen preset phrases with nearby players in Free Roam.</small>
            <em data-i18n data-i18n-src={!ready ? 'Loading' : readOnly ? 'Read only' : values.quick_chat === 'on' ? 'On' : 'Off'}>{!ready ? 'Loading' : readOnly ? 'Read only' : values.quick_chat === 'on' ? 'On' : 'Off'}</em>
          </span>
          <input type="checkbox" role="switch" checked={values.quick_chat === 'on'} disabled={!ready || readOnly || !!busy}
            aria-label="Quick chat" onChange={event => void update('quick_chat', event.target.checked)} />
        </label>
        <label className="trp-online-max-cars-card">
          <span><strong data-i18n>Players’ cars shown</strong><small data-i18n>Limit how many nearby cars are loaded at once.</small></span>
          <select value={values.roam_max_cars} disabled={!ready || readOnly || !!busy}
            onChange={event => void saveValidated('roam_max_cars', event.target.value)}>
            {['16', '20', '24', '28', '32'].map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>
      <section className="trp-online-crews-panel" aria-labelledby="trp-online-crews-title">
        <div className="trp-online-crews-heading">
          <div><span className="trp-eyebrow" data-i18n>DRIVER GROUPS / 02</span><h3 id="trp-online-crews-title" data-i18n>Your crews</h3></div>
          <span className="trp-online-crews-count">{crewList.length} / {CREW_MAX}</span>
        </div>
        {crewList.map((crew, index) => {
          const count = window.__trpSettingsBridge?.crewCount(crew.name);
          return (
          <div className="trp-online-crew-row" key={crew.name}>
            <span className="trp-online-crew-name"><i style={{ backgroundColor: '#' + crew.rgb }} />{crew.name}
              {count !== undefined && <small>{t('{n} in free roam', { n: count })}</small>}
            </span>
            <div className="trp-online-crew-palette" role="group" aria-label={t('Colour of {name}', { name: crew.name })}>
              {CREW_PALETTE.map((rgb, colourIndex) => (
                <button key={rgb} type="button" className="trp-online-crew-swatch"
                  style={{ backgroundColor: '#' + rgb }}
                  aria-label={t(CREW_COLOUR_NAMES[colourIndex])}
                  aria-pressed={crew.rgb === rgb}
                  title={t(CREW_COLOUR_NAMES[colourIndex])}
                  disabled={!ready || readOnly || !!busy}
                  onClick={() => setCrewColour(index, rgb)} />
              ))}
            </div>
            <button type="button" className="trp-online-crew-leave" data-i18n
              disabled={!ready || readOnly || !!busy} onClick={() => leaveCrew(index)}>Leave</button>
            {count !== undefined && count > CREW_BIG && <em className="trp-online-crew-large">{t('{name} has more than 64 players in free roam: in a crew that big, crew-mates far away no longer always show, only the ones nearby, as with everyone else. A less common name works better.', { name: crew.name })}</em>}
          </div>
          );
        })}
        <div className="trp-online-crew-add">
          <input type="text" maxLength={24} autoComplete="off" spellCheck={false}
            value={crewDraft} placeholder="Crew name"
            disabled={!ready || readOnly || !!busy || crewList.length >= CREW_MAX}
            onChange={event => setCrewDraft(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); joinCrew(); } }} />
          <button type="button" disabled={!ready || readOnly || !!busy || crewList.length >= CREW_MAX}
            onClick={joinCrew} data-i18n>Join crew</button>
        </div>
        <p className="trp-online-crews-note" data-i18n>Players who use the same crew name are grouped together and share the crew colour. Crews are not private.</p>
      </section>
      <section className="trp-online-phrases-panel" aria-labelledby="trp-online-phrases-title">
        <div className="trp-online-phrases-heading">
          <div><span className="trp-eyebrow" data-i18n>QUICK CHAT / 16 PHRASES</span><h3 id="trp-online-phrases-title" data-i18n>Your phrases</h3></div>
          <button type="button" className="trp-online-phrases-save" disabled={!ready || readOnly || !!busy}
            onClick={() => void saveQuickChat()} data-i18n>Save phrases</button>
        </div>
        <div className="trp-online-phrases-grid">
          {quickChatDraft.groups.map((group, groupIndex) => (
            <div className="trp-online-phrase-group" key={groupIndex}>
              <div className="trp-online-phrase-group-head">
                <kbd>{groupIndex + 1}</kbd>
                <select value={group} disabled={!ready || readOnly || !!busy}
                  aria-label={t('Group {n}: its name', { n: groupIndex + 1 })}
                  onChange={event => chooseQuickChatGroup(groupIndex, event.target.value)}>
                  {CATS.map(category => <option key={category.id} value={category.id} data-i18n>{category.name}</option>)}
                </select>
              </div>
              {Array.from({ length: 4 }, (_, phraseIndex) => {
                const slot = groupIndex * 4 + phraseIndex;
                return (
                  <label className="trp-online-phrase-slot" key={slot}>
                    <span>{phraseIndex + 1}</span>
                    <select value={String(quickChatDraft.phrases[slot])} disabled={!ready || readOnly || !!busy}
                      aria-label={t('Group {n}, phrase {i}', { n: groupIndex + 1, i: phraseIndex + 1 })}
                      onChange={event => chooseQuickChatPhrase(slot, event.target.value)}>
                      {PHRASES.map((phrase, phraseNumber) => phrase.cat === group
                        ? <option key={phraseNumber} value={String(phraseNumber)} data-i18n>{phrase.text}</option>
                        : null)}
                    </select>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      </section>
      {onlineStatus && <p className="trp-online-live-status" role="status" aria-live="polite">{onlineStatus}</p>}
      <div className="trp-online-text-grid">
        <label className="trp-online-text-card">
          <span className="trp-online-text-label" data-i18n>Your name</span>
          <span className="trp-online-text-help" data-i18n>The name other drivers see above your car.</span>
          <span className="trp-online-text-entry">
            <input type="text" maxLength={15} autoComplete="off" value={textValues.roam_name}
              disabled={!ready || readOnly || !!busy}
              onChange={event => {
                const value = event.target.value;
                setTextValues(current => ({ ...current, roam_name: value }));
                const next = window.__trpNameRowBridge?.updateName(value);
                if (next) setNameClaim(next);
              }}
              onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void saveText('roam_name'); } }} />
            <button type="button" disabled={!ready || readOnly || !!busy} onClick={() => void saveText('roam_name')} data-i18n>Save</button>
          </span>
        </label>
        <div className="trp-online-name-claim">
          {nameClaim.lineVisible && <p className={'trp-online-name-claim-line is-' + nameClaim.tone} role="status" aria-live="polite">{nameClaim.line}</p>}
          {nameClaim.alternativeVisible && <button type="button" className="trp-online-name-alternative" onClick={() => {
            const alternative = window.__trpNameRowBridge?.useAlternative();
            if (alternative !== undefined) setTextValues(current => ({ ...current, roam_name: alternative }));
          }}>{nameClaim.alternativeLabel}</button>}
          {nameClaim.claimVisible && <button type="button" className="trp-online-name-claim-button" disabled={nameClaim.claimDisabled || busy !== ''} onClick={() => void window.__trpNameRowBridge?.claim()}>{nameClaim.claimLabel}</button>}
          <div className="trp-online-name-claim-widget" ref={claimHostRef} />
        </div>
        <label className="trp-online-text-card">
          <span className="trp-online-text-label" data-i18n>World</span>
          <span className="trp-online-text-help" data-i18n>Choose the main world, a quieter public world, or give your own world a name.</span>
          <span className="trp-online-text-entry">
            <select aria-label="World" value={ownWorldOpen ? '#own' : (worldOf(textValues.roam_room) ? WORLDS[worldOf(textValues.roam_room) - 1] : '')}
              disabled={!ready || readOnly || !!busy}
              onChange={event => {
                const value = event.target.value;
                if (value === '#own') {
                  setOwnWorldOpen(true);
                  setOwnWorldDraft(isOwn(textValues.roam_room) ? textValues.roam_room : '');
                } else {
                  setOwnWorldOpen(false);
                  setOwnWorldDraft('');
                  void saveValidated('roam_room', value);
                }
              }}>
              <option value="">{worldCountLabel('')}</option>
              {WORLDS.map(world => <option key={world} value={world}>{worldCountLabel(world)}</option>)}
              <option value="#own" data-i18n>Own name</option>
            </select>
          </span>
          {ownWorldOpen && <span className="trp-online-text-entry">
            <input type="text" maxLength={63} autoComplete="off" spellCheck={false} value={ownWorldDraft}
              placeholder="World name" aria-label="World name"
              disabled={!ready || readOnly || !!busy}
              onChange={event => setOwnWorldDraft(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void saveValidated('roam_room', ownWorldDraft); } }} />
            <button type="button" disabled={!ready || readOnly || !!busy} onClick={() => void saveValidated('roam_room', ownWorldDraft)} data-i18n>Save</button>
          </span>}
          {noGhost(textValues.roam_room) && values.roam === 'on' &&
            <p className="trp-online-setting-message" data-i18n>Ghost mode stays off in World 4.</p>}
        </label>
        <label className="trp-online-text-card trp-online-block-card">
          <span className="trp-online-text-label" data-i18n>Blocked players</span>
          <span className="trp-online-text-help" data-i18n>Separate names with commas. You and these players will not see each other in Free Roam.</span>
          <span className="trp-online-text-entry">
            <input type="text" maxLength={1023} autoComplete="off" value={textValues.roam_block}
              disabled={!ready || readOnly || !!busy}
              onChange={event => setTextValues(current => ({ ...current, roam_block: event.target.value }))}
              onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void saveText('roam_block'); } }} />
            <button type="button" disabled={!ready || readOnly || !!busy} onClick={() => void saveText('roam_block')} data-i18n>Save</button>
          </span>
        </label>
      </div>
      {message && <p className="trp-online-setting-message" role="status">{message}</p>}
    </div>
  );
}

function FriendsDashboardPanel() {
  const reduceMotion = useReducedMotion();
  const root = useRef(null);
  const [lists, setLists] = useState(null);
  const [crews, setCrews] = useState([]);
  const [filter, setFilter] = useState('');
  const [player, setPlayer] = useState('');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const bridge = window.__trpFriendsBridge;
    if (!bridge) return;
    try {
      const result = await bridge.refresh();
      setLists(result);
      setReady(true);
      setCrews(window.__trpSettingsBridge?.crews?.() || []);
    } catch (error) {
      setMessage(String(error));
    }
  }, []);

  useEffect(() => {
    const onReady = () => void refresh();
    window.addEventListener('trp-friends-ready', onReady);
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60000);
    return () => {
      window.removeEventListener('trp-friends-ready', onReady);
      window.clearInterval(interval);
    };
  }, [refresh]);

  useLayoutEffect(() => {
    if (root.current && typeof window.__trpTranslateReact === 'function') {
      window.__trpTranslateReact(root.current);
    }
  }, [lists, crews, filter, player, message, ready]);

  const act = async (op, name) => {
    const bridge = window.__trpFriendsBridge;
    if (!bridge || busy || !name) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await bridge.act(op, name);
      if (result) {
        setLists(result);
        const labels = {
          asked: 'Friend request sent.',
          friends: 'You are friends now.',
          ok: 'Done.',
          full: 'A friends list is full (250 at most).',
          rate: 'Wait a moment.',
          blocked: 'This player is blocked.',
        };
        setMessage(labels[result.done] || 'Friends list updated.');
        if (op === 'ask') setPlayer('');
      } else setMessage('Friends are unavailable. Claim your name and connect to the server first.');
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  };

  const inviteCrew = async (name, crew) => {
    const bridge = window.__trpFriendsBridge;
    if (!bridge || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await bridge.crew(name, crew);
      if (result) {
        setLists(result);
        const labels = {
          sent: 'Crew invite sent.',
          away: 'That friend is no longer in Free Roam.',
          none: 'Crew invites can only be sent to a mutual friend.',
          claim: 'Claim your player name before sending crew invites.',
          name: 'That crew or room name is not valid.',
          rate: 'Crew invite limit reached. Wait a moment.',
        };
        setMessage(labels[result.done] || 'Crew invite could not be sent.');
      } else setMessage('Friends are unavailable. Connect to the server first.');
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  };

  const matching = (lists?.friends || []).filter(friend =>
    !filter || friend.name.toLocaleLowerCase().includes(filter.toLocaleLowerCase()));
  const pages = Math.max(1, Math.ceil(matching.length / 20));
  const currentPage = Math.min(page, pages - 1);
  const visible = matching.slice(currentPage * 20, currentPage * 20 + 20);

  useEffect(() => { setPage(0); }, [filter]);
  useEffect(() => {
    const pagesNow = Math.max(1, Math.ceil(matching.length / 20));
    setPage(current => Math.min(current, pagesNow - 1));
  }, [lists, filter]);

  return (
    <motion.section ref={root} className="trp-friends-dashboard-panel"
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : .24 }}>
      <div className="trp-friends-dashboard-heading">
        <div>
          <div className="trp-eyebrow"><Users size={13} /> <span data-i18n>DRIVER NETWORK / SOCIAL</span></div>
          <h2 data-i18n>Friends &amp; Crews</h2>
          <p data-i18n>Manage the same EA Messenger friends and crew settings used by the game.</p>
        </div>
        <div className="trp-friends-dashboard-actions">
          <span className="trp-friends-count">{lists?.friends?.length ?? '—'} <span data-i18n>friends</span></span>
          <button type="button" className="trp-friends-refresh" disabled={busy} onClick={() => void refresh()} data-i18n>Refresh</button>
        </div>
      </div>

      {!ready && <p className="trp-friends-note" role="status" data-i18n>Loading friends…</p>}
      {ready && !lists && <p className="trp-friends-note" role="status" data-i18n>Friends are unavailable. Claim your name in Cloud Saves and connect to the server.</p>}
      {lists && !lists.me && <p className="trp-friends-note" role="status" data-i18n>Claim a player name in Cloud Saves before adding friends.</p>}

      <div className="trp-friends-tools">
        <form className="trp-friends-add" onSubmit={event => { event.preventDefault(); void act('ask', player.trim()); }}>
          <label htmlFor="trp-friend-add" data-i18n>Add a player</label>
          <div><input id="trp-friend-add" value={player} maxLength={32} autoComplete="off" onChange={event => setPlayer(event.target.value)} placeholder="Player name" data-i18n-attr="placeholder" />
          <button type="submit" disabled={busy || !player.trim() || !lists?.me} data-i18n>Send request</button></div>
        </form>
        <label className="trp-friends-filter"><span data-i18n>Filter friends</span>
          <input type="search" value={filter} onChange={event => setFilter(event.target.value)} placeholder="Search names" data-i18n-attr="placeholder" />
        </label>
      </div>

      <div className="trp-friends-dashboard-columns">
        <section className="trp-friends-dashboard-list">
          <h3><span data-i18n>Incoming requests</span><b>{lists?.asks?.length || 0}</b></h3>
          {!lists?.asks?.length && <p className="trp-friends-empty" data-i18n>No pending requests.</p>}
          {(lists?.asks || []).slice(0, 8).map(name => (
            <div className="trp-friend-dashboard-row" key={name}>
              <span>{name}</span>
              <div><button type="button" disabled={busy} onClick={() => void act('accept', name)} data-i18n>Accept</button>
              <button type="button" disabled={busy} onClick={() => void act('decline', name)} data-i18n>Decline</button></div>
            </div>
          ))}
        </section>

        <section className="trp-friends-dashboard-list trp-friends-roster">
          <h3><span data-i18n>Friends</span><b>{matching.length}</b></h3>
          {!matching.length && <p className="trp-friends-empty" data-i18n>No friends match this filter.</p>}
          {visible.map(friend => {
            const where = friend.where === 'roam' ? 'Free Roam' : friend.where === 'online' ? 'Online lobby' : 'Offline';
            const room = friend.where === 'roam' && friend.room ? ' · ' + friend.room : '';
            return <div className="trp-friend-dashboard-row" key={friend.name}>
              <span><strong>{friend.name}</strong><small><span data-i18n>{where}</span>{room}</small></span>
              <span className={'trp-friend-presence ' + (friend.where || 'offline')} />
              {friend.where === 'roam' && crews.length > 0 && <span className="trp-friend-crew-actions">
                <select aria-label={'Crew for ' + friend.name} defaultValue={crews[0].name}>
                  {crews.map(crew => <option value={crew.name} key={crew.name}>{crew.name}</option>)}
                </select>
                <button type="button" disabled={busy} data-i18n onClick={event => {
                  const selected = event.currentTarget.parentElement?.querySelector('select')?.value || crews[0].name;
                  void inviteCrew(friend.name, selected);
                }}>Invite</button>
              </span>}
            </div>;
          })}
          {matching.length > 20 && <div className="trp-friends-pagination">
            <button type="button" aria-label="Previous friends page" disabled={currentPage === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>‹</button>
            <span>{currentPage + 1} / {pages}</span>
            <button type="button" aria-label="Next friends page" disabled={currentPage >= pages - 1} onClick={() => setPage(p => Math.min(pages - 1, p + 1))}>›</button>
          </div>}
        </section>

        <section className="trp-friends-dashboard-list trp-crews-roster">
          <h3><span data-i18n>Your crews</span><b>{crews.length}</b></h3>
          {!crews.length && <p className="trp-friends-empty" data-i18n>No crews configured. Agree on a crew name with your friends and add it in Online settings.</p>}
          {crews.map(crew => <div className="trp-crew-dashboard-row" key={crew.name}>
            <i style={{ backgroundColor: '#' + crew.rgb }} />
            <span>{crew.name}</span>
          </div>)}
        </section>
      </div>
      {message && <p className="trp-friends-note" role="status" data-i18n>{message}</p>}
      <p className="trp-friends-footnote" data-i18n>These are the same friend records used by F9. Your friends list supports up to 250 players.</p>
    </motion.section>
  );
}

function OnlineDashboard() {
  const reduceMotion = useReducedMotion();
  const enter = reduceMotion ? false : { opacity: 0, y: 12 };
  const shown = { opacity: 1, y: 0 };
  const transition = { duration: reduceMotion ? 0 : .28, ease: [.2, .75, .25, 1] };

  return (
    <motion.div className="trp-route-page trp-online-dashboard" initial={enter} animate={shown} transition={transition}>
      <motion.section className="trp-online-hero" initial={enter} animate={shown} transition={transition}>
        <div className="trp-online-hero-copy">
          <div className="trp-eyebrow"><Activity size={13} /> LIVE MULTIPLAYER / BAYVIEW</div>
          <h2 data-i18n>Meet the city on the server.</h2>
          <p data-i18n>Find other drivers, choose how you connect, and shape your Free Roam experience.</p>
        </div>
        <div className="trp-online-live-mark"><span className="trp-live-indicator is-live" /><span data-i18n>SERVER FEATURES</span><strong>NFSU2 / ONLINE</strong></div>
        <div className="trp-online-orbit trp-online-orbit-a" aria-hidden="true" />
        <div className="trp-online-orbit trp-online-orbit-b" aria-hidden="true" />
      </motion.section>

      <div className="trp-online-feature-grid">
        {ONLINE_FEATURES.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <motion.article key={feature.title} className={'trp-online-feature trp-online-feature-' + feature.tone}
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : .24, delay: reduceMotion ? 0 : .06 + index * .055 }}>
              <span className="trp-online-feature-icon"><Icon size={20} strokeWidth={1.8} /></span>
              <div><h3 data-i18n>{feature.title}</h3><p data-i18n>{feature.detail}</p></div>
              <span className="trp-online-feature-index">0{index + 1}</span>
            </motion.article>
          );
        })}
      </div>

      <motion.section className="trp-online-settings-panel" initial={enter} animate={shown} transition={{ ...transition, delay: reduceMotion ? 0 : .1 }}>
        <div className="trp-online-settings-heading">
          <div>
            <div className="trp-eyebrow" data-i18n>DRIVER NETWORK / CONFIGURATION</div>
            <h2 data-i18n>Online and Free Roam settings</h2>
            <p data-i18n>Player counts, rooms, crews and connection options are provided by the existing game settings and server.</p>
          </div>
          <span className="trp-online-settings-icon"><Settings size={20} /></span>
        </div>
        <OnlineReactControls />
      </motion.section>
      <FriendsDashboardPanel />
    </motion.div>
  );
}



function AboutDashboard() {
  const reduceMotion = useReducedMotion();
  const enter = reduceMotion ? false : { opacity: 0, y: 12 };
  const transition = { duration: reduceMotion ? 0 : .28, ease: [.2, .75, .25, 1] };
  return (
    <motion.div className="trp-route-page trp-about-dashboard" initial={enter} animate={{ opacity: 1, y: 0 }} transition={transition}>
      <motion.section className="trp-about-hero" initial={enter} animate={{ opacity: 1, y: 0 }} transition={transition}>
        <div className="trp-about-brand-mark"><img src="/icon-192.png" alt="" width="54" height="54" decoding="async" /></div>
        <div className="trp-about-hero-copy">
          <div className="trp-eyebrow" data-i18n>TRPOLARIS / WEB EDITION</div>
          <h2 data-i18n>Underground, reimagined for the web.</h2>
          <p data-i18n>A community project maintained by TRPOLARIS. It brings NFSU2 to your browser and requires your own copy of the game; game files are not included.</p>
        </div>
        <span className="trp-about-hero-index">NFSU2 / 2004</span>
      </motion.section>
      <motion.section className="trp-about-section" initial={enter} animate={{ opacity: 1, y: 0 }} transition={{ ...transition, delay: reduceMotion ? 0 : .06 }}>
        <div className="trp-about-section-head">
          <div><div className="trp-eyebrow" data-i18n>PROJECT FEATURES / 01</div><h3 data-i18n>Changes from the original</h3></div>
          <span className="trp-about-section-mark">01—04</span>
        </div>
        <p className="trp-about-lead" data-i18n>The PC game's own code, recompiled to run in Chrome and Firefox with WebGPU graphics and Web Audio sound. It runs at up to 120 fps in widescreen at your screen's resolution, with the original look at its highest settings.</p>
        <div className="trp-about-feature-grid">
          <article className="trp-about-feature"><span data-i18n>01 / GRAPHICS</span><strong data-i18n>WebGPU rendering</strong></article>
          <article className="trp-about-feature"><span data-i18n>02 / MULTIPLAYER</span><strong data-i18n>Free roam + online play</strong></article>
          <article className="trp-about-feature"><span data-i18n>03 / INPUT</span><strong data-i18n>Keyboard + controller</strong></article>
          <article className="trp-about-feature"><span data-i18n>04 / SAVES</span><strong data-i18n>Local + cloud saves</strong></article>
        </div>
      </motion.section>
      <motion.section className="trp-about-info-grid" initial={enter} animate={{ opacity: 1, y: 0 }} transition={{ ...transition, delay: reduceMotion ? 0 : .1 }}>
        <article className="trp-about-info-card">
          <span className="trp-eyebrow" data-i18n>SOURCE / CODE</span>
          <h3 data-i18n>Source code</h3>
          <p data-i18n-html>The source code and project updates are available on <a href="https://github.com/trpolaris/NFSU2-Web" target="_blank" rel="noopener noreferrer">GitHub</a>.</p>
          <a className="trp-about-link" href="https://github.com/trpolaris/NFSU2-Web" target="_blank" rel="noopener noreferrer" data-i18n>Open repository ↗</a>
        </article>
        <article className="trp-about-info-card">
          <span className="trp-eyebrow" data-i18n>SUPPORT / FEEDBACK</span>
          <h3 data-i18n>Support and feedback</h3>
          <p data-i18n-html>For feedback, bug reports, and feature requests, open an issue on <a href="https://github.com/trpolaris/NFSU2-Web/issues" target="_blank" rel="noopener noreferrer">GitHub</a>.</p>
          <a className="trp-about-link" href="https://github.com/trpolaris/NFSU2-Web/issues" target="_blank" rel="noopener noreferrer" data-i18n>Report an issue ↗</a>
        </article>
        <article className="trp-about-info-card trp-about-notice">
          <span className="trp-eyebrow" data-i18n>PROJECT / NOTICE</span>
          <h3 data-i18n>Independent project</h3>
          <p data-i18n>TRPOLARIS is an independent fan project and is not affiliated with or endorsed by Electronic Arts.</p>
        </article>
      </motion.section>
      <motion.section className="trp-about-section trp-about-credits" initial={enter} animate={{ opacity: 1, y: 0 }} transition={{ ...transition, delay: reduceMotion ? 0 : .14 }}>
        <div className="trp-about-section-head">
          <div><div className="trp-eyebrow" data-i18n>ACKNOWLEDGEMENTS</div><h3 data-i18n>Credits</h3></div>
          <span className="trp-about-section-mark">COMMUNITY</span>
        </div>
        <p data-i18n-html>The language packs are built from KyoriAsh's <a href="https://nfsmods.xyz/mod/5749" target="_blank" rel="noopener noreferrer">Multi 13 languages mod</a> (with Lee-Ryo's Thai support), from TraduMix's and MixMods' Brazilian Portuguese translation (Fyro, Beater, Kerlyston F.; Junior_Djjr, SideWinder, Elyzandro), from PLProjekt's Polish translation (Daniel Graszka, MaDeR, Marcin Piech, Nati, Mateusz Wilkowski, alter), from VileStuff's <a href="https://nfsmods.xyz/mod/5286" target="_blank" rel="noopener noreferrer">English Subtitles Fixed</a> and from muntazam's <a href="https://www.moddb.com/mods/need-for-speed-underground-2-turkish-translation-patch" target="_blank" rel="noopener noreferrer">Turkish translation</a>. The texture pack is built from LunicAura106's <a href="https://nfsmods.xyz/mod/4319" target="_blank" rel="noopener noreferrer">Upscaled HUD</a>.</p>
      </motion.section>
    </motion.div>
  );
}



function ModLibraryLists() {
  const rootRef = useRef(null);
  const [snapshot, setSnapshot] = useState({ packs: [], custom: [], count: 0, statusText: '' });
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [message, setMessage] = useState('');

  const sync = useCallback(() => {
    const bridge = window.__trpModLibraryBridge;
    if (!bridge) return;
    try { setSnapshot(bridge.snapshot()); setReady(true); } catch { setReady(false); }
  }, []);

  useEffect(() => {
    const onChange = () => sync();
    window.addEventListener('trp-mod-library-ready', onChange);
    window.addEventListener('trp-mod-library-changed', onChange);
    sync();
    return () => {
      window.removeEventListener('trp-mod-library-ready', onChange);
      window.removeEventListener('trp-mod-library-changed', onChange);
    };
  }, [sync]);

  useLayoutEffect(() => {
    if (rootRef.current && typeof window.__trpTranslateReact === 'function') {
      window.__trpTranslateReact(rootRef.current);
    }
  }, [snapshot, search, category, favoritesOnly, checking, message]);

  const filteredPacks = snapshot.packs.filter(item =>
    (!favoritesOnly || item.favorite) &&
    (!search || (item.name + ' ' + (item.detail || '')).toLocaleLowerCase().includes(search.toLocaleLowerCase())));
  const filteredCustom = snapshot.custom.filter(item =>
    (!favoritesOnly || item.favorite) &&
    (!category || item.category === category) &&
    (!search || (item.name + ' ' + (item.url || '') + ' ' + (item.category || '') + ' ' + (item.targetPath || '')).toLocaleLowerCase().includes(search.toLocaleLowerCase())));

  const toggleFavorite = id => {
    const bridge = window.__trpModLibraryBridge;
    if (bridge) setSnapshot(bridge.toggleFavorite(id));
  };
  const removeCustom = id => {
    const bridge = window.__trpModLibraryBridge;
    if (bridge) setSnapshot(bridge.removeCustom(id));
  };
  const checkInstalled = async () => {
    const bridge = window.__trpModLibraryBridge;
    if (!bridge || checking) return;
    setChecking(true);
    setMessage('');
    try {
      const next = await bridge.checkPacks();
      setSnapshot(next);
      setMessage(next.statusText || 'Pack check finished.');
    } catch (error) { setMessage(String(error)); }
    finally { setChecking(false); }
  };
  const copyLink = async url => {
    try { await navigator.clipboard.writeText(url); setMessage('Link copied.'); }
    catch { setMessage(url); }
  };
  const statusLabel = status => status === 'installed'
    ? t('Detected on server')
    : status === 'missing' ? t('Not found on server')
    : status === 'unchecked' ? t('Not checked')
    : t('Manifest unavailable in this preview.');

  return (
    <div ref={rootRef} className="trp-mod-react-lists">
      <div className="trp-mod-tools-row">
        <label className="trp-mod-search"><span data-i18n>Search your library</span>
          <input type="search" value={search} placeholder="Search mods and packs" onChange={event => setSearch(event.target.value)} />
        </label>
        <label className="trp-mod-favorites-filter"><input type="checkbox" checked={favoritesOnly} onChange={event => setFavoritesOnly(event.target.checked)} /><span data-i18n>Favorites only</span></label>
        <div className="trp-mod-live-count" aria-live="polite"><strong>{snapshot.count}</strong><span data-i18n>Saved links</span></div>
        <button type="button" className="trp-mod-check-button" disabled={!ready || checking} onClick={() => void checkInstalled()} data-i18n>
          {checking ? 'Checking…' : 'Check installed packs'}
        </button>
      </div>

      <div className="trp-mod-pack-grid">
        {filteredPacks.map(item => (
          <article className="trp-mod-react-card trp-mod-pack-card" key={item.id}>
            <div className="trp-mod-card-top">
              <span className="trp-mod-card-kicker" data-i18n>COMMUNITY PACK</span>
              <button type="button" className="trp-mod-favorite" aria-pressed={item.favorite}
                aria-label={item.favorite ? 'Remove from favorites' : 'Add to favorites'}
                onClick={() => toggleFavorite(item.id)}>{item.favorite ? '★' : '☆'}</button>
            </div>
            <h4>{item.name}</h4>
            <p>{item.detail}</p>
            <div className="trp-mod-card-footer">
              <span className={'trp-mod-status is-' + item.status}>{statusLabel(item.status)}</span>
              {item.source && <a className="trp-mod-source-link" href={item.source} target="_blank" rel="noopener noreferrer" data-i18n>Open source page ↗</a>}
            </div>
          </article>
        ))}
        {!filteredPacks.length && <p className="trp-mod-empty" data-i18n>No recommended packs match this search.</p>}
      </div>

      <div className="trp-mod-list-heading">
        <div><span className="trp-eyebrow" data-i18n>YOUR COLLECTION</span><strong data-i18n>Saved mod links</strong></div>
        <label className="trp-mod-category-select"><span data-i18n>Category</span>
          <select value={category} onChange={event => setCategory(event.target.value)}>
            <option value="" data-i18n>All mod categories</option>
            <option value="vehicle" data-i18n>Vehicle</option>
            <option value="visual" data-i18n>Visuals</option>
            <option value="audio" data-i18n>Audio</option>
            <option value="translation" data-i18n>Translation</option>
            <option value="gameplay" data-i18n>Gameplay</option>
            <option value="other" data-i18n>Other</option>
          </select>
        </label>
      </div>

      <div className="trp-mod-saved-grid">
        {filteredCustom.map(item => (
          <article className="trp-mod-react-card trp-mod-saved-card" key={item.id}>
            <div className="trp-mod-saved-main">
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="trp-mod-saved-name">{item.name}</a>
              <div className="trp-mod-saved-meta">
                <span className="trp-mod-category-tag">{item.category}</span>
                {item.targetPath && <code>{item.targetPath}</code>}
                <span className={'trp-mod-status is-' + item.status}>{statusLabel(item.status)}</span>
              </div>
            </div>
            <div className="trp-mod-saved-actions">
              <button type="button" className="trp-mod-action" onClick={() => void copyLink(item.url)} data-i18n>Copy link</button>
              <button type="button" className="trp-mod-favorite" aria-pressed={item.favorite}
                aria-label={item.favorite ? 'Remove from favorites' : 'Add to favorites'}
                onClick={() => toggleFavorite(item.id)}>{item.favorite ? '★' : '☆'}</button>
              <button type="button" className="trp-mod-action is-danger" onClick={() => removeCustom(item.id)} data-i18n>Delete</button>
            </div>
          </article>
        ))}
        {!filteredCustom.length && <p className="trp-mod-empty" data-i18n>{snapshot.custom.length ? 'No mod links match these filters.' : 'No custom mod links saved yet.'}</p>}
      </div>
      <div className="trp-mod-react-status" role="status" aria-live="polite">{message || snapshot.statusText}</div>
    </div>
  );
}


function ModLibraryForm() {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('other');
  const [targetPath, setTargetPath] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const onReady = () => setReady(Boolean(window.__trpModLibraryBridge));
    window.addEventListener('trp-mod-library-ready', onReady);
    onReady();
    return () => window.removeEventListener('trp-mod-library-ready', onReady);
  }, []);

  useLayoutEffect(() => {
    if (rootRef.current && typeof window.__trpTranslateReact === 'function') {
      window.__trpTranslateReact(rootRef.current);
    }
  }, [message, busy, ready, category]);

  const submit = event => {
    event.preventDefault();
    const bridge = window.__trpModLibraryBridge;
    if (!bridge || busy) return;
    const result = bridge.addLink(name, url, category, targetPath);
    setMessage(result.message);
    if (result.ok) {
      setName(''); setUrl(''); setCategory('other'); setTargetPath('');
    }
  };

  const importFile = async event => {
    const file = event.target.files && event.target.files[0];
    const bridge = window.__trpModLibraryBridge;
    if (!file || !bridge || busy) { event.target.value = ''; return; }
    setBusy(true);
    setMessage('');
    try { setMessage(await bridge.importList(file)); }
    catch (error) { setMessage(String(error)); }
    finally { setBusy(false); event.target.value = ''; }
  };

  const exportList = () => {
    const bridge = window.__trpModLibraryBridge;
    if (!bridge) return;
    const file = bridge.exportList();
    downloadJsonExport(file);
    setMessage(file.message);
  };

  return (
    <div ref={rootRef} className="trp-mod-react-form">
      <form onSubmit={submit}>
        <div className="trp-mod-react-form-grid">
          <label><span data-i18n>Mod name</span>
            <input type="text" maxLength={80} autoComplete="off" required value={name}
              placeholder="Mod name" disabled={!ready || busy}
              onChange={event => setName(event.target.value)} />
          </label>
          <label><span data-i18n>Mod URL</span>
            <input type="url" maxLength={2048} inputMode="url" autoComplete="url" required value={url}
              placeholder="https://…" disabled={!ready || busy}
              onChange={event => setUrl(event.target.value)} />
          </label>
          <label><span data-i18n>Mod category</span>
            <select value={category} disabled={!ready || busy} onChange={event => setCategory(event.target.value)}>
              <option value="vehicle" data-i18n>Vehicle</option>
              <option value="visual" data-i18n>Visuals</option>
              <option value="audio" data-i18n>Audio</option>
              <option value="translation" data-i18n>Translation</option>
              <option value="gameplay" data-i18n>Gameplay</option>
              <option value="other" data-i18n>Other</option>
            </select>
          </label>
          <label><span data-i18n>Expected game-data path (optional)</span>
            <input type="text" maxLength={180} autoComplete="off" value={targetPath}
              placeholder="e.g. LANGPACKS/turkish/english.bin" disabled={!ready || busy}
              onChange={event => setTargetPath(event.target.value)} />
          </label>
        </div>
        <div className="trp-mod-react-form-actions">
          <button type="submit" disabled={!ready || busy} className="is-primary" data-i18n>Add link</button>
          <button type="button" disabled={!ready || busy} onClick={exportList} data-i18n>Export mod list</button>
          <label className={'trp-mod-react-file-button' + (!ready || busy ? ' is-disabled' : '')}>
            <span data-i18n>Import mod list</span>
            <input type="file" accept="application/json,.json" disabled={!ready || busy} onChange={importFile} />
          </label>
        </div>
      </form>
      <p className="trp-mod-react-form-status" role="status" aria-live="polite">{message}</p>
    </div>
  );
}

function ModLibraryDashboard() {
  const reduceMotion = useReducedMotion();
  const enter = reduceMotion ? false : { opacity: 0, y: 12 };
  const transition = { duration: reduceMotion ? 0 : .27, ease: [.2, .75, .25, 1] };
  return (
    <motion.div className="trp-route-page trp-mod-dashboard" initial={enter} animate={{ opacity: 1, y: 0 }} transition={transition}>
      <motion.section className="trp-mod-hero" initial={enter} animate={{ opacity: 1, y: 0 }} transition={transition}>
        <div>
          <div className="trp-eyebrow" data-i18n>TRPOLARIS / WORKSHOP</div>
          <h2 data-i18n>Build your own Underground.</h2>
          <p data-i18n>Save mod links, track expected files, and export your mod list. The library stores links and metadata; it does not install files on the server.</p>
        </div>

        <span className="trp-mod-hero-stamp" aria-hidden="true">WORKSHOP / 04</span>
      </motion.section>

      <motion.section className="trp-mod-panel" initial={enter} animate={{ opacity: 1, y: 0 }} transition={{ ...transition, delay: reduceMotion ? 0 : .06 }}>
        <div className="trp-mod-section-head">
          <div><div className="trp-eyebrow" data-i18n>COMMUNITY PICKS</div><h3 data-i18n>Recommended packs</h3></div>
          <span className="trp-mod-section-mark">01</span>
        </div>
        <ModLibraryLists />
      </motion.section>

      <motion.section className="trp-mod-add-panel" initial={enter} animate={{ opacity: 1, y: 0 }} transition={{ ...transition, delay: reduceMotion ? 0 : .14 }}>
        <div className="trp-mod-add-heading">
          <div><div className="trp-eyebrow" data-i18n>PERSONAL LIBRARY</div><h3 data-i18n>Add or transfer links</h3></div>
          <span className="trp-mod-section-mark">03</span>
        </div>
        <ModLibraryForm />
      </motion.section>
    </motion.div>
  );
}


function SavesReactControls() {
  const [snapshot, setSnapshot] = useState({ profiles: [], busy: true, message: '' });
  const [editing, setEditing] = useState('');
  const [draft, setDraft] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const update = () => setSnapshot(window.__trpSavesBridge?.snapshot() ?? { profiles: [], busy: true, message: '' });
    window.addEventListener('trp-saves-changed', update);
    window.addEventListener('trp-saves-ready', update);
    update();
    return () => {
      window.removeEventListener('trp-saves-changed', update);
      window.removeEventListener('trp-saves-ready', update);
    };
  }, []);

  useEffect(() => {
    if (rootRef.current) window.__trpTranslateReact?.(rootRef.current);
  }, [snapshot.profiles, snapshot.busy, snapshot.message, editing]);

  const run = async task => {
    const bridge = window.__trpSavesBridge;
    if (!bridge) return;
    setActionBusy(true);
    try {
      await task(bridge);
    } catch (error) {
      console.error('[saves] React action failed:', error);
    } finally {
      setSnapshot(bridge.snapshot());
      setActionBusy(false);
    }
  };

  const rename = async event => {
    event.preventDefault();
    const bridge = window.__trpSavesBridge;
    if (!bridge || !editing) return;
    setActionBusy(true);
    try {
      const result = await bridge.rename(editing, draft);
      if (result.ok) setEditing('');
      setSnapshot(bridge.snapshot());
    } catch (error) {
      console.error('[saves] React rename failed:', error);
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <section className="trp-saves-react-manager" ref={rootRef} aria-labelledby="trp-saves-react-title">
      <div className="trp-saves-react-heading">
        <div>
          <div className="trp-eyebrow" data-i18n>LOCAL STORAGE / PROFILES</div>
          <h3 id="trp-saves-react-title" data-i18n>Profiles in this browser</h3>
        </div>
        <div className="trp-saves-react-actions">
          <button type="button" className="trp-saves-action" disabled={actionBusy} onClick={() => void run(bridge => bridge.exportBackup())}>
            <Save size={14} /><span data-i18n>Download backup</span>
          </button>
          <label className={'trp-saves-action trp-saves-file-action' + (snapshot.busy || actionBusy ? ' is-disabled' : '')}>
            <ArrowUpRight size={14} /><span data-i18n>Restore backup</span>
            <input type="file" accept=".zip,application/zip,application/octet-stream" disabled={snapshot.busy || actionBusy}
              onChange={event => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (file) void run(bridge => bridge.importBackup(file));
              }} />
          </label>
        </div>
      </div>
      <p className="trp-saves-react-description" data-i18n>Profile files stay in this browser. A backup includes saves, game options and settings, but not downloaded game data.</p>
      <p className="trp-saves-react-status" role="status" aria-live="polite">{snapshot.message}</p>
      {snapshot.profiles.length ? (
        <ul className="trp-saves-profile-list">
          {snapshot.profiles.map(profile => (
            <li className="trp-saves-profile" key={profile.name}>
              {editing === profile.name ? (
                <form className="trp-saves-rename-form" onSubmit={rename}>
                  <input autoFocus type="text" value={draft} maxLength={window.__trpSavesBridge?.nameMax ?? 7}
                    autoComplete="off" spellCheck="false"
                    aria-label={t('New name for {name}', { name: profile.name })}
                    onChange={event => setDraft(event.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, window.__trpSavesBridge?.nameMax ?? 7))}
                    onKeyDown={event => { if (event.key === 'Escape') setEditing(''); }} />
                  <button type="submit" className="trp-saves-inline-button" disabled={snapshot.busy || actionBusy}><span data-i18n>Rename</span></button>
                  <button type="button" className="trp-saves-inline-button is-muted" onClick={() => setEditing('')}><span data-i18n>Cancel</span></button>
                </form>
              ) : (
                <>
                  <div className="trp-saves-profile-copy">
                    <strong>{profile.name}</strong>
                    <span>{t('saved {when}, {size}', { when: new Date(profile.mtime).toLocaleString(dateLocale()), size: fmtBytes(profile.size) })}</span>
                  </div>
                  <button type="button" className="trp-saves-inline-button" disabled={snapshot.busy || actionBusy}
                    onClick={() => { setEditing(profile.name); setDraft(profile.name); }}>
                    <span data-i18n>Rename</span>
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="trp-saves-empty" data-i18n>No profiles yet. Create one in the game: it is saved in this browser.</div>
      )}
    </section>
  );
}

function ScreenshotsReactControls() {
  const [shots, setShots] = useState([]);
  const [thumbs, setThumbs] = useState({});
  const [current, setCurrent] = useState(-1);
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');
  const thumbRun = useRef(0);
  const imageRun = useRef(0);

  const refresh = useCallback(() => {
    const next = window.__trpSavesBridge?.shotsSnapshot();
    if (next) setShots(next);
  }, []);

  useEffect(() => {
    window.addEventListener('trp-saves-ready', refresh);
    window.addEventListener('trp-saves-changed', refresh);
    refresh();
    return () => {
      window.removeEventListener('trp-saves-ready', refresh);
      window.removeEventListener('trp-saves-changed', refresh);
    };
  }, [refresh]);

  useEffect(() => {
    const run = ++thumbRun.current;
    const bridge = window.__trpSavesBridge;
    if (!bridge || !shots.length) { setThumbs({}); return; }
    void Promise.all(shots.map(async shot => [shot.path, await bridge.shotThumbnail(shot.path)]))
      .then(entries => { if (thumbRun.current === run) setThumbs(Object.fromEntries(entries)); })
      .catch(() => { if (thumbRun.current === run) setThumbs({}); });
    return () => { if (thumbRun.current === run) thumbRun.current++; };
  }, [shots]);

  useEffect(() => {
    if (!imageUrl) return undefined;
    return () => URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  const close = useCallback(() => {
    imageRun.current++;
    setCurrent(-1);
    setError('');
    setImageUrl('');
  }, []);

  const open = async index => {
    const shot = shots[index];
    if (!shot) return;
    const run = ++imageRun.current;
    setCurrent(index);
    setError('');
    setImageUrl('');
    try {
      const url = await window.__trpSavesBridge?.shotImageUrl(shot.path);
      if (!url) throw new Error('Screenshot not available');
      if (imageRun.current !== run) { URL.revokeObjectURL(url); return; }
      setImageUrl(url);
    } catch (reason) {
      if (imageRun.current === run) setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const step = delta => {
    const next = current + delta;
    if (next >= 0 && next < shots.length) void open(next);
  };

  useEffect(() => {
    if (current < 0) return undefined;
    const key = event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [current, shots, close]);

  const download = path => window.__trpSavesBridge?.downloadShot(path);
  const remove = async () => {
    const shot = shots[current];
    if (!shot) return;
    try {
      const removed = await window.__trpSavesBridge?.deleteShot(shot.path);
      if (removed) { close(); refresh(); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };

  const shot = current >= 0 ? shots[current] : null;
  return (
    <section className="trp-shots-react" aria-labelledby="trp-shots-title">
      <div className="trp-shots-react-heading">
        <div><span className="trp-eyebrow" data-i18n>LOCAL GALLERY / F12</span><h3 id="trp-shots-title" data-i18n>Screenshots</h3></div>
        <span className="trp-shots-react-count">{shots.length} <span data-i18n>images</span></span>
      </div>
      {shots.length ? (
        <div className="trp-shots-react-grid">
          {shots.map((item, index) => (
            <article className="trp-shot-react-card" key={item.path}>
              <button type="button" className="trp-shot-react-preview" onClick={() => void open(index)} aria-label={t('Screenshot, {when}', { when: new Date(item.mtime).toLocaleString(dateLocale()) })}>
                {thumbs[item.path] ? <img src={thumbs[item.path]} alt="" loading="lazy" decoding="async" /> : <span className="trp-shot-placeholder">{item.path.split('.').pop()?.toUpperCase()}</span>}
                <span className="trp-shot-open-mark"><span data-i18n>Open</span><ArrowUpRight size={14} /></span>
              </button>
              <div className="trp-shot-react-meta"><strong>{new Date(item.mtime).toLocaleString(dateLocale())}</strong><span>{fmtBytes(item.size)}</span></div>
              <button type="button" className="trp-shot-react-download" onClick={() => download(item.path)}><span data-i18n>Download original</span></button>
            </article>
          ))}
        </div>
      ) : (
        <div className="trp-shots-react-empty"><span className="trp-shots-empty-symbol">F12</span><strong data-i18n>No screenshots yet.</strong><p data-i18n>Take a screenshot while driving. Your pictures stay in this browser and are included in local backups.</p></div>
      )}
      {shot && (
        <div className="trp-shot-lightbox" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
          <section className="trp-shot-lightbox-panel" role="dialog" aria-modal="true" aria-labelledby="trp-shot-lightbox-title">
            <header><div><span className="trp-eyebrow" data-i18n>LOCAL CAPTURE / {String(current + 1).padStart(2,'0')}</span><h3 id="trp-shot-lightbox-title" data-i18n>Screenshot</h3><p>{new Date(shot.mtime).toLocaleString(dateLocale())} · {fmtBytes(shot.size)}</p></div><button type="button" className="trp-shot-lightbox-close" onClick={close} aria-label="Close">×</button></header>
            <div className="trp-shot-lightbox-image">{imageUrl ? <img src={imageUrl} alt={t('Screenshot, {when}', { when: new Date(shot.mtime).toLocaleString(dateLocale()) })} /> : <p role="status">{error || t('Loading screenshot…')}</p>}</div>
            {error && <p className="trp-shot-lightbox-error" role="alert">{error}</p>}
            <footer>
              <button type="button" disabled={current <= 0} onClick={() => step(-1)}><span data-i18n>‹ Newer</span></button>
              <span>{current + 1} / {shots.length}</span>
              <button type="button" disabled={current >= shots.length - 1} onClick={() => step(1)}><span data-i18n>Older ›</span></button>
              <button type="button" onClick={() => download(shot.path)}><span data-i18n>Download</span></button>
              <button type="button" className="is-danger" onClick={() => void remove()}><span data-i18n>Delete</span></button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}

function VaultReactControls() {
  const [snapshot, setSnapshot] = useState({
    available: false, linked: false, phrase: '', revealed: false, owner: false, busy: true, working: false,
    host: '', when: '', whenVisible: false, claim: '', claimVisible: false, about: '', aboutVisible: true,
    sides: '', status: '', message: '', messageWarn: false, makeVisible: false, showDownload: false,
    showLoad: false, showSync: false, showEarlier: false, showConflict: false, showReplaced: false,
    makeDisabled: true, loadDisabled: true, syncDisabled: true, earlierDisabled: true, keepMineDisabled: true,
    takeTheirsDisabled: true, stopDisabled: true, deleteDisabled: true, putBackDisabled: true, conflictState: false,
  });
  const [phrase, setPhrase] = useState('');
  const [action, setAction] = useState('');
  const rootRef = useRef(null);
  const refresh = useCallback(() => {
    const next = window.__trpVaultBridge?.snapshot();
    if (!next) return;
    setSnapshot(next);
    if (next.linked) setPhrase(next.phrase);
  }, []);

  useEffect(() => {
    window.addEventListener('trp-vault-ready', refresh);
    window.addEventListener('trp-vault-changed', refresh);
    refresh();
    return () => {
      window.removeEventListener('trp-vault-ready', refresh);
      window.removeEventListener('trp-vault-changed', refresh);
    };
  }, [refresh]);

  useEffect(() => { if (rootRef.current) window.__trpTranslateReact?.(rootRef.current); }, [snapshot, action]);

  const run = async (key, operation) => {
    const bridge = window.__trpVaultBridge;
    if (!bridge || action) return;
    setAction(key);
    try { await operation(bridge); }
    finally { refresh(); setAction(''); }
  };
  const load = event => {
    event.preventDefault();
    void run('load', bridge => bridge.load(phrase));
  };

  if (!snapshot.available) return null;
  return (
    <section className="trp-vault-react" ref={rootRef} aria-labelledby="trp-vault-react-title">
      <div className="trp-vault-react-heading">
        <div><span className="trp-eyebrow">TRPOLARIS CLOUD / PRIVATE SYNC</span><h3 id="trp-vault-react-title" data-i18n>Cloud saves</h3><p>{snapshot.host}</p></div>
        {snapshot.whenVisible && <span className="trp-vault-react-sync-state" role="status">{snapshot.when}</span>}
      </div>
      <div className="trp-vault-react-key-row">
        <form className="trp-vault-react-key-form" onSubmit={load}>
          <input type={snapshot.revealed ? 'text' : 'password'} value={snapshot.linked ? snapshot.phrase : phrase}
            readOnly={snapshot.linked} autoComplete="off" autoCapitalize="none" spellCheck="false"
            placeholder={t('Enter your keyphrase')} aria-label={t('Keyphrase')}
            onChange={event => setPhrase(event.target.value)} />
          <button type="button" className="trp-vault-icon-action" onClick={() => window.__trpVaultBridge?.toggleVisibility()} aria-label={snapshot.revealed ? t('Hide passphrase') : t('Show passphrase')} aria-pressed={snapshot.revealed}>◉</button>
          {snapshot.showDownload && <button type="button" className="trp-vault-icon-action" onClick={() => window.__trpVaultBridge?.download()} aria-label={t('Download keyphrase')}>↓</button>}
          {snapshot.showLoad && <button type="submit" disabled={snapshot.loadDisabled || action !== ''}><span data-i18n>{action === 'load' ? 'Loading…' : 'Load'}</span></button>}
        </form>
        {snapshot.makeVisible && <button type="button" className="trp-vault-primary" disabled={snapshot.makeDisabled || action !== ''} onClick={() => void run('make', bridge => bridge.make())}><span data-i18n>{action === 'make' ? 'Enabling…' : 'Enable cloud saving'}</span></button>}
      </div>
      {snapshot.aboutVisible && <p className="trp-vault-react-hint" data-i18n>{snapshot.about}</p>}
      {snapshot.claimVisible && <p className="trp-vault-react-hint">{snapshot.claim}</p>}
      {snapshot.sides && <p className="trp-vault-react-sides">{snapshot.sides}</p>}
      {snapshot.status && <p className="trp-vault-react-status" role="status">{snapshot.status}</p>}
      {snapshot.message && <p className={'trp-vault-react-message' + (snapshot.messageWarn ? ' is-warn' : '')} role="status" aria-live="polite">{snapshot.message}</p>}
      {snapshot.showConflict && (
        <div className="trp-vault-react-conflict">
          <strong data-i18n>Resolve cloud conflict</strong><p data-i18n>Choose which save set should remain linked to this passphrase.</p>
          <div>
            <button type="button" disabled={snapshot.keepMineDisabled || action !== ''} onClick={() => void run('mine', bridge => bridge.keepMine())}><span data-i18n>Keep this browser's</span></button>
            <button type="button" disabled={snapshot.takeTheirsDisabled || action !== ''} onClick={() => void run('theirs', bridge => bridge.takeTheirs())}><span data-i18n>Use the cloud's</span></button>
          </div>
        </div>
      )}
      <div className="trp-vault-react-actions">
        {snapshot.showSync && <button type="button" disabled={snapshot.syncDisabled || action !== ''} onClick={() => void run('sync', bridge => bridge.sync())}><span data-i18n>Sync now</span></button>}
        {snapshot.showEarlier && <button type="button" disabled={snapshot.earlierDisabled || action !== ''} onClick={() => void run('earlier', bridge => bridge.goBack())}><span data-i18n>Go back</span></button>}
        {snapshot.showReplaced && <div className="trp-vault-react-replaced"><span>{snapshot.replacedText}</span><button type="button" disabled={snapshot.putBackDisabled || action !== ''} onClick={() => void run('putback', bridge => bridge.putBack())}><span data-i18n>Put back</span></button></div>}
        {snapshot.showSync && <button type="button" disabled={snapshot.stopDisabled || action !== ''} onClick={() => void run('stop', bridge => bridge.stop())}><span data-i18n>Stop syncing</span></button>}
        {snapshot.showSync && <button type="button" className="is-danger" disabled={snapshot.deleteDisabled || action !== ''} onClick={() => void run('delete', bridge => bridge.remove())}><span data-i18n>Delete from cloud</span></button>}
      </div>
    </section>
  );
}

function SavesDashboard() {
  const reduceMotion = useReducedMotion();
  const enter = reduceMotion ? false : { opacity: 0, y: 12 };
  const transition = { duration: reduceMotion ? 0 : .27, ease: [.2, .75, .25, 1] };
  return (
    <motion.div className="trp-route-page trp-saves-dashboard" initial={enter} animate={{ opacity: 1, y: 0 }} transition={transition}>
      <motion.section className="trp-saves-hero" initial={enter} animate={{ opacity: 1, y: 0 }} transition={transition}>
        <div className="trp-saves-hero-copy">
          <div className="trp-eyebrow"><Save size={13} /> <span data-i18n>GARAGE DATA / BACKUP</span></div>
          <h2 data-i18n>Your progress, your way.</h2>
          <p data-i18n>Manage browser profiles and screenshots, keep a local backup, or synchronize encrypted saves with TRPOLARIS Cloud.</p>
        </div>
      </motion.section>

      <motion.section className="trp-saves-panel" initial={enter} animate={{ opacity: 1, y: 0 }} transition={{ ...transition, delay: reduceMotion ? 0 : .05 }}>
        <SavesReactControls />
        <ScreenshotsReactControls />
        <VaultReactControls />

      </motion.section>
    </motion.div>
  );
}


const CONTROL_KEYS = [
  { keys: ['↑', '↓'], action: 'Throttle, brake and reverse' },
  { keys: ['←', '→'], action: 'Steer (or W S A D)' },
  { keys: ['Alt'], action: 'Nitrous' },
  { keys: ['Space'], action: 'Handbrake' },
  { keys: ['Shift', 'Ctrl'], action: 'Shift up, shift down (manual)' },
  { keys: ['C', 'B'], action: 'Change camera, look back' },
  { keys: ['R'], action: 'Respawn' },
  { keys: ['H', 'J'], action: 'Hydraulics (hold, then the arrows)' },
  { keys: ['N'], action: 'Horn (with other players)' },
  { keys: ['X'], action: 'Drift mode (in free roam)' },
  { keys: ['1–4'], action: 'Quick chat (with other players): a group, then a phrase' },
  { keys: ['Enter'], action: 'Start an event, take an outrun' },
  { keys: ['M', 'Tab'], action: 'Map, messages' },
  { keys: ['Esc', 'P'], action: 'Pause' },
];

const CONTROLLER_KEYS = [
  { xb: 'LT', ps: 'L2', action: 'Brake and reverse' },
  { xb: 'LB', ps: 'L1', action: 'Nitrous' },
  { xb: 'LS', ps: 'L3', action: 'Steer; press in for horn' },
  { xb: 'D-pad ↑', ps: 'D-pad ↑', action: 'Start event' },
  { xb: 'D-pad ←', ps: 'D-pad ←', action: 'Map' },
  { xb: 'D-pad →', ps: 'D-pad →', action: 'Messages' },
  { xb: 'RT', ps: 'R2', action: 'Throttle' },
  { xb: 'RB', ps: 'R1', action: 'Handbrake' },
  { xb: 'A', ps: 'Cross', action: 'Shift up' },
  { xb: 'X', ps: 'Square', action: 'Shift down' },
  { xb: 'Y', ps: 'Triangle', action: 'Camera' },
  { xb: 'B', ps: 'Circle', action: 'Look back' },
  { xb: 'RS', ps: 'R3', action: 'Quick chat' },
  { xb: 'View', ps: 'Create', action: 'Respawn' },
  { xb: 'Menu', ps: 'Options', action: 'Pause' },
];

function ControlsReactPanel() {
  const [state, setState] = useState({ tab: 'keys', family: 'xb', steering: 'buttons', steeringOptions: [], levelHorizon: true,
    touchSize: 'auto', touchSizeOptions: [], menuSize: 'auto', menuSizeOptions: [] });
  const rootRef = useRef(null);

  useEffect(() => {
    const update = () => {
      const next = window.__trpControlsBridge?.snapshot();
      if (next) setState(next);
    };
    window.addEventListener('trp-controls-ready', update);
    window.addEventListener('trp-controls-changed', update);
    update();
    return () => {
      window.removeEventListener('trp-controls-ready', update);
      window.removeEventListener('trp-controls-changed', update);
    };
  }, []);

  useEffect(() => {
    if (rootRef.current) window.__trpTranslateReact?.(rootRef.current);
  }, [state]);

  const setTab = tab => window.__trpControlsBridge?.showTab(tab);
  return (
    <section className="trp-controls-react-workbench" ref={rootRef} aria-label="Control configuration">
      <div className="trp-controls-react-tabs" role="tablist" aria-label="Controls">
        <button type="button" role="tab" aria-selected={state.tab === 'keys'} onClick={() => setTab('keys')}><span data-i18n>Keyboard</span><small>01</small></button>
        <button type="button" role="tab" aria-selected={state.tab === 'pad'} onClick={() => setTab('pad')}><span data-i18n>Controller</span><small>02</small></button>
        <button type="button" role="tab" aria-selected={state.tab === 'site'} onClick={() => setTab('site')}><span data-i18n>Site</span><small>03</small></button>
      </div>

      {state.tab === 'keys' && (
        <div className="trp-controls-react-panel" role="tabpanel">
          <div className="trp-controls-react-intro"><div><span className="trp-eyebrow" data-i18n>INPUT MAP / 01</span><h3 data-i18n>Keyboard controls</h3></div><p data-i18n>Change game keys in the game's Options, Controls menu.</p></div>
          <div className="trp-control-key-grid">
            {CONTROL_KEYS.map((item, index) => (
              <div className="trp-control-key-row" key={index}>
                <div className="trp-control-key-caps">{item.keys.map(key => <kbd key={key}>{key}</kbd>)}</div>
                <span data-i18n>{item.action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {state.tab === 'pad' && (
        <div className="trp-controls-react-panel" role="tabpanel">
          <div className="trp-controls-react-intro">
            <div><span className="trp-eyebrow" data-i18n>GAMEPAD MAP / 02</span><h3 data-i18n>Controller mapping</h3></div>
            <div className="trp-controller-family" role="group" aria-label="Button names">
              <button type="button" aria-pressed={state.family === 'xb'} onClick={() => window.__trpControlsBridge?.setFamily('xb')}>Xbox</button>
              <button type="button" aria-pressed={state.family === 'ps'} onClick={() => window.__trpControlsBridge?.setFamily('ps')}>PlayStation</button>
            </div>
          </div>
          <div className="trp-controller-map-grid">
            {CONTROLLER_KEYS.map((item, index) => (
              <div className="trp-controller-map-item" key={index}>
                <kbd>{state.family === 'ps' ? item.ps : item.xb}</kbd>
                <span data-i18n>{item.action}</span>
              </div>
            ))}
          </div>
          <p className="trp-controls-react-note" data-i18n>Connecting or taking control with a PlayStation controller updates the selected button names automatically.</p>
        </div>
      )}

      {state.tab === 'site' && (
        <div className="trp-controls-react-panel" role="tabpanel">
          <div className="trp-controls-react-intro"><div><span className="trp-eyebrow" data-i18n>BROWSER SHORTCUTS / 03</span><h3 data-i18n>Site shortcuts</h3></div><p data-i18n>Actions handled by the web page while the game is running.</p></div>
          <div className="trp-control-key-grid">
            {[['F9', 'Menu: full screen, controls, log, quit'], ['Home / both sticks', 'Open the menu on a controller'], ['F8', 'Frame-rate counter'], ['F12', 'Screenshot, shown in Saves'], ['Hold Esc', 'Leave full screen']].map(([key, action]) => (
              <div className="trp-control-key-row" key={key}><div className="trp-control-key-caps"><kbd>{key}</kbd></div><span data-i18n>{action}</span></div>
            ))}
          </div>
        </div>
      )}

      <div className="trp-touch-settings-grid">
        <div className="trp-controls-react-intro trp-touch-settings-heading"><div><span className="trp-eyebrow" data-i18n>TOUCH / DEVICE INPUT</span><h3 data-i18n>Touch controls</h3></div><p data-i18n>These preferences are saved in this browser and are applied by the existing touch input service.</p></div>
        <label className="trp-touch-setting">
          <span data-i18n>Steering</span><small data-i18n>Choose buttons, thumb stick or tilt steering.</small>
          <select value={state.steering} onChange={event => window.__trpControlsBridge?.setSteering(event.target.value)}>
            {state.steeringOptions.map(option => <option key={option.value} value={option.value} data-i18n>{option.label}</option>)}
          </select>
        </label>
        <label className="trp-touch-setting trp-touch-setting-switch">
          <span data-i18n>Level horizon</span><small data-i18n>With tilt steering, keep the road horizon level as the phone turns.</small>
          <input type="checkbox" role="switch" checked={state.levelHorizon} onChange={event => window.__trpControlsBridge?.setLevelHorizon(event.target.checked)} />
        </label>
        <label className="trp-touch-setting">
          <span data-i18n>Control size</span><small data-i18n>Size of the touch controls shown while driving.</small>
          <select value={state.touchSize} onChange={event => window.__trpControlsBridge?.setTouchSize(event.target.value)}>
            {state.touchSizeOptions.map(option => <option key={option.value} value={option.value} data-i18n>{option.label}</option>)}
          </select>
        </label>
        <label className="trp-touch-setting">
          <span data-i18n>Menu button size</span><small data-i18n>Size of the game's small menu buttons and arrows.</small>
          <select value={state.menuSize} onChange={event => window.__trpControlsBridge?.setMenuSize(event.target.value)}>
            {state.menuSizeOptions.map(option => <option key={option.value} value={option.value} data-i18n>{option.label}</option>)}
          </select>
        </label>
      </div>
    </section>
  );
}

function ControlsDashboard() {
  const reduceMotion = useReducedMotion();
  const enter = reduceMotion ? false : { opacity: 0, y: 12 };
  const transition = { duration: reduceMotion ? 0 : .27, ease: [.2, .75, .25, 1] };
  return (
    <motion.div className="trp-route-page trp-controls-dashboard" initial={enter} animate={{ opacity: 1, y: 0 }} transition={transition}>
      <motion.section className="trp-controls-hero" initial={enter} animate={{ opacity: 1, y: 0 }} transition={transition}>
        <div className="trp-controls-hero-copy">
          <div className="trp-eyebrow"><Gamepad2 size={13} /> <span data-i18n>DRIVER INPUT / CONFIGURATION</span></div>
          <h2 data-i18n>Make every input count.</h2>
          <p data-i18n>Keyboard, controller and touch controls in one place. The live game launch dock and input controls remain owned by their runtime services.</p>
        </div>
        <div className="trp-controls-hero-badges">
          <span><kbd>01</kbd><b data-i18n>Keyboard</b></span>
          <span><kbd>02</kbd><b data-i18n>Controller</b></span>
          <span><kbd>03</kbd><b data-i18n>Touch</b></span>
        </div>
      </motion.section>
      <motion.section className="trp-controls-workspace-panel" initial={enter} animate={{ opacity: 1, y: 0 }} transition={{ ...transition, delay: reduceMotion ? 0 : .06 }}>
        <div className="trp-controls-panel-heading">
          <div><div className="trp-eyebrow" data-i18n>INPUT MAP / REACT</div><h3 data-i18n>Control layout</h3></div>
          <span className="trp-controls-status"><i /> <span data-i18n>Settings stay on this device</span></span>
        </div>
        <ControlsReactPanel />
      </motion.section>
    </motion.div>
  );
}


function UpdatesReactPanel() {
  const [snapshot, setSnapshot] = useState({ currentVersion: '—', serverVersion: '—', updateStatus: '', translationStatus: '', privacyStatus: '', reloadAvailable: false });
  const [busy, setBusy] = useState('');
  const rootRef = useRef(null);
  useEffect(() => {
    const update = () => {
      const next = window.__trpPlatformBridge?.snapshot();
      if (next) setSnapshot(next);
    };
    window.addEventListener('trp-platform-ready', update);
    window.addEventListener('trp-platform-changed', update);
    update();
    return () => {
      window.removeEventListener('trp-platform-ready', update);
      window.removeEventListener('trp-platform-changed', update);
    };
  }, []);
  useEffect(() => { if (rootRef.current) window.__trpTranslateReact?.(rootRef.current); }, [snapshot]);
  const run = async (key, action) => {
    const bridge = window.__trpPlatformBridge;
    if (!bridge) return;
    setBusy(key);
    try { await action(bridge); setSnapshot(bridge.snapshot()); }
    finally { setBusy(''); }
  };
  return (
    <div className="trp-system-react" ref={rootRef}>
      <div className="trp-system-version-grid">
        <div><span data-i18n>Current build</span><strong>{snapshot.currentVersion}</strong></div>
        <div><span data-i18n>Server build</span><strong>{snapshot.serverVersion}</strong></div>
      </div>
      <div className="trp-system-react-actions">
        <button type="button" disabled={busy !== ''} onClick={() => void run('updates', bridge => bridge.checkUpdates())}><span data-i18n>{busy === 'updates' ? 'Checking…' : 'Check for updates'}</span></button>
        {snapshot.reloadAvailable && <button type="button" className="is-primary" disabled={busy !== ''} onClick={() => window.__trpPlatformBridge?.reload()}><span data-i18n>Reload</span></button>}
        <button type="button" disabled={busy !== ''} onClick={() => window.__trpPlatformBridge?.openFirstRun()}><span data-i18n>First-run setup</span></button>
      </div>
      <p className="trp-system-react-status" role="status" aria-live="polite">{snapshot.updateStatus}</p>
      <div className="trp-system-subsection">
        <div><strong data-i18n>Translation quality</strong><p data-i18n>Checks language files for missing text, formatting placeholders and markup tokens.</p></div>
        <button type="button" disabled={busy !== ''} onClick={() => void run('translations', bridge => bridge.checkTranslations())}><span data-i18n>{busy === 'translations' ? 'Checking…' : 'Run translation checks'}</span></button>
      </div>
      <p className="trp-system-react-status" role="status" aria-live="polite">{snapshot.translationStatus}</p>
      <div className="trp-system-subsection">
        <div><strong data-i18n>Privacy &amp; security</strong><p data-i18n>Clear browser app preferences. Game saves and game settings are not deleted.</p></div>
        <button type="button" className="is-danger" disabled={busy !== ''} onClick={() => void run('privacy', async bridge => { await bridge.clearPreferences(); })}><span data-i18n>Clear app preferences</span></button>
      </div>
      <p className="trp-system-react-status" role="status" aria-live="polite">{snapshot.privacyStatus}</p>
    </div>
  );
}

function DiagnosticsReactPanel() {
  const [snapshot, setSnapshot] = useState({ items: [], busy: false });
  const [action, setAction] = useState('');
  const rootRef = useRef(null);
  useEffect(() => {
    const update = () => {
      const next = window.__trpDiagnosticsBridge?.snapshot();
      if (next) setSnapshot(next);
    };
    window.addEventListener('trp-diagnostics-ready', update);
    window.addEventListener('trp-diagnostics-changed', update);
    update();
    return () => {
      window.removeEventListener('trp-diagnostics-ready', update);
      window.removeEventListener('trp-diagnostics-changed', update);
    };
  }, []);
  useEffect(() => { if (rootRef.current) window.__trpTranslateReact?.(rootRef.current); }, [snapshot]);
  const refresh = async () => {
    const bridge = window.__trpDiagnosticsBridge;
    if (!bridge) return;
    setAction('refresh');
    try { await bridge.refresh(); setSnapshot(bridge.snapshot()); }
    finally { setAction(''); }
  };
  return (
    <div className="trp-diagnostics-react" ref={rootRef}>
      <div className="trp-diagnostics-react-actions">
        <button type="button" disabled={snapshot.busy || action !== ''} onClick={() => void refresh()}><span data-i18n>{snapshot.busy || action === 'refresh' ? 'Checking…' : 'Check again'}</span></button>
        <button type="button" disabled={action !== ''} onClick={() => window.__trpDiagnosticsBridge?.download()}><span data-i18n>Download diagnostic report</span></button>
      </div>
      <ul className="trp-diagnostics-react-list">
        {snapshot.items.map(item => (
          <li className={'trp-diagnostic-react-item is-' + item.state} key={item.id}>
            <span className="trp-diagnostic-react-icon" aria-hidden="true">{item.state === 'ok' ? '✓' : item.state === 'warn' ? '!' : item.state === 'fail' ? '×' : '…'}</span>
            <div><strong data-i18n>{item.label}</strong><p>{item.detail}{item.code ? ' ' + item.code : ''}</p></div>
            <span className="trp-diagnostic-react-state">{item.state.toUpperCase()}</span>
          </li>
        ))}
        {!snapshot.items.length && <li className="trp-diagnostics-empty" data-i18n>Diagnostics have not run yet.</li>}
      </ul>
    </div>
  );
}

function GameDataReactPanel() {
  const [snapshot, setSnapshot] = useState({ info: '', message: '', state: 'idle', busy: true, preloading: false, paused: false, progress: 0, showPreload: false, preloadLabel: 'Preload the game data', progressHidden: true });
  const [action, setAction] = useState('');
  const rootRef = useRef(null);
  useEffect(() => {
    const update = () => {
      const next = window.__trpSavesBridge?.gameDataSnapshot();
      if (next) setSnapshot(next);
    };
    window.addEventListener('trp-saves-ready', update);
    window.addEventListener('trp-saves-changed', update);
    update();
    return () => {
      window.removeEventListener('trp-saves-ready', update);
      window.removeEventListener('trp-saves-changed', update);
    };
  }, []);
  useEffect(() => { if (rootRef.current) window.__trpTranslateReact?.(rootRef.current); }, [snapshot]);
  const run = async (key, operation) => {
    const bridge = window.__trpSavesBridge;
    if (!bridge) return;
    setAction(key);
    try { await operation(bridge); setSnapshot(bridge.gameDataSnapshot()); }
    finally { setAction(''); }
  };
  return (
    <div className="trp-game-data-react" ref={rootRef}>
      <p className="trp-game-data-info">{snapshot.info}</p>
      {snapshot.preloading && <div className="trp-game-data-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={snapshot.progress}><span style={{ width: snapshot.progress + '%' }} /></div>}
      {snapshot.message && <p className={"trp-game-data-status" + (snapshot.messageWarn ? " is-warn" : "")} role="status">{snapshot.message}</p>}
      <div className="trp-system-react-actions">
        {snapshot.showPreload && <button type="button" disabled={snapshot.busy || action !== '' || snapshot.paused} onClick={() => void run('preload', bridge => bridge.togglePreload())}><span data-i18n>{action === 'preload' ? 'Working…' : snapshot.preloadLabel}</span></button>}
        <button type="button" className="is-danger" disabled={snapshot.busy || action !== ''} onClick={() => void run('clear', bridge => bridge.clearGameData())}><span data-i18n>Delete the game data on this PC</span></button>
      </div>
    </div>
  );
}

function SystemDashboard() {
  const reduceMotion = useReducedMotion();
  const enter = reduceMotion ? false : { opacity: 0, y: 12 };
  const transition = { duration: reduceMotion ? 0 : .27, ease: [.2, .75, .25, 1] };
  return (
    <motion.div className="trp-route-page trp-system-dashboard" initial={enter} animate={{ opacity: 1, y: 0 }} transition={transition}>
      <motion.section className="trp-system-hero" initial={enter} animate={{ opacity: 1, y: 0 }} transition={transition}>
        <div className="trp-system-hero-copy">
          <div className="trp-eyebrow"><Gauge size={13} /> <span data-i18n>SYSTEM STATUS / OVERVIEW</span></div>
          <h2 data-i18n>Know what is ready.</h2>
          <p data-i18n>Check app updates, browser compatibility, storage and the game data kept on this device.</p>
        </div>
        <div className="trp-system-hero-stamp"><span data-i18n>LIVE CHECKS</span><strong>TRP / SYS</strong></div>
      </motion.section>
      <motion.section className="trp-system-panel" initial={enter} animate={{ opacity: 1, y: 0 }} transition={{ ...transition, delay: reduceMotion ? 0 : .05 }}>
        <div className="trp-system-panel-head"><div><div className="trp-eyebrow" data-i18n>RELEASE / SECURITY / 01</div><h3 data-i18n>Updates and security</h3><p data-i18n>Build availability, translation files, privacy and first-run setup.</p></div><span className="trp-system-index">01</span></div>
        <UpdatesReactPanel />
      </motion.section>
      <motion.section className="trp-system-panel" initial={enter} animate={{ opacity: 1, y: 0 }} transition={{ ...transition, delay: reduceMotion ? 0 : .1 }}>
        <div className="trp-system-panel-head"><div><div className="trp-eyebrow" data-i18n>DIAGNOSTICS / 02</div><h3 data-i18n>Browser and runtime checks</h3><p data-i18n>Inspect the current browser, graphics, security, storage and game module.</p></div><span className="trp-system-index">02</span></div>
        <DiagnosticsReactPanel />
      </motion.section>
      <motion.section className="trp-system-panel" initial={enter} animate={{ opacity: 1, y: 0 }} transition={{ ...transition, delay: reduceMotion ? 0 : .15 }}>
        <div className="trp-system-panel-head"><div><div className="trp-eyebrow" data-i18n>LOCAL GAME DATA / 03</div><h3 data-i18n>Game data on this device</h3><p data-i18n>Review cached game data, preload what is missing, or clear the local copy.</p></div><span className="trp-system-index">03</span></div>
        <GameDataReactPanel />
      </motion.section>
    </motion.div>
  );
}

function SettingsReactControls() {
  const [snapshot, setSnapshot] = useState({ ready: false, readOnly: true, note: 'Loading settings…', groups: [] });
  const [status, setStatus] = useState('');
  const [previewing, setPreviewing] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [drafts, setDrafts] = useState({});
  const rootRef = useRef(null);

  useEffect(() => {
    const update = () => setSnapshot(window.__trpSettingsBridge?.snapshot() ?? { ready: false, readOnly: true, note: 'Loading settings…', groups: [] });
    window.addEventListener('trp-settings-ready', update);
    window.addEventListener('trp-settings-changed', update);
    update();
    return () => {
      window.removeEventListener('trp-settings-ready', update);
      window.removeEventListener('trp-settings-changed', update);
    };
  }, []);

  useEffect(() => {
    if (rootRef.current) window.__trpTranslateReact?.(rootRef.current);
  }, [snapshot, status, previewing]);

  const update = async (key, value) => {
    const bridge = window.__trpSettingsBridge;
    if (!bridge) return false;
    setBusyKey(key);
    setStatus('');
    try {
      await bridge.setOption(key, value);
      setSnapshot(bridge.snapshot());
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
      return false;
    } finally { setBusyKey(''); }
  };
  const reset = async key => {
    const bridge = window.__trpSettingsBridge;
    if (!bridge) return;
    setBusyKey(key);
    setStatus('');
    try {
      await bridge.resetOption(key);
      setSnapshot(bridge.snapshot());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally { setBusyKey(''); }
  };
  const preview = async (key, value) => {
    const bridge = window.__trpSettingsBridge;
    if (!bridge) return;
    if (previewing === key) {
      bridge.stopPreviewOption(key);
      setPreviewing('');
      return;
    }
    setPreviewing(key);
    try { await bridge.previewOption(key, value); }
    catch { /* audio preview is optional; the saved setting remains available */ }
    finally { setPreviewing(current => current === key ? '' : current); }
  };

  const renderItem = item => {
    const disabled = snapshot.readOnly || busyKey === item.key || !snapshot.ready;
    const checked = (item.value === 'on') !== !!item.inverted;
    const inputValue = Object.prototype.hasOwnProperty.call(drafts, item.key) ? drafts[item.key] : item.value;
    return (
      <article className="trp-settings-react-item" key={item.key}>
        <div className="trp-settings-react-copy">
          <strong data-i18n>{item.label}</strong>
          <p data-i18n>{item.help}</p>
          {item.link && <a href={item.link.href} target="_blank" rel="noopener noreferrer">{item.link.text}</a>}
        </div>
        <div className="trp-settings-react-control">
          {item.control === 'switch' && (
            <label className="trp-settings-switch">
              <span data-i18n>{checked ? 'On' : 'Off'}</span>
              <input type="checkbox" role="switch" checked={checked} disabled={disabled}
                onChange={event => void update(item.key, event.target.checked !== !!item.inverted ? 'on' : 'off')} />
            </label>
          )}
          {(item.control === 'seg' || item.control === 'select') && (
            <div className="trp-settings-select-wrap">
              <select value={item.value} disabled={disabled} onChange={event => void update(item.key, event.target.value)}>
                {item.options.map(option => <option key={option.value} value={option.value} data-i18n>{option.label}</option>)}
              </select>
              {item.preview && <button type="button" className="trp-settings-preview" disabled={disabled}
                aria-pressed={previewing === item.key} onClick={() => void preview(item.key, item.value)}>
                <span data-i18n>{previewing === item.key ? 'Stop' : 'Listen'}</span>
              </button>}
            </div>
          )}
          {(item.control === 'text' || item.control === 'num') && (
            <input type={item.control === 'num' ? 'number' : 'text'} value={inputValue} disabled={disabled}
              min={item.min} max={item.max} step={item.step} placeholder={item.placeholder || ''}
              onChange={event => setDrafts(current => ({ ...current, [item.key]: event.target.value }))}
              onBlur={event => {
                if (event.target.value !== item.value) {
                  void update(item.key, event.target.value).then(ok => {
                    if (ok) setDrafts(current => { const next = { ...current }; delete next[item.key]; return next; });
                  });
                } else {
                  setDrafts(current => { const next = { ...current }; delete next[item.key]; return next; });
                }
              }}
              onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
          )}
          {item.modified && <button type="button" className="trp-settings-reset" disabled={disabled} onClick={() => void reset(item.key)}><span data-i18n>Reset</span></button>}
        </div>
      </article>
    );
  };

  return (
    <section className="trp-settings-react" ref={rootRef} aria-label="Game settings">
      <p className="trp-settings-react-note" role="status" aria-live="polite">{snapshot.note}</p>
      {status && <p className="trp-settings-react-error" role="alert">{status}</p>}
      {!snapshot.ready ? <div className="trp-settings-react-loading" data-i18n>Loading settings…</div> : snapshot.groups.map((group, index) => {
        const primary = group.items.filter(item => !item.more);
        const extra = group.items.filter(item => item.more);
        return (
          <section className="trp-settings-react-group" key={group.title}>
            <div className="trp-settings-react-group-title"><span className="trp-eyebrow">{String(index + 1).padStart(2, '0')} / GAME CONFIGURATION</span><h4 data-i18n>{group.title}</h4></div>
            {primary.map(renderItem)}
            {extra.length > 0 && (
              <details className="trp-settings-react-more">
                <summary data-i18n>{group.moreLabel}</summary>
                {extra.map(renderItem)}
              </details>
            )}
          </section>
        );
      })}
    </section>
  );
}

function SettingsProfilesReactControls() {
  const [profiles, setProfiles] = useState([]);
  const [selected, setSelected] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [readOnly, setReadOnly] = useState(true);
  const rootRef = useRef(null);
  const refresh = useCallback(() => {
    const bridge = window.__trpSettingsProfilesBridge;
    if (!bridge) return;
    const next = bridge.snapshot();
    setProfiles(next);
    setReadOnly(bridge.readOnly());
    setSelected(current => next.some(profile => profile.id === current) ? current : (next[0]?.id ?? ''));
  }, []);

  useEffect(() => {
    const update = () => refresh();
    window.addEventListener('trp-settings-profiles-ready', update);
    window.addEventListener('trp-settings-profiles-changed', update);
    window.addEventListener('trp-settings-changed', update);
    refresh();
    return () => {
      window.removeEventListener('trp-settings-profiles-ready', update);
      window.removeEventListener('trp-settings-profiles-changed', update);
      window.removeEventListener('trp-settings-changed', update);
    };
  }, [refresh]);
  useEffect(() => { if (rootRef.current) window.__trpTranslateReact?.(rootRef.current); }, [profiles, selected, message, readOnly]);

  const run = async (key, action) => {
    const bridge = window.__trpSettingsProfilesBridge;
    if (!bridge || busy || readOnly) return null;
    setBusy(key);
    setMessage('');
    try {
      const result = await action(bridge);
      if (result?.profiles) setProfiles(result.profiles);
      if (result?.message) setMessage(result.message);
      refresh();
      return result;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      return null;
    } finally { setBusy(''); }
  };

  const save = async () => {
    const wanted = name.trim();
    const result = await run('save', bridge => bridge.save(wanted));
    if (result?.message === t('Profile saved.')) {
      const found = result.profiles?.find(profile => profile.name.toLowerCase() === wanted.toLowerCase());
      if (found) setSelected(found.id);
      setName('');
    }
  };
  const importFile = event => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file) void run('import', bridge => bridge.import(file));
  };

  return (
    <section className="trp-settings-profiles-react" ref={rootRef} aria-labelledby="trp-settings-profiles-title">
      <div className="trp-settings-profiles-heading">
        <div><span className="trp-eyebrow" data-i18n>LOCAL CONFIGURATION / PROFILES</span><h3 id="trp-settings-profiles-title" data-i18n>Configuration profiles</h3></div>
        <span className="trp-settings-profile-count">{profiles.length} / 30</span>
      </div>
      <p className="trp-settings-react-note" data-i18n>Profiles contain only supported settings. Save a setup for later or move it to another browser with a JSON file.</p>
      <div className="trp-settings-profile-save">
        <label><span data-i18n>Profile name</span><input type="text" value={name} maxLength={40} disabled={readOnly || busy !== ''} placeholder={t('Profile name')}
          onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void save(); } }} /></label>
        <button type="button" disabled={readOnly || busy !== '' || !name.trim()} onClick={() => void save()}><span data-i18n>{busy === 'save' ? 'Saving…' : 'Save current profile'}</span></button>
      </div>
      <div className="trp-settings-profile-actions">
        <label><span data-i18n>Saved profiles in this browser</span>
          <select value={selected} disabled={!profiles.length || busy !== ''} onChange={event => setSelected(event.target.value)}>
            {profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
          </select>
        </label>
        <button type="button" disabled={readOnly || !selected || busy !== ''} onClick={() => void run('apply', bridge => bridge.apply(selected))}><span data-i18n>{busy === 'apply' ? 'Applying…' : 'Apply profile'}</span></button>
        <button type="button" disabled={!selected || busy !== ''} onClick={() => {
          const file = window.__trpSettingsProfilesBridge?.export(selected);
          if (file) downloadJsonExport(file);
        }}><span data-i18n>Export profile</span></button>
        <button type="button" className="is-danger" disabled={readOnly || !selected || busy !== ''} onClick={() => void run('delete', bridge => bridge.remove(selected))}><span data-i18n>Delete profile</span></button>
        <label className={'trp-settings-file-action' + (readOnly || busy !== '' ? ' is-disabled' : '')}>
          <span data-i18n>Import profile</span><input type="file" accept="application/json,.json" disabled={readOnly || busy !== ''} onChange={importFile} />
        </label>
      </div>
      {message && <p className="trp-settings-react-note" role="status" aria-live="polite">{message}</p>}
    </section>
  );
}

function SettingsPresetsReactControls() {
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const options = [
    { id: 'performance', name: 'Performance', detail: 'Prioritize frame rate and responsiveness.' },
    { id: 'balanced', name: 'Balanced', detail: 'Use the default balance of image quality and speed.' },
    { id: 'quality', name: 'High quality', detail: 'Prefer a larger render scale and richer audio response.' },
  ];
  const apply = async id => {
    const bridge = window.__trpSettingsProfilesBridge;
    if (!bridge || busy || bridge.readOnly()) return;
    setBusy(id);
    setMessage('');
    try {
      const result = await bridge.preset(id);
      setMessage(result.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(''); }
  };
  return (
    <section className="trp-settings-presets-react" aria-labelledby="trp-settings-presets-title">
      <div className="trp-settings-profiles-heading">
        <div><span className="trp-eyebrow" data-i18n>QUICK CONFIGURATION / PRESETS</span><h3 id="trp-settings-presets-title" data-i18n>Quick presets</h3></div>
      </div>
      <p className="trp-settings-react-note" data-i18n>Choose a starting point; all options remain editable below.</p>
      <div className="trp-settings-presets-grid">
        {options.map(option => (
          <button type="button" className="trp-settings-preset-card" key={option.id} disabled={busy !== '' || !!window.__trpSettingsProfilesBridge?.readOnly()} onClick={() => void apply(option.id)}>
            <span className={'trp-settings-preset-symbol is-' + option.id}>{option.id === 'performance' ? '01' : option.id === 'balanced' ? '02' : '03'}</span>
            <strong data-i18n>{option.name}</strong><small data-i18n>{option.detail}</small>
            <em data-i18n>{busy === option.id ? 'Applying…' : 'Apply preset'}</em>
          </button>
        ))}
      </div>
      {message && <p className="trp-settings-react-note" role="status" aria-live="polite">{message}</p>}
    </section>
  );
}

function SettingsRawReactControls() {
  const [snapshot, setSnapshot] = useState({ ready: false, readOnly: true, text: '', canResetAll: false, other: [] });
  const [value, setValue] = useState('');
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const rootRef = useRef(null);

  const refresh = useCallback((force = false) => {
    const next = window.__trpSettingsBridge?.rawSnapshot();
    if (!next) return;
    setSnapshot(next);
    if (force || !dirty) setValue(next.text);
  }, [dirty]);

  useEffect(() => {
    const update = () => refresh();
    window.addEventListener('trp-settings-ready', update);
    window.addEventListener('trp-settings-changed', update);
    refresh(true);
    return () => {
      window.removeEventListener('trp-settings-ready', update);
      window.removeEventListener('trp-settings-changed', update);
    };
  }, [refresh]);
  useEffect(() => { if (rootRef.current) window.__trpTranslateReact?.(rootRef.current); }, [snapshot, message]);

  const save = async () => {
    const bridge = window.__trpSettingsBridge;
    if (!bridge || snapshot.readOnly || busy) return;
    setBusy('save'); setMessage('');
    try {
      const note = await bridge.saveRaw(value);
      setMessage(note); setDirty(false); refresh(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(''); }
  };
  const resetAll = async () => {
    const bridge = window.__trpSettingsBridge;
    if (!bridge || snapshot.readOnly || busy) return;
    setBusy('reset'); setMessage('');
    try {
      const reset = await bridge.resetAll();
      if (reset) { setDirty(false); refresh(true); setMessage(t('Settings are back to their defaults.')); }
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(''); }
  };
  const resetOther = async item => {
    const bridge = window.__trpSettingsBridge;
    if (!bridge || snapshot.readOnly || busy) return;
    setBusy('other:' + item.line); setMessage('');
    try {
      await bridge.resetOther(item.line, item.key);
      setDirty(false); refresh(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(''); }
  };

  return (
    <section className="trp-settings-raw-react" ref={rootRef} aria-labelledby="trp-settings-raw-title">
      <div className="trp-settings-profiles-heading">
        <div><span className="trp-eyebrow" data-i18n>ADVANCED / SETTINGS.INI</span><h3 id="trp-settings-raw-title" data-i18n>Edit settings.ini as text</h3></div>
        <span className="trp-settings-profile-count">{value.split('\\n').length} <span data-i18n>lines</span></span>
      </div>
      <p className="trp-settings-react-note" data-i18n>Advanced editor for the complete game configuration. Unsupported or ignored entries are still checked by the original settings parser.</p>
      <textarea value={value} rows={18} spellCheck={false} wrap="off" readOnly={snapshot.readOnly || !snapshot.ready}
        aria-label="settings.ini" onChange={event => { setValue(event.target.value); setDirty(true); }} />
      <div className="trp-settings-raw-actions">
        <button type="button" disabled={snapshot.readOnly || !dirty || busy !== ''} onClick={() => void save()}><span data-i18n>{busy === 'save' ? 'Saving…' : 'Save file'}</span></button>
        <button type="button" className="is-danger" disabled={snapshot.readOnly || !snapshot.canResetAll || busy !== ''} onClick={() => void resetAll()}><span data-i18n>Reset all settings</span></button>
      </div>
      {message && <p className="trp-settings-react-note" role="status" aria-live="polite">{message}</p>}
      {!!snapshot.other.length && (
        <div className="trp-settings-other-react">
          <h4 data-i18n>Other settings in this file</h4>
          <p data-i18n>Entries not represented by a regular setting control. They remain effective where the game runtime supports them.</p>
          <ul>
            {snapshot.other.map(item => (
              <li key={item.line + ':' + item.key}>
                <code>{'line ' + item.line + ': ' + item.key + ' = ' + item.value}</code>
                {item.refused && <small>{item.refused}</small>}
                {item.env && <small>{'Sets ' + item.env}</small>}
                <button type="button" disabled={snapshot.readOnly || busy !== ''} onClick={() => void resetOther(item)}><span data-i18n>Reset</span></button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

const ACCESSIBILITY_OPTIONS = [
  { key: 'largeText', label: 'Larger text', detail: 'Increase interface text size across the page.' },
  { key: 'reduceMotion', label: 'Reduce animations', detail: 'Limit non-essential interface movement and transitions.' },
  { key: 'highContrast', label: 'High contrast', detail: 'Increase contrast between text, controls and backgrounds.' },
];

function AccessibilityReactControls() {
  const [preferences, setPreferences] = useState({ largeText: false, reduceMotion: false, highContrast: false });
  const [ready, setReady] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const update = () => {
      const bridge = window.__trpAccessibilityBridge;
      if (!bridge) return;
      setPreferences(bridge.current());
      setReady(true);
    };
    window.addEventListener('trp-accessibility-ready', update);
    window.addEventListener('trp-accessibility-changed', update);
    update();
    return () => {
      window.removeEventListener('trp-accessibility-ready', update);
      window.removeEventListener('trp-accessibility-changed', update);
    };
  }, []);

  useEffect(() => {
    if (rootRef.current) window.__trpTranslateReact?.(rootRef.current);
  }, [preferences, ready]);

  const change = (key, value) => {
    const bridge = window.__trpAccessibilityBridge;
    if (!bridge) return;
    try {
      setPreferences(bridge.set(key, value));
      setReady(true);
    } catch {
      setPreferences(bridge.current());
    }
  };

  return (
    <div className="trp-a11y-react-options" ref={rootRef}>
      {ACCESSIBILITY_OPTIONS.map(option => (
        <label className="trp-a11y-option-card" key={option.key}>
          <span className="trp-a11y-option-copy">
            <strong data-i18n>{option.label}</strong>
            <small data-i18n>{option.detail}</small>
          </span>
          <input type="checkbox" role="switch" checked={!!preferences[option.key]}
            disabled={!ready} onChange={event => change(option.key, event.target.checked)} />
        </label>
      ))}
    </div>
  );
}

function SettingsDashboard() {
  const reduceMotion = useReducedMotion();
  const enter = reduceMotion ? false : { opacity: 0, y: 12 };
  const transition = { duration: reduceMotion ? 0 : .27, ease: [.2, .75, .25, 1] };
  return (
    <motion.div className="trp-route-page trp-settings-dashboard" initial={enter} animate={{ opacity: 1, y: 0 }} transition={transition}>
      <motion.section className="trp-settings-hero" initial={enter} animate={{ opacity: 1, y: 0 }} transition={transition}>
        <div className="trp-settings-hero-copy">
          <div className="trp-eyebrow"><Settings size={13} /> <span data-i18n>CONFIGURATION / DRIVER PROFILE</span></div>
          <h2 data-i18n>Tune your experience.</h2>
          <p data-i18n>Choose game settings, save reusable profiles and adjust browser accessibility. Game changes take effect the next time you start Play.</p>
        </div>
        <div className="trp-settings-hero-stamp"><span data-i18n>PROFILE</span><strong>NFSU2 / CONFIG</strong></div>
      </motion.section>

      <motion.section className="trp-settings-panel" initial={enter} animate={{ opacity: 1, y: 0 }} transition={{ ...transition, delay: reduceMotion ? 0 : .06 }}>
        <div className="trp-settings-panel-head">
          <div><div className="trp-eyebrow" data-i18n>GAME OPTIONS / 01</div><h3 data-i18n>Game configuration</h3><p data-i18n>Validated settings, configuration profiles and quick presets.</p></div>
          <span className="trp-settings-index">01</span>
        </div>
        <SettingsProfilesReactControls />
        <SettingsPresetsReactControls />
        <SettingsReactControls />
        <SettingsRawReactControls />

      </motion.section>

      <motion.section className="trp-settings-panel" initial={enter} animate={{ opacity: 1, y: 0 }} transition={{ ...transition, delay: reduceMotion ? 0 : .12 }}>
        <div className="trp-settings-panel-head">
          <div><div className="trp-eyebrow" data-i18n>DISPLAY / ACCESSIBILITY / 02</div><h3 data-i18n>Accessibility</h3><p data-i18n>Browser display preferences; these do not change the game's settings.ini.</p></div>
          <span className="trp-settings-index">02</span>
        </div>
        <AccessibilityReactControls />
      </motion.section>
    </motion.div>
  );
}

function LanguagePickerReact() {
  const [value, setValue] = useState(language());
  useEffect(() => {
    const sync = () => setValue(language());
    onLanguage(sync);
    window.addEventListener('trp-settings-ready', sync);
    window.addEventListener('trp-settings-changed', sync);
    sync();
    return () => {
      window.removeEventListener('trp-settings-ready', sync);
      window.removeEventListener('trp-settings-changed', sync);
    };
  }, []);
  const change = async next => {
    const changed = await setLanguage(next, message => console.warn(message));
    if (!changed) { setValue(language()); return; }
    const bridge = window.__trpSettingsBridge;
    // Page language is independent of game-save ownership; only persist to settings.ini when writable.
    if (bridge && !bridge.readOnly()) {
      try { await bridge.set('language', next); }
      catch (error) { window.showToast?.(error instanceof Error ? error.message : String(error)); }
    }
  };
  return (
    <label className="trp-language-react">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9M12 3C9.5 5.6 8.2 8.6 8.2 12s1.3 6.4 3.8 9"/></svg>
      <select aria-label={t('Language')} data-language-picker value={value} onChange={event => void change(event.target.value)}>
        {LANGUAGES.map(code => <option key={code} value={code} lang={code}>{NATIVE[code]}</option>)}
      </select>
    </label>
  );
}

function InstallAppReact() {
  const [state, setState] = useState({ installed: false, ready: false, disabled: false, label: 'Install app', notice: '', state: 'manual' });
  useEffect(() => {
    const update = () => {
      const next = window.__trpInstallBridge?.snapshot();
      if (next) setState(current => ({ ...next, notice: current.notice && !next.notice ? current.notice : next.notice }));
    };
    window.addEventListener('trp-install-changed', update);
    onLanguage(update);
    update();
    return () => window.removeEventListener('trp-install-changed', update);
  }, []);
  const install = async () => {
    const bridge = window.__trpInstallBridge;
    if (!bridge) return;
    try {
      const result = await bridge.install(), next = bridge.snapshot();
      setState({ ...next, notice: result.message || next.notice });
    } catch (error) {
      setState(current => ({ ...current, notice: error instanceof Error ? error.message : String(error) }));
    }
  };
  return (
    <>
      <button type="button" className={'trp-install-react' + (state.ready ? ' is-ready' : '') + (state.installed ? ' is-installed' : '')}
        disabled={state.disabled} aria-label={state.label} title={state.notice || state.label} onClick={() => void install()}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m-5-5 5 5 5-5M4 16v4h16v-4" /></svg>
        <span>{state.label}</span>
      </button>
      {state.notice && <p className="trp-install-react-notice" role="status" aria-live="polite">{state.notice}</p>}
    </>
  );
}


function TestEnvironmentNotice() {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  const preventDismiss = event => event.preventDefault();

  return createPortal(
    <dialog
      ref={dialogRef}
      className="trp-test-notice-dialog"
      aria-modal="true"
      aria-labelledby="trp-test-notice-title"
      aria-describedby="trp-test-notice-description"
      data-testid="test-environment-notice"
      onCancel={preventDismiss}
    >
      <div className="trp-test-notice-card">
        <div className="trp-test-notice-header">
          <span className="trp-test-notice-icon" aria-hidden="true">
            <AlertTriangle size={21} strokeWidth={1.8} />
          </span>
          <span className="trp-test-notice-kicker">{t(TEST_NOTICE_TEXT.kicker)}</span>
          <span className="trp-test-notice-mark">TRP / TEST</span>
        </div>
        <h2 id="trp-test-notice-title">{t(TEST_NOTICE_TEXT.title)}</h2>
        <div id="trp-test-notice-description" className="trp-test-notice-copy">
          <p>{t(TEST_NOTICE_TEXT.stability)}</p>
          <p>{t(TEST_NOTICE_TEXT.details)}</p>
          <p className="trp-test-notice-acknowledgement">{t(TEST_NOTICE_TEXT.acknowledgement)}</p>
        </div>
        <div className="trp-test-notice-footer">
          <span className="trp-test-notice-brand">TRPOLARIS / NFSU2 WEB</span>
          <button
            type="button"
            className="trp-test-notice-continue"
            autoFocus
            onClick={() => dialogRef.current?.close()}
          >
            <span>{t(TEST_NOTICE_TEXT.button)}</span>
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}

function App() {
  const reduceMotion = useReducedMotion();
  const initialHash = pageFromHash(location.hash);
  const initialRuntime = window.__trpRuntimeBridge?.snapshot();
  const [active, setActive] = useState(() => NAV.some(item => item.id === initialHash) ? initialHash : 'home');
  const [phase, setPhase] = useState(initialRuntime?.phase || document.body.dataset.phase || 'boot');
  const [statusText, setStatusText] = useState(initialRuntime?.statusText || '');
  const [runtimeLocked, setRuntimeLocked] = useState(() => Boolean(initialRuntime?.locked));
  const [transitioning, setTransitioning] = useState(false);
  // Route headings are React-owned; refresh their t() output when the page language changes.
  const [languageRevision, setLanguageRevision] = useState(0);
  const rootRef = useRef(null);
  const activeItem = useMemo(() => NAV.find(item => item.id === active) || NAV[0], [active]);

  const syncStatus = useCallback(() => {
    const current = window.__trpRuntimeBridge?.snapshot();
    if (!current) return;
    setPhase(current.phase || 'boot');
    setStatusText(current.statusText || '');
    setRuntimeLocked(Boolean(current.locked));
  }, []);

  const navigate = useCallback((id) => {
    if (!NAV.some(item => item.id === id)) return;
    const pageHash = {
      home: 'home-page', online: 'online', mods: 'mods', saves: 'saves',
      controls: 'controls', settings: 'settings', system: 'diagnostics', about: 'about',
    };
    const hash = '#' + (pageHash[id] || 'home-page');
    if (location.hash !== hash) history.pushState({ page: id }, '', hash);
    setActive(id);
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [reduceMotion]);

  useEffect(() => {
    const onHashChange = () => setActive(pageFromHash(location.hash));
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onHashChange);
    window.addEventListener('trp-runtime-ready', syncStatus);
    window.addEventListener('trp-runtime-changed', syncStatus);
    syncStatus();
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onHashChange);
      window.removeEventListener('trp-runtime-ready', syncStatus);
      window.removeEventListener('trp-runtime-changed', syncStatus);
    };
  }, [syncStatus]);

  useEffect(() => {
    onLanguage(() => setLanguageRevision(revision => revision + 1));
  }, []);

  useLayoutEffect(() => {
    if (rootRef.current && typeof window.__trpTranslateReact === 'function') {
      window.__trpTranslateReact(rootRef.current);
    }
  }, [active, phase, statusText, runtimeLocked, languageRevision]);

  useEffect(() => {
    if (reduceMotion) return undefined;
    setTransitioning(true);
    const timer = window.setTimeout(() => setTransitioning(false), 170);
    return () => window.clearTimeout(timer);
  }, [active, reduceMotion]);

  const phaseLabel = PHASE_LABELS[phase] || 'TRPOLARIS';
  const connectedTone = phase === 'ready' || phase === 'playing';
  const gameActive = runtimeLocked || phase === 'playing' || phase === 'starting';

  return (
    <div ref={rootRef} className={'trp-react-shell' + (active === 'home' ? ' is-home' : '')}>
      <TestEnvironmentNotice />
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
                aria-current={selected ? 'page' : undefined} data-page={item.id} title={item.detail}>
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
            <span>TRPOLARIS</span><ChevronRight size={14} /><strong>{t(activeItem.label)}</strong>
          </div>
          <div className="trp-topbar-actions">
            <div className="trp-build-label"><span className={'trp-live-indicator' + (connectedTone ? ' is-live' : '')} /> {phaseLabel}</div>
            <LanguagePickerReact />
            <InstallAppReact />
            <a className="trp-top-hub" href="/hub/"><Users size={16} /><span>Player Hub</span><ArrowUpRight size={14} /></a>
          </div>
        </header>

        <div className="trp-content">
          <div className="trp-content-heading">
            <div key={activeItem.id}>
              <div className="trp-eyebrow" data-i18n>BAYVIEW / NIGHT DRIVER SYSTEM</div>
              <h1>{t(activeItem.label)}.</h1>
              <p>{t(activeItem.detail)} <span>·</span> TRPOLARIS NFSU2 Web</p>
            </div>
            <div className="trp-heading-index" aria-hidden="true"><span>EXPERIENCE</span><strong>02</strong></div>
          </div>

          <motion.div className="trp-page-frame" initial={false}
            animate={transitioning ? { opacity: .78, y: 7, filter: 'blur(1.5px)' } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: reduceMotion ? 0 : .19, ease: [0.2, 0.75, 0.25, 1] }}>
            {active === 'home' && !gameActive && <HomeDashboard onNavigate={navigate} />}
            {active === 'online' && !gameActive && <OnlineDashboard />}
            {active === 'settings' && !gameActive && <SettingsDashboard />}
            {active === 'system' && !gameActive && <SystemDashboard />}
            {active === 'controls' && !gameActive && <ControlsDashboard />}
            {active === 'saves' && !gameActive && <SavesDashboard />}
            {active === 'mods' && !gameActive && <ModLibraryDashboard />}
            {active === 'about' && !gameActive && <AboutDashboard />}

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
if (rootNode) {
  const root = createRoot(rootNode);
  flushSync(() => root.render(<App />));
}
