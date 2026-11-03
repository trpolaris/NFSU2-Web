import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const html = read('index.html');
const shell = read('src/app/shell.ts');
const service = read('src/app/settings-service.ts');
const saves = read('src/app/saves-ui.ts');
const shots = read('src/app/shots.ts');
const vault = read('src/app/vault-ui.ts');
const compatibility = read('src/app/settings-ui.ts');
const crew = read('src/app/crew-control.ts');
const platform = read('src/app/platform.ts');
const nameRow = read('src/app/claim-ui.ts');
const entry = read('src/main.ts');
const react = read('src/ui/main.jsx');

const retiredIds = [
  'app-pages', 'mods', 'mods-title', 'pack-list', 'custom-mod-count', 'packs-check', 'custom-mod-filter', 'custom-mod-list', 'mod-link-form', 'custom-mod-name', 'custom-mod-url', 'custom-mod-category', 'custom-mod-path', 'custom-mod-add', 'custom-mod-export', 'custom-mod-import', 'custom-mod-status', 'garage-search', 'garage-favorites-only', 'garage-make-filter', 'garage-class-filter', 'garage-count', 'preferred-vehicle-status', 'garage-cars', 'garage-empty-state',
  'updates', 'updates-title', 'build-current', 'build-server', 'updates-check', 'updates-reload', 'updates-status', 'first-run-open', 'i18n-check', 'i18n-check-status', 'clear-app-preferences', 'privacy-status',
  'diagnostics', 'diagnostics-title', 'diagnostics-refresh', 'diagnostics-download', 'diagnostic-list',
  'saves', 'saves-title', 'saves-msg', 'export', 'import', 'profiles', 'save-hint', 'shots-info', 'shots', 'storage-note',
  'game-data', 'game-data-title', 'cache-info', 'data-bar', 'fetch-all', 'clear-cache', 'data-msg', 'shot-view',
  'shot-title', 'shot-when', 'shot-img', 'shot-meta', 'vault-service-host', 'vault', 'vault-host', 'vault-make', 'vault-when', 'vault-form', 'vault-box', 'vault-input', 'vault-mask', 'vault-file', 'vault-eye', 'vault-load', 'vault-claim', 'vault-sides', 'vault-about', 'vault-status', 'vault-conflict', 'vault-mine', 'vault-theirs', 'vault-on', 'vault-sync', 'vault-earlier', 'vault-stop', 'vault-delete', 'vault-replaced', 'vault-replaced-text', 'vault-putback', 'vault-msg',
  'settings', 'settings-title', 'settings-note', 'settings-body', 'settings-raw',
  'settings-reset-all', 'settings-text', 'settings-text-msg', 'settings-text-save',
  'online', 'online-title', 'online-note', 'online-body',
  'config-profile-name', 'config-profile-pick', 'config-profile-save', 'config-profile-apply',
  'config-profile-export', 'config-profile-delete', 'config-profile-import', 'config-profile-status',
, 'recommended-mods-title', 'saved-mods-title'];

test('Settings persistence and validation live in a DOM-free SettingsService', () => {
  assert.match(service, /export class SettingsService/);
  for (const method of ['reactSnapshot', 'rawSnapshot', 'setFromReact', 'resetFromReact', 'setValidated', 'saveCrewsFromReact', 'saveQuickChatFromReact', 'profileValues', 'applyProfileValues', 'applyPreset']) {
    assert.ok(service.includes(method), method + ' is part of the service API');
  }
  assert.doesNotMatch(service, /document\.|window\.|HTMLElement|querySelector|createElement|innerHTML|this\.root|this\.online|render\(/);
  assert.match(service, /readOnly\(\)/);
  assert.match(service, /writeFile\(this\.deps\.saveDir, 'settings\.ini', next\)/);
  assert.match(service, /export const PROFILE_SETTING_KEYS/);
});

test('legacy Settings and Online page roots and their static editor controls are removed', () => {
  for (const id of retiredIds) assert.doesNotMatch(html, new RegExp('id="' + id + '"'), 'legacy #' + id + ' root is absent');
  assert.doesNotMatch(shell, /new SettingsPanel|querySelector\('#settings'\)|querySelector\('#online'\)/);
  assert.match(shell, /new SettingsService\(\{/);
  assert.match(shell, /snapshot: \(\) => settings\.reactSnapshot\(\)/);
  assert.match(react, /function SettingsDashboard\(\)/);
  assert.match(react, /function OnlineDashboard\(\)/);
  assert.match(react, /function SettingsReactControls\(\)/);
  assert.match(react, /function OnlineReactControls\(\)/);
});

test('the Settings UI compatibility module only re-exports domain helpers and F9 helpers', () => {
  assert.match(compatibility, /from '\.\/settings-service'/);
  assert.match(compatibility, /from '\.\/crew-control'/);
  assert.doesNotMatch(compatibility, /class SettingsPanel|document\.|querySelector|createElement/);
  assert.match(crew, /export function crewControl\(/);
  assert.match(crew, /export function showCrewCounts\(/);
  assert.match(shell, /import \{ crewControl, showCrewCounts \} from '\.\/crew-control'/);
  assert.match(shell, /crewControl\(/);
  assert.match(shell, /showCrewCounts\(/);
});

test('player-name ownership is React-controlled while the Turnstile widget retains its dedicated host', () => {
  assert.match(nameRow, /updateName\(value: string\)/);
  assert.match(nameRow, /const n = \+\+this\.seq;\s+const typed = await this\.typed\(\);\s+if \(n !== this\.seq\) return;/);
  assert.match(nameRow, /reactSnapshot\(\)/);
  assert.match(nameRow, /mountChallenge\(host: HTMLElement \| null\)/);
  assert.doesNotMatch(nameRow, /\battach\(row: HTMLElement/);
  assert.match(nameRow, /turnstile\(this\.info\.captcha, this\.check\)/);
  assert.match(shell, /updateName: name => nameRow\.updateName\(name\)/);
  assert.match(entry, /updateName\(name: string\): TrpNameRowSnapshot/);
  assert.match(react, /nameBridge\.updateName\(nextTextValues\.roam_name\)/);
  assert.match(react, /bridge\.mountChallenge\(claimHostRef\.current\)/);
});

test('settings profiles and presets no longer depend on legacy profile HTML', () => {
  assert.match(platform, /import \{ PROFILE_SETTING_KEYS, type SettingsService \} from '\.\/settings-service'/);
  assert.match(platform, /__trpSettingsProfilesBridge = \{/);
  assert.match(platform, /import: async \(file: File\)/);
  assert.match(platform, /preset: async \(id: string\)/);
  assert.doesNotMatch(platform, /#config-profile-|renderProfilePicker|selectedProfile\(/);
  assert.match(platform, /trp-settings-profiles-changed/);
  assert.match(react, /addEventListener\('trp-settings-profiles-changed'/);
  assert.match(react, /function SettingsProfilesReactControls\(\)/);
  assert.match(react, /function SettingsPresetsReactControls\(\)/);
  assert.match(react, /function SettingsRawReactControls\(\)/);
});

test('old page Settings and Online CSS selectors are retired while React styling remains', () => {
  for (const file of ['src/app/component-polish.css', 'src/app/design-system.css', 'src/app/full-redesign.css', 'src/app/style.css']) {
    const css = read(file);
    assert.doesNotMatch(css, /#settings(?:\s|[.#:[>])|#online(?:\s|[.#:[>])/);
  }
  const reactCss = read('src/static/react-shell.css');
  assert.match(reactCss, /\.trp-settings-react-group/);
  assert.match(reactCss, /\.trp-online-react-controls/);
  assert.match(reactCss, /\.trp-online-name-claim/);
  assert.match(reactCss, /#app\.experience-shell \{ display:none!important; \}/);
});

test('Saves and screenshot persistence are DOM-free services consumed by React', () => {
  assert.match(shell, /new SavesPanel\(\{/);
  assert.doesNotMatch(shell, /new SavesPanel\(\$\('#saves'\)|\$\('#game-data'\)/);
  assert.doesNotMatch(saves, /document\.|window\.|HTMLElement|querySelector|createElement|innerHTML|this\.root|this\.dataPanel|render\(/);
  assert.match(saves, /renameProfile\(filesOf\(this\.deps\.saveDir\)/);
  assert.match(saves, /exportSaves\(this\.deps\.saveDir\)/);
  assert.match(saves, /readBackup\(/);
  assert.match(saves, /restoreSaves\(this\.deps\.saveDir, r\)/);
  assert.match(saves, /gameDataSnapshot\(\)/);
  assert.match(saves, /this\.shots = new ScreenshotsPart\(/);
  assert.doesNotMatch(shots, /document\.|querySelector|createElement|HTMLDialogElement|IntersectionObserver|this\.root|this\.dlg/);
  assert.match(shots, /saveRoot\(saveDir, false\)/);
  assert.match(shots, /decodeTga/);
  assert.match(shots, /deleteFromReact\(path: string\)/);
  assert.match(react, /function ScreenshotsReactControls\(\)/);
  assert.match(react, /function GameDataReactPanel\(\)/);
  assert.doesNotMatch(html, /id="saves"|id="game-data"|id="shot-view"/);
  assert.doesNotMatch(html, /id="vault-service-host"|id="vault"/);
  assert.match(vault, /export class VaultPanel/);
  assert.doesNotMatch(vault, /document\.|HTMLElement|querySelector|createElement|this\.root|this\.input/);
  assert.match(vault, /reactSnapshot\(\)/);
  assert.match(vault, /askAtPlay\(\)/);
});

test('Mod Library, updates and diagnostics are React-owned over DOM-free service snapshots', () => {
  for (const selector of ['#pack-list', '#custom-mod-status', '#custom-mod-add', '#custom-mod-import', '#updates-check', '#updates-status', '#i18n-check-status']) {
    assert.ok(!platform.includes(selector), selector + ' is not a legacy platform DOM dependency');
  }
  assert.ok(!shell.includes('#storage-note'));
  assert.ok(!shell.includes('#diagnostic-list'));
  assert.ok(!shell.includes('#diagnostics-refresh'));
  assert.match(platform, /window\.__trpModLibraryBridge = \{/);
  assert.match(platform, /window\.__trpPlatformBridge = \{/);
  assert.match(platform, /modStatusText/);
  assert.match(platform, /currentVersion: APP_BUILD_VERSION/);
  assert.match(platform, /const openFirstRun = wireFirstRun\(settings, log\)/);
  assert.match(shell, /window\.__trpDiagnosticsBridge = \{/);
  assert.match(shell, /diagnosticsSnapshot\(\)/);
  assert.doesNotMatch(html, /id="(?:app-pages|mods|updates|diagnostics|diagnostic-list|build-current|custom-mod-add)"/);
  assert.match(react, /function ModLibraryDashboard\(\)/);
  assert.match(react, /function UpdatesReactPanel\(\)/);
  assert.match(react, /function DiagnosticsReactPanel\(\)/);
});
