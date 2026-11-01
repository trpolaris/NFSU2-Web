// Chat HUD appearance controls: bounded values and immediate application to the in-game overlay.
//   node --test web/test/quickchat-appearance.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const js = (await esbuild.build({
  stdin: { contents: `export { QuickChat } from './web/src/app/quickchat.ts';`, resolveDir: ROOT, loader: 'ts' },
  bundle: true, format: 'esm', write: false, platform: 'browser',
})).outputFiles[0].text;
const BUNDLE_URL = 'data:text/javascript;base64,' + Buffer.from(js).toString('base64');

test('chat HUD appearance controls are bounded and immediately applied to the overlay', { timeout: 30_000 }, async t => {
  let browser;
  try { browser = await chromium.launch({ headless: true }); }
  catch (error) { t.skip(`no Chromium: ${String(error).split('\\n')[0]}`); return; }
  try {
    const page = await browser.newPage();
    await page.setContent('<main id="stage"></main>');
    const result = await page.evaluate(async bundleUrl => {
      const { QuickChat } = await import(bundleUrl);
      const chat = new QuickChat(document.querySelector('#stage'), { line() {}, lobby() {}, place() {}, log() {} });
      chat.setAppearance(2, 0.1);
      const appearance = chat.appearance();
      const styles = {
        scale: chat.chatHud.style.getPropertyValue('--chat-scale'),
        opacity: chat.chatHud.style.getPropertyValue('--chat-opacity'),
      };
      chat.stop();
      return { appearance, styles };
    }, BUNDLE_URL);
    assert.deepEqual(result.appearance, { scale: 1.15, opacity: 0.35 });
    assert.deepEqual(result.styles, { scale: '1.15', opacity: '0.35' });
  } finally { await browser.close(); }
});
