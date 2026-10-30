import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'src/app/experience.css'), 'utf8');
const main = fs.readFileSync(path.join(ROOT, 'src/main.ts'), 'utf8');
const controls = fs.readFileSync(path.join(ROOT, 'src/app/controls.ts'), 'utf8');
const settingsUi = fs.readFileSync(path.join(ROOT, 'src/app/settings-ui.ts'), 'utf8');
const wheel = fs.readFileSync(path.join(ROOT, 'src/app/wheel-setup.ts'), 'utf8');
const shell = fs.readFileSync(path.join(ROOT, 'src/app/shell.ts'), 'utf8');
const platform = fs.readFileSync(path.join(ROOT, 'src/app/platform.ts'), 'utf8');
const i18n = fs.readFileSync(path.join(ROOT, 'src/app/i18n.ts'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'src/sw.ts'), 'utf8');
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/static/app-version.json'), 'utf8'));

test('Nightshift shell keeps the runtime anchors used by the game modules', () => {
  for (const id of [
    'app','lang-pick','install-app','home-page','play-panel','play','progress','progress-fill',
    'status','status-sub','lastgame','report','newer','problems','override','retry','reload','log-btn',
    'controls','keys','saves','online','mods','settings','diagnostics','game-data','stage','stage-menu'
  ]) assert.match(html, new RegExp('id="' + id + '"'), id);
  assert.match(main, /import ['"]\.\/app\/experience\.css['"]/);
});

test('controls workspace retains keyboard, controller, site and touch preference hooks', () => {
  for (const tab of ['keys','pad','site']) assert.match(html, new RegExp('data-tab="' + tab + '"'));
  for (const hook of ['data-steer','data-level','data-size','data-menu-size']) assert.ok(html.includes(hook), hook);
  assert.match(html, /role="tablist"/);
  assert.match(html, /role="tabpanel"/);
  assert.equal((html.match(/data-pad-mount/g) || []).length, 1, 'controller SVG has a dedicated mount');
  assert.match(controls, /querySelector<HTMLElement>\('\[data-pad-mount\]'\)/);
  assert.match(wheel, /querySelector<HTMLElement>\('\[data-pad-mount\]'\)/);
  assert.match(wheel, /for \(const el of mount\.children\)/, 'a connected wheel only hides the drawing area');
  assert.match(css, /#controls \.pad/);
  assert.match(css, /\.keyboard-map-grid/);
});

test('the page shell uses horizontal navigation and a single-column workspace', () => {
  assert.match(css, /\.experience-shell>\.quick-nav[\s\S]*overflow-x:auto/);
  assert.match(css, /\.app-grid>\.side,\.app-grid>\.content\{display:contents\}/);
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /@media\(max-width:380px\)/);
});

test('diagnostics are populated, refreshable and downloadable; module bytes remain visible under Play', () => {
  for (const id of ['diagnostic-list','diagnostics-refresh','diagnostics-download','module-download-status','module-download-percent']) {
    assert.match(html, new RegExp('id="' + id + '"'), id);
  }
  assert.match(shell, /function renderDiagnostics\(/);
  assert.match(shell, /function refreshDiagnostics\(/);
  assert.match(shell, /function downloadDiagnostics\(/);
  assert.match(shell, /#diagnostics-refresh/);
  assert.match(shell, /#module-download-status/);
  assert.match(shell, /#module-download-percent/);
  assert.match(shell, /#play'\)\.disabled = !ok/);
});

test('first-run, language default, accessibility and version metadata stay aligned', () => {
  assert.match(html, /id="first-run-dialog"/);
  assert.match(css, /#first-run-dialog\.first-run/);
  assert.match(css, /\.first-run-controls\{display:grid/);
  assert.match(css, /html\[data-large-text\]/);
  assert.match(css, /html\[data-reduce-motion\]/);
  assert.match(css, /html\[data-high-contrast\]/);
  assert.match(platform, /APP_BUILD_VERSION = '2026\.10\.30\.02'/);
  assert.equal(version.version, '2026.10.30.02');
  assert.match(platform, /lastLanguage\(\)/, 'first-run language falls back to the saved language');
  assert.match(platform, /: lastLanguage\(\)/, 'an empty top picker does not blank the first-run language');
  assert.match(i18n, /return isLanguage\(v\) \? v : 'turkish'/, 'new visitors default to Turkish');
  assert.match(sw, /nfsu2-offline-17/);
});

test('mod workshop, cloud keyphrase, team join and about cards have bounded responsive layouts', () => {
  assert.match(css, /#mods \.mod-tool-icon svg\{[^}]*width:21px!important/);
  assert.match(css, /#saves \.vault-row\{display:grid/);
  assert.match(css, /#saves \.keybox\{/);
  assert.match(css, /\.crew-line \.crew-add\{/);
  assert.match(css, /\.about-feature-grid/);
  assert.match(css, /\.about-info-grid/);
  assert.match(html, /id="about"/);
});

test('missing core NFSU2 data is diagnosed before the game process starts', () => {
  assert.match(shell, /async function checkGameData\(\)/);
  for (const required of ['SPEED2\\.EXE','NFSUNDER\\/ZDIR\\.BIN','sdata\\/sdat\\.viv']) assert.match(shell, new RegExp(required));
  assert.match(shell, /GAME-DATA-MISSING/);
  assert.match(shell, /const ORDER = \['browser', 'isolation', 'gpu', 'storage', 'game-data', 'module'\]/);
  const playStart = shell.indexOf('async function startGame()');
  const preflight = shell.indexOf('const gameData = await checkGameData()', playStart);
  const guestStart = shell.indexOf('GameSession.start({', playStart);
  assert.ok(preflight > playStart && guestStart > preflight, 'game data is checked before the guest process is created');
  assert.match(shell, /setCheck\(gameData\)/);
});

test('empty crew chips do not create a full-width blank panel, and Community Picks stays compact', () => {
  assert.match(settingsUi, /const chips = document\.createElement\('div'\); chips\.className = 'crew-chips'/);
  assert.match(settingsUi, /line\.append\(chips, box\)/);
  assert.match(css, /\.crew-line \.crew-chips:has\(ul\.crews:empty\)\{display:none\}/);
  assert.match(css, /#mods \.mods-feature-grid\{max-width:1080px/);
  assert.match(css, /#mods \.favorite-button svg\{[\s\S]*?width:17px!important/);
});
