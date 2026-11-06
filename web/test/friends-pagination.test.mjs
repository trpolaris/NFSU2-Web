// The existing F9 Friends roster pages long lists without changing the panel layout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bundle = (await esbuild.build({
  stdin: {
    contents: `export { FriendsPanel } from './web/src/app/friends.ts';`,
    resolveDir: ROOT,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  write: false,
  platform: 'browser',
})).outputFiles[0].text;
const BUNDLE_URL = 'data:text/javascript;base64,' + Buffer.from(bundle).toString('base64');

test('F9 Friends roster paginates 20 rows, clamps pages and resets pagination on filter', { timeout: 30_000 }, async t => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    t.skip(`no Chromium: ${String(error).split('\\n')[0]}`);
    return;
  }

  try {
    const page = await browser.newPage();
    await page.setContent('<main id="friends"></main>');
    const result = await page.evaluate(async bundleUrl => {
      const { FriendsPanel } = await import(bundleUrl);
      const allFriends = Array.from({ length: 45 }, (_, index) => ({
        name: `Driver ${index + 1}`,
        where: index % 2 ? 'online' : 'roam',
      }));
      const lists = { me: 'LocalDriver', friends: allFriends.slice(), asks: [], sent: [], mail: [] };
      const root = document.querySelector('#friends');
      new FriendsPanel(root, { room: async () => lists }, () => {}, () => 'Room A');
      await new Promise(resolve => setTimeout(resolve, 0));

      const inspect = () => ({
        rows: root.querySelectorAll('[data-friends-list] .friends-row').length,
        first: root.querySelector('[data-friends-list] .friends-row b')?.textContent ?? '',
        page: root.querySelector('[data-friends-page]')?.textContent ?? '',
        hidden: root.querySelector('[data-friends-pagination]')?.hidden ?? true,
        previousDisabled: root.querySelector('[data-friends-prev]')?.disabled ?? true,
        nextDisabled: root.querySelector('[data-friends-next]')?.disabled ?? true,
        empty: root.querySelector('[data-friends-list] .friends-empty')?.textContent ?? '',
      });

      const states = [];
      states.push(inspect());
      root.querySelector('[data-friends-next]').click();
      states.push(inspect());
      root.querySelector('[data-friends-next]').click();
      states.push(inspect());
      root.querySelector('[data-friends-prev]').click();
      states.push(inspect());

      // If a refresh shrinks the roster, the current page is clamped to the
      // new last page rather than leaving an empty list.
      lists.friends = allFriends.slice(0, 21);
      await root.querySelector('[data-friends-refresh]').click();
      await new Promise(resolve => setTimeout(resolve, 0));
      states.push(inspect());
      lists.friends = allFriends.slice();

      const filter = root.querySelector('[data-friends-filter]');
      filter.value = 'Driver 4';
      filter.dispatchEvent(new Event('input', { bubbles: true }));
      states.push(inspect());
      filter.value = 'no-such-player';
      filter.dispatchEvent(new Event('input', { bubbles: true }));
      states.push(inspect());
      return states;
    }, BUNDLE_URL);

    assert.deepEqual(result[0], {
      rows: 20, first: 'Driver 1', page: '1 / 3', hidden: false,
      previousDisabled: true, nextDisabled: false, empty: '',
    });
    assert.deepEqual(result[1], {
      rows: 20, first: 'Driver 21', page: '2 / 3', hidden: false,
      previousDisabled: false, nextDisabled: false, empty: '',
    });
    assert.deepEqual(result[2], {
      rows: 5, first: 'Driver 41', page: '3 / 3', hidden: false,
      previousDisabled: false, nextDisabled: true, empty: '',
    });
    assert.deepEqual(result[3], {
      rows: 20, first: 'Driver 21', page: '2 / 3', hidden: false,
      previousDisabled: false, nextDisabled: false, empty: '',
    });
    assert.deepEqual(result[4], {
      rows: 1, first: 'Driver 21', page: '2 / 2', hidden: false,
      previousDisabled: false, nextDisabled: true, empty: '',
    });
    assert.deepEqual(result[5], {
      rows: 7, first: 'Driver 4', page: '1 / 1', hidden: true,
      previousDisabled: true, nextDisabled: true, empty: '',
    });
    assert.deepEqual(result[6], {
      rows: 0, first: '', page: '1 / 1', hidden: true,
      previousDisabled: true, nextDisabled: true, empty: 'Eşleşen arkadaş yok.',
    });
  } finally {
    await browser.close();
  }
});
