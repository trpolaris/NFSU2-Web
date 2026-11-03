import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const build = fs.readFileSync(path.join(ROOT, 'build.sh'), 'utf8');

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
  assert.equal(invocations.length, 5, 'all compiler invocations are covered');
  for (const line of invocations) {
    assert.match(line, /"\$CC"/, 'compiler executable is quoted');
  }
});
