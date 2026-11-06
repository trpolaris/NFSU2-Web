// The Photo Mode auto-turn slider: its centre is deliberately neutral; values outside the middle tenth turn
// continuously, and values are kept within the slider/runtime range.
//   node --test web/test/photo-spin.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [spinBuild, speedBuild] = await Promise.all([
  esbuild.build({ entryPoints: [path.join(ROOT, 'web/src/app/photo-spin.ts')], bundle: true, format: 'esm', write: false }),
  esbuild.build({ entryPoints: [path.join(ROOT, 'web/src/app/photo-speed.ts')], bundle: true, format: 'esm', write: false }),
]);
const spin = await import('data:text/javascript;base64,' + Buffer.from(spinBuild.outputFiles[0].text).toString('base64'));
const speed = await import('data:text/javascript;base64,' + Buffer.from(speedBuild.outputFiles[0].text).toString('base64'));

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


test('the camera speed range maps to 0.1x, 1x and 4x', () => {
  assert.equal(speed.photoSpeedValue(0), 10);
  assert.equal(speed.photoSpeedValue(500), 100);
  assert.equal(speed.photoSpeedValue(1000), 400);
  assert.equal(speed.photoSpeedMultiplier(500), 1);
});

test('camera speed is monotonic, bounded and safe for invalid slider values', () => {
  const values = [0, 100, 250, 500, 750, 900, 1000].map(speed.photoSpeedValue);
  assert.deepEqual(values, [...values].sort((a, b) => a - b));
  assert.equal(speed.photoSpeedValue(-100), 10);
  assert.equal(speed.photoSpeedValue(1200), 400);
  assert.equal(speed.photoSpeedValue(Number.NaN), 100);
  assert.equal(speed.photoSpeedValue(Number.POSITIVE_INFINITY), 100);
});
