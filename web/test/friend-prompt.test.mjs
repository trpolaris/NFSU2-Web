import test from 'node:test';
import assert from 'node:assert/strict';
import * as esbuild from 'esbuild';

const ROOT = new URL('../..', import.meta.url).pathname;
const built = await esbuild.build({
  entryPoints: [ROOT + '/web/src/app/friend-bump.ts'],
  bundle: true, format: 'esm', write: false, platform: 'node',
});
const url = 'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64');
const { parseFriendBump } = await import(url);

test('parses the native front-bumper event while touching and while parted', () => {
  assert.deepEqual(parseFriendBump('{"id":42,"name":"Alex","on":1}'), { id: 42, name: 'Alex', on: true });
  assert.deepEqual(parseFriendBump('{"id":42,"name":"Alex","on":0}'), { id: 42, name: 'Alex', on: false });
});

test('rejects malformed events and invalid peer IDs, names and on values', () => {
  const tooLong = JSON.stringify({ id: 1, name: 'A'.repeat(65), on: 1 });
  for (const invalid of ['{', 'null', '[]', '{}', '{"id":0,"name":"Alex","on":1}',
    '{"id":1.5,"name":"Alex","on":1}', '{"id":1,"name":"","on":1}', tooLong,
    '{"id":1,"name":"Alex","on":2}']) assert.equal(parseFriendBump(invalid), null, invalid);
});
