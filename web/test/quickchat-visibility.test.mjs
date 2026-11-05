// The FreeRoam HUD must not appear on the start or loading screens. Closed mode is message-only.
//   node --test web/test/quickchat-visibility.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bundle = (await esbuild.build({
  stdin: { contents: `export { QuickChat } from './web/src/app/quickchat.ts';`, resolveDir: ROOT, loader: 'ts' },
  bundle: true, format: 'esm', write: false, platform: 'browser',
})).outputFiles[0].text;
const BUNDLE_URL = 'data:text/javascript;base64,' + Buffer.from(bundle).toString('base64');

test('chat remains hidden before gameplay, shows messages-only when closed, and hides after the session', { timeout: 30_000 }, async t => {
  let browser;
  try { browser = await chromium.launch({ headless: true }); }
  catch (error) { t.skip(`no Chromium: ${String(error).split('\\n')[0]}`); return; }
  try {
    const page = await browser.newPage();
    await page.setContent('<main id="stage"></main>');
    const result = await page.evaluate(async bundleUrl => {
      const { QuickChat } = await import(bundleUrl);
      const chat = new QuickChat(document.querySelector('#stage'), { line() {}, lobby() {}, place() {}, log() {} });
      const initial = { hidden: chat.chatHud.hidden, ready: chat.chatHud.dataset.gameReady };
      let drive = 0;
      const session = {
        net: { chat: () => true },
        status: { read: () => ({ get: key => key === 'drive' ? drive : 0 }) },
      };
      chat.start(session, false, [], []);
      const started = { hidden: chat.chatHud.hidden, ready: chat.chatHud.dataset.gameReady };
      drive = 2;
      chat.driveAt = -Infinity;
      chat.marks(0, new Float32Array(0), new Uint32Array(0));
      const driving = { hidden: chat.chatHud.hidden, ready: chat.chatHud.dataset.gameReady };
      chat.chat(JSON.stringify({ id: 1, name: 'Driver', text: 'Test message', scope: 'room', channel: 0 }));
      const hasFeed = chat.chatMessages.childElementCount === 1;
      chat.toggle();
      const opened = chat.chatHud.classList.contains('active');
      chat.toggle();
      const closed = !chat.chatHud.classList.contains('active');
      chat.stop();
      const stopped = { hidden: chat.chatHud.hidden, ready: chat.chatHud.dataset.gameReady, rows: chat.chatMessages.childElementCount };
      return { initial, started, driving, hasFeed, opened, closed, stopped };
    }, BUNDLE_URL);
    assert.deepEqual(result.initial, { hidden: true, ready: 'false' });
    assert.deepEqual(result.started, { hidden: true, ready: 'false' });
    assert.deepEqual(result.driving, { hidden: false, ready: 'true' });
    assert.equal(result.hasFeed, true);
    assert.equal(result.opened, true);
    assert.equal(result.closed, true);
    assert.deepEqual(result.stopped, { hidden: true, ready: 'false', rows: 0 });
  } finally { await browser.close(); }
});

test('closed CSS hides every control and keeps only the message feed', async () => {
  const css = await fs.readFile(path.join(ROOT, 'web/src/app/modern-theme.css'), 'utf8');
  assert.match(css, /\.racing-chat-wrapper\[hidden\]/);
  assert.match(css, /\.racing-chat-wrapper:not\(\.active\) > \.chat-hud-header/);
  assert.match(css, /\.racing-chat-wrapper:not\(\.active\) > \.chat-tools/);
  assert.match(css, /\.racing-chat-wrapper:not\(\.active\) > \.quick-chat-panel/);
  assert.match(css, /\.racing-chat-wrapper:not\(\.active\) > \.chat-input-area/);
  assert.match(css, /\.racing-chat-wrapper:not\(\.active\) > \.chat-messages:empty/);
  assert.match(css, /\.chat-messages:not\(:has\(\.message:not\(\.fade-out\):not\(\[hidden\]\)\)\)/);
});
