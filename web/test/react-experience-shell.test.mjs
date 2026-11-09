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
const settingsUi = read('src/app/settings-service.ts');
const crewUi = read('src/app/crew-control.ts');
const controlsUi = read('src/app/controls.ts');
const savesUi = read('src/app/saves-ui.ts');
const shotsUi = read('src/app/shots.ts');
const vaultUi = read('src/app/vault-ui.ts');
const claimUi = read('src/app/claim-ui.ts');
const platform = read('src/app/platform.ts');
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

test('every icon used by main navigation is imported from lucide-react', () => {
  const imports = /import\s*\{([^}]+)\}\s*from 'lucide-react'/s.exec(app);
  assert.ok(imports, 'lucide-react imports are present');
  const imported = new Set(imports[1].split(',').map(name => name.trim()).filter(Boolean));
  const nav = /const NAV = \[([\s\S]*?)\n\];/.exec(app)?.[1] ?? '';
  assert.ok(nav, 'main navigation is declared');
  for (const [, icon] of nav.matchAll(/\bicon:\s*(\w+)/g)) {
    assert.ok(imported.has(icon), 'navigation icon ' + icon + ' is imported');
  }
});

test('React owns the main navigation, route state and motion transitions', () => {
  assert.match(app, /from 'react'/);
  assert.match(app, /from 'react-dom\/client'/);
  assert.match(app, /from 'motion\/react'/);
  assert.match(app, /createRoot\(rootNode\)/);
  assert.match(app, /NAV\.map/);
  assert.match(app, /layoutId="trp-nav-active"/);
  assert.doesNotMatch(app, /LegacyAppHost|legacyApp/);
  assert.match(app, /window\.__trpRuntimeBridge\?\.snapshot\(\)/);
  assert.match(runtime, /statusText: read\('status'\)/);
  assert.match(runtime, /locked: document\.getElementById\('app'\)\?\.inert/);
  assert.match(gameEntry, /statusText: string; locked: boolean/);
  assert.doesNotMatch(html, /id="settings"|id="online"|id="controls"/);
  assert.match(shellCss, /#app\.experience-shell \{ display:none!important; \}/);
  assert.match(app, /pageFromHash/);
  assert.ok(html.indexOf('</main>') < html.indexOf('id="stage"'));
  assert.ok(html.indexOf('</main>') < html.indexOf('id="menu"'));
  assert.match(app, /inert=\{gameActive\}/);
  assert.match(app, /useReducedMotion/);
});

test('the legacy runtime anchors remain present while React provides the page shell', () => {
  for (const id of ['app', 'home-page', 'play', 'progress', 'status', 'stage']) {
    assert.match(html, new RegExp('id="' + id + '"'), id);
  }
  assert.doesNotMatch(html, /id="lang-pick"|id="install-app"|id="install-security-notice"/);
  assert.match(app, /function LanguagePickerReact\(\)/);
  assert.match(app, /function InstallAppReact\(\)/);
  assert.doesNotMatch(app, /LegacyNode selector="\.lang-pick"/);
  assert.doesNotMatch(app, /LegacyNode selector="#install-app"/);
  assert.match(app, /const bridge = window\.__trpInstallBridge/);
  assert.match(app, /await bridge\.install\(\)/);
  assert.match(gameEntry, /interface TrpInstallBridge/);
  assert.match(navigation, /window\.__trpInstallBridge = \{ snapshot, install \}/);
  assert.match(shellCss, /#app\.experience-shell/);
  assert.doesNotMatch(html, /class="quick-nav/);
  assert.doesNotMatch(navigation, /function setupNavigation\(/);
  assert.match(app, /history\.pushState\(\{ page: id \}/);
  assert.match(app, /window\.addEventListener\('popstate', onHashChange\)/);
});

test('React owns visible motion, icons and lazy previews; browser helpers keep only PWA and viewport behavior', () => {
  assert.doesNotMatch(navigation, /function setupNavigation/);
  assert.doesNotMatch(navigation, /function setupMotionTransitions/);
  assert.doesNotMatch(navigation, /setupHeroParticles|setupLazyPreviews|setupLucideIcons/);
  assert.match(navigation, /function setupInstallExperience/);
  assert.match(navigation, /function setupViewportStability/);
  assert.doesNotMatch(html, /id="hero-particles"/);
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


test('Home Play and live status are React-owned through the game runtime adapter', () => {
  assert.match(app, /function HomeDashboard/);
  assert.match(app, /function RuntimePlayControls\(\)/);
  assert.match(app, /function RuntimeHomeStatus\(/);
  assert.match(app, /<RuntimePlayControls \/>/);
  assert.match(app, /<RuntimeHomeStatus onNavigate=\{onNavigate\} \/>/);
  assert.ok(!app.includes('LegacyNode selector="#hero-particles"'));
  assert.ok(!app.includes('LegacyNode selector=".hero-visual"'));
  assert.ok(!app.includes('LegacyNode selector="#play-panel"'));
  assert.ok(!app.includes('LegacyNode selector="#home-status-panel"'));
  assert.match(app, /window\.__trpRuntimeBridge\?\.play\(\)/);
  assert.match(app, /window\.__trpRuntimeBridge\?\.downloadLog\(\)/);
  assert.match(runtime, /window\.__trpRuntimeBridge = \{/);
  assert.match(runtime, /runtimeSnapshot\(\)/);
  assert.match(runtime, /runtimeChanged\(\)/);
  assert.match(gameEntry, /interface TrpRuntimeBridge/);
  assert.match(gameEntry, /__trpRuntimeBridge\?: TrpRuntimeBridge/);
  assert.match(shellCss, /\.trp-runtime-play/);
  assert.match(shellCss, /\.trp-runtime-status/);
  assert.match(shellCss, /#app\.experience-shell \{ display:none!important; \}/);
  assert.match(shellCss, /trp-react-shell\.is-home \.trp-content-heading/);
});

test('the game stage is never placed inside an inert React root while page chrome is disabled during play', () => {
  assert.doesNotMatch(app, /<div className=\{[^}]*trp-react-shell[^}]*\} inert=/);
  assert.match(app, /<aside className="trp-sidebar" aria-label="Ana gezinme" inert=\{gameActive\}/);
  assert.match(app, /<header className="trp-topbar" inert=\{gameActive\}/);
  assert.ok(runtime.includes("$('#app').inert = true"), 'legacy app retains its existing game-session focus rule');
  assert.match(app, /window\.addEventListener\('trp-runtime-changed', syncStatus\)/);
  assert.match(app, /setRuntimeLocked\(Boolean\(current\.locked\)\)/);
});


test('React-owned UI text uses the existing game language dictionaries and is translated again after remounts', () => {
  assert.match(gameEntry, /interface Window \{/);
  assert.match(gameEntry, /__trpTranslateReact\?: \(root: ParentNode\) => void;/);
  assert.match(gameEntry, /window\.__trpTranslateReact = translatePage/);
  assert.match(gameEntry, /import \{ translatePage \} from '\.\/app\/i18n'/);
  assert.match(app, /window\.__trpTranslateReact\(rootRef\.current\)/);
  assert.match(app, /data-i18n>\{item\.label\}/);
  assert.match(app, /data-i18n>\{item\.detail\}/);
  assert.match(app, /key=\{phase\} data-i18n>\{phaseLabel\}/);
});


test('Online / Free Roam is React-owned, including live status and name claim actions', () => {
  assert.match(app, /function OnlineDashboard/);
  assert.match(app, /function OnlineReactControls\(\)/);
  assert.match(app, /active === 'online' && !gameActive && <OnlineDashboard/);
  assert.doesNotMatch(app, /LegacyNode selector="#online"/);
  assert.match(app, /trp-online-name-claim/);
  assert.match(app, /window\.__trpNameRowBridge\?\.claim\(\)/);
  assert.match(app, /window\.__trpNameRowBridge\?\.useAlternative\(\)/);
  assert.match(runtime, /window\.__trpNameRowBridge = \{/);
  assert.match(runtime, /onlineStatus: \(\) => settings\.onlineStatus\(\)/);
  assert.match(gameEntry, /interface TrpNameRowBridge/);
  assert.match(claimUi, /reactSnapshot\(\)/);
  assert.match(claimUi, /claimFromReact\(\)/);
  assert.match(claimUi, /mountChallenge\(host: HTMLElement \| null\)/);
  assert.match(settingsUi, /onlineStatus\(\)/);
  assert.match(shellCss, /\.trp-online-name-claim/);
  assert.match(shellCss, /\.trp-online-live-status/);
});

test('Online dashboard labels describe existing Free Roam, Online and Crew settings without inventing player counts', () => {
  assert.match(settingsUi, /N\('Free roam with others'\)/);
  assert.match(settingsUi, /N\('Online mode'\)/);
  assert.match(settingsUi, /N\('Crews'\)/);
  assert.match(settingsUi, /N\('Room'\)/);
  assert.doesNotMatch(app, /activePlayers\s*[:=]|onlineCount\s*[:=]\s*\d/);
});


test('remaining React routes render without obsolete About/Changes DOM sections', () => {
  assert.match(app, /active === 'online' && !gameActive && <OnlineDashboard \/>/);
  assert.match(app, /active === 'system' && !gameActive && <SystemDashboard \/>/);
  assert.match(app, /active === 'controls' && !gameActive && <ControlsDashboard \/>/);
  assert.match(app, /active === 'mods' && !gameActive && <ModLibraryDashboard \/>/);
  assert.match(app, /active === 'about' && !gameActive && <AboutDashboard \/>/);
  assert.doesNotMatch(app, /LegacyRoutePage|trp-legacy-route/);
  for (const id of ['mods','saves','updates','diagnostics','game-data','app-pages']) {
    assert.doesNotMatch(html, new RegExp('id="' + id + '"'));
  }
  assert.doesNotMatch(html, /id="changes"|id="about"|class="top app-topbar"/);
  assert.match(shellCss, /\.trp-about-feature-grid/);
});


test('Free Roam and Online toggles are React-controlled through the DOM-free SettingsService bridge', () => {
  assert.match(app, /function OnlineReactControls/);
  assert.match(app, /window\.__trpSettingsBridge/);
  assert.match(app, /bridge\.current\('roam'\)/);
  assert.match(app, /bridge\.current\('online'\)/);
  assert.match(app, /bridge\.set\(key, next\)/);
  assert.match(gameEntry, /interface TrpSettingsBridge/);
  assert.match(gameEntry, /__trpSettingsBridge\?: TrpSettingsBridge/);
  assert.match(settingsRuntime, /__trpSettingsBridge:\s*\{/);
  assert.match(settingsRuntime, /current: \(key: string\) => settings\.current\(key\)/);
  assert.match(settingsRuntime, /set: async \(key: string, value: string\) => \{ await settings\.set\(key, value\)/);
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
  assert.match(shellCss, /\.trp-online-react-controls/);
  assert.doesNotMatch(shellCss, /\.trp-online-legacy-slot/);
});


test('React Online name and room editors reuse SettingsService normalization and validation', () => {
  assert.match(app, /await bridge\.setValidated\(key, value\)/);
  assert.match(app, /const saveText = async key => saveValidated\(key, textValues\[key\]\)/);
  assert.match(app, /textValues\.roam_name/);
  assert.match(app, /textValues\.roam_room/);
  assert.match(gameEntry, /setValidated\(key: string, value: string \| null\): Promise<void>/);
  assert.match(runtime, /setValidated: async \(key: string, value: string\) => \{ await settings\.setValidated\(key, value\)/);
  assert.match(settingsUi, /async setValidated\(key: string, value: string \| null\)/);
  assert.match(settingsUi, /onlineName\(next\)/);
  assert.match(settingsUi, /checkSetting\(key, next\)/);
  assert.match(shellCss, /\.trp-online-text-grid/);
  assert.match(shellCss, /\.trp-online-text-card/);
});


test('React Online room field matches the settings schema text limit', () => {
  assert.match(app, /<input type="text" maxLength=\{63\} autoComplete="off"/);
  assert.match(app, /value=\{ownWorldDraft\}/);
  assert.match(app, /saveValidated\('roam_room', ownWorldDraft\)/);
  assert.match(settingsUi, /key: 'roam_room'/);
  assert.match(read('src/app/settings.ts'), /text: N\('text of 1 to 63 bytes without control characters'\)/);
});


test('React Online owns ghost mode, quick chat, blocked players and the visible car limit', () => {
  for (const token of ['roam_collide', 'quick_chat', 'roam_max_cars', 'roam_block']) {
    assert.ok(app.includes(token), token + ' is exposed in the React Online route');
    assert.ok(settingsUi.includes("key: '" + token + "'"), token + ' is part of the SettingsService catalogue');
  }
  assert.match(app, /values\.roam_collide !== 'on'/);
  assert.match(app, /update\('roam_collide', !event\.target\.checked\)/);
  assert.match(app, /saveValidated\('roam_max_cars', event\.target\.value\)/);
  assert.match(app, /saveText\('roam_block'\)/);
  assert.match(settingsUi, /'roam_name', 'roam_room', 'roam_block', 'roam_max_cars'/);
});


test('React Crew editor keeps crew order, palette colours, limits and atomic settings writes', () => {
  assert.match(app, /bridge\.crews\(\)/);
  assert.match(app, /bridge\.setCrews\(next\)/);
  assert.match(app, /checkCrew\(crewDraft, crewList\)/);
  assert.match(app, /freeColour\(crewList\)/);
  assert.match(app, /CREW_PALETTE\.map/);
  assert.match(app, /CREW_MAX/);
  assert.match(gameEntry, /setCrews\(list: TrpCrew\[\]\): Promise<void>/);
  assert.match(runtime, /crews: \(\) => crewsOf\(settings\.current\('roam_crew'\), settings\.current\('roam_crew_colours'\)\)/);
  assert.match(runtime, /setCrews: async \(list: readonly Crew\[\]\) => \{ await settings\.saveCrewsFromReact\(list\)/);
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
  assert.match(gameEntry, /saveQuickChat\(phrases: number\[\], groups: string\[\]\): Promise<void>/);
  assert.match(runtime, /quickChat: \(\) => \(\{ phrases: phrasesOf\(settings\.current\('quick_chat_phrases'\)\), groups: groupsOf\(settings\.current\('quick_chat_groups'\)\) \}\)/);
  assert.match(runtime, /saveQuickChat: async \(phrases: readonly number\[\], groups: readonly string\[\]\) => \{ await settings\.saveQuickChatFromReact/);
  assert.match(settingsUi, /async saveQuickChatFromReact\(phrases: readonly number\[\], groups: readonly string\[\]\)/);
  assert.match(settingsUi, /checkSetting\('quick_chat_phrases', phraseValue\)/);
  assert.match(settingsUi, /checkSetting\('quick_chat_groups', groupValue\)/);
  assert.match(settingsUi, /DEFAULT_PHRASES/);
  assert.match(settingsUi, /DEFAULT_GROUPS/);
  assert.match(shellCss, /trp-online-phrases-grid/);
});


test('React Crew and Quick Chat dynamic controls are retranslated whenever their draft state changes', () => {
  assert.match(app, /\[values, textValues, crewList, crewDraft, quickChatDraft, message, ready, readOnly, busy, statusText, onlineStatus, nameClaim\]/);
  assert.ok(app.includes('data-i18n>{category.name}'));
  assert.ok(app.includes('data-i18n>{phrase.text}'));
});


test('React Crew rows show only live /players counts and the existing large-crew warning', () => {
  assert.match(gameEntry, /crewCount\(name: string\): number \| undefined/);
  assert.match(settingsUi, /crewCount\(hash: number\): number \| undefined/);
  assert.match(runtime, /crewCount: \(name: string\) => settings\.crewCount\(roomHash\(name\)\)/);
  assert.match(runtime, /settings\.setCrewCounts\(crews\); window\.dispatchEvent\(new Event\('trp-settings-changed'\)\)/);
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
  assert.match(shellCss, /#app\.experience-shell \{ display:none!important; \}/);
  assert.match(shellCss, /\.trp-about-feature-grid/);
  assert.match(shellCss, /\.trp-about-info-grid/);
});


test('Mod Library is React-owned over a DOM-free local-storage and manifest service', () => {
  assert.ok(app.includes('function ModLibraryDashboard'));
  assert.ok(app.includes('function ModLibraryLists'));
  assert.ok(app.includes('function ModLibraryForm'));
  assert.ok(app.includes("active === 'mods' && !gameActive && <ModLibraryDashboard />"));
  assert.ok(app.includes('<ModLibraryLists />'));
  assert.ok(app.includes('<ModLibraryForm />'));
  for (const id of ['app-pages','mods','pack-list','custom-mod-list','custom-mod-filter','mod-link-form','custom-mod-name','custom-mod-url','custom-mod-category','custom-mod-path','custom-mod-add','custom-mod-export','custom-mod-import','custom-mod-status','custom-mod-count','packs-check']) {
    assert.doesNotMatch(html, new RegExp('id="' + id + '"'), id + ' is retired');
  }
  assert.match(platform, /window\.__trpModLibraryBridge = \{/);
  assert.match(platform, /modStatusText/);
  assert.match(platform, /addCustomModLink/);
  assert.match(platform, /importModList/);
  assert.match(platform, /exportModList/);
  assert.doesNotMatch(platform, /#(?:pack-list|custom-mod-status|custom-mod-add|custom-mod-import|packs-check)/);
  assert.match(shellCss, /\.trp-mod-panel/);
  assert.match(shellCss, /\.trp-mod-react-form-grid/);
});

test('Saves route is rendered by React over DOM-free OPFS and predownload services', () => {
  assert.match(app, /function SavesDashboard/);
  assert.ok(app.includes("active === 'saves' && !gameActive && <SavesDashboard />"));
  assert.ok(!html.includes('id="app-pages"'));
  assert.doesNotMatch(html, /id="saves"|id="game-data"/);
  assert.doesNotMatch(html, /id="vault-service-host"|id="vault"/);
  assert.match(vaultUi, /reactSnapshot\(\)/);
  assert.doesNotMatch(vaultUi, /document\.|HTMLElement|querySelector|createElement|this\.root|this\.input/);
  assert.match(shellCss, /\.trp-saves-react-manager/);
  assert.match(shellCss, /\.trp-game-data-react/);
  assert.match(app, /function ScreenshotsReactControls\(\)/);
  assert.match(app, /function GameDataReactPanel\(\)/);
  assert.doesNotMatch(savesUi, /this\.root|this\.dataPanel|document\.|querySelector|render\(/);
  assert.doesNotMatch(shotsUi, /querySelector|createElement|HTMLDialogElement|IntersectionObserver|this\.root|this\.dlg/);
});

test('Controls route is rendered in React and reads/writes the existing touch and gamepad services through a typed bridge', () => {
  assert.ok(app.includes('function ControlsReactPanel()'));
  assert.ok(app.includes('<ControlsReactPanel />'));
  assert.ok(!app.includes('LegacyNode selector="#controls"'));
  assert.ok(runtime.includes('controlState = createControlsState({ follow: true, onChange: controlsChanged });'));
  assert.ok(runtime.includes("document.getElementById('controls-help-template')"));
  assert.ok(runtime.includes('window.__trpControlsBridge = {'));
  assert.ok(controlsUi.includes('export function controlsState('));
  assert.ok(html.includes('<template id="controls-help-template">'));
  assert.ok(!html.includes('id="controls"'));
  assert.ok(!html.includes('id="keys"'));
  assert.ok(!runtime.includes("controlsSheet($('#keys'"));
  assert.ok(runtime.includes('setSteering: (value: Steering)'));
  assert.ok(runtime.includes('setTouchSize: (value: string)'));
  assert.ok(runtime.includes('setMenuSize: (value: string)'));
  assert.ok(gameEntry.includes('interface TrpControlsBridge'));
  assert.ok(gameEntry.includes('__trpControlsBridge?: TrpControlsBridge'));
  assert.ok(app.includes('CONTROL_KEYS.map'));
  assert.ok(app.includes('CONTROLLER_KEYS.map'));
  assert.ok(app.includes('trp-touch-settings-grid'));
  assert.ok(shellCss.includes('.trp-controls-react-workbench'));
  assert.ok(shellCss.includes('.trp-controller-map-grid'));
});

test('Screenshots gallery and lightbox are React-rendered through the existing screenshot file service', () => {
  assert.match(app, /function ScreenshotsReactControls\(\)/);
  assert.match(app, /<ScreenshotsReactControls \/>/);
  assert.match(app, /window\.__trpSavesBridge\?\.shotImageUrl/);
  assert.match(app, /window\.__trpSavesBridge\?\.deleteShot/);
  assert.match(runtime, /shotsSnapshot: \(\) => saves\.shotsSnapshot\(\)/);
  assert.match(runtime, /shotImageUrl: path => saves\.shotImageUrl\(path\)/);
  assert.match(savesUi, /shotsSnapshot\(\)/);
  assert.match(shotsUi, /imageUrl\(path: string\)/);
  assert.match(shotsUi, /thumbnail\(path: string\)/);
  assert.match(shotsUi, /deleteFromReact\(path: string\)/);
  assert.match(shellCss, /\.trp-shots-react-grid/);
  assert.match(shellCss, /\.trp-shot-lightbox/);
});

test('Cloud Vault controls are React-rendered while keyphrase sync and conflict decisions remain in VaultPanel', () => {
  assert.match(app, /function VaultReactControls\(\)/);
  assert.match(app, /<VaultReactControls \/>/);
  assert.match(runtime, /window\.__trpVaultBridge = \{/);
  assert.match(runtime, /onReactUpdate: \(\) => window\.dispatchEvent\(new Event\('trp-vault-changed'\)\)/);
  assert.match(vaultUi, /reactSnapshot\(\)/);
  assert.match(vaultUi, /keepMineFromReact\(\)/);
  assert.match(vaultUi, /takeTheirsFromReact\(\)/);
  assert.match(vaultUi, /putBackFromReact\(\)/);
  assert.match(gameEntry, /interface TrpVaultBridge/);
  assert.match(gameEntry, /__trpVaultBridge\?: TrpVaultBridge/);
  assert.match(shellCss, /\.trp-vault-react-key-form/);
  assert.match(shellCss, /\.trp-vault-react-conflict/);
  assert.match(shellCss, /#app\.experience-shell \{ display:none!important; \}/);
});

test('Saves and screenshots expose DOM-free APIs for the React dashboards', () => {
  assert.match(runtime, /new SavesPanel\(\{/);
  assert.match(runtime, /window\.__trpSavesBridge = \{/);
  assert.match(runtime, /rename: \(from, to\) => saves\.renameFromReact\(from, to\)/);
  assert.match(runtime, /onReactUpdate: \(\) => window\.dispatchEvent\(new Event\('trp-saves-changed'\)\)/);
  assert.match(savesUi, /snapshot\(\)/);
  assert.match(savesUi, /renameFromReact\(from: string, to: string\)/);
  assert.match(savesUi, /exportBackup\(\): Promise<void>/);
  assert.match(savesUi, /importBackup\(file: File\): Promise<void>/);
  assert.match(savesUi, /gameDataSnapshot\(\)/);
  assert.doesNotMatch(savesUi, /this\.root|this\.dataPanel|document\.|querySelector|render\(/);
  assert.doesNotMatch(shotsUi, /querySelector|createElement|HTMLDialogElement|IntersectionObserver|this\.root|this\.dlg/);
  assert.match(shotsUi, /thumbnail\(path: string\)/);
  assert.match(shotsUi, /imageUrl\(path: string\)/);
  assert.doesNotMatch(html, /id="saves"|id="game-data"|id="shot-view"/);
  assert.doesNotMatch(html, /id="vault-service-host"|id="vault"/);
});

test('System update, diagnostics and game-data panels are React-owned through DOM-free service bridges', () => {
  assert.ok(app.includes('function UpdatesReactPanel()'));
  assert.ok(app.includes('function DiagnosticsReactPanel()'));
  assert.ok(app.includes('function GameDataReactPanel()'));
  assert.ok(app.includes('<UpdatesReactPanel />'));
  assert.ok(app.includes('<DiagnosticsReactPanel />'));
  assert.ok(app.includes('<GameDataReactPanel />'));
  assert.doesNotMatch(html, /id="(?:app-pages|mods|updates|diagnostics|game-data|diagnostic-list|diagnostics-refresh|diagnostics-download|updates-check|updates-reload|build-current|build-server|i18n-check|i18n-check-status|privacy-status)"/);
  assert.match(runtime, /window\.__trpDiagnosticsBridge = \{/);
  assert.match(runtime, /diagnosticsSnapshot\(\)/);
  assert.doesNotMatch(runtime, /#(?:storage-note|diagnostic-list|diagnostics-refresh|diagnostics-download)/);
  assert.match(platform, /window\.__trpPlatformBridge = \{/);
  assert.match(platform, /checkUpdates: async \(\) => \{ await checkUpdates\(\)/);
  assert.match(platform, /checkTranslations: async \(\) => \{ await checkTranslations\(\)/);
  assert.match(platform, /currentVersion: APP_BUILD_VERSION/);
  assert.match(platform, /serverVersion,/);
  assert.match(platform, /translationStatus,/);
  assert.match(runtime, /gameDataSnapshot: \(\) => saves\.gameDataSnapshot\(\)/);
  assert.match(savesUi, /gameDataSnapshot\(\)/);
  assert.match(shellCss, /\.trp-system-react/);
  assert.match(shellCss, /\.trp-diagnostics-react-list/);
  assert.match(shellCss, /\.trp-game-data-progress/);
});

test('Settings and accessibility routes are fully React-owned while game configuration persists through SettingsService', () => {
  assert.ok(app.includes('function SettingsDashboard'));
  assert.ok(app.includes("active === 'settings' && !gameActive && <SettingsDashboard />"));
  assert.ok(!app.includes("selectors: ['#settings', '#accessibility']"));
  assert.ok(!html.includes('id="settings"'));
  assert.ok(!html.includes('id="app-pages"'));
  assert.ok(app.includes('<AccessibilityReactControls />'));
  assert.ok(!app.includes('LegacyNode selector="#accessibility"'));
  assert.ok(!html.includes('id="online"'));
  assert.ok(shellCss.includes('.trp-a11y-react-options'));
  assert.ok(!shellCss.includes('.trp-settings-accessibility-legacy'));
  assert.ok(runtime.includes('new SettingsService({'));
  assert.ok(!html.includes('id="accessibility"'));
});


test('all main navigation routes use dedicated React dashboards instead of the empty generic page template', () => {
  assert.ok(!app.includes('function LegacyRoutePage'));
  assert.ok(!app.includes('const LEGACY_PAGES'));
  assert.ok(!shellCss.includes('.trp-legacy-route.experience-shell'));
  for (const page of ['home','online','controls','saves','mods','settings','system','about']) {
    assert.ok(app.includes("active === '" + page + "'"), page + ' has a dedicated route condition');
  }
});

test('Accessibility switches are React-controlled through the existing browser preference store', () => {
  assert.ok(app.includes('function AccessibilityReactControls'));
  assert.ok(app.includes('bridge.current()'));
  assert.ok(app.includes('bridge.set(key, value)'));
  assert.ok(!app.includes('LegacyNode selector="#accessibility"'));
  assert.ok(!html.includes('a11y-large-text'));
  assert.ok(!platform.includes("'#a11y-large-text'"));
  assert.ok(gameEntry.includes('interface TrpAccessibilityBridge'));
  assert.ok(gameEntry.includes('__trpAccessibilityBridge?: TrpAccessibilityBridge'));
  assert.ok(platform.includes('currentAccessibilityPrefs'));
  assert.ok(platform.includes('setAccessibilityPreference'));
  assert.ok(platform.includes('window.__trpAccessibilityBridge = {'));
  assert.ok(platform.includes('trp-accessibility-ready'));
  assert.ok(platform.includes('trp-accessibility-changed'));
  assert.ok(shellCss.includes('.trp-a11y-react-options'));
  assert.ok(shellCss.includes('.trp-a11y-react-options'));
  assert.ok(!shellCss.includes('.trp-settings-accessibility-legacy'));
});

test('Mod Library cards are React-owned while existing local-storage and manifest helpers remain the source of truth', () => {
  assert.ok(app.includes('function ModLibraryLists'));
  assert.ok(app.includes('bridge.snapshot()'));
  assert.ok(app.includes('bridge.toggleFavorite(id)'));
  assert.match(app, /const removeCustom = id => \{/);
  assert.match(app, /bridge\.removeCustom\(id\)/);
  assert.ok(app.includes('bridge.checkPacks()'));
  assert.ok(app.includes('function ModLibraryForm()'));
  assert.ok(app.includes('<form onSubmit={submit}>'));
  assert.ok(!html.includes('id="mod-link-form"'), 'the form is owned by the React route, not legacy HTML');
  assert.doesNotMatch(app, /LegacyNode selector="#mod-link-form"/);
  assert.ok(!app.includes('LegacyNode selector="#pack-list"'));
  assert.ok(!app.includes('LegacyNode selector="#custom-mod-list"'));
  assert.ok(gameEntry.includes('interface TrpModLibraryBridge'));
  assert.ok(platform.includes('getModLibrarySnapshot'));
  assert.ok(platform.includes('toggleModLibraryFavorite'));
  assert.ok(platform.includes('removeModLibraryEntry'));
  assert.ok(platform.includes('checkModLibraryPacks'));
  assert.ok(platform.includes('trp-mod-library-changed'));
  assert.ok(platform.includes('window.__trpModLibraryBridge = {'));
  assert.ok(shellCss.includes('.trp-mod-react-card'));
  assert.ok(shellCss.includes('.trp-mod-saved-actions'));
});

test('Mod Library state is typed and saved links appear only in the React list section', () => {
  assert.ok(app.includes("useState({ packs: [], custom: [], count: 0, statusText: '' })"));
  assert.ok(app.includes('YOUR COLLECTION'));
  assert.ok(!app.includes('<h3 data-i18n>Saved mod links</h3><p data-i18n>The mod list stores names and links only.'));
});

test('Mod Library add, import and export actions use existing URL, path, size and count validation helpers', () => {
  assert.ok(app.includes('function ModLibraryForm'));
  assert.ok(app.includes('bridge.addLink(name, url, category, targetPath)'));
  assert.ok(app.includes('bridge.importList(file)'));
  assert.ok(app.includes('bridge.exportList()'));
  assert.ok(app.includes('LegacyNode selector="#mod-link-form"') === false);
  assert.ok(gameEntry.includes('addLink(name: string, url: string, category: string, targetPath: string)'));
  assert.ok(platform.includes('export function addCustomModLink'));
  assert.ok(platform.includes('export async function importModList(file: File)'));
  assert.ok(platform.includes('export function exportModList'));
  assert.ok(platform.includes('file.size > 256 * 1024'));
  assert.ok(platform.includes('mods.length >= 100'));
  assert.ok(platform.includes('validHttpUrl(url)'));
  assert.ok(platform.includes('validRelativeGamePath(targetPath)'));
  assert.ok(shellCss.includes('.trp-mod-react-form-grid'));
});


test('local save profiles and backup actions are React-owned through the existing SavesPanel service bridge', () => {
  assert.match(app, /function SavesReactControls\(\)/);
  assert.match(app, /<SavesReactControls \/>/);
  assert.match(app, /bridge\.rename\(editing, draft\)/);
  assert.match(app, /bridge\.exportBackup\(\)/);
  assert.match(app, /bridge\.importBackup\(file\)/);
  assert.match(gameEntry, /interface TrpSavesBridge/);
  assert.match(gameEntry, /__trpSavesBridge\?: TrpSavesBridge/);
  assert.match(runtime, /window\.__trpSavesBridge = \{/);
  assert.match(runtime, /rename: \(from, to\) => saves\.renameFromReact\(from, to\)/);
  assert.match(runtime, /onReactUpdate: \(\) => window\.dispatchEvent\(new Event\('trp-saves-changed'\)\)/);
  assert.match(savesUi, /snapshot\(\)/);
  assert.match(savesUi, /renameFromReact\(from: string, to: string\)/);
  assert.match(savesUi, /exportBackup\(\): Promise<void>/);
  assert.match(savesUi, /importBackup\(file: File\): Promise<void>/);
  assert.match(savesUi, /readonly nameMax = NAME_MAX/);
  assert.match(shellCss, /\.trp-saves-react-manager/);
  assert.match(shellCss, /\.trp-saves-react-manager/);
  assert.ok(!html.includes('id="save-hint"'));
});

test('Screenshots and Cloud Vault are React-owned over DOM-free persistence services', () => {
  assert.ok(!html.includes('id="vault-service-host"'));
  assert.ok(!html.includes('id="vault"'));
  assert.ok(!html.includes('id="saves"'));
  assert.ok(!html.includes('id="shots"'));
  assert.ok(!html.includes('id="shot-view"'));
  assert.match(runtime, /new SavesPanel\(\{/);
  assert.match(runtime, /new VaultPanel\(\{/);
  assert.match(runtime, /window\.__trpVaultBridge = \{/);
  assert.match(vaultUi, /reactSnapshot\(\)/);
  assert.match(vaultUi, /askAtPlay\(\)/);
  assert.doesNotMatch(vaultUi, /document\.|HTMLElement|querySelector|createElement|this\.root|this\.input/);
  assert.match(app, /function ScreenshotsReactControls\(\)/);
  assert.match(app, /function VaultReactControls\(\)/);
});

test('Settings groups are React-rendered through the DOM-free SettingsService', () => {
  assert.match(app, /function SettingsReactControls\(\)/);
  assert.match(app, /await bridge\.setOption\(key, value\)/);
  assert.match(app, /await bridge\.resetOption\(key\)/);
  assert.match(runtime, /snapshot: \(\) => settings\.reactSnapshot\(\)/);
  assert.match(runtime, /setOption: async \(key: string, value: string\) => \{ await settings\.setFromReact/);
  assert.match(gameEntry, /interface TrpSettingsSnapshot/);
  assert.match(settingsUi, /reactSnapshot\(\)/);
  assert.match(settingsUi, /setFromReact\(key: string, rawValue: string\)/);
  assert.match(settingsUi, /resetFromReact\(key: string\)/);
  assert.match(settingsUi, /await this\.put\(key, checked && checked\.ok \? checked\.value : value\)/);
  assert.doesNotMatch(settingsUi, /document\.|querySelector|HTMLElement|this\.root|render\(/);
  assert.match(shellCss, /\.trp-settings-react-group/);
  assert.match(shellCss, /\.trp-settings-react-item/);
});

test('Settings profiles, quick presets and the raw settings editor are React-owned through validated services', () => {
  assert.match(app, /function SettingsProfilesReactControls\(\)/);
  assert.match(app, /function SettingsPresetsReactControls\(\)/);
  assert.match(app, /function SettingsRawReactControls\(\)/);
  assert.match(app, /<SettingsProfilesReactControls \/>/);
  assert.match(app, /<SettingsPresetsReactControls \/>/);
  assert.match(app, /<SettingsRawReactControls \/>/);
  assert.match(platform, /window\.__trpSettingsProfilesBridge = \{/);
  assert.match(platform, /settings\.applyProfileValues\(profile\.name, profile\.values\)/);
  assert.match(platform, /settings\.applyPreset\(preset\.name, preset\.values\)/);
  assert.match(runtime, /rawSnapshot: \(\) => settings\.rawSnapshot\(\)/);
  assert.match(runtime, /saveRaw: async \(text: string\) => \{ const message = await settings\.saveRawFromReact\(text\)/);
  assert.match(settingsUi, /rawSnapshot\(\)/);
  assert.match(settingsUi, /saveRawFromReact\(raw: string\)/);
  assert.match(settingsUi, /resetAllFromReact\(\)/);
  assert.match(settingsUi, /resetOtherFromReact\(line: number, key: string\)/);
  assert.match(gameEntry, /interface TrpSettingsProfilesBridge/);
  assert.match(gameEntry, /rawSnapshot\(\): TrpSettingsRawSnapshot/);
  assert.match(shellCss, /\.trp-settings-profiles-react/);
  assert.match(shellCss, /\.trp-settings-presets-grid/);
  assert.match(shellCss, /\.trp-settings-raw-react textarea/);
  assert.doesNotMatch(html, /id="app-pages"/);
});
