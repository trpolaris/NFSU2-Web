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


test('chat history keeps the latest 200 lines and does not pull the reader away from older messages', { timeout: 30_000 }, async t => {
  let browser;
  try { browser = await chromium.launch({ headless: true }); }
  catch (error) { t.skip(`no Chromium: ${String(error).split('\\n')[0]}`); return; }
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.setContent('<main id="stage" style="position:relative;width:1200px;height:800px"></main>');
    await page.addStyleTag({ content: CHAT_CSS });
    await page.evaluate(async bundleUrl => {
      const { QuickChat } = await import(bundleUrl);
      const chat = new QuickChat(document.querySelector('#stage'), { line() {}, lobby() {}, place() {}, log() {} });
      // The message renderer only needs a live session marker for these room messages.
      chat.session = {};
      chat.chatHud.classList.add('active');
      for (let id = 1; id <= 205; id++) {
        chat.chat(JSON.stringify({ id, name: `Driver${id}`, text: `Message ${id}`, scope: 'room', channel: 0 }));
      }
      window.__historyChat = chat;
    }, BUNDLE_URL);

    const list = page.locator('#chatMessages');
    const initial = await list.evaluate(el => ({
      count: el.childElementCount,
      first: Number(el.firstElementChild?.dataset.messageId),
      last: Number(el.lastElementChild?.dataset.messageId),
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    assert.equal(initial.count, 200);
    assert.equal(initial.first, 6);
    assert.equal(initial.last, 205);
    assert.ok(initial.scrollHeight > initial.clientHeight, 'the message feed is scrollable');

    await list.evaluate(el => { el.scrollTop = el.scrollHeight; });
    await list.hover();
    await page.mouse.wheel(0, -420);
    await page.waitForFunction(() => {
      const el = document.querySelector('#chatMessages');
      return el.scrollHeight - el.clientHeight - el.scrollTop > 2;
    });
    const readingPosition = await list.evaluate(el => el.scrollTop);
    assert.ok(readingPosition > 0, 'mouse wheel moves into the older message history');

    await page.evaluate(() => window.__historyChat.chat(JSON.stringify({
      id: 206, name: 'Driver206', text: 'Message 206', scope: 'room', channel: 0,
    })));
    const whileReading = await list.evaluate(el => ({
      count: el.childElementCount,
      first: Number(el.firstElementChild?.dataset.messageId),
      last: Number(el.lastElementChild?.dataset.messageId),
      top: el.scrollTop,
      max: el.scrollHeight - el.clientHeight,
    }));
    assert.equal(whileReading.count, 200);
    assert.equal(whileReading.first, 7);
    assert.equal(whileReading.last, 206);
    assert.ok(whileReading.top < whileReading.max - 1, 'new messages do not force the reader back to the latest line');
    assert.ok(await page.locator('#chatHistoryLatest').isVisible(), 'a jump-to-latest control appears while older messages are open');

    await page.locator('#chatHistoryLatest').click();
    const latest = await list.evaluate(el => ({
      top: el.scrollTop,
      max: el.scrollHeight - el.clientHeight,
    }));
    assert.ok(Math.abs(latest.max - latest.top) <= 2, 'jump-to-latest returns to the bottom');
    assert.equal(await page.locator('#chatHistoryLatest').isVisible(), false);
    await browser.close();
  } finally {
    if (browser) await browser.close();
  }
});
