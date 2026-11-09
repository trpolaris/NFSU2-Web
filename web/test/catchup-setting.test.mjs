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
const settings = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));

test('career rubberbanding is a persisted, validated setting with Original as the default', () => {
  assert.deepEqual(settings.keyDef('catchup'), {
    key: 'catchup', env: 'NFSU2_CATCHUP', kind: 'enum', vals: 'original|noboost|off', scope: 'web',
  });
  for (const value of ['original', 'noboost', 'off'])
    assert.deepEqual(settings.checkSetting('catchup', value), {
      ok: true, env: 'NFSU2_CATCHUP', value,
    });
  assert.equal(settings.checkSetting('catchup', 'bogus').ok, false);
  assert.equal(settings.DEFAULTS.get('catchup'), 'original');
  assert.match(settings.TEMPLATE, /#catchup = original/);
});
