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
