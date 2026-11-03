import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const result = await build({
  entryPoints: [new URL('../src/app/chat-filter.ts', import.meta.url).pathname],
  bundle: true, format: 'esm', platform: 'browser', write: false,
});
const source = result.outputFiles[0].text;
const { hasChatProfanity } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('client chat filter catches Turkish and English profanity and common obfuscation', () => {
  for (const message of ['AMK', 'a m k', 'siktir', 's!kt!r', 'f.u.c.k', 'f u c k', 'amina koyayim', 'orospu cocugu', 'kurwa']) {
    assert.equal(hasChatProfanity(message), true, message);
  }
});

test('client chat filter leaves ordinary words and harmless phrases alone', () => {
  for (const message of ['sıkıntı yok', 'class is ready', 'rapid race', 'the spice must flow', 'Mustafa GS', 'normal FreeRoam chat', '']) {
    assert.equal(hasChatProfanity(message), false, message);
  }
});
