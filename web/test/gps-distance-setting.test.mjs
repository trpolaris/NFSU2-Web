import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bundle = (await esbuild.build({
  stdin: {
    contents: `export { checkSetting, keyDef, DEFAULTS, TEMPLATE } from './web/src/app/settings.ts';`,
    resolveDir: ROOT,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  write: false,
  platform: 'node',
})).outputFiles[0].text;
const BUNDLE_URL = 'data:text/javascript;base64,' + Buffer.from(bundle).toString('base64');
const settings = await import(BUNDLE_URL);

test('GPS distance is a persisted, opt-in web setting', () => {
  assert.deepEqual(settings.keyDef('gps_distance'), {
    key: 'gps_distance', env: 'NFSU2_GPS_DISTANCE', kind: 'bool', scope: 'web',
  });
  assert.deepEqual(settings.checkSetting('gps_distance', 'on'), {
    ok: true, env: 'NFSU2_GPS_DISTANCE', value: '1',
  });
  assert.deepEqual(settings.checkSetting('gps_distance', 'off'), {
    ok: true, env: 'NFSU2_GPS_DISTANCE', value: '0',
  });
  assert.equal(settings.checkSetting('gps_distance', 'maybe').ok, false);
  assert.equal(settings.DEFAULTS.get('gps_distance'), 'off');
  assert.match(settings.TEMPLATE, /#gps_distance = off/);
});
