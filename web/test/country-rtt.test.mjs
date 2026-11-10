import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const load = async f => await import('data:text/javascript;base64,' + Buffer.from(
  (await esbuild.build({ entryPoints: [path.join(ROOT, f)], bundle: true, format: 'esm', write: false })).outputFiles[0].text).toString('base64'));
const { measureCountryRtt, countryFlag } = await load('web/src/app/country-rtt.ts');

test('country endpoint reports trusted country and measures same-origin HTTP RTT', async () => {
  let clock = 100;
  const result = await measureCountryRtt(async (url, init) => {
    assert.equal(url, '/country');
    assert.equal(init?.cache, 'no-store');
    clock = 137.4;
    return new Response(JSON.stringify({ country: 'gb' }), { status: 200 });
  }, () => clock);
  assert.deepEqual(result, { country: 'gb', rttMs: 37 });
  assert.equal(countryFlag(result.country), '🇬🇧');
});

test('unknown or invalid country remains null and non-success responses fail', async () => {
  const result = await measureCountryRtt(async () => new Response(JSON.stringify({ country: 'T1' })), () => 4);
  assert.deepEqual(result, { country: null, rttMs: 0 });
  await assert.rejects(() => measureCountryRtt(async () => new Response('', { status: 503 })), /HTTP 503/);
});
