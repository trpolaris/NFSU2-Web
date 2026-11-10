import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'src/app/experience.css'), 'utf8');
const reactCss = fs.readFileSync(path.join(ROOT, 'src/static/react-shell.css'), 'utf8');
const theme = fs.readFileSync(path.join(ROOT, 'src/app/modern-theme.css'), 'utf8');
const main = fs.readFileSync(path.join(ROOT, 'src/main.ts'), 'utf8');
const controls = fs.readFileSync(path.join(ROOT, 'src/app/controls.ts'), 'utf8');
const settingsUi = fs.readFileSync(path.join(ROOT, 'src/app/settings-service.ts'), 'utf8');
const crewUi = fs.readFileSync(path.join(ROOT, 'src/app/crew-control.ts'), 'utf8');
const reactUi = fs.readFileSync(path.join(ROOT, 'src/ui/main.jsx'), 'utf8');
const wheel = fs.readFileSync(path.join(ROOT, 'src/app/wheel-setup.ts'), 'utf8');
const shell = fs.readFileSync(path.join(ROOT, 'src/app/shell.ts'), 'utf8');
const platform = fs.readFileSync(path.join(ROOT, 'src/app/platform.ts'), 'utf8');
const i18n = fs.readFileSync(path.join(ROOT, 'src/app/i18n.ts'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'src/sw.ts'), 'utf8');
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/static/app-version.json'), 'utf8'));

test('TRPOLARIS neon design system integrates Tailwind v4 without resetting game controls', () => {
  const design = fs.readFileSync(path.join(ROOT, 'src/app/design-system.css'), 'utf8');
  const tailwind = fs.readFileSync(path.join(ROOT, 'src/app/tailwind.css'), 'utf8');
  const enhancements = fs.readFileSync(path.join(ROOT, 'src/app/ui-enhancements.js'), 'utf8');
  assert.match(main, /import ['"]\.\/app\/design-system\.css['"]/);
  assert.match(html, /href="\/tailwind\.css"/);
  assert.match(tailwind, /@import "tailwindcss\/theme\.css" layer\(theme\)/);
  assert.match(tailwind, /@import "tailwindcss\/utilities\.css" layer\(utilities\)/);
  assert.doesNotMatch(tailwind, /preflight\.css/);
  for (const token of ['#050708', '#00ffcc', '#10b981', '#09090b', '#18181b']) assert.ok(design.includes(token), token);
  assert.match(design, /backdrop-filter:\s*blur\(16px\)/);
  assert.match(design, /prefers-reduced-motion:\s*reduce/);
  assert.match(reactUi, /from 'motion\/react'/);
  assert.match(reactUi, /from 'lucide-react'/);
  assert.match(reactUi, /useReducedMotion/);
  assert.match(reactUi, /motion\.div/);
  assert.doesNotMatch(enhancements, /setupMotionTransitions|setupLucideIcons|setupHeroParticles/);
});



test('Midnight Run is a full layout redesign with a responsive rail, vehicle stage and launch dock', () => {
  const redesign = fs.readFileSync(path.join(ROOT, 'src/app/full-redesign.css'), 'utf8');
  const enhancements = fs.readFileSync(path.join(ROOT, 'src/app/ui-enhancements.js'), 'utf8');
  assert.match(main, /import ['"]\.\/app\/full-redesign\.css['"]/);
  assert.match(html, /class="hero-visual"/);
  assert.match(html, /class="hero-vehicle-art"/);
  assert.match(html, /id="play-panel"/);
  assert.match(redesign, /grid-template-areas: "header header" "nav view"/);
  assert.match(redesign, /@media \(max-width: 820px\)[\s\S]*?grid-template-areas: "header" "view" "nav"/);
  assert.match(redesign, /--bg: #080b12/);
  assert.match(redesign, /--lime: #ff6945/);
  assert.match(redesign, /--cyan: #a69aff/);
  assert.match(redesign, /@keyframes trpCarFloat/);
  assert.match(redesign, /@keyframes trpAura/);
  assert.match(reactUi, /motion\.div/);
  assert.match(reactUi, /motion\.section/);
  assert.match(reactUi, /useReducedMotion/);
  assert.match(enhancements, /setupViewportStability/);
  assert.doesNotMatch(enhancements, /cdn\.jsdelivr\.net|fonts\.googleapis\.com/);
});


test('inner pages use polished modern controls without replacing their existing DOM behavior', () => {
  const polish = fs.readFileSync(path.join(ROOT, 'src/app/component-polish.css'), 'utf8');
  assert.match(main, /import ['"]\.\/app\/component-polish\.css['"]/);
  assert.match(polish, /input\.switch::after/);
  assert.match(polish, /\.seg \.opt:has\(input:checked\)/);
  assert.doesNotMatch(polish, /(?:^|[\s,])#(?:online|settings)(?:[\s.#:[>]|$)/m);
  assert.match(reactUi, /trp-online-live-status/);
  assert.doesNotMatch(polish, /#saves|#game-data/);
  assert.match(reactCss, /\.trp-saves-profile/);
  assert.doesNotMatch(polish, /#mods|#updates|#diagnostics/);
  assert.match(reactCss, /\.trp-mod-panel/);
  assert.doesNotMatch(polish, /#controls/);
  assert.doesNotMatch(polish, /#accessibility/);
  assert.match(reactCss, /\.trp-system-react/);
  assert.match(polish, /\.bar-fill::after/);
  assert.match(polish, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(html, /id="online-body"|id="settings-body"|id="config-profile-save"/);
  assert.match(reactUi, /function SettingsProfilesReactControls\(\)/);
  assert.match(reactUi, /function SettingsPresetsReactControls\(\)/);
  assert.doesNotMatch(html, /id="(?:custom-mod-add|diagnostic-list|app-pages|mods|updates|diagnostics)"/);
  assert.match(settingsUi, /async setFromReact\(key: string, rawValue: string\)/);
  assert.doesNotMatch(settingsUi, /document\.|querySelector|HTMLElement|this\.root|render\(/);
});

test('online controls display only the live player and room counts supplied by /players', () => {
  const design = fs.readFileSync(path.join(ROOT, 'src/app/design-system.css'), 'utf8');
  const playerSource = fs.readFileSync(path.join(ROOT, 'src/app/players.ts'), 'utf8');
  const renderer = fs.readFileSync(path.join(ROOT, 'src/app/settings-service.ts'), 'utf8');
  assert.doesNotMatch(html, /id="online-body"/);
  assert.match(reactUi, /function OnlineReactControls\(\)/);
  assert.match(reactUi, /trp-online-live-status/);
  assert.doesNotMatch(renderer, /this\.online|#online-body|document\./);
  assert.match(playerSource, /export function playersText\(/);
  assert.match(playerSource, /On this server now:/);
  assert.doesNotMatch(design, /#online|#settings/);
  assert.match(reactUi, /bridge\.onlineStatus\(\)/);
  assert.match(reactUi, /trp-online-live-status/);
});


test('Nightshift shell keeps the runtime anchors used by the game modules', () => {
  for (const id of [
    'app','home-page','play-panel','play','progress','progress-fill',
    'status','status-sub','lastgame','report','newer','problems','override','retry','reload','log-btn',
    'stage','stage-menu'
  ]) assert.match(html, new RegExp('id="' + id + '"'), id);
  assert.match(reactUi, /function InstallAppReact\(\)/);
  assert.match(main, /import ['"]\.\/app\/experience\.css['"]/);
});

test('React owns the Controls route while the F9 help sheet keeps its inert source template', () => {
  assert.match(html, /<template id="controls-help-template">/);
  assert.doesNotMatch(html, /id="controls"|id="keys"/);
  assert.match(reactUi, /function ControlsReactPanel\(\)/);
  assert.match(reactUi, /role="tab" aria-selected=\{state\.tab === 'keys'\}/);
  assert.match(reactUi, /role="tab" aria-selected=\{state\.tab === 'pad'\}/);
  assert.match(reactUi, /role="tab" aria-selected=\{state\.tab === 'site'\}/);
  for (const hook of ['data-steer','data-level','data-size','data-menu-size']) assert.ok(html.includes(hook), hook);
  assert.match(reactUi, /role="tablist"/);
  assert.match(reactUi, /role="tabpanel"/);
  assert.equal((html.match(/data-pad-mount/g) || []).length, 1, 'controller SVG has a dedicated mount');
  assert.match(controls, /querySelector<HTMLElement>\('\[data-pad-mount\]'\)/);
  assert.match(wheel, /export function wheelSection\(pad: HTMLElement/);
  assert.match(wheel, /for \(const el of pad\.children\)/, 'a connected wheel only hides the drawing area');
  assert.doesNotMatch(css, /#controls/);
  assert.match(css, /\.keyboard-map-grid/);
});

test('the page shell uses horizontal navigation and a single-column workspace', () => {
  assert.match(css, /\.experience-shell>\.quick-nav[\s\S]*overflow-x:auto/);
  assert.match(css, /\.app-grid>\.side,\.app-grid>\.content\{display:contents\}/);
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /@media\(max-width:380px\)/);
});

test('diagnostics are populated, refreshable and downloadable through React while module bytes remain visible under Play', () => {
  assert.doesNotMatch(html, /id="(?:app-pages|diagnostic-list|diagnostics-refresh|diagnostics-download|diagnostics)"/);
  assert.match(reactUi, /function DiagnosticsReactPanel\(\)/);
  assert.match(reactUi, /window\.__trpDiagnosticsBridge\?\.snapshot\(\)/);
  assert.match(shell, /function refreshDiagnostics\(\)/);
  assert.match(shell, /function downloadDiagnostics\(\)/);
  assert.doesNotMatch(shell, /#(?:diagnostics-refresh|diagnostics-download|diagnostic-list|storage-note)/);
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
  assert.ok(platform.includes(`APP_BUILD_VERSION = '${version.version}'`));
  assert.doesNotMatch(html, /id="build-current"/);
  assert.match(platform, /currentVersion: APP_BUILD_VERSION/);
  assert.match(platform, /lastLanguage\(\)/, 'first-run language falls back to the saved language');
  assert.match(platform, /: lastLanguage\(\)/, 'an empty top picker does not blank the first-run language');
  assert.match(i18n, /export function browserLanguage/);
  assert.match(i18n, /return 'english';/, 'unsupported browser preferences fall back to English');
  assert.match(sw, /nfsu2-offline-19/);
});

test('mod workshop, cloud keyphrase, team join and about cards have bounded responsive layouts', () => {
  assert.match(reactCss, /\.trp-mod-panel/);
  assert.match(reactUi, /className="trp-vault-react-key-form"/);
  assert.match(reactUi, /className="trp-vault-react-key-row"/);
  assert.match(css, /\.crew-line \.crew-add\{/);
  assert.match(reactUi, /className="trp-about-feature-grid"/);
  assert.match(reactUi, /className="trp-about-info-grid"/);
  assert.match(reactUi, /function AboutDashboard\(\)/);
  assert.doesNotMatch(html, /id="about"/);
});

test('missing core NFSU2 data is diagnosed before the game process starts', () => {
  assert.match(shell, /async function checkGameData\(\)/);
  for (const required of ['SPEED2\\.EXE','SDATA\\/sdat\\.viv']) assert.match(shell, new RegExp(required));
  assert.ok(!shell.includes('NFSUNDER\\ZDIR'));
  assert.match(shell, /GAME-DATA-MISSING/);
  assert.match(shell, /const ORDER = \['browser', 'isolation', 'gpu', 'storage', 'game-data', 'module'\]/);
  const playStart = shell.indexOf('async function startGame()');
  const preflight = shell.indexOf('const gameData = await checkGameData()', playStart);
  const guestStart = shell.indexOf('GameSession.start({', playStart);
  assert.ok(preflight > playStart && guestStart > preflight, 'game data is checked before the guest process is created');
  assert.match(shell, /setCheck\(gameData\)/);
});

test('empty crew chips do not create a full-width blank panel, and Community Picks stays compact', () => {
  assert.match(crewUi, /const chips = document\.createElement\('div'\); chips\.className = 'crew-chips'/);
  assert.match(crewUi, /line\.append\(chips, box\)/);
  assert.match(css, /\.crew-line \.crew-chips:has\(ul\.crews:empty\)\{display:none\}/);
  assert.match(reactCss, /\.trp-mod-react-form-grid/);
  assert.match(reactUi, /function ModLibraryLists\(\)/);
});


test('Night Circuit 2.0 shares one restrained midnight-teal palette across the web shell', () => {
  assert.match(theme, /--bg: #09111a/);
  assert.match(theme, /--lime: #63d9c6/);
  assert.match(theme, /--surface-raised: rgba\(25, 41, 57, \.98\)/);
  assert.match(css, /--night: var\(--bg\)/);
  assert.match(css, /--acid: var\(--lime\)/);
  assert.match(css, /NIGHT CIRCUIT 2\.0/);
  assert.match(css, /\.home-overview-grid\s*\{[\s\S]*?grid-template-columns: minmax\(0, \.9fr\) minmax\(0, 1\.1fr\)/);
  assert.match(reactCss, /\.trp-mod-dashboard/);
  assert.match(css, /\.crew-line\s*\{[\s\S]*?flex-direction: row/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(html, /class="landing-art"|class="hero-car"|class="art-grid"/);
});


test('Play uses a dedicated responsive launch dock without changing runtime anchors', () => {
  assert.match(html, /id="play-panel"/);
  assert.match(html, /id="play"/);
  assert.match(html, /id="progress"/);
  assert.match(html, /id="progress-fill"/);
  assert.match(html, /id="module-download-status"/);
  assert.match(css, /NIGHT CIRCUIT 2\.0 — Play \/ launch dock/);
  assert.match(css, /grid-template-areas:[\s\S]*"head head"[\s\S]*"play progress-label"[\s\S]*"play progress-bar"[\s\S]*"play progress-meta"/);
  assert.match(css, /\.home-page \.play:not\(:disabled\)/);
  assert.match(css, /@media \(max-width: 390px\)[\s\S]*?grid-template-areas: "head" "play" "progress-label" "progress-bar" "progress-meta"/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.home-page \.play svg \{ transition: none/);
});

 
test('landing hero removes the decorative car-art panel and retains the Play launch dock', () => {
  assert.doesNotMatch(html, /class="landing-art"|class="hero-car"|class="art-grid"/);
  assert.match(css, /The separate car-art panel is intentionally removed/);
  assert.match(css, /\.landing-hero\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(html, /id="play-panel"/);
  assert.match(html, /id="play"/);
  assert.match(html, /id="progress"/);
  assert.match(css, /NIGHT CIRCUIT 2\.0 — Play \/ launch dock/);
  assert.match(css, /\.home-page \.play:not\(:disabled\)/);
});


test('compact landing hero places the unchanged Play dock beside the intro on desktop', () => {
  const introEnd = html.lastIndexOf('      </div>', html.indexOf('id="play-panel"'));
  const introStart = html.indexOf('<div class="landing-copy">');
  assert.ok(introStart >= 0 && introEnd > introStart, 'intro closes before the Play panel');
  assert.match(css, /NIGHT CIRCUIT — compact split hero/);
  assert.match(css, /grid-template-columns: minmax\(0, 1\.05fr\) minmax\(390px, \.95fr\)/);
  assert.match(css, /width: 100%;[\s\S]*?max-width: none;/);
  assert.match(css, /\.home-page \.play-console\s*\{[\s\S]*?margin: 0/);
  assert.match(html, /id="play"/);
  assert.match(html, /id="progress"/);
  assert.match(css, /NIGHT CIRCUIT 2\.0 — Play \/ launch dock/);
});


test('landing hero uses the same full content width as the other page panels', () => {
  assert.match(css, /\.landing-hero\s*\{[\s\S]*?width: 100%;[\s\S]*?max-width: none;/);
});


test('landing hero stays full-width at tablet breakpoints too', () => {
  assert.match(css, /@media \(max-width: 980px\)\s*\{[\s\S]*?\.landing-hero\s*\{\s*width: 100%;\s*max-width: none;/);
});
