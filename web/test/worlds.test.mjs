// The fixed public worlds and named-room mapping used by the Online page.
//   node --test web/test/worlds.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const HERE = path.dirname(fileURLToPath(import.meta.url));
async function bundle(entry) {
  const out = await esbuild.build({
    entryPoints: [path.join(HERE, entry)],
    bundle: true, write: false, format: 'esm', platform: 'neutral',
  });
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
}
const { WORLDS, isMain, isOwn, noGhost, worldName, worldNamed, worldOf, worldRooms } =
  await bundle('../src/app/worlds.ts');
const { roomHash, worldCounts, askWorlds } = await bundle('../src/app/players.ts');

test('the four public worlds have stable names and the World 4 collision rule', () => {
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

test('a named world and the requested counts keep stable hash order', () => {
  const own = 'Night Owls';
  assert.equal(isOwn(own), true);
  assert.equal(isOwn('World 3'), false);
  assert.equal(worldName(own), own);
  assert.equal(worldNamed(''), 'Main world');
  assert.equal(worldNamed('World 2'), 'World 2');

  const asked = [0, ...WORLDS.map(roomHash), roomHash(own)];
  assert.deepEqual(worldRooms(own), asked);
  assert.deepEqual(worldRooms(''), asked.slice(0, 5));
  assert.deepEqual([...worldCounts({ rooms: [2, 3, 0, 1, 4, 6] }, asked)],
    [[0, 2], [asked[1], 3], [asked[2], 0], [asked[3], 1], [asked[4], 4], [asked[5], 6]]);
  assert.deepEqual([...worldCounts({ rooms: [5] }, [0, asked[1]])], [[0, 5]],
    'a short response has no counts for the worlds not present');
});

test('/players?rooms asks for at most eight worlds and preserves returned counts', async () => {
  const oldFetch = globalThis.fetch;
  let requested = '';
  globalThis.fetch = async url => {
    requested = String(url);
    return { ok: true, json: async () => ({ rooms: [7, 2] }) };
  };
  try {
    const result = await askWorlds([0, 11, 12, 13, 14, 15, 16, 17, 18], 1000);
    assert.equal(requested, '/players?rooms=0,11,12,13,14,15,16,17');
    assert.deepEqual([...result], [[0, 7], [11, 2]]);
  } finally {
    globalThis.fetch = oldFetch;
  }
});
