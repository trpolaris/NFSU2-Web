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

async function browserTest(t, run) {
  let browser;
  try { browser = await chromium.launch({ headless: true }); }
  catch (error) { t.skip(`no Chromium: ${String(error).split('\\n')[0]}`); return null; }
  try {
    const page = await browser.newPage();
    await page.setContent('<main id="stage"></main>');
    return await page.evaluate(run, BUNDLE_URL);
  } finally {
    await browser.close();
  }
}

test('Crew names, player identity and message content are visible and safely rendered', { timeout: 30_000 }, async t => {
  const result = await browserTest(t, async bundleUrl => {
    const { QuickChat } = await import(bundleUrl);
    const stage = document.querySelector('#stage');
    const chat = new QuickChat(stage, { line() {}, lobby() {}, place() {}, log() {} });
    const session = {
      net: { chat: () => true },
      status: { read: () => ({ get: key => key === 'drive' ? 2 : 0 }) },
    };
    chat.start(session, false, [], [], [{ name: 'Night Owls', id: 0x1234 }]);
    chat.channelIndex = 1;
    chat.updateChannel();
    const header = { text: chat.channelButton.textContent, title: chat.channelButton.title };

    chat.chat('null');
    chat.chat('[]');
    chat.chat(JSON.stringify({
      id: 17, name: '<b>Alice</b>', text: 'Hello Crew', scope: 'crew', channel: 0x1234, me: false,
    }));
    const other = chat.chatMessages.lastElementChild;
    const otherMessage = {
      channel: other.querySelector('.channel').textContent,
      channelTitle: other.querySelector('.channel').title,
      sender: other.querySelector('.sender').textContent,
      renderedHtml: other.querySelector('.sender').innerHTML,
      senderId: other.dataset.senderId,
      mine: other.classList.contains('me'),
    };

    chat.chat(JSON.stringify({
      id: 18, name: 'Driver', text: 'My message', scope: 'crew', channel: 0x1234, me: true,
    }));
    const mine = chat.chatMessages.lastElementChild;
    const ownMessage = { highlighted: mine.classList.contains('me'), self: mine.dataset.self };
    chat.stop();
    return { header, otherMessage, ownMessage };
  });
  if (!result) return;
  assert.deepEqual(result.header, { text: '[Night Owls]', title: 'Night Owls' });
  assert.deepEqual(result.otherMessage, {
    channel: '[Night Owls]', channelTitle: 'Night Owls', sender: '<b>Alice</b>:', renderedHtml: '&lt;b&gt;Alice&lt;/b&gt;:',
    senderId: '17', mine: false,
  });
  assert.deepEqual(result.ownMessage, { highlighted: true, self: 'true' });
});

test('the client mirrors four messages per five seconds and keeps the composer open with a visible wait notice', { timeout: 30_000 }, async t => {
  const result = await browserTest(t, async bundleUrl => {
    const { QuickChat } = await import(bundleUrl);
    const sent = [];
    const chat = new QuickChat(document.querySelector('#stage'), { line() {}, lobby() {}, place() {}, log() {} });
    const session = {
      net: { chat: (...args) => { sent.push(args); return true; } },
      status: { read: () => ({ get: key => key === 'drive' ? 2 : 0 }) },
    };
    chat.start(session, false, [], []);
    chat.driveAt = -Infinity;
    chat.toggle();
    for (let i = 0; i < 4; i++) {
      chat.chatInput.value = `message ${i + 1}`;
      chat.sendText();
      if (i < 3) chat.toggle();
    }
    chat.toggle();
    chat.chatInput.value = 'fifth message';
    chat.sendText();

    const notice = chat.chatMessages.querySelector('.message.system');
    const out = {
      accepted: sent.length,
      composerOpen: chat.chatHud.classList.contains('active'),
      draft: chat.chatInput.value,
      notice: notice?.textContent ?? '',
    };
    chat.stop();
    return out;
  });
  if (!result) return;
  assert.equal(result.accepted, 4, 'only four messages are sent');
  assert.equal(result.composerOpen, true, 'the composer stays open while waiting');
  assert.equal(result.draft, 'fifth message', 'the unsent draft is preserved');
  assert.match(result.notice, /Wait a moment \(\d+s\)/);
});

test('typing @ in the FreeRoam composer suggests live server players and inserts the selected name', { timeout: 30_000 }, async t => {
  const result = await browserTest(t, async bundleUrl => {
    window.fetch = async path => {
      if (path !== '/api/v1/live/players') throw new Error('unexpected fetch ' + path);
      return new Response(JSON.stringify({ players: [
        { id: 'opaque-1', name: 'AliceRacer', activity: 'free-roam' },
        { id: 'opaque-2', name: 'Bob', activity: 'online' },
        { id: 'opaque-3', name: 'LocalDriver', activity: 'free-roam' },
      ] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const { QuickChat } = await import(bundleUrl);
    const chat = new QuickChat(document.querySelector('#stage'), { line() {}, lobby() {}, place() {}, log() {} });
    const session = {
      net: { chat: () => true },
      status: { read: () => ({ get: key => key === 'drive' ? 2 : 0 }) },
    };
    chat.start(session, true, [], [], [], 'LocalDriver');
    chat.driveAt = -Infinity;
    const composerOpened = chat.openChat();
    const input = document.querySelector('#chatInput');
    input.value = '@ali';
    input.setSelectionRange(input.value.length, input.value.length);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const deadline = Date.now() + 3000;
    while (!document.querySelector('.chat-mention-option') && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    const suggestions = [...document.querySelectorAll('.chat-mention-option')].map(node => node.textContent);
    const candidate = document.querySelector('.chat-mention-option');
    if (candidate) candidate.click();
    const output = input.value;
    const expanded = input.getAttribute('aria-expanded');
    chat.stop();
    return { suggestions, output, expanded, composerOpen: chat.chatHud.classList.contains('active'), composerOpened };
  });
  if (!result) return;
  assert.equal(result.composerOpened, true);
  assert.equal(result.composerOpen, true);
  assert.deepEqual(result.suggestions, ['@AliceRacerFREE ROAM']);
  assert.equal(result.output, '@AliceRacer ');
  assert.equal(result.expanded, 'false');
});
