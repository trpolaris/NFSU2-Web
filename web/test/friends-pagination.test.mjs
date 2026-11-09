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


test('F9 Friends inbox keeps live LAN mail once across a real page reload', { timeout: 30_000 }, async t => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    t.skip(`no Chromium: ${String(error).split('\\n')[0]}`);
    return;
  }

  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<main id="friends"></main>',
    }));
    await page.goto('http://friends-live-inbox.test/');
    assert.equal(await page.evaluate(() => location.origin), 'http://friends-live-inbox.test');

    const lists = {
      me: 'LocalDriver',
      friends: [{ name: 'Bo', where: '' }],
      asks: [],
      sent: [],
      mail: [],
    };
    await page.evaluate(async (bundleUrl, snapshot) => {
      const { FriendsPanel } = await import(bundleUrl);
      localStorage.clear();
      const root = document.querySelector('#friends');
      const panel = new FriendsPanel(root, { room: async () => snapshot }, () => {});
      // Let the initial /friends snapshot establish the claimed player before a live LAN event arrives.
      await new Promise(resolve => setTimeout(resolve, 0));
      const message = { op: 'mail', from: 'Bo', body: 'live LAN message', at: 3000 };
      panel.server(message);
      panel.server(message);
    }, BUNDLE_URL, lists);

    await page.waitForFunction(
      () => localStorage.getItem('nfsu2.friends.inbox.localdriver') !== null,
      null,
      { timeout: 10_000 },
    );
    const first = await page.evaluate(() => {
      const root = document.querySelector('#friends');
      return {
        unread: root.querySelector('[data-friends-mail-count]')?.textContent ?? '',
        rows: [...root.querySelectorAll('.friends-mail-row')].map(row => ({
          sender: row.querySelector('b')?.textContent ?? '',
          body: row.querySelector('p')?.textContent ?? '',
          unread: row.dataset.unread ?? '',
        })),
        persisted: localStorage.getItem('nfsu2.friends.inbox.localdriver'),
      };
    });

    assert.deepEqual(first, {
      unread: '1',
      rows: [{ sender: 'Bo', body: 'live LAN message', unread: 'true' }],
      persisted: JSON.stringify([{ from: 'Bo', body: 'live LAN message', t: 3000, read: false }]),
    });

    await page.reload();
    await page.evaluate(async (bundleUrl, snapshot) => {
      const { FriendsPanel } = await import(bundleUrl);
      const root = document.querySelector('#friends');
      new FriendsPanel(root, { room: async () => snapshot }, () => {});
    }, BUNDLE_URL, lists);
    await page.waitForFunction(() => document.querySelector('.friends-mail-row') !== null, null, { timeout: 10_000 });
    const afterReload = await page.evaluate(() => {
      const root = document.querySelector('#friends');
      return {
        unread: root.querySelector('[data-friends-mail-count]')?.textContent ?? '',
        rows: [...root.querySelectorAll('.friends-mail-row')].map(row => ({
          sender: row.querySelector('b')?.textContent ?? '',
          body: row.querySelector('p')?.textContent ?? '',
          unread: row.dataset.unread ?? '',
        })),
        persisted: localStorage.getItem('nfsu2.friends.inbox.localdriver'),
      };
    });

    assert.deepEqual(afterReload, first, 'live messages and unread state survive a real page reload');
  } finally {
    await browser.close();
  }
});

test('F9 Friends inbox persists unread state per claimed name and keeps read history', { timeout: 30_000 }, async t => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    t.skip(`no Chromium: ${String(error).split('\\n')[0]}`);
    return;
  }

  try {
    const page = await browser.newPage();
    await page.route('http://friends-inbox.test/**', route => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<main id="friends"></main>',
    }));
    await page.goto('http://friends-inbox.test/');
    const result = await page.evaluate(async bundleUrl => {
      const { FriendsPanel } = await import(bundleUrl);
      localStorage.clear();
      const lists = {
        me: 'LocalDriver',
        friends: [{ name: 'Bo', where: '' }, { name: 'Cy', where: '' }],
        asks: [],
        sent: [],
        mail: [
          { from: 'Bo', body: 'first message', t: 1000 },
          { from: 'Cy', body: 'newer message', t: 2000 },
        ],
      };
      const snapshot = root => ({
        unread: root.querySelector('[data-friends-mail-count]')?.textContent ?? '',
        mailboxHidden: root.querySelector('[data-friends-mailbox]')?.hidden ?? true,
        markAllHidden: root.querySelector('[data-friends-mail-clear]')?.hidden ?? true,
        rows: [...root.querySelectorAll('.friends-mail-row')].map(row => ({
          sender: row.querySelector('b')?.textContent ?? '',
          unread: row.dataset.unread ?? '',
        })),
      });

      const firstRoot = document.querySelector('#friends');
      new FriendsPanel(firstRoot, { room: async () => lists }, () => {});
      await new Promise(resolve => setTimeout(resolve, 0));
      const initial = snapshot(firstRoot);
      firstRoot.querySelector('.friends-mail-row.is-unread [data-friends-mail-read]')?.click();
      const afterOneRead = snapshot(firstRoot);

      const secondRoot = document.createElement('main');
      document.body.append(secondRoot);
      new FriendsPanel(secondRoot, { room: async () => ({ ...lists, mail: [] }) }, () => {});
      await new Promise(resolve => setTimeout(resolve, 0));
      const afterReload = snapshot(secondRoot);
      secondRoot.querySelector('[data-friends-mail-clear]')?.click();
      const afterMarkAll = snapshot(secondRoot);

      const otherRoot = document.createElement('main');
      document.body.append(otherRoot);
      new FriendsPanel(otherRoot, { room: async () => ({ ...lists, me: 'OtherDriver', mail: [] }) }, () => {});
      await new Promise(resolve => setTimeout(resolve, 0));
      const otherPlayer = snapshot(otherRoot);
      return { initial, afterOneRead, afterReload, afterMarkAll, otherPlayer };
    }, BUNDLE_URL);

    assert.deepEqual(result.initial, {
      unread: '2', mailboxHidden: false, markAllHidden: false,
      rows: [{ sender: 'Cy', unread: 'true' }, { sender: 'Bo', unread: 'true' }],
    });
    assert.deepEqual(result.afterOneRead, {
      unread: '1', mailboxHidden: false, markAllHidden: false,
      rows: [{ sender: 'Bo', unread: 'true' }, { sender: 'Cy', unread: 'false' }],
    });
    assert.deepEqual(result.afterReload, result.afterOneRead, 'delivered mail and its read state survive a page reload');
    assert.deepEqual(result.afterMarkAll, {
      unread: '0', mailboxHidden: false, markAllHidden: true,
      rows: [{ sender: 'Cy', unread: 'false' }, { sender: 'Bo', unread: 'false' }],
    });
    assert.deepEqual(result.otherPlayer, {
      unread: '0', mailboxHidden: true, markAllHidden: true, rows: [],
    }, 'another claimed name must not see this inbox');
  } finally {
    await browser.close();
  }
});
