import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const load = async f => await import('data:text/javascript;base64,' + Buffer.from(
  (await esbuild.build({ entryPoints: [path.join(ROOT, f)], bundle: true, format: 'esm', write: false })).outputFiles[0].text).toString('base64'));
const { checkSetting, TEMPLATE, settingsPut, resetAll, resolveEnv } = await load('web/src/app/settings.ts');

test('license plate setting normalizes uppercase and accepts only one to eight ASCII letters/digits', () => {
  assert.deepEqual(checkSetting('license_plate', 'ab12cd'), {
    ok: true, env: 'NFSU2_LICENSE_PLATE', value: 'AB12CD',
  });
  assert.equal(checkSetting('license_plate', 'abc ; comment')?.value, 'ABC');
  assert.equal(checkSetting('license_plate', '') , null);

  for (const value of ['bad plate', '123456789', 'AB-123', 'A_B', 'é', 'АBC']) {
    assert.match(checkSetting('license_plate', value)?.reason ?? '', /not a license plate \(1 to 8 letters and digits\)/, value);
  }
});

test('plate moderation rejects disallowed words without rejecting safe lookalikes', () => {
  for (const value of ['n1gger', 'N1GGER', '1488', 'bigfag', 'FAGBOY', 'HH88', 'KKK']) {
    assert.match(checkSetting('license_plate', value)?.reason ?? '', /not a license plate \(it reads as a slur\)/, value);
  }
  for (const value of ['RACCOON', 'MUSTAFA6', 'SPICY', 'KONIG', 'KKKK', 'BOSS88']) {
    assert.equal(checkSetting('license_plate', value)?.value, value, value);
  }
});

test('license plate remains in settings.ini, reaches the game and survives Reset all settings', () => {
  assert.match(TEMPLATE, /# \[NFSU2_LICENSE_PLATE\]\n#license_plate =\n/);
  const ini = settingsPut(TEMPLATE, 'license_plate', 'abc1');
  assert.equal(resolveEnv(ini, {}, {}).env.NFSU2_LICENSE_PLATE, 'ABC1');
  assert.equal(resolveEnv(resetAll(ini), {}, {}).env.NFSU2_LICENSE_PLATE, 'ABC1');
  const cleared = settingsPut(ini, 'license_plate', '');
  assert.equal(resolveEnv(cleared, {}, {}).env.NFSU2_LICENSE_PLATE ?? '', '');
  const refused = settingsPut(TEMPLATE, 'license_plate', 'N1GGER');
  assert.equal(resolveEnv(refused, {}, {}).env.NFSU2_LICENSE_PLATE ?? '', '');
});
