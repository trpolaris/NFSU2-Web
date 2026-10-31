import test from 'node:test';
import assert from 'node:assert/strict';
import { FramePacing } from '../src/app/frame-pacing.ts';

test('reports median, p95, maximum and long-frame count', () => {
  const pacing = new FramePacing();
  for (const t of [100, 116, 132, 190]) pacing.push(t);

  assert.deepEqual(pacing.snapshot(), {
    samples: 3,
    p50Ms: 16,
    p95Ms: 58,
    maxMs: 58,
    over50Ms: 1,
  });
});

test('ignores a suspended-tab gap and starts a fresh window', () => {
  const pacing = new FramePacing();
  for (const t of [0, 16, 32, 1_100, 1_116]) pacing.push(t);

  assert.deepEqual(pacing.snapshot(), {
    samples: 1,
    p50Ms: 16,
    p95Ms: 16,
    maxMs: 16,
    over50Ms: 0,
  });
});

test('keeps only the newest 240 intervals', () => {
  const pacing = new FramePacing();
  for (let i = 0; i <= 300; i++) pacing.push(i * 16);

  assert.deepEqual(pacing.snapshot(), {
    samples: 240,
    p50Ms: 16,
    p95Ms: 16,
    maxMs: 16,
    over50Ms: 0,
  });
});

test('resets on non-monotonic timestamps and can be cleared explicitly', () => {
  const pacing = new FramePacing();
  for (const t of [100, 116, 132, 120, 136]) pacing.push(t);
  assert.deepEqual(pacing.snapshot(), {
    samples: 1,
    p50Ms: 16,
    p95Ms: 16,
    maxMs: 16,
    over50Ms: 0,
  });

  pacing.reset();
  assert.equal(pacing.snapshot(), null);
});

test('ignores non-finite timestamps and does not count exactly 50 ms as a hitch', () => {
  const pacing = new FramePacing();
  for (const t of [0, Number.NaN, 16, 66, 116]) pacing.push(t);

  assert.deepEqual(pacing.snapshot(), {
    samples: 3,
    p50Ms: 50,
    p95Ms: 50,
    maxMs: 50,
    over50Ms: 0,
  });
});
