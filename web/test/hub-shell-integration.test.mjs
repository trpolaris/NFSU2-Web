import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

const entry = read('src/main.ts');
const html = read('index.html');
const shell = read('src/app/hub-integration.css');

test('the existing NFSU2 game page loads the Player Hub integration layer last', () => {
  assert.match(entry, /import '\.\/app\/hub-integration\.css';/);
  assert.ok(entry.indexOf("import './app/hub-integration.css';") > entry.indexOf("import './app/component-polish.css';"));
  assert.match(entry, /setupUIEnhancements\(\);/);
  assert.match(entry, /void boot\(\);/);
});

test('the main game surface adopts the Player Hub desktop shell and visual tokens', () => {
  assert.match(shell, /--hub-shell-bg:\s*#080c14/);
  assert.match(shell, /--hub-shell-panel:\s*#111b2a/);
  assert.match(shell, /--hub-shell-coral:\s*#ff6945/);
  assert.match(shell, /grid-template-columns:\s*254px minmax\(0, 1fr\)/);
  assert.match(shell, /grid-template-areas:\s*"nav header" "nav view"/);
  assert.match(shell, /\.experience-shell > \.quick-nav/);
  assert.match(shell, /\.experience-shell \.quick-link\.active/);
  assert.match(shell, /\.experience-shell \.landing-hero/);
  assert.match(shell, /\.experience-shell \.play-console/);
});

test('mobile navigation remains reachable and respects reduced-motion preferences', () => {
  assert.match(shell, /@media \(max-width: 700px\)/);
  assert.match(shell, /grid-template-areas:\s*"header" "nav" "view"/);
  assert.match(shell, /overflow-x:\s*auto/);
  assert.match(shell, /@media \(prefers-reduced-motion: reduce\)/);
});

test('game runtime anchors and same-tab Hub navigation remain in the original HTML', () => {
  const hubEntry = html.match(/<a class="hub-entry" href="\/hub\/"[^>]*>/);
  assert.ok(hubEntry, 'the Player Hub link remains available from the main page');
  assert.doesNotMatch(hubEntry[0], /target=/, 'the Hub opens in the current tab');
  for (const id of ['play', 'progress', 'progress-fill', 'lang-pick', 'install-app']) {
    assert.match(html, new RegExp('id="' + id + '"'), 'existing game anchor: ' + id);
  }
  assert.match(html, /<script type="module" src="\/main\.js"><\/script>/);
});
