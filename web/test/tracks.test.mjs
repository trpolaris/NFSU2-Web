import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
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

const readSource = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('Tracks UI events stay wired through the C mailbox, game frame and status publisher', () => {
  const tsProto = readSource('web/src/input/proto.ts');
  const tsInput = readSource('web/src/input/index.ts');
  const cProto = readSource('runtime/web/input_proto.h');
  const cInput = readSource('runtime/web/input_web.c');
  const roam = readSource('runtime/roam.c');
  const travel = readSource('runtime/travel.c');
  const build = readSource('web/build.sh');
  const status = readSource('runtime/web/status_web.c');
  const main = readSource('runtime/web/main_web.c');

  assert.ok(tsProto.includes('export const IEV_TRAVEL = 17;'));
  assert.ok(tsProto.includes('export const IEV_TRAVEL_FRIEND = 18;'));
  assert.ok(cProto.includes('IEV_TRAVEL = 17,'));
  assert.ok(cProto.includes('IEV_TRAVEL_FRIEND = 18,'));
  assert.ok(tsInput.includes('travel(where) {'));
  assert.ok(tsInput.includes('push(IEV_TRAVEL, 0, 0, 0, [], where, 0);'));
  assert.ok(tsInput.includes('travelFriend(nameHash, spot) {'));
  assert.ok(tsInput.includes('push(IEV_TRAVEL_FRIEND, 0, 0, 0, [], nameHash | 0, spot);'));
  assert.ok(cInput.includes('case IEV_TRAVEL: travel_ask(e->a);'));
  assert.ok(cInput.includes('case IEV_TRAVEL_FRIEND: travel_ask_friend((uint32_t)e->a, e->b);'));
  assert.ok(roam.includes('case HOOK_SITE(0x00581475):'));
  assert.ok(roam.includes('travel_frame(c);'));
  assert.ok(travel.includes('void sub_0041ace0_orig(CPU *c);'));
  assert.ok(travel.includes('void sub_0041ace0(CPU *c){'));
  assert.ok(travel.includes('if (on_track()){ c->eax &= ~0xffu; POP32(c->eip); return; }'));
  assert.ok(travel.includes('void sub_00540780_orig(CPU *c);'));
  assert.ok(travel.includes('void sub_00581820_orig(CPU *c);'));
  assert.ok(build.includes('travel sbrk'));
  assert.ok(build.includes('WEB="$(cd runtime/web && ls *.c'));
  assert.ok(status.includes('int host_status_slot(const char *name)'));
  assert.ok(status.includes('void status_web_start(void)'));
  assert.ok(main.includes('status_web_start();'));
});
