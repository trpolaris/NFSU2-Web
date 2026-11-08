import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const entry = `export * from './web/src/app/tracks.ts'; export * as P from './web/src/app/players.ts';`;
const js = (await esbuild.build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', write: false, platform: 'neutral' })).outputFiles[0].text;
const T = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

test('track rooms use the game\'s uint32 world/key calculation and never return zero', () => {
  assert.equal(T.trackRoom(0, 4711), 2397071415);
  assert.equal(T.trackRoom(0, 4605), 199754989);
  assert.equal(T.trackRoom(0x12345678, 4301), 942920901);
  assert.equal(T.trackRoom(0xffffffff, 4201), 2745435750);
  const base = T.P.roomHash('World 2');
  assert.equal(T.trackRoom(base, 4711), ((base ^ 2397071415) >>> 0) || 1);
  assert.notEqual(T.trackRoom(base, 4711), base);
});

test('the nine career race-track spots keep travel.c order and unique rooms', () => {
  assert.deepEqual(T.TRACKS.map(s => s.key), [4711, 4701, 4311, 4301, 4201, 4211, 4221, 4601, 4605]);
  const rooms = T.trackRooms(0);
  assert.equal(rooms.length, 9);
  assert.equal(new Set(rooms).size, 9);
  assert.ok(!rooms.includes(0));
});

test('friend spot is resolved only against the friend\'s own world', () => {
  const w2 = T.P.roomHash('World 2');
  assert.equal(T.friendSpot('', 0), 0);
  assert.equal(T.friendSpot('World 2', w2), 0);
  assert.equal(T.friendSpot('', T.trackRoom(0, 4311)), 3);
  assert.equal(T.friendSpot('World 2', T.trackRoom(w2, 4605)), 9);
  assert.equal(T.friendSpot(undefined, T.trackRoom(0, 4701)), 2);
  assert.equal(T.friendSpot('World 2', T.trackRoom(0, 4311)), 0);
  assert.equal(T.friendSpot('World 2', undefined), 0);
});

test('travel status is parsed safely and explains why a track change is unavailable', () => {
  assert.equal(T.travelState(undefined), null);
  assert.equal(T.travelState(0), null);
  assert.deepEqual(T.travelState(65536), { at: 0, why: 0 });
  assert.deepEqual(T.travelState(65536 + 3), { at: 3, why: 0 });
  assert.deepEqual(T.travelState(65536 + 5 * 256), { at: 0, why: 5 });
  assert.equal(T.travelState(65536 + 10), null);
  assert.equal(T.whyText(0), '');
  assert.equal(T.whyText(5), 'Drive off the marker first.');
  assert.equal(T.atName(0), '');
  assert.equal(T.atName(1), 'URL: Airport Circuit');
});
