import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { checkCrew, CREW_BIG, CREW_COLOUR_NAMES, CREW_MAX, CREW_PALETTE, freeColour } from '../app/crews';
import { t } from '../app/i18n';
import { CATS, DEFAULT_GROUPS, DEFAULT_PHRASES, PHRASES } from '../app/phrases';
import { flushSync } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Activity, ArrowUpRight, CarFront, ChevronRight, Gamepad2, Gauge,
  Info, LayoutDashboard, LibraryBig, MessageCircle, Save, Settings, ShieldCheck, Users,
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


const ONLINE_FEATURES = [
  { title: 'Free Roam', detail: 'Meet other drivers in the city and see their names above their cars.', icon: CarFront, tone: 'coral' },
  { title: 'Online mode', detail: 'Enter the game’s Online menu for lobbies, chat and races on this server.', icon: Gamepad2, tone: 'violet' },
  { title: 'Rooms and crews', detail: 'Use room names and crews to organize who appears together in Free Roam.', icon: Users, tone: 'green' },
];


function OnlineReactControls() {
  const statusRoot = useRef(null);
  const [values, setValues] = useState({ roam: 'off', online: 'off', roam_collide: 'off', quick_chat: 'off', roam_max_cars: '32' });
  const [textValues, setTextValues] = useState({ roam_name: '', roam_room: '', roam_block: '' });
  const [crewList, setCrewListState] = useState([]);
  const [crewDraft, setCrewDraft] = useState('');
  const [quickChatDraft, setQuickChatDraft] = useState({ phrases: [...DEFAULT_PHRASES], groups: [...DEFAULT_GROUPS] });
  const [ready, setReady] = useState(false);
  const [readOnly, setReadOnly] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const statusText = !ready ? 'Loading' : readOnly ? 'Read only' : '';

  useLayoutEffect(() => {
    if (statusRoot.current && typeof window.__trpTranslateReact === 'function') {
      window.__trpTranslateReact(statusRoot.current);
    }
  }, [values, textValues, crewList, crewDraft, quickChatDraft, message, ready, readOnly, busy, statusText]);

  const sync = useCallback(() => {
    const bridge = window.__trpSettingsBridge;
    if (!bridge) return;
    try {
      setValues({
        roam: bridge.current('roam'), online: bridge.current('online'),
        roam_collide: bridge.current('roam_collide'), quick_chat: bridge.current('quick_chat'),
        roam_max_cars: bridge.current('roam_max_cars'),
      });
      setTextValues({
        roam_name: bridge.current('roam_name'), roam_room: bridge.current('roam_room'),
        roam_block: bridge.current('roam_block'),
      });
      setCrewListState(bridge.crews());
      setQuickChatDraft(bridge.quickChat());
      setReadOnly(bridge.readOnly());
      setReady(true);
    } catch { setReady(false); }
  }, []);

  useEffect(() => {
    const onSettings = () => sync();
    window.addEventListener('trp-settings-ready', onSettings);
    window.addEventListener('trp-settings-changed', onSettings);
    sync();
    const bridge = window.__trpSettingsBridge;
    if (bridge) void bridge.refresh().then(sync).catch(error => setMessage(String(error)));
    return () => {
      window.removeEventListener('trp-settings-ready', onSettings);
      window.removeEventListener('trp-settings-changed', onSettings);
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
      <label className="trp-online-toggle-card">
        <span className="trp-online-toggle-icon"><CarFront size={19} /></span>
        <span className="trp-online-toggle-copy">
          <strong data-i18n>Free roam with others</strong>
          <small data-i18n>Show your car to other players and see theirs in career free roam.</small>
          <em data-i18n data-i18n-src={!ready ? 'Loading' : readOnly ? 'Read only' : values.roam === 'on' ? 'On' : 'Off'}>{!ready ? 'Loading' : readOnly ? 'Read only' : values.roam === 'on' ? 'On' : 'Off'}</em>
        </span>
        <input type="checkbox" role="switch" checked={values.roam === 'on'} disabled={!ready || readOnly || !!busy}
          aria-label="Free roam with others" onChange={event => void update('roam', event.target.checked)} />
      </label>
      <label className="trp-online-toggle-card trp-online-toggle-violet">
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
      <div className="trp-online-text-grid">
        <label className="trp-online-text-card">
          <span className="trp-online-text-label" data-i18n>Your name</span>
          <span className="trp-online-text-help" data-i18n>The name other drivers see above your car.</span>
          <span className="trp-online-text-entry">
            <input type="text" maxLength={15} autoComplete="off" value={textValues.roam_name}
              disabled={!ready || readOnly || !!busy}
              onChange={event => setTextValues(current => ({ ...current, roam_name: event.target.value }))}
              onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void saveText('roam_name'); } }} />
            <button type="button" disabled={!ready || readOnly || !!busy} onClick={() => void saveText('roam_name')} data-i18n>Save</button>
          </span>
        </label>
        <label className="trp-online-text-card">
          <span className="trp-online-text-label" data-i18n>Room</span>
          <span className="trp-online-text-help" data-i18n>Leave empty to drive with everyone. A room name shows only matching Free Roam players.</span>
          <span className="trp-online-text-entry">
            <input type="text" maxLength={63} autoComplete="off" value={textValues.roam_room}
              disabled={!ready || readOnly || !!busy}
              onChange={event => setTextValues(current => ({ ...current, roam_room: event.target.value }))}
              onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void saveText('roam_room'); } }} />
            <button type="button" disabled={!ready || readOnly || !!busy} onClick={() => void saveText('roam_room')} data-i18n>Save</button>
          </span>
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
        <LegacyNode selector="#online" className="trp-online-legacy-slot" />
      </motion.section>
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
        <div className="trp-mod-hero-actions">
          <LegacyNode selector="#custom-mod-count" className="trp-mod-count-slot" />
          <LegacyNode selector="#packs-check" className="trp-mod-check-slot" />
        </div>
        <span className="trp-mod-hero-stamp" aria-hidden="true">WORKSHOP / 04</span>
      </motion.section>

      <motion.section className="trp-mod-panel" initial={enter} animate={{ opacity: 1, y: 0 }} transition={{ ...transition, delay: reduceMotion ? 0 : .06 }}>
        <div className="trp-mod-section-head">
          <div><div className="trp-eyebrow" data-i18n>COMMUNITY PICKS</div><h3 data-i18n>Recommended packs</h3></div>
          <span className="trp-mod-section-mark">01</span>
        </div>
        <div className="trp-react-pack-list" aria-live="polite"><LegacyNode selector="#pack-list" /></div>
      </motion.section>

      <motion.section className="trp-mod-panel" initial={enter} animate={{ opacity: 1, y: 0 }} transition={{ ...transition, delay: reduceMotion ? 0 : .1 }}>
        <div className="trp-mod-section-head trp-mod-collection-head">
          <div><div className="trp-eyebrow" data-i18n>YOUR COLLECTION</div><h3 data-i18n>Saved mod links</h3><p data-i18n>The mod list stores names and links only. It does not contain mod files.</p></div>
          <div className="trp-mod-filter"><label htmlFor="custom-mod-filter" data-i18n>Filter by category</label><LegacyNode selector="#custom-mod-filter" /></div>
        </div>
        <div className="trp-react-custom-mod-list"><LegacyNode selector="#custom-mod-list" /></div>
      </motion.section>

      <motion.section className="trp-mod-add-panel" initial={enter} animate={{ opacity: 1, y: 0 }} transition={{ ...transition, delay: reduceMotion ? 0 : .14 }}>
        <div className="trp-mod-add-heading">
          <div><div className="trp-eyebrow" data-i18n>PERSONAL LIBRARY</div><h3 data-i18n>Add or transfer links</h3></div>
          <span className="trp-mod-section-mark">03</span>
        </div>
        <LegacyNode selector="#mod-link-form" className="trp-mod-form-slot" />
      </motion.section>
    </motion.div>
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
        <div className="trp-saves-panel-head">
          <div><div className="trp-eyebrow" data-i18n>LOCAL STORAGE / 01</div><h3 data-i18n>Profiles in this browser</h3></div>
          <span className="trp-saves-index">01</span>
        </div>
        <p className="trp-saves-section-description" data-i18n>Profiles, screenshots, local backups and encrypted Cloud sync stay together in the same save manager.</p>
        <LegacyNode selector="#saves" className="trp-saves-legacy-slot" />
      </motion.section>
    </motion.div>
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
          <p data-i18n>Keyboard, controller and touch controls in one place. The live game mapping below follows the connected controller and current device.</p>
        </div>
        <div className="trp-controls-hero-badges">
          <span><kbd>01</kbd><b data-i18n>Keyboard</b></span>
          <span><kbd>02</kbd><b data-i18n>Controller</b></span>
          <span><kbd>03</kbd><b data-i18n>Touch</b></span>
        </div>
      </motion.section>
      <motion.section className="trp-controls-workspace-panel" initial={enter} animate={{ opacity: 1, y: 0 }} transition={{ ...transition, delay: reduceMotion ? 0 : .06 }}>
        <div className="trp-controls-panel-heading">
          <div><div className="trp-eyebrow" data-i18n>INPUT MAP / LIVE</div><h3 data-i18n>Control layout</h3></div>
          <span className="trp-controls-status"><i /> <span data-i18n>Settings stay on this device</span></span>
        </div>
        <LegacyNode selector="#controls" className="trp-controls-legacy-slot" />
      </motion.section>
    </motion.div>
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
        <div className="trp-system-hero-stamp">
          <span data-i18n>LIVE CHECKS</span><strong>TRP / SYS</strong>
        </div>
      </motion.section>
      <motion.section className="trp-system-panel" initial={enter} animate={{ opacity: 1, y: 0 }} transition={{ ...transition, delay: reduceMotion ? 0 : .05 }}>
        <div className="trp-system-panel-head">
          <div><div className="trp-eyebrow" data-i18n>RELEASE / SECURITY / 01</div><h3 data-i18n>Updates and security</h3><p data-i18n>Build availability, translation files, privacy and first-run setup.</p></div>
          <span className="trp-system-index">01</span>
        </div>
        <LegacyNode selector="#updates" className="trp-system-updates-slot" />
      </motion.section>
      <motion.section className="trp-system-panel" initial={enter} animate={{ opacity: 1, y: 0 }} transition={{ ...transition, delay: reduceMotion ? 0 : .1 }}>
        <div className="trp-system-panel-head">
          <div><div className="trp-eyebrow" data-i18n>DIAGNOSTICS / 02</div><h3 data-i18n>Browser and runtime checks</h3><p data-i18n>Inspect the current browser, graphics, security, storage and game module.</p></div>
          <span className="trp-system-index">02</span>
        </div>
        <LegacyNode selector="#diagnostics" className="trp-system-diagnostics-slot" />
      </motion.section>
      <motion.section className="trp-system-panel" initial={enter} animate={{ opacity: 1, y: 0 }} transition={{ ...transition, delay: reduceMotion ? 0 : .15 }}>
        <div className="trp-system-panel-head">
          <div><div className="trp-eyebrow" data-i18n>LOCAL GAME DATA / 03</div><h3 data-i18n>Game data on this device</h3><p data-i18n>Review cached game data, preload what is missing, or clear the local copy.</p></div>
          <span className="trp-system-index">03</span>
        </div>
        <LegacyNode selector="#game-data" className="trp-system-game-data-slot" />
      </motion.section>
    </motion.div>
  );
}

const LEGACY_PAGES = {
  settings: {
    eyebrow: 'CONFIGURATION / 07',
    headline: 'Tune your experience.',
    description: 'Adjust validated game options and browser display preferences.',
    icon: Settings,
    selectors: ['#settings', '#accessibility'],
  },
};

function LegacyRoutePage({ page }) {
  const reduceMotion = useReducedMotion();
  const config = LEGACY_PAGES[page];
  if (!config) return null;
  const Icon = config.icon;
  const enter = reduceMotion ? false : { opacity: 0, y: 12 };

  return (
    <motion.div className={'trp-route-page trp-legacy-route experience-shell trp-route-' + page}
      initial={enter} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : .27, ease: [.2, .75, .25, 1] }}>
      <motion.section className="trp-route-intro" initial={enter} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : .25 }}>
        <div className="trp-route-intro-icon"><Icon size={21} strokeWidth={1.8} /></div>
        <div className="trp-route-intro-copy">
          <div className="trp-eyebrow" data-i18n>{config.eyebrow}</div>
          <h2 data-i18n>{config.headline}</h2>
          <p data-i18n>{config.description}</p>
        </div>
        <span className="trp-route-intro-index" aria-hidden="true">TRP / {page.toUpperCase()}</span>
      </motion.section>
      <div className="trp-route-section-list">
        {config.selectors.map(selector => (
          <LegacyNode key={selector} selector={selector} className="trp-route-section-slot" />
        ))}
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
            {active === 'online' && !gameActive && <OnlineDashboard />}
            {active === 'settings' && !gameActive && <LegacyRoutePage page={active} />}
            {active === 'system' && !gameActive && <SystemDashboard />}
            {active === 'controls' && !gameActive && <ControlsDashboard />}
            {active === 'saves' && !gameActive && <SavesDashboard />}
            {active === 'mods' && !gameActive && <ModLibraryDashboard />}
            {active === 'about' && !gameActive && <AboutDashboard />}
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
