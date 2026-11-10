import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const KEY = 'trpolaris.nfsu2.ui-sounds.v1';

class FakeAudio {
  static instances = [];
  constructor(src) {
    this.src = src;
    this.preload = '';
    this.volume = 1;
    this.playCalls = 0;
    FakeAudio.instances.push(this);
  }
  load() {}
  cloneNode() { return new FakeAudio(this.src); }
  play() { this.playCalls++; return Promise.resolve(); }
}
class FakeNode {}
class FakeElement extends FakeNode {
  constructor() { super(); this.dataset = {}; this.attributes = new Set(); }
  closest(selector) {
    return selector === '#menu, #racingChat' ||
      selector === 'button, a[href], select, summary, [role="button"]' ? this : null;
  }
  hasAttribute(name) { return this.attributes.has(name); }
  contains(node) { return node === this; }
}

const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
};
globalThis.Audio = FakeAudio;
globalThis.Element = FakeElement;
globalThis.Node = FakeNode;
const listeners = {};
globalThis.document = {
  addEventListener: (name, callback) => { listeners[name] = callback; },
};

const { uiSounds, bindUiSounds } = await (async () => {
  const source = fs.readFileSync(path.join(ROOT, 'web/src/app/ui-sound.ts'), 'utf8');
  const built = await esbuild.build({ stdin: { contents: source, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', write: false });
  return import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
})();

test('interaction sound preference defaults on and persists both states', () => {
  assert.equal(uiSounds.enabled, true);
  assert.equal(uiSounds.setEnabled(false), false);
  assert.equal(storage.get(KEY), '0');
  assert.equal(uiSounds.enabled, false);
  assert.equal(uiSounds.setEnabled(true), true);
  assert.equal(storage.get(KEY), '1');
  assert.equal(uiSounds.enabled, true);
});

test('hover and click effects use short, low-volume cloned audio elements', () => {
  const initial = FakeAudio.instances.length;
  uiSounds.play('hover');
  uiSounds.play('click');
  const played = FakeAudio.instances.slice(initial);
  assert.equal(played.length, 2);
  assert.deepEqual(played.map(audio => audio.src), ['/ui-hover.mp3', '/ui-click.mp3']);
  assert.deepEqual(played.map(audio => audio.volume), [0.16, 0.25]);
  assert.deepEqual(played.map(audio => audio.playCalls), [1, 1]);
});

test('delegated menu/chat handlers bind once and respect the off switch', () => {
  bindUiSounds();
  bindUiSounds();
  assert.deepEqual(Object.keys(listeners).sort(), ['click', 'pointerover']);

  const target = new FakeElement();
  const initial = FakeAudio.instances.length;
  listeners.pointerover({ target, relatedTarget: null });
  listeners.click({ target });
  assert.equal(FakeAudio.instances.length, initial + 2);

  uiSounds.setEnabled(false);
  listeners.pointerover({ target, relatedTarget: null });
  listeners.click({ target });
  assert.equal(FakeAudio.instances.length, initial + 2);
});

test('the current F9 preferences expose a persisted UI-sounds switch', () => {
  const html = fs.readFileSync(path.join(ROOT, 'web/index.html'), 'utf8');
  const shell = fs.readFileSync(path.join(ROOT, 'web/src/app/shell.ts'), 'utf8');
  assert.match(html, /id="menu-ui-sounds"/);
  assert.match(shell, /bindUiSounds\(\)/);
  assert.match(shell, /uiSounds\.setEnabled/);
});
