import test from 'node:test';
import assert from 'node:assert/strict';
import {
  linkStateCode, linkStateLabel, networkQualityCode, networkQualityLabel,
} from '../src/app/network-quality.ts';

test('link states map to stable diagnostic labels', () => {
  for (const [state, code] of Object.entries({
    online: 1, queued: 2, connecting: 3, waiting: 4, offline: 5, idle: 6, away: 7, closed: 8,
  })) {
    assert.equal(linkStateCode(state), code, state);
    assert.equal(linkStateLabel(code), state.charAt(0).toUpperCase() + state.slice(1), state);
  }
  assert.equal(linkStateLabel(99), 'Unknown');
});

test('network quality follows the documented switch RTT thresholds', () => {
  assert.equal(networkQualityCode('online', 20), 4);
  assert.equal(networkQualityCode('online', 50), 4);
  assert.equal(networkQualityCode('online', 51), 3);
  assert.equal(networkQualityCode('online', 100), 3);
  assert.equal(networkQualityCode('online', 101), 2);
  assert.equal(networkQualityCode('online', 180), 2);
  assert.equal(networkQualityCode('online', 181), 1);
  assert.equal(networkQualityLabel(4), 'Excellent');
  assert.equal(networkQualityLabel(3), 'Good');
  assert.equal(networkQualityLabel(2), 'Fair');
  assert.equal(networkQualityLabel(1), 'Poor');
  assert.equal(networkQualityLabel(0), 'Unknown');
});

test('quality remains unknown when the link is not online or RTT is unavailable', () => {
  for (const state of ['waiting', 'connecting', 'queued', 'offline', 'idle', 'away', 'closed']) {
    assert.equal(networkQualityCode(state, 25), 0, state);
  }
  for (const rtt of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(networkQualityCode('online', rtt), 0, String(rtt));
  }
});
