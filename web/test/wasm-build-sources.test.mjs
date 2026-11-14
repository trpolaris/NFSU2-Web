import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const build = fs.readFileSync(path.join(ROOT, 'build.sh'), 'utf8');
const runtimePath = (name) => path.join(ROOT, '..', 'runtime', name);
const mem = fs.readFileSync(runtimePath('mem.c'), 'utf8');
const span = fs.readFileSync(runtimePath('guest_span.h'), 'utf8');
const overrides = fs.readFileSync(runtimePath('overrides.c'), 'utf8');
const intro = fs.readFileSync(runtimePath('intro.c'), 'utf8');
const modpacks = fs.readFileSync(runtimePath('modpacks.c'), 'utf8');
const dinputKbd = fs.readFileSync(runtimePath('dinput_kbd.c'), 'utf8');
const dinputPad = fs.readFileSync(runtimePath('dinput_pad.c'), 'utf8');
const horn = fs.readFileSync(runtimePath('horn.c'), 'utf8');
const hornHeader = fs.readFileSync(runtimePath('horn.h'), 'utf8');
const roam = fs.readFileSync(runtimePath('roam_game.c'), 'utf8');

test('WebAssembly runtime build includes newly integrated look and carspot modules', () => {
  const runtime = /^RT="([^"]+)"/m.exec(build)?.[1];
  assert.ok(runtime, 'web/build.sh declares its runtime C source list');
  const sources = new Set(runtime.split(/\s+/));
  for (const source of ['look', 'carspot']) {
    assert.ok(sources.has(source), `WebAssembly build includes runtime/${source}.c`);
  }
});

test('WASI compiler invocations quote executable paths that may contain spaces', () => {
  const invocations = build.split('\n').filter((line) => line.includes('$CC'));
  assert.equal(invocations.length, 4, 'all C compiler invocations are covered');
  for (const line of invocations) {
    assert.match(line, /"\$CC"/, 'compiler executable is quoted');
  }
});

test('WASM linker preserves object paths containing spaces', () => {
  const link = build.slice(build.indexOf('# ---- link ----'));
  assert.match(link, /shopt -s nullglob/);
  assert.match(link, /OBJS=\([\s\S]*?"\$OUT"\/obj\/\*\.o[\s\S]*?"\$OUT"\/obj\/srv\/\*\.o[\s\S]*?"\$OUT"\/rt\/\*\.o[\s\S]*?\)/);
  assert.match(link, /"\$\{OBJS\[@\]\}"/, 'linker receives each object path as a separate argument');
  assert.doesNotMatch(link, /-o "\$OUT\/nfsu2\.wasm" \$OBJS/, 'unquoted object-list expansion must not return');
});

test('WASM final link uses the C++ driver for damagecore libc++ symbols', () => {
  assert.ok(build.includes('CXX="$WASI/bin/clang++"'));
  const link = build.slice(build.indexOf('# ---- link ----'));
  assert.ok(link.includes('"$CXX" $TARGET $OPT $FEAT -o "$OUT/nfsu2.wasm"'));
  assert.ok(!link.includes('"$CC" $TARGET $OPT $FEAT -o "$OUT/nfsu2.wasm"'));
});

test('WASM guest-span globals are defined and the unsupported upper window stays disabled', () => {
  assert.ok(mem.includes('uint32_t g_gwin_lo = 0, g_gwin_hi = 0;'));
  assert.ok(span.includes('but is not enabled'));
  assert.ok(span.includes('extern uint32_t g_gwin_lo, g_gwin_hi'));
});

test('carpaint diagnostic state is owned and wired to model rendering', () => {
  assert.ok(overrides.includes('int g_carpaint_watch = 0;'));
  assert.ok(overrides.includes('if (g_carpaint_watch && carpaint_model) carpaint_model(item);'));
});

test('runtime APIs referenced by WASM features have a single provider', () => {
  assert.ok(intro.includes('void intro_frame(CPU *c)'));
  assert.ok(modpacks.includes('void modparts_deleted(const char *name)'));
  assert.ok(dinputKbd.includes('unsigned dikbd_site_key(const char *env, unsigned dflt)'));
  assert.ok(dinputKbd.includes('int dikbd_ours(unsigned dik, const char *what)'));
  assert.ok(dinputPad.includes('int pad_look_stick(void)'));
  assert.ok(horn.includes('void horn_mute(int on)'));
  assert.ok(hornHeader.includes('void horn_mute(int on);'));
  for (const symbol of [
    'void roam_game_hold(int on)',
    'int roam_game_online_here(void)',
    'int roam_game_names_here(void)',
    'int roam_game_names(CPU *c, uint32_t *objects, int max)',
    'int roam_game_slot_kind(uint32_t car, const char **name)'
  ]) assert.ok(roam.includes(symbol), `roam_game.c provides ${symbol}`);
});
