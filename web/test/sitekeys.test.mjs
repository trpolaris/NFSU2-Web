// Site keyboard/controller bindings (sitekeys.ts) are device-local settings.ini keys.
//   node --test web/test/sitekeys.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const { outputFiles } = await build({
  stdin: {
    contents: `
      export { keyDef, resolveEnv, settingsPut, TEMPLATE } from './web/src/app/settings.ts';
      export { SITE_KEYS, applySiteKeys, menuKeyOf, siteKey } from './web/src/app/sitekeys.ts';
    `,
    resolveDir: ROOT,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  write: false,
});
const S = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'));

test('every Site control is a device-local settings.ini key', () => {
  assert.equal(S.SITE_KEYS.length, 19);
  for (const key of S.SITE_KEYS) {
    const def = S.keyDef(key);
    assert.ok(def, `${key} is registered`);
    assert.equal(def.env, `NFSU2_${key.toUpperCase()}`, key);
    assert.equal(def.kind, 'raw', key);
    assert.equal(def.scope, 'web', key);
    assert.equal(def.device, true, key);
  }
});

test('settings.ini values flow into Site key dispatch', () => {
  let ini = S.TEMPLATE;
  ini = S.settingsPut(ini, 'key_menu', 'F6');
  ini = S.settingsPut(ini, 'key_song', 'F4');
  ini = S.settingsPut(ini, 'key_fps', 'F5');
  ini = S.settingsPut(ini, 'button_hold', 'dright');
  const env = S.resolveEnv(ini, {}, {}).env;
  assert.equal(env.NFSU2_KEY_MENU, 'F6');
  assert.equal(env.NFSU2_KEY_SONG, 'F4');
  assert.equal(env.NFSU2_KEY_FPS, 'F5');
  assert.equal(env.NFSU2_BUTTON_HOLD, 'dright');

  S.applySiteKeys(env);
  assert.equal(S.siteKey('menu'), 'F6');
  assert.equal(S.menuKeyOf('F6'), 'menu');
  assert.equal(S.menuKeyOf('F4'), 'song');
  assert.equal(S.menuKeyOf('F5'), 'fps');
});
