// FreeRoam typed chat UX: named Crew channels, safe sender rendering and visible send cooldown.
//   node --test web/test/quickchat-ux.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const js = (await esbuild.build({
  stdin: {
    contents: `export { QuickChat } from './web/src/app/quickchat.ts';`,
    resolveDir: ROOT,
    loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, platform: 'browser',
})).outputFiles[0].text;
const BUNDLE_URL = 'data:text/javascript;base64,' + Buffer.from(js).toString('base64');

async function withChat(t, fn) {
  let browser;
  try { browser = await chromium.launch({ headless: true }); }
  catch (error) { t.skip(`no Chromium: ${String(error).split('\\n')[0]}`); return; }
  try {
    const page = await browser.newPage();
    await page.setContent('<main id="stage"></main>');
    const result = await page.evaluate(async bundleUrl => {
      const { QuickChat } = await import(bundleUrl);
      const logs = [];
      const deps = { line() {}, lobby() {}, place() {}, log: s => logs.push(s) };
      const stage = document.querySelector('#stage');
      const sent = [];
      const session = {
        net: { chat: (...args) => { sent.push(args); return true; } },
        status: { read: () => ({ get: key => key === 'drive' ? 2 : 0 }) },
      };
      const chat = new QuickChat(stage, deps);
      chat.start(session, false, [], [], [{ name: 'Night Owls', id: 0x1234 }]);
      chat.driveAt = -Infinity;
      return { chat, sent, logs };
    }, bundleUrl);
    await fn(page, result);
  } finally {
    await browser.close();
  }
}

test('Crew names, player identity and message content are visible and safely rendered', { timeout: 30_000 }, async t => {
  await withChat(t, async (_page, { chat }) => {
    chat.channelIndex = 1;
    chat.updateChannel();
    assert.equal(chat.channelButton.textContent, '[Night Owls]');
    assert.equal(chat.channelButton.title, 'Night Owls');

    chat.chat(JSON.stringify({
      id: 17, name: '<b>Alice</b>', text: 'Hello Crew', scope: 'crew', channel: 0x1234, me: false,
    }));
    const other = chat.chatMessages.lastElementChild;
    assert.equal(other.querySelector('.channel').textContent, '[Night Owls]');
    assert.equal(other.querySelector('.sender').textContent, '<b>Alice</b>:');
    assert.equal(other.querySelector('.sender').querySelector('b'), null, 'untrusted player names render as text, not HTML');
    assert.equal(other.dataset.senderId, '17');
    assert.equal(other.classList.contains('me'), false);

    chat.chat(JSON.stringify({
      id: 18, name: 'Driver', text: 'My message', scope: 'crew', channel: 0x1234, me: true,
    }));
    const mine = chat.chatMessages.lastElementChild;
    assert.equal(mine.classList.contains('me'), true);
    assert.equal(mine.dataset.self, 'true');
    chat.stop();
  });
});

test('the client mirrors four messages per five seconds and keeps the composer open with a visible wait notice', { timeout: 30_000 }, async t => {
  await withChat(t, async (_page, { chat, sent }) => {
    chat.toggle();
    assert.equal(chat.chatHud.classList.contains('active'), true);
    for (let i = 0; i < 4; i++) {
      chat.chatInput.value = `message ${i + 1}`;
      chat.sendText();
      if (i < 3) chat.toggle();
    }
    assert.equal(sent.length, 4);
    chat.toggle();
    chat.chatInput.value = 'fifth message';
    chat.sendText();

    assert.equal(sent.length, 4, 'the fifth send is stopped locally');
    assert.equal(chat.chatHud.classList.contains('active'), true, 'the composer stays open while waiting');
    assert.equal(chat.chatInput.value, 'fifth message', 'the unsent draft is preserved');
    const notice = chat.chatMessages.querySelector('.message.system');
    assert.ok(notice, 'a visible system notice is added');
    assert.match(notice.textContent, /Wait a moment \\(\\d+s\\)/);
    chat.stop();
  });
});
