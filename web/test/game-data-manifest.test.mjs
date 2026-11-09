// The game-data gate must not require an SDATA archive: alternate music and speech packs are valid.
//   node --test web/test/game-data-manifest.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const shell = fs.readFileSync(path.join(ROOT, 'web/src/app/shell.ts'), 'utf8');
const start = shell.indexOf('async function checkGameData(): Promise<Check>');
const end = shell.indexOf('\nconst ORDER =', start);
assert.ok(start >= 0 && end > start, 'checkGameData source block exists');
const check = shell.slice(start, end);

test('only SPEED2.EXE is required; SDATA archive is not a startup prerequisite', () => {
  assert.match(check, /const required = \['SPEED2\.EXE'\];/);
  assert.doesNotMatch(check, /SDATA\/sdat\.viv/);
  assert.doesNotMatch(check, /const required = \[[^\]]*,/);
});

test('alternate music and both speech pack layouts are recognized as optional data', () => {
  for (const file of [
    'PFData/MusicSFx.mpf',
    'PFData/MusicSFx.mus',
    'speech/nisaudio.evt',
    'speech/nisaudio.idx',
    'speech/nisaudio.big',
    'speech/nisaudio.csi',
    'speech/UG2_Speech.big',
    'speech/UG2_Speech.csi',
    'speech/UG2_Speech.evt',
    'speech/UG2_Speech.idx',
  ]) {
    assert.ok(check.includes("'" + file + "'"), 'optional game data: ' + file);
  }
});

test('manifest matching is case-insensitive and ignores directory entries', () => {
  assert.match(check, /const normalize = \(value: string\) => value\.trim\(\)\.toLowerCase\(\);/);
  assert.match(check, /manifest\.files\.filter\(file => !file\.d && typeof file\.p === 'string'\)/);
});

test('missing optional files warn without blocking the game-data gate', () => {
  assert.match(check, /if \(missing\.length\)\s*\{/);
  assert.match(check, /if \(missingOptional\.length\)\s*\{/);
  assert.match(check, /'GAME-DATA-OPTIONAL'/);
  assert.match(check, /'GAME-DATA-MISSING'/);
  assert.match(check, /Required game files are present in the server manifest\./);
});
