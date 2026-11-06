import test from 'node:test';
import assert from 'node:assert/strict';
import * as esbuild from 'esbuild';

const ROOT = new URL('../..', import.meta.url).pathname;
const built = await esbuild.build({
  stdin: { contents: "export { KEY_FRIEND, gameHas } from './web/src/app/gamekeys.ts';", resolveDir: ROOT, loader: 'ts' },
  bundle: true, format: 'esm', write: false, platform: 'node',
});
const url = 'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64');
const { KEY_FRIEND, gameHas } = await import(url);

test('FriendPrompt key uses the PAGE_KEYS bit for the live game mapping', () => {
  assert.equal(KEY_FRIEND, 1);
  const session = { status: { read: () => new Map([['keys', 0]]) } };
  assert.equal(gameHas(session, KEY_FRIEND), false);
  session.status.read = () => new Map([['keys', 1 << KEY_FRIEND]]);
  assert.equal(gameHas(session, KEY_FRIEND), true);
});

test('an unknown game map fails closed, so FriendPrompt does not take its shortcut', () => {
  assert.equal(gameHas({ status: null }, KEY_FRIEND), true);
});

test('no session or a negative bit never reserves a game key', () => {
  assert.equal(gameHas(null, KEY_FRIEND), false);
  assert.equal(gameHas({ status: { read: () => new Map([['keys', 0xffffffff]]) } }, -1), false);
});
