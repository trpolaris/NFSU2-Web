import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('Tracks is listed in the WASM and native macOS runtime build manifests', () => {
  const wasmBuild = read('web/build.sh');
  const nativeBuild = read('link.sh');
  const wasmRuntime = /^RT="([^"]+)"/m.exec(wasmBuild)?.[1];
  const nativeRuntime = /^CSRC="([^"]+)"/m.exec(nativeBuild)?.[1];

  assert.ok(wasmRuntime, 'web/build.sh declares its runtime source list');
  assert.ok(nativeRuntime, 'link.sh declares its native macOS C runtime source list');
  assert.ok(wasmRuntime.split(/\s+/).includes('travel'), 'WASM compiles runtime/travel.c');
  assert.ok(nativeRuntime.split(/\s+/).includes('travel'), 'native macOS build compiles runtime/travel.c');
});

test('Tracks input event numbers and payloads agree across TypeScript and C', () => {
  const tsProto = read('web/src/input/proto.ts');
  const cProto = read('runtime/web/input_proto.h');
  const tsInput = read('web/src/input/index.ts');
  const cInput = read('runtime/web/input_web.c');

  assert.match(tsProto, /export const IEV_TRAVEL = 17;/);
  assert.match(tsProto, /export const IEV_TRAVEL_FRIEND = 18;/);
  assert.match(cProto, /IEV_TRAVEL\s*=\s*17/);
  assert.match(cProto, /IEV_TRAVEL_FRIEND\s*=\s*18/);

  assert.match(tsInput, /push\(IEV_TRAVEL, 0, 0, 0, \[\], where, 0\)/);
  assert.match(tsInput, /push\(IEV_TRAVEL_FRIEND, 0, 0, 0, \[\], nameHash \| 0, spot\)/);
  assert.match(cInput, /case IEV_TRAVEL:\s*travel_ask\(e->a\);/);
  assert.match(cInput, /case IEV_TRAVEL_FRIEND:\s*travel_ask_friend\(\(uint32_t\)e->a, e->b\);/);
});

test('Tracks input API and menu bridge expose one matching travel contract', () => {
  const contract = read('web/src/app/contract.ts');
  const input = contract.slice(contract.indexOf('export interface InputSubsystem'));
  const tracks = read('web/src/app/tracks.ts');
  const shell = read('web/src/app/shell.ts');
  const tsInput = read('web/src/input/index.ts');

  assert.equal((input.match(/\btravel\?\(/g) ?? []).length, 1, 'one Tracks travel method is declared');
  assert.equal((input.match(/\btravelFriend\?\(/g) ?? []).length, 1, 'one friend-travel method is declared');
  assert.match(tsInput, /travel\(where\) \{/);
  assert.match(tsInput, /travelFriend\(nameHash, spot\) \{/);
  assert.match(tracks, /export function travelState\(/);
  assert.match(tracks, /export function travelSaid\(/);
  assert.match(shell, /get\('travel'\)/);
  assert.match(shell, /game\.input\.travel\(spot\)/);
  assert.match(shell, /game\.input\.travelFriend\(roomHash\(friend\.name\), friendSpot\(friend\.room, friend\.at\)\)/);
  assert.match(shell, /get\('travel_said'\)/);
});

test('travel.c publishes both status values through the registered status ABI', () => {
  const travel = read('runtime/travel.c');
  const statusProto = read('runtime/web/status_proto.h');
  const statusRuntime = read('runtime/web/status_web.c');

  assert.match(travel, /host_status_slot\("travel"\)/);
  assert.match(travel, /host_status_slot\("travel_said"\)/);
  assert.match(travel, /host_status_set_n\(&T\.slot, &v, 1\)/);
  assert.match(travel, /host_status_set_n\(&S\.slot, &v, 1\)/);
  assert.match(statusProto, /int\s+host_status_slot\(const char \*name\)/);
  assert.match(statusProto, /void\s+host_status_set_n\(const int \*slot, const double \*value, int n\)/);
  assert.match(statusRuntime, /int host_status_slot\(const char \*name\)/);
  assert.match(statusRuntime, /void host_status_set_n\(const int \*slot, const double \*value, int n\)/);
});

test('travel.c is connected to the main loop and the Windows companion stays city-only', () => {
  const travel = read('runtime/travel.c');
  const roam = read('runtime/roam.c');
  const features = read('runtime/features.c');
  const roamGame = read('runtime/roam_game.c');

  assert.match(roam, /int travel_hook\(CPU \*c, uint32_t ip\);/);
  assert.match(roam, /if \(travel_hook\(c, ip\)\) return 1;/);
  assert.match(roam, /void travel_frame\(CPU \*c\);/);
  assert.match(roam, /case HOOK_SITE\(0x00581475\): features_frame\(c\); return 1;/);
  assert.match(features, /\{\s*"travel",\s*travel_frame\s*\}/);
  assert.match(features, /\{\s*"roam_game",\s*f_roam_game\s*\}/);
  assert.match(features, /static void f_roam_game\(CPU \*c\)\{ if \(!roam_asipeer_frame\(c\)\) roam_game_frame\(c\); \}/);
  assert.match(travel, /int travel_hook\(CPU \*c, uint32_t ip\)/);
  assert.match(travel, /void travel_frame\(CPU \*c\)/);

  assert.match(roamGame, /#ifdef ROAM_HOST_WIN[\s\S]*?static uint32_t travel_room\(void\)\s*\{\s*return 0;\s*\}\s*#else\s*uint32_t travel_room\(void\);\s*#endif/);
  assert.match(roamGame, /#ifndef ROAM_HOST_WIN[\s\S]*?__attribute__\(\(weak\)\) uint32_t travel_room\(void\)\s*\{\s*return 0;\s*\}/);
});

test('travel and co-op share one owner for the free-roam setup/reload overrides', () => {
  const travel = read('runtime/travel.c');
  const coop = read('runtime/coop.c');
  const stamp = read('tools/genstamp.sh');
  const gencheck = read('web/tools/gencheck.sh');
  const wasmBuild = read('web/build.sh');

  assert.match(travel, /case HOOK_SITE\(0x00602eef\)/);
  assert.match(travel, /void sub_0041ace0\(CPU \*c\)/);
  assert.match(travel, /void sub_0041ace0_orig\(CPU \*c\);/);

  // Travel behavior stays in travel.c; the combined Co-op/Travel wrappers live only in coop.c.
  assert.match(travel, /void travel_presetup\(void\)/);
  assert.match(travel, /void travel_setup\(void\)/);
  assert.match(travel, /int travel_full\(void\)/);
  for (const address of ['00540780', '00581820']) {
    const definition = new RegExp('void sub_' + address + '\\(CPU \\*c\\)\\s*\\{');
    const owners = ['runtime/travel.c', 'runtime/coop.c']
      .filter((file) => definition.test(read(file)));
    assert.deepEqual(owners, ['runtime/coop.c'], address + ' has exactly one runtime owner');
    assert.match(coop, new RegExp('void sub_' + address + '_orig\\(CPU \\*c\\);'));
  }

  assert.match(coop, /cameras_setup\(\);[\s\S]*?travel_presetup\(\);[\s\S]*?sub_00540780_orig\(c\);[\s\S]*?travel_setup\(\);/);
  assert.match(coop, /int trip = travel_full\(\);/);
  assert.match(coop, /if \(trip\) fprintf\(stderr/);
  assert.match(stamp, /HOOK_SITE/);
  assert.match(gencheck, /tools\/genstamp\.sh sources/);
  assert.match(gencheck, /hooks/);
  assert.match(wasmBuild, /web\/tools\/gencheck\.sh/);
});

