import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(WEB, rel), 'utf8');
const html = read('index.html');
const main = read('src/main.ts');
const shell = read('src/app/shell.ts');
const ui = read('src/app/ui-enhancements.js');
const platform = read('src/app/platform.ts');
const theme = read('src/app/modern-theme.css');
const sw = read('src/sw.ts');
const shots = read('src/app/shots.ts');
const settings = read('src/app/settings-service.ts');
const react = read('src/ui/main.jsx');

test('all upstream HTML ids remain present after the redesigned layout was merged', () => {
  const baseline = JSON.parse(read('test/fixtures/upstream-index-ids.json'));
  const current = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  const retiredReactRoots = new Set(['about', 'about-title', 'changes', 'changes-title', 'controls', 'controls-title', 'keys', 'lang-pick', 'settings', 'settings-title', 'settings-note', 'settings-body', 'settings-raw', 'settings-reset-all', 'settings-text', 'settings-text-msg', 'settings-text-save', 'online', 'online-title', 'online-note', 'online-body', 'config-profile-name', 'config-profile-pick', 'config-profile-save', 'config-profile-apply', 'config-profile-export', 'config-profile-delete', 'config-profile-import', 'config-profile-status', 'saves', 'saves-title', 'saves-msg', 'export', 'import', 'profiles', 'save-hint', 'shots-info', 'shots', 'storage-note', 'game-data', 'game-data-title', 'cache-info', 'data-bar', 'fetch-all', 'clear-cache', 'data-msg', 'shot-view', 'shot-title', 'shot-when', 'shot-img', 'shot-meta']);
  const missing = baseline.filter(id => !current.has(id) && !retiredReactRoots.has(id));
  assert.deepEqual(missing, [], `upstream UI hooks removed: ${missing.join(', ')}`);
  for (const id of ['playlist', 'claim-check', 'vault-claim', 'vault-sides', 'vault-replaced']) {
    assert.ok(current.has(id), `preserved game feature #${id}`);
  }
});

test('the custom UI layer is isolated from the upstream game shell', () => {
  assert.match(main, /import '\.\/app\/modern-theme\.css'/);
  assert.match(main, /import \{ setupUIEnhancements \} from '\.\/app\/ui-enhancements\.js'/);
  assert.match(main, /import \{ boot \} from '\.\/app\/shell'/);
  assert.match(main, /setupUIEnhancements\(\);\s*void boot\(\)/);
  assert.match(shell, /setupPlatformFeatures\(settings, confirmBox, logLine\)/);
  assert.match(react, /window\.addEventListener\('popstate'/);
  assert.match(react, /window\.addEventListener\('hashchange'/);
  assert.doesNotMatch(react, /location\.reload\(\)/);
});

test('responsive navigation and controls have safe widths and touch targets', () => {
  assert.match(theme, /\.quick-nav \.quick-link\s*\{[^}]*min-height:\s*64px/);
  assert.match(theme, /@media \(max-width:\s*480px\)[\s\S]*?\.quick-nav\s*\{[^}]*display:\s*grid/);
  assert.match(theme, /@media \(max-width:\s*380px\)[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(theme, /#controls \.tabs \.tab\s*\{[^}]*min-height:\s*44px/);
  assert.match(theme, /\.app-grid:has\(\s*>\s*\.side\[hidden\]\s*\)/);
  assert.match(theme, /\.app-grid:has\(\s*>\s*\.content\[hidden\]\s*\)/);
});

test('screenshot thumbnails are decoded only when approaching the viewport', () => {
  assert.match(shots, /private thumbObserver:\s*IntersectionObserver\s*\|\s*null/);
  assert.match(shots, /new IntersectionObserver/);
  assert.match(shots, /rootMargin:\s*'280px 0px'/);
  assert.match(shots, /this\.thumbObserver\.observe\(b\)/);
  assert.match(shots, /private async loadTile/);
  assert.match(shots, /loading:\s*'lazy'/);
  assert.match(shots, /async function bitmap/);
});

test('PWA assets and cache are versioned together with trusted-origin guidance', () => {
  assert.match(html, /rel="manifest" href="\/manifest\.json"/);
  assert.match(html, /rel="icon" href="\/favicon\.ico"/);
  assert.match(sw, /nfsu2-offline-19/);
  for (const asset of ['/manifest.json', '/app-version.json', '/favicon.ico', '/icon-192.png', '/icon-512.png']) {
    assert.ok(sw.includes(asset), `service worker should cache ${asset}`);
  }
  assert.match(ui, /!isSecureContext/);
  assert.match(ui, /trusted HTTPS certificate/i);
  assert.match(ui, /beforeinstallprompt/);
});

test('profile import only allows explicit and validated setting keys', () => {
  assert.match(settings, /PROFILE_SETTING_KEYS\s*=/);
  assert.match(settings, /PROFILE_SETTING_SET\.has\(key\)/);
  assert.match(settings, /checkSetting\(key,\s*raw\)/);
  assert.match(platform, /settings\.applyProfileValues/);
  assert.match(platform, /settings\.applyPreset/);
});


test('the platform helper only binds controls present in the merged page', () => {
  const ids = new Set([...html.matchAll(/\\bid="([^"]+)"/g)].map(m => m[1]));
  const refs = [...platform.matchAll(/['"]#([\\w-]+)['"]/g)].map(m => m[1]);
  const missing = [...new Set(refs.filter(id => !ids.has(id)))];
  assert.deepEqual(missing, [], `platform selectors without markup: ${missing.join(', ')}`);
  assert.doesNotMatch(platform, /vehicle-pack-import/);
  assert.doesNotMatch(html, /vehicle-pack-import|imported-vehicle-cards/);
});

test('latest upstream Windows cache optimization is kept', () => {
  const io = read('src/host/io-worker.ts');
  assert.match(io, /const CACHE_OPEN = \/Windows\/\.test\(navigator\.userAgent\).*512 : 64/);
  assert.match(io, /sum\.reopened/);
});
