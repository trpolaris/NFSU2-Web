import test from 'node:test';
import assert from 'node:assert/strict';
import { browserHeapStats } from '../src/app/browser-memory.ts';

test('reports Chromium heap measurements in MiB when available', () => {
  const stats = browserHeapStats({
    memory: {
      usedJSHeapSize: 64 * 1048576,
      totalJSHeapSize: 96 * 1048576,
      jsHeapSizeLimit: 2048 * 1048576,
    },
  });
  assert.deepEqual(stats, {
    'js heap used MB': 64,
    'js heap committed MB': 96,
    'js heap limit MB': 2048,
  });
});

test('does not invent heap measurements when browser support is absent', () => {
  assert.deepEqual(browserHeapStats({}), {});
});

test('ignores unavailable or invalid heap fields individually', () => {
  const stats = browserHeapStats({
    memory: {
      usedJSHeapSize: Number.NaN,
      totalJSHeapSize: 32 * 1048576,
      jsHeapSizeLimit: -1,
    },
  });
  assert.deepEqual(stats, { 'js heap committed MB': 32 });
});
