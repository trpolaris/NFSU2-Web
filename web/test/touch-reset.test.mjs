// The touch Reset control stays in its slot, is hidden above 30 km/h, and is restored below 25 km/h.
// A finger holding it when the car accelerates must release R immediately.
//   node --test web/test/touch-reset.test.mjs
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// the page as touch.ts uses it: elements that keep their attributes, classes and listeners, a window's events, a
// touch screen, the frames and the clock driven by the tests
class El {
  constructor() {
    this.dataset = {}; this.attrs = new Map(); this.listeners = {}; this.hidden = false; this.innerHTML = ''; this.textContent = '';
    this.style = { setProperty() {}, removeProperty() {} };
    const cls = this.cls = new Set();
    this.classList = {
      add: (...c) => c.forEach(x => cls.add(x)), remove: (...c) => c.forEach(x => cls.delete(x)),
      toggle: (c, on = !cls.has(c)) => { if (on) cls.add(c); else cls.delete(c); return on; }, contains: c => cls.has(c),
    };
  }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  hasAttribute(k) { return this.attrs.has(k); }
  toggleAttribute(k, on = !this.attrs.has(k)) { if (on) this.attrs.set(k, ''); else this.attrs.delete(k); return on; }
  append() {}
  replaceChildren() {}
  addEventListener(type, f) { (this.listeners[type] ??= []).push(f); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0 }; }
  closest(sel) { return sel === '[data-ctl]' && this.dataset.ctl ? this : null; }
}
const win = new EventTarget();
let now = 1000, raf = null;
Object.assign(globalThis, {
  document: { createElement: () => new El(), documentElement: new El(), addEventListener() {}, elementFromPoint: () => null },
  getComputedStyle: () => ({ paddingLeft: '12px', paddingRight: '12px', paddingTop: '12px', paddingBottom: '12px' }),
  innerWidth: 1280, innerHeight: 720,
  addEventListener: win.addEventListener.bind(win), removeEventListener: win.removeEventListener.bind(win),
  dispatchEvent: win.dispatchEvent.bind(win),
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  matchMedia: () => ({ matches: true, addEventListener() {} }),
  requestAnimationFrame: f => { raf = f; return 1; },
  cancelAnimationFrame: () => { raf = null; },
});
Object.defineProperty(globalThis, 'performance', { value: { now: () => now }, configurable: true });

const js = (await esbuild.build({ entryPoints: [path.join(ROOT, 'web/src/app/touch.ts')], bundle: true, format: 'esm', write: false })).outputFiles[0].text;
const { TouchControls } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

// a game in free roam (drive 2) whose speed state is controlled by each test
function setup() {
  mock.timers.enable({ apis: ['setTimeout'] });
  const status = new Map([['drive', 2], ['frames', 100], ['fast', 0]]);
  const sent = [];
  const session = () => ({
    status: { read: () => status },
    input: { key: (code, down) => sent.push([code, down]), touchPad() {}, menuScale() {}, padPressed: () => 0, viewRoll() {} },
  });
  const tc = new TouchControls(new El(), { toast() {}, log() {} });
  tc.start(session(), false);
  // a frame: the timers run as the page's clock goes (late: they lag behind it, as on a busy page)
  const frame = (late = false) => { now += 17; if (!late) mock.timers.tick(17); raf?.(); };
  const run = ms => { for (let k = 0; k < ms; k += 17) frame(); };
  // frames until the controls have what the game says (they read it every 100 ms)
  const until = (fn, late = false) => {
    for (let k = 0; !fn(); k += 17) { assert.ok(k < 1000, 'the controls read the status'); frame(late); }
  };
  // the game's status changes ('drive', 'fast'), and the controls have read it: anything next happens
  // within HOLD_MS of that
  const set = (k, v, late = false) => { status.set(k, v); until(() => tc.state()[k] === v, late); };
  // a tap on a control: a finger down and up on it
  const tap = id => {
    const target = tc.ctls.get(id).el;
    for (const type of ['pointerdown', 'pointerup']) {
      const e = { type, target, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: 0, clientY: 0, preventDefault() {} };
      for (const f of tc.root.listeners[type]) f(e);
    }
  };
  // the key down in the game (its last press or release), and down as the controls count it
  const held = code => sent.findLast(([c]) => c === code)?.[1] === true;
  const counted = code => tc.state().keys.includes(code);
  until(() => tc.state().shown);
  return { tc, status, sent, session, run, until, set, tap, held, counted };
}
const done = (x) => { x.tc.stop(); mock.timers.reset(); };


test('Reset stays in place, hides at speed and releases a finger already holding R', () => {
  const x = setup();
  try {
    const reset = x.tc.ctls.get('reset').el;
    const stowed = () => x.tc.state().stowed.includes('reset');
    assert.ok(!stowed(), 'Reset is initially visible');
    const pointer = { type: 'pointerdown', target: reset, pointerId: 9, pointerType: 'touch', isPrimary: true,
      clientX: 0, clientY: 0, preventDefault() {} };
    for (const f of x.tc.root.listeners.pointerdown) f(pointer);
    x.run(200);
    assert.ok(x.held('KeyR') && x.counted('KeyR'), 'a finger holds Reset and R');
    x.set('fast', 1);
    assert.ok(stowed(), 'Reset becomes invisible above the threshold');
    assert.ok(!x.held('KeyR') && !x.counted('KeyR'), 'R is released as soon as Reset stows');
    assert.ok(!x.tc.byFinger.has(9), 'the old finger is no longer captured by Reset');
    x.set('fast', 0);
    assert.ok(!stowed(), 'Reset returns only after the game reports slow speed');
    assert.equal(x.tc.ctls.get('reset').el, reset, 'the same control stays in the same layout slot');
  } finally { done(x); }
});

test('a page/status without the fast field keeps Reset visible', () => {
  const x = setup();
  try {
    x.status.delete('fast');
    x.until(() => x.tc.state().fast === undefined);
    assert.ok(!x.tc.state().stowed.includes('reset'), 'legacy/no-speed status does not hide Reset');
  } finally { done(x); }
});
