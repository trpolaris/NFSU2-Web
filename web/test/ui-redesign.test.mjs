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
const wheel = fs.readFileSync(path.join(ROOT, 'src/app/wheel-setup.ts'), 'utf8');

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
