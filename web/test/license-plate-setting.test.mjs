import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const load = async f => await import('data:text/javascript;base64,' + Buffer.from(
  (await esbuild.build({ entryPoints: [path.join(ROOT, f)], bundle: true, format: 'esm', write: false })).outputFiles[0].text).toString('base64'));
const { checkSetting } = await load('web/src/app/settings.ts');

test('license plate setting normalizes uppercase and limits text to eight ASCII letters/digits', () => {
  assert.deepEqual(checkSetting('license_plate', 'ab12cd'), {
    ok: true, env: 'NFSU2_LICENSE_PLATE', value: 'AB12CD',
  });
  assert.equal(checkSetting('license_plate', 'bad plate')?.ok, false);
  assert.equal(checkSetting('license_plate', '123456789')?.ok, false);
  assert.equal(checkSetting('license_plate', 'AB-123')?.ok, false);
  assert.equal(checkSetting('license_plate', '') , null);
});
