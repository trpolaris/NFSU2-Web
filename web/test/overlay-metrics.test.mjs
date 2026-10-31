import test from 'node:test';
import assert from 'node:assert/strict';
import { overlayMetrics } from '../src/app/overlay-metrics.ts';

test('detailed overlay hides drift and photo internals but keeps useful game counters', () => {
  const status = new Map([
    ['frames', 120],
    ['frames_t', 5000],
    ['frames_dropped', 3],
    ['textures', 1587],
    ['drive', 2],
    ['rate', 120],
    ['pause', 0],
    ['sms', 0],
    ['roam_cars', 2],
    ['roam_friends', 1],
    ['drift', 0],
    ['drift_key', 12],
    ['drift_total', 500],
    ['photo', 1],
    ['photo_fov', 45],
    ['photo_roll', 0],
    ['photo_n', 1],
    ['input_events', 420],
    ['keys_held', 0],
    ['pad_connected', 1],
    ['input_dropped', 0],
  ]);
  const rows = overlayMetrics(status, {});
  const keys = rows.map(([key]) => key);

  assert.deepEqual(keys, [
    'frames_dropped', 'textures', 'drive', 'rate', 'pause', 'roam_cars', 'roam_friends',
    'input_events', 'keys_held', 'pad_connected', 'input_dropped',
  ]);
  assert.equal(keys.some(key => key.startsWith('drift')), false);
  assert.equal(keys.some(key => key.startsWith('photo')), false);
  assert.equal(keys.includes('sms'), false);
});

test('LAN link displays every diagnostic and marks unsupported values as unavailable', () => {
  const rows = overlayMetrics(null, {
    'lan online': 1,
    'lan friends': 2,
    'lan rtt ms': 4.5,
  });
  const values = new Map(rows);

  assert.equal(values.get('lan online'), 1);
  assert.equal(values.get('lan link state'), null);
  assert.equal(values.get('lan quality'), null);
  assert.equal(values.get('lan friends'), 2);
  assert.equal(values.get('lan rtt ms'), 4.5);
  for (const key of [
    'lan rtt avg ms', 'lan rtt max ms', 'lan reconnects',
    'lan frames in', 'lan frames out', 'lan rx drops',
    'lan tx wait avg ms', 'lan tx wait max ms',
  ]) assert.equal(values.get(key), null, key);
});

test('complete network, audio, and GPU metrics are retained', () => {
  const extra = {
    'lan online': 1,
    'lan link state': 1,
    'lan quality': 4,
    'lan friends': 1,
    'lan rtt ms': 4,
    'lan rtt avg ms': 3.8,
    'lan rtt max ms': 12,
    'lan reconnects': 0,
    'lan frames in': 20,
    'lan frames out': 19,
    'lan rx drops': 0,
    'lan tx wait avg ms': 0,
    'lan tx wait max ms': 0,
    'audio latency ms': 50,
    'audio underruns': 0,
    'gpu errors': 0,
  };
  const values = new Map(overlayMetrics(null, extra));

  for (const [key, value] of Object.entries(extra)) assert.equal(values.get(key), value, key);
  assert.equal(values.size, Object.keys(extra).length);
});
