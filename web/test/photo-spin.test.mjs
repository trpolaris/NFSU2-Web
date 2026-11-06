// The Photo Mode auto-turn slider: its centre is deliberately neutral; values outside the middle tenth turn
// continuously, and values are kept within the slider/runtime range.
//   node --test web/test/photo-spin.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const built = await esbuild.build({
  entryPoints: [path.join(ROOT, 'web/src/app/photo-spin.ts')],
  bundle: true, format: 'esm', write: false,
});
const spin = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));

test('the middle tenth of the range is off', () => {
  for (const value of [-60, -59, -30, -5, 0, 5, 30, 59, 60]) {
    assert.equal(spin.photoSpinValue(value), Math.abs(value) < 60 ? 0 : value);
  }
});

test('the ends are bounded and invalid values stop the camera', () => {
  assert.equal(spin.photoSpinValue(-900), -600);
  assert.equal(spin.photoSpinValue(900), 600);
  assert.equal(spin.photoSpinValue(Number.NaN), 0);
  assert.equal(spin.photoSpinValue(Number.POSITIVE_INFINITY), 0);
  assert.equal(spin.photoSpinValue(Number.NEGATIVE_INFINITY), 0);
});
