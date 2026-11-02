// Typed FreeRoam chat fades visually while keeping a bounded, readable session history.
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

 test('typed chat fades, returns when the composer opens, and retains only the latest 200 lines', { timeout: 30_000 }, async t => {
   let browser;
   try { browser = await chromium.launch({ headless: true }); }
   catch (error) { t.skip(`no Chromium: ${String(error).split('\\n')[0]}`); return; }

   try {
     const page = await browser.newPage();
     await page.setContent('<main><div id="single"></div><div id="busy"></div></main>');
     const result = await page.evaluate(async bundleUrl => {
       const realSetTimeout = window.setTimeout.bind(window);
       // Keep production timing values in source; accelerate only this deterministic timer test.
       window.setTimeout = (fn, ms, ...args) => realSetTimeout(fn, ms === 5000 ? 15 : ms, ...args);
       const { QuickChat } = await import(bundleUrl);
       const deps = { line() {}, lobby() {}, place() {}, log() {} };
       const session = () => ({
         net: { chat: () => true },
         status: { read: () => ({ get: () => 2 }) },
       });
       const wait = ms => new Promise(resolve => realSetTimeout(resolve, ms));
       const message = id => JSON.stringify({
         id, name: 'Driver', text: `message-${id}`, scope: 'room', channel: 0,
       });

       const single = new QuickChat(document.querySelector('#single'), deps);
       single.start(session(), false, [], []);
       single.driveAt = -Infinity;
       single.chat(message(1));
       const initially = single.chatMessages.childElementCount;
       await wait(35);
       const faded = single.chatMessages.firstElementChild?.classList.contains('fade-out') ?? false;
       const retainedAfterFade = single.chatMessages.childElementCount;

       single.toggle();
       const composerOpened = single.chatHud.classList.contains('active');
       const visibleAgain = !single.chatMessages.firstElementChild?.classList.contains('fade-out');
       single.toggle();
       await wait(35);
       const fadedAgain = single.chatMessages.firstElementChild?.classList.contains('fade-out') ?? false;
       const retainedAfterSecondFade = single.chatMessages.childElementCount;
       single.stop();
       const clearedAtStop = single.chatMessages.childElementCount;

       const busy = new QuickChat(document.querySelector('#busy'), deps);
       busy.start(session(), false, [], []);
       busy.driveAt = -Infinity;
       busy.toggle();
       const busyComposerOpened = busy.chatHud.classList.contains('active');
       for (let id = 1; id <= 205; id++) busy.chat(message(id));
       const whileOpen = busy.chatMessages.childElementCount;
       const oldestWhileOpen = busy.chatMessages.firstElementChild?.textContent ?? '';
       const newestWhileOpen = busy.chatMessages.lastElementChild?.textContent ?? '';
       busy.toggle();
       await wait(60);
       const afterCloseFade = busy.chatMessages.childElementCount;
       const fadedAfterClose = busy.chatMessages.querySelectorAll('.fade-out').length;
       busy.stop();
       const clearedBusyAtStop = busy.chatMessages.childElementCount;

       return {
         initially, faded, retainedAfterFade, composerOpened, visibleAgain, fadedAgain,
         retainedAfterSecondFade, clearedAtStop, busyComposerOpened, whileOpen,
         oldestWhileOpen, newestWhileOpen, afterCloseFade, fadedAfterClose, clearedBusyAtStop,
       };
     }, BUNDLE_URL);

     assert.equal(result.initially, 1);
     assert.equal(result.faded, true, 'the fade class is applied after the display interval');
     assert.equal(result.retainedAfterFade, 1, 'faded messages remain in the bounded session history');
     assert.equal(result.composerOpened, true);
     assert.equal(result.visibleAgain, true, 'opening the composer reveals the retained message again');
     assert.equal(result.fadedAgain, true, 'the message fades again after the composer closes');
     assert.equal(result.retainedAfterSecondFade, 1);
     assert.equal(result.clearedAtStop, 0, 'ending the session clears its chat history');

     assert.equal(result.busyComposerOpened, true);
     assert.equal(result.whileOpen, 200, 'the composer retains at most 200 message rows');
     assert.match(result.oldestWhileOpen, /message-6$/, 'the oldest five of 205 messages are discarded first');
     assert.match(result.newestWhileOpen, /message-205$/, 'the newest message remains in the history');
     assert.equal(result.afterCloseFade, 200, 'fading does not remove the bounded history from the DOM');
     assert.equal(result.fadedAfterClose, 200, 'retained rows fade while the composer is closed');
     assert.equal(result.clearedBusyAtStop, 0, 'ending the session clears all retained rows');
   } finally {
     await browser.close();
   }
 });
