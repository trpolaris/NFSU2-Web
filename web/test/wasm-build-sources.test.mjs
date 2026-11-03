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
