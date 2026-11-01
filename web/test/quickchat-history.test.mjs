// Typed FreeRoam chat history stays bounded and removes faded DOM rows.
//   node --test web/test/quickchat-history.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const entry = `export { QuickChat } from './web/src/app/quickchat.ts';`;
const js = (await esbuild.build({
  stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' },
  bundle: true, format: 'esm', write: false, platform: 'browser',
})).outputFiles[0].text;
const BUNDLE_URL = 'data:text/javascript;base64,' + Buffer.from(js).toString('base64');

test('typed chat rows fade out, are removed, and history remains bounded while the composer is open', { timeout: 30_000 }, async t => {
  let browser;
  try { browser = await chromium.launch({ headless: true }); }
  catch (error) { t.skip(`no Chromium: ${String(error).split('\\n')[0]}`); return; }

  try {
    const page = await browser.newPage();
    await page.setContent('<main><div id="single"></div><div id="busy"></div></main>');
    const result = await page.evaluate(async bundleUrl => {
      const realSetTimeout = window.setTimeout.bind(window);
      // Keep the production timing values in source; accelerate only this deterministic timer test.
      window.setTimeout = (fn, ms, ...args) => realSetTimeout(fn, ms === 5000 || ms === 450 ? 15 : ms, ...args);
      const { QuickChat } = await import(bundleUrl);
      const deps = { line() {}, lobby() {}, place() {}, log() {} };
      const session = () => ({
        net: { chat: () => true },
        status: { read: () => ({ get: () => 2 }) },
      });
      const message = id => JSON.stringify({
        id, name: 'Driver', text: `message-${id}`, scope: 'room', channel: 0,
      });

      const single = new QuickChat(document.querySelector('#single'), deps);
      single.start(session(), false, [], []);
      single.chat(message(1));
      const initially = single.chatMessages.childElementCount;
      await new Promise(resolve => realSetTimeout(resolve, 25));
      const fading = single.chatMessages.firstElementChild?.classList.contains('fade-out') ?? false;
      await new Promise(resolve => realSetTimeout(resolve, 35));
      const afterExpiry = single.chatMessages.childElementCount;
      const timersAfterExpiry = single.messageTimers.size;
      single.stop();

      const busy = new QuickChat(document.querySelector('#busy'), deps);
      busy.start(session(), false, [], []);
      busy.driveAt = -Infinity;
      busy.toggle();
      const composerOpened = busy.chatHud.classList.contains('active');
      for (let i = 0; i < 60; i++) busy.chat(message(i));
      const whileOpen = busy.chatMessages.childElementCount;
      const oldestVisible = busy.chatMessages.firstElementChild?.textContent ?? '';
      busy.toggle();
      await new Promise(resolve => realSetTimeout(resolve, 100));
      const afterCloseExpiry = busy.chatMessages.childElementCount;
      const timersAfterClose = busy.messageTimers.size;
      busy.stop();

      return { initially, fading, afterExpiry, timersAfterExpiry, composerOpened, whileOpen, oldestVisible, afterCloseExpiry, timersAfterClose };
    }, BUNDLE_URL);

    assert.equal(result.initially, 1);
    assert.equal(result.fading, true, 'the fade class is applied after the display interval');
    assert.equal(result.afterExpiry, 0, 'the message node is removed after the CSS fade');
    assert.equal(result.timersAfterExpiry, 0, 'completed messages leave no timer entries');
    assert.equal(result.composerOpened, true);
    assert.equal(result.whileOpen, 40, 'the composer cannot grow the DOM history without a limit');
    assert.match(result.oldestVisible, /message-20$/, 'the oldest 20 of 60 messages are discarded first');
    assert.equal(result.afterCloseExpiry, 0, 'the retained history expires after the composer closes');
    assert.equal(result.timersAfterClose, 0);
  } finally {
    await browser.close();
  }
});
