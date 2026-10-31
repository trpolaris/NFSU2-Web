import test from 'node:test';
import assert from 'node:assert/strict';
import { adapterOptionsFor } from '../src/gpu/adapter-options.ts';

test('omits the ignored powerPreference option on Windows', () => {
  assert.equal(adapterOptionsFor('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/156.0'), undefined);
});

test('keeps the high-performance preference on platforms where it is useful', () => {
  assert.deepEqual(adapterOptionsFor('Mozilla/5.0 (X11; Linux x86_64) Chrome/156.0'), {
    powerPreference: 'high-performance',
  });
  assert.deepEqual(adapterOptionsFor('Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/156.0'), {
    powerPreference: 'high-performance',
  });
});
