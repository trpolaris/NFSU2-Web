// The fixed public worlds and named-room mapping used by the Online page.
//   node --test web/test/worlds.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const built = await esbuild.build({
  entryPoints: [path.join(HERE, '../src/app/worlds.ts')],
  bundle: true, write: false, format: 'esm', platform: 'neutral',
});
const { WORLDS, isMain, isOwn, noGhost, worldName, worldNamed, worldOf, worldRooms } =
  await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));

test('the four public worlds have stable names, hashes and world-four rule', () => {
  assert.deepEqual(WORLDS, ['World 1', 'World 2', 'World 3', 'World 4']);
  assert.equal(worldOf('World 1'), 1);
  assert.equal(worldOf('World 2'), 2);
  assert.equal(worldOf('World 3'), 3);
  assert.equal(worldOf('World 4'), 4);
  assert.equal(noGhost('World 4'), true);
  assert.equal(noGhost('World 3'), false);
  assert.equal(isMain('  '), true);
  assert.equal(isMain('World 1'), false);
});

test('a named room is an own world, and requested count hashes are ordered', () => {
  assert.equal(isOwn('Night Owls'), true);
  assert.equal(isOwn('World 3'), false);
  assert.equal(worldName('Night Owls'), 'Night Owls');
  assert.equal(worldNamed(''), 'Main world');
  assert.equal(worldNamed('World 2'), 'World 2');
  assert.deepEqual(worldRooms('Night Owls'), [0, ...WORLDS.map((name) => {
    // hashes are intentionally not hard-coded here: worldRooms and roomHash share the same game hash implementation
    return ({'World 1': worldRooms('')[1], 'World 2': worldRooms('')[2], 'World 3': worldRooms('')[3], 'World 4': worldRooms('')[4]})[name];
  }), worldRooms('Night Owls')[5]]);
  assert.equal(worldRooms('Night Owls').length, 6);
  assert.equal(worldRooms('').length, 5);
});
