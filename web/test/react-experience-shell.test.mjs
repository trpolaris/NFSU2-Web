import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

const html = read('index.html');
const builder = read('build.mjs');
const app = read('src/ui/main.jsx');
const shellCss = read('src/static/react-shell.css');
const hub = read('src/hub/main.jsx');
const hubCss = read('src/hub/hub.css');
const runtime = read('src/app/shell.ts');
const gameEntry = read('src/main.ts');
const settingsUi = read('src/app/settings-ui.ts');
const navigation = read('src/app/ui-enhancements.js');
const settingsRuntime = read('src/app/shell.ts');

test('the main page loads its React shell before the legacy runtime boot sequence', () => {
  assert.match(html, /id="trp-react-root"/);
  const reactEntry = html.indexOf('src="/ui/main.js"');
  const runtimeEntry = html.indexOf('src="/main.js"');
  assert.ok(reactEntry >= 0 && runtimeEntry > reactEntry);
  assert.match(html, /href="\/react-shell\.css"/);
  assert.match(builder, /'ui\/main': 'src\/ui\/main\.jsx'/);
});

test('React owns the main navigation, route state and motion transitions', () => {
  assert.match(app, /from 'react'/);
  assert.match(app, /from 'react-dom\/client'/);
  assert.match(app, /from 'motion\/react'/);
  assert.match(app, /createRoot\(rootNode\)/);
  assert.match(app, /NAV\.map/);
  assert.match(app, /layoutId="trp-nav-active"/);
  assert.match(app, /LegacyAppHost app=\{legacyApp\}/);
  assert.match(app, /pageFromHash/);
  assert.match(app, /inert=\{phase === 'playing' \|\| phase === 'starting'\}/);
  assert.match(app, /useReducedMotion/);
});

test('the legacy runtime anchors remain present while React provides the page shell', () => {
  for (const id of ['app', 'lang-pick', 'install-app', 'home-page', 'play', 'progress', 'status', 'settings', 'online', 'saves', 'controls', 'diagnostics', 'game-data', 'stage']) {
    assert.match(html, new RegExp('id="' + id + '"'), id);
  }
  assert.match(app, /LegacyNode selector="\.lang-pick"/);
  assert.match(app, /LegacyNode selector="#install-app"/);
  assert.match(shellCss, /#app\.experience-shell/);
  assert.match(shellCss, /quick-nav \{ display:none/);
});

test('the React shell remains responsive and follows reduced-motion preferences', () => {
  assert.match(shellCss, /@media \(max-width:620px\)/);
  assert.match(shellCss, /@media \(max-width:860px\)/);
  assert.match(shellCss, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(app, /cdn\.jsdelivr\.net|fonts\.googleapis\.com/);
});

test('Player Hub uses React Motion navigation and communicates its real connection state', () => {
  assert.match(hub, /motion\.aside/);
  assert.match(hub, /layoutId="hub-nav-indicator"/);
  assert.match(hub, /BAĞLANTI BEKLENİYOR/);
  assert.match(hubCss, /\.hub-atmosphere/);
  assert.match(hubCss, /prefers-reduced-motion:\s*reduce/);
});


test('the home dashboard is React-owned while live game controls and status nodes remain bridged', () => {
  assert.match(app, /function HomeDashboard/);
  assert.match(app, /active === 'home' && !gameActive && <HomeDashboard/);
  for (const selector of ['#hero-particles', '.hero-visual', '#play-panel', '#home-status-panel']) {
    assert.ok(app.includes('selector="' + selector + '"'), 'live node is hosted: ' + selector);
  }
  assert.match(app, /onClick=\{event => jump\(event, item\.id\)\}/);
  assert.match(app, /HOME_LINKS\.map/);
  assert.match(shellCss, /\.trp-legacy-slot #app > #home-page \{ display:none!important; \}/);
  assert.match(shellCss, /\.trp-home-particles-slot,.trp-home-art-slot,.trp-home-play-slot,.trp-home-status-slot \{ display:contents; \}/);
  assert.match(shellCss, /trp-react-shell\.is-home \.trp-content-heading/);
});

test('the game stage is never placed inside an inert React root while page chrome is disabled during play', () => {
  assert.doesNotMatch(app, /<div className=\{[^}]*trp-react-shell[^}]*\} inert=/);
  assert.match(app, /<aside className="trp-sidebar" aria-label="Ana gezinme" inert=\{gameActive\}/);
  assert.match(app, /<header className="trp-topbar" inert=\{gameActive\}/);
  assert.ok(runtime.includes("$('#app').inert = true"), 'legacy app retains its existing game-session focus rule');
  assert.match(app, /runtimeObserver\.observe\(legacyApp, \{ attributes: true, attributeFilter: \['inert'\] \}\)/);
  assert.match(app, /setRuntimeLocked\(Boolean\(legacyApp\?\.inert\)\)/);
});


test('React-owned UI text uses the existing game language dictionaries and is translated again after remounts', () => {
  assert.match(gameEntry, /interface Window \{ __trpTranslateReact\?: \(root: ParentNode\) => void; \}/);
  assert.match(gameEntry, /window\.__trpTranslateReact = translatePage/);
  assert.match(gameEntry, /import \{ translatePage \} from '\.\/app\/i18n'/);
  assert.match(app, /window\.__trpTranslateReact\(rootRef\.current\)/);
  assert.match(app, /data-i18n>\{item\.label\}/);
  assert.match(app, /data-i18n>\{item\.detail\}/);
  assert.match(app, /key=\{phase\} data-i18n>\{phaseLabel\}/);
});


test('Online / Free Roam is composed by React while the validated settings controller and live player source remain intact', () => {
  assert.match(app, /function OnlineDashboard/);
  assert.match(app, /active === 'online' && !gameActive && <OnlineDashboard/);
  assert.match(app, /LegacyNode selector="#online" className="trp-online-legacy-slot"/);
  assert.match(app, /ONLINE_FEATURES\.map/);
  assert.match(app, /Meet the city on the server/);
  assert.match(shellCss, /\.trp-online-legacy-slot > #online/);
  assert.match(shellCss, /\.trp-online-feature-grid/);
  assert.match(shellCss, /@media \(max-width:700px\)[\s\S]*?trp-online-legacy-slot/);
  assert.match(settingsUi, /this\.online\.querySelector\('#online-body'\)!\.replaceChildren/);
  assert.match(settingsUi, /this\.online\.querySelector<HTMLElement>\('#online-note'\)/);
  assert.match(settingsUi, /setCrewCounts\(counts: Map<number, number>\)/);
  assert.match(navigation, /online: \['online'\]/);
  assert.match(navigation, /pageForHash = \{[\s\S]*online: 'online'/);
});

test('Online dashboard labels describe existing Free Roam, Online and Crew settings without inventing player counts', () => {
  assert.match(settingsUi, /N\('Free roam with others'\)/);
  assert.match(settingsUi, /N\('Online mode'\)/);
  assert.match(settingsUi, /N\('Crews'\)/);
  assert.match(settingsUi, /N\('Room'\)/);
  assert.doesNotMatch(app, /activePlayers\s*[:=]|onlineCount\s*[:=]\s*\d/);
});


test('the remaining main-page sections are presented through React route compositions', () => {
  assert.match(app, /function LegacyRoutePage/);
  assert.match(app, /active === 'online' && !gameActive && <OnlineDashboard \/>/);
  assert.match(app, /<LegacyRoutePage page=\{active\} \/>/);
  for (const selector of ['#mods','#saves','#controls','#settings','#accessibility','#updates','#diagnostics','#game-data','#changes','#about']) {
    assert.ok(app.includes(selector), 'route retains selector ' + selector);
  }
  assert.match(app, /selectors: \['#settings', '#accessibility'\]/);
  assert.match(app, /selectors: \['#updates', '#diagnostics', '#game-data'\]/);
  assert.match(app, /selectors: \['#changes', '#about'\]/);
  assert.match(app, /trp-legacy-route experience-shell/);
  assert.match(shellCss, /\.trp-route-intro/);
  assert.match(shellCss, /\.trp-route-section-slot > \.panel/);
  assert.match(shellCss, /@media \(max-width:700px\)[\s\S]*?\.trp-route-intro/);
  for (const id of ['mods','saves','controls','settings','accessibility','updates','diagnostics','game-data','changes','about']) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
});


test('Free Roam and Online toggles are React-controlled through the existing SettingsPanel bridge', () => {
  assert.match(app, /function OnlineReactControls/);
  assert.match(app, /window\.__trpSettingsBridge/);
  assert.match(app, /bridge\.current\('roam'\)/);
  assert.match(app, /bridge\.current\('online'\)/);
  assert.match(app, /bridge\.set\(key, next\)/);
  assert.match(gameEntry, /interface TrpSettingsBridge/);
  assert.match(gameEntry, /__trpSettingsBridge\?: TrpSettingsBridge/);
  assert.match(settingsRuntime, /window\.__trpSettingsBridge = \{/);
  assert.match(settingsRuntime, /current: key => settings\.current\(key\)/);
  assert.match(settingsRuntime, /set: async \(key, value\) => \{ await settings\.set\(key, value\)/);
  assert.match(settingsRuntime, /readOnly: \(\) => !instance\.owner/);
  assert.match(settingsRuntime, /trp-settings-ready/);
  assert.match(settingsRuntime, /trp-settings-changed/);
  assert.match(settingsUi, /current\(key: string\): string/);
  assert.match(settingsUi, /set\(key: string, value: string \| null\)/);
  assert.match(shellCss, /\.trp-online-react-controls/);
  assert.match(shellCss, /data-key="roam"/);
  assert.match(shellCss, /data-key="online"/);
});


test('React Online toggle status follows the existing UI language and does not leave duplicate legacy switches', () => {
  assert.match(app, /const statusRoot = useRef\(null\)/);
  assert.match(app, /data-i18n-src=\{!ready \? 'Loading'/);
  assert.match(app, /__trpTranslateReact\(statusRoot\.current\)/);
  assert.match(shellCss, /\.trp-online-legacy-slot > #online #online-body \.set\[data-key="roam"\]/);
  assert.match(shellCss, /\.trp-online-legacy-slot > #online #online-body \.set\[data-key="online"\]/);
});


test('React Online name and room editors reuse SettingsPanel normalization and validation', () => {
  assert.match(app, /bridge\.setValidated\(key, textValues\[key\]\)/);
  assert.match(app, /textValues\.roam_name/);
  assert.match(app, /textValues\.roam_room/);
  assert.match(gameEntry, /setValidated\(key: string, value: string \| null\): Promise<void>/);
  assert.match(shell, /setValidated: async \(key, value\) => \{ await settings\.setValidated\(key, value\)/);
  assert.match(settingsUi, /async setValidated\(key: string, value: string \| null\)/);
  assert.match(settingsUi, /onlineName\(next\)/);
  assert.match(settingsUi, /checkSetting\(key, next\)/);
  assert.match(shellCss, /data-key="roam_name"/);
  assert.match(shellCss, /data-key="roam_room"/);
});


test('React Online room field matches the settings schema text limit', () => {
  assert.match(app, /maxLength=\{63\} autoComplete="off" value=\{textValues\.roam_room\}/);
  assert.match(settings, /text: N\('text of 1 to 63 bytes without control characters'\)/);
});


test('React Online owns ghost mode, quick chat, blocked players and the visible car limit', () => {
  for (const token of ['roam_collide', 'quick_chat', 'roam_max_cars', 'roam_block']) {
    assert.ok(app.includes(token), token + ' is exposed in the React Online route');
    assert.ok(shellCss.includes('data-key="' + token + '"'), token + ' legacy row is hidden');
  }
  assert.match(app, /values\.roam_collide !== 'on'/);
  assert.match(app, /update\('roam_collide', !event\.target\.checked\)/);
  assert.match(app, /saveValidated\('roam_max_cars', event\.target\.value\)/);
  assert.match(app, /saveText\('roam_block'\)/);
  assert.match(settingsUi, /key !== 'roam_block'/);
  assert.match(settingsUi, /key !== 'roam_max_cars'/);
});


test('React Crew editor keeps crew order, palette colours, limits and atomic settings writes', () => {
  assert.match(app, /bridge\.crews\(\)/);
  assert.match(app, /bridge\.setCrews\(next\)/);
  assert.match(app, /checkCrew\(crewDraft, crewList\)/);
  assert.match(app, /freeColour\(crewList\)/);
  assert.match(app, /CREW_PALETTE\.map/);
  assert.match(app, /CREW_MAX/);
  assert.match(gameEntry, /setCrews\(list: TrpCrew\[\]\): Promise<void>/);
  assert.match(shell, /crews: \(\) => crewsOf\(settings\.current\('roam_crew'\), settings\.current\('roam_crew_colours'\)\)/);
  assert.match(shell, /setCrews: async list => \{ await settings\.saveCrewsFromReact\(list\)/);
  assert.match(settingsUi, /async saveCrewsFromReact\(list: readonly Crew\[\]\)/);
  assert.match(settingsUi, /rgbsValue\(list\)/);
  assert.match(settingsUi, /this\.put\([\s\S]*'roam_crew_colours'/);
  assert.match(shellCss, /trp-online-crew-palette/);
});


test('React Quick Chat phrase editor keeps four groups of four and saves phrase/group ids atomically', () => {
  assert.match(app, /bridge\.quickChat\(\)/);
  assert.match(app, /bridge\.saveQuickChat\(quickChatDraft\.phrases, quickChatDraft\.groups\)/);
  assert.match(app, /CATS\.map/);
  assert.match(app, /PHRASES\.map/);
  assert.match(main, /saveQuickChat\(phrases: number\[\], groups: string\[\]\): Promise<void>/);
  assert.match(shell, /quickChat: \(\) => \(\{ phrases: phrasesOf\(settings\.current\('quick_chat_phrases'\)\), groups: groupsOf\(settings\.current\('quick_chat_groups'\)\) \}\)/);
  assert.match(shell, /saveQuickChat: async \(phrases, groups\) => \{ await settings\.saveQuickChatFromReact/);
  assert.match(settingsUi, /async saveQuickChatFromReact\(phrases: readonly number\[\], groups: readonly string\[\]\)/);
  assert.match(settingsUi, /checkSetting\('quick_chat_phrases', phraseValue\)/);
  assert.match(settingsUi, /checkSetting\('quick_chat_groups', groupValue\)/);
  assert.match(settingsUi, /DEFAULT_PHRASES/);
  assert.match(settingsUi, /DEFAULT_GROUPS/);
  assert.match(shellCss, /trp-online-phrases-grid/);
});


test('React Crew and Quick Chat dynamic controls are retranslated whenever their draft state changes', () => {
  assert.ok(app.includes('[values, textValues, crewList, crewDraft, quickChatDraft, message, ready, readOnly, busy, statusText]'));
  assert.ok(app.includes('data-i18n>{category.name}'));
  assert.ok(app.includes('data-i18n>{phrase.text}'));
});


test('React Crew rows show only live /players counts and the existing large-crew warning', () => {
  assert.match(gameEntry, /crewCount\(name: string\): number \| undefined/);
  assert.match(settingsUi, /crewCount\(hash: number\): number \| undefined/);
  assert.match(shell, /crewCount: name => settings\.crewCount\(roomHash\(name\)\)/);
  assert.match(shell, /settings\.setCrewCounts\(crews\); window\.dispatchEvent\(new Event\('trp-settings-changed'\)\)/);
  assert.match(app, /crewCount\(crew\.name\)/);
  assert.match(app, /count !== undefined && count > CREW_BIG/);
});


test('About and project credits are rendered directly in the React route, not legacy DOM islands', () => {
  assert.match(app, /function AboutDashboard/);
  assert.match(app, /active === 'about' && !gameActive && <AboutDashboard \/>/);
  assert.doesNotMatch(app, /selectors: \['#changes', '#about'\]/);
  assert.doesNotMatch(app, /about: \{/);
  assert.match(app, /https:\/\/github\.com\/trpolaris\/NFSU2-Web/);
  assert.match(app, /https:\/\/github\.com\/trpolaris\/NFSU2-Web\/issues/);
  assert.match(app, /KyoriAsh's/);
  assert.match(app, /Lee-Ryo's Thai support/);
  assert.match(app, /Electronic Arts/);
  assert.match(shellCss, /#changes,.trp-legacy-slot #app #about \{ display:none!important; \}/);
  assert.match(shellCss, /\.trp-about-feature-grid/);
  assert.match(shellCss, /\.trp-about-info-grid/);
});


test('Mod Library page layout is React-owned while existing local mod handlers remain mounted', () => {
  assert.match(app, /function ModLibraryDashboard/);
  assert.match(app, /active === 'mods' && !gameActive && <ModLibraryDashboard \/>/);
  assert.doesNotMatch(app, /selectors: \['#mods'\]/);
  for (const selector of ['#custom-mod-count','#packs-check','#pack-list','#custom-mod-filter','#custom-mod-list','#mod-link-form']) {
    assert.ok(app.includes('selector="' + selector + '"'), selector + ' remains connected');
  }
  assert.match(shellCss, /#app #mods \{ display:none!important; \}/);
  assert.match(shellCss, /\.trp-mod-panel/);
  assert.match(shellCss, /\.trp-mod-add-panel \.mod-form-grid/);
});


test('Saves route keeps the complete SavesPanel root intact inside one React compatibility island', () => {
  assert.match(app, /function SavesDashboard/);
  assert.ok(app.includes("active === 'saves' && !gameActive && <SavesDashboard />"));
  assert.ok(!app.includes("selectors: ['#saves']"));
  assert.ok(app.includes('LegacyNode selector="#saves" className="trp-saves-legacy-slot"'));
  for (const selector of ['#export','#import','#saves-msg','#profiles','#storage-note','#shots-info','#shots','#vault']) {
    assert.ok(html.includes('id="' + selector.slice(1) + '"'), selector + ' remains inside the single Saves root');
  }
  assert.ok(!app.includes('LegacyNode selector="#profiles"'));
  assert.ok(!app.includes('LegacyNode selector="#vault"'));
  assert.ok(shellCss.includes('#app #saves { display:none!important; }'));
  assert.ok(shellCss.includes('.trp-saves-hero'));
  assert.ok(shellCss.includes('.trp-saves-vault-slot'));
});


test('Controls route is React-composed while the existing controlsSheet, gamepad and touch settings stay wired', () => {
  assert.ok(app.includes('function ControlsDashboard'));
  assert.ok(app.includes("active === 'controls' && !gameActive && <ControlsDashboard />"));
  assert.ok(!app.includes("selectors: ['#controls']"));
  assert.ok(app.includes('LegacyNode selector="#controls" className="trp-controls-legacy-slot"'));
  assert.ok(runtime.includes("keySheet = controlsSheet($('#keys'), 'keys', { follow: true });"));
  assert.ok(html.includes('data-pad-mount'));
  assert.ok(shellCss.includes('.trp-controls-hero'));
  assert.ok(shellCss.includes('.trp-controls-legacy-slot > #controls .controls-tabs'));
  assert.ok(shellCss.includes('.trp-controls-legacy-slot > #controls .controller-visual'));
});

test('SavesPanel still owns all descendant profile, screenshot and message controls under #saves', () => {
  assert.match(runtime, /new SavesPanel\(\$\('#saves'\)/);
  assert.match(runtime, /root\.querySelector\('#saves-msg'\)/);
  assert.match(runtime, /root\.querySelector\('#profiles'\)/);
  assert.match(runtime, /root\.querySelector\('#shots'\)/);
  assert.match(app, /LegacyNode selector="#saves" className="trp-saves-legacy-slot"/);
});

test('System route is composed in React while updates, diagnostics and game-data roots stay mounted', () => {
  assert.ok(app.includes('function SystemDashboard'));
  assert.ok(app.includes("active === 'system' && !gameActive && <SystemDashboard />"));
  assert.ok(!app.includes("selectors: ['#updates', '#diagnostics', '#game-data']"));
  for (const selector of ['#updates','#diagnostics','#game-data']) {
    assert.ok(app.includes('selector="' + selector + '"'), selector + ' remains mounted');
  }
  assert.ok(shellCss.includes('.trp-system-hero'));
  assert.ok(shellCss.includes('.trp-system-updates-slot > #updates'));
  assert.ok(shellCss.includes('.trp-system-diagnostics-slot > #diagnostics'));
  assert.ok(shellCss.includes('.trp-system-game-data-slot > #game-data'));
});

test('Settings route is composed in React while game settings and accessibility roots stay intact', () => {
  assert.ok(app.includes('function SettingsDashboard'));
  assert.ok(app.includes("active === 'settings' && !gameActive && <SettingsDashboard />"));
  assert.ok(!app.includes("selectors: ['#settings', '#accessibility']"));
  assert.ok(app.includes('LegacyNode selector="#settings" className="trp-settings-game-slot"'));
  assert.ok(app.includes('LegacyNode selector="#accessibility" className="trp-settings-accessibility-slot"'));
  assert.ok(shellCss.includes('.trp-settings-game-slot > #settings'));
  assert.ok(shellCss.includes('.trp-settings-accessibility-slot > #accessibility'));
  assert.ok(runtime.includes("new SettingsPanel($('#settings')"));
  assert.ok(html.includes('id="accessibility"'));
});


test('all main navigation routes use dedicated React dashboards instead of the empty generic page template', () => {
  assert.ok(!app.includes('function LegacyRoutePage'));
  assert.ok(!app.includes('const LEGACY_PAGES'));
  assert.ok(!shellCss.includes('.trp-legacy-route.experience-shell'));
  for (const page of ['home','online','controls','saves','mods','settings','system','about']) {
    assert.ok(app.includes("active === '" + page + "'"), page + ' has a dedicated route condition');
  }
});
