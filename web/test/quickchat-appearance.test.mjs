// Chat HUD appearance controls: bounded values and immediate application to the in-game overlay.
//   node --test web/test/quickchat-appearance.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const js = (await esbuild.build({
  stdin: { contents: `export { QuickChat } from './web/src/app/quickchat.ts';`, resolveDir: ROOT, loader: 'ts' },
  bundle: true, format: 'esm', write: false, platform: 'browser',
})).outputFiles[0].text;
const BUNDLE_URL = 'data:text/javascript;base64,' + Buffer.from(js).toString('base64');
const CHAT_CSS = await readFile(path.join(ROOT, 'web/src/app/style.css'), 'utf8');

test('chat HUD appearance controls are bounded and immediately applied to the overlay', { timeout: 30_000 }, async t => {
  let browser;
  try { browser = await chromium.launch({ headless: true }); }
  catch (error) { t.skip(`no Chromium: ${String(error).split('\\n')[0]}`); return; }
  try {
    const page = await browser.newPage();
    await page.setContent('<main id="stage" style="position:relative;width:1200px;height:800px"></main>');
    await page.addStyleTag({ content: CHAT_CSS });
    const result = await page.evaluate(async bundleUrl => {
      const { QuickChat } = await import(bundleUrl);
      const chat = new QuickChat(document.querySelector('#stage'), { line() {}, lobby() {}, place() {}, log() {} });
      chat.setAppearance(0.75, 0.35);
      const low = {
        width: getComputedStyle(chat.chatHud).width,
        fontSize: getComputedStyle(chat.chatHud).fontSize,
        background: getComputedStyle(chat.chatMessages).backgroundImage,
      };
      chat.setAppearance(1.15, 0.92);
      const appearance = chat.appearance();
      const high = {
        width: getComputedStyle(chat.chatHud).width,
        fontSize: getComputedStyle(chat.chatHud).fontSize,
        background: getComputedStyle(chat.chatMessages).backgroundImage,
      };
      const styles = {
        scale: chat.chatHud.style.getPropertyValue('--chat-scale'),
        opacity: chat.chatHud.style.getPropertyValue('--chat-opacity'),
      };
      chat.stop();
      return { appearance, styles, low, high };
    }, BUNDLE_URL);
    assert.deepEqual(result.appearance, { scale: 1.15, opacity: 0.92 });
    assert.deepEqual(result.styles, { scale: '1.15', opacity: '0.92' });
    assert.ok(parseFloat(result.high.width) > parseFloat(result.low.width), 'HUD scale changes the chat panel width');
    assert.ok(parseFloat(result.high.fontSize) > parseFloat(result.low.fontSize), 'HUD scale changes text size');
    assert.notEqual(result.high.background, result.low.background, 'HUD background slider changes the message feed background');
  } finally { await browser.close(); }
});
