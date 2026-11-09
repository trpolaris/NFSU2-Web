import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const built = await esbuild.build({
  entryPoints: [path.join(HERE, '../src/app/settings-store.ts')],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
});
const { SettingsFile } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));

const settingsBuilt = await esbuild.build({
  entryPoints: [path.join(HERE, '../src/app/settings.ts')],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
});
const { TEMPLATE } = await import('data:text/javascript;base64,' + Buffer.from(settingsBuilt.outputFiles[0].text).toString('base64'));

function memoryFiles(initial = null) {
  let disk = initial;
  let readError = null;
  let writeError = null;
  return {
    io: {
      async readText(_dir, name) {
        assert.equal(name, 'settings.ini');
        if (readError) throw readError;
        return disk;
      },
      async writeFile(_dir, name, text) {
        assert.equal(name, 'settings.ini');
        if (writeError) throw writeError;
        disk = text;
      },
    },
    get disk() { return disk; },
    set disk(value) { disk = value; },
    set readError(value) { readError = value; },
    set writeError(value) { writeError = value; },
  };
}

test('the game snapshot and the settings panel view stay separate', async () => {
  const disk = memoryFiles('language = turkish\nroam = off\n');
  const file = new SettingsFile(() => 'save', () => {}, disk.io);

  assert.equal(await file.load(false), 'language = turkish\nroam = off\n');
  assert.equal(file.forGame, 'language = turkish\nroam = off\n');
  assert.equal(file.text, null, 'loading for a game does not populate the panel view');

  disk.disk = 'language = english\nroam = on\n';
  assert.equal(await file.read(), 'language = english\nroam = on\n');
  assert.equal(file.text, 'language = english\nroam = on\n');
  assert.equal(file.forGame, 'language = turkish\nroam = off\n', 'a panel refresh cannot change a running game snapshot');
});

test('the save owner creates a missing template and upgrades an older settings file', async () => {
  const logs = [];
  const missing = memoryFiles();
  const fresh = new SettingsFile(() => 'save', line => logs.push(line), missing.io);

  assert.equal(await fresh.load(true), TEMPLATE);
  assert.equal(missing.disk, fresh.forGame);
  assert.equal(fresh.text, null);
  assert.match(logs.join('\n'), /wrote template \/save\/settings\.ini/);

  const firstLine = TEMPLATE.slice(0, TEMPLATE.indexOf('\n'));

  const oldText = firstLine + '\nlanguage = turkish\n';
  const oldDisk = memoryFiles(oldText);
  const upgraded = new SettingsFile(() => 'save', line => logs.push(line), oldDisk.io);

  const result = await upgraded.load(true);
  assert.notEqual(result, oldText, "the owner's load adds the missing settings");
  assert.ok(result.startsWith(oldText));
  assert.equal(oldDisk.disk, result);
  assert.equal(upgraded.forGame, result);
  assert.equal(upgraded.text, null);
  assert.match(logs.join('\n'), /added the new options/);
});

test('a successful write updates both views and returns the previous game snapshot', async () => {
  const disk = memoryFiles('language = turkish\n');
  const file = new SettingsFile(() => 'save', () => {}, disk.io);
  await file.load(false);
  await file.read();

  const previous = await file.write('language = english\n');
  assert.equal(previous, 'language = turkish\n');
  assert.equal(disk.disk, 'language = english\n');
  assert.equal(file.text, 'language = english\n');
  assert.equal(file.forGame, 'language = english\n');
});

test('a failed read preserves both cached views', async () => {
  const disk = memoryFiles('language = turkish\n');
  const file = new SettingsFile(() => 'save', () => {}, disk.io);
  await file.load(false);
  await file.read();
  const previousText = file.text;
  const previousGame = file.forGame;

  disk.readError = new Error('read failed');
  await assert.rejects(file.read(), /read failed/);
  assert.equal(file.text, previousText);
  assert.equal(file.forGame, previousGame);
});

test('a failed write preserves both cached views and does not claim the new file was saved', async () => {
  const disk = memoryFiles('language = turkish\n');
  const file = new SettingsFile(() => 'save', () => {}, disk.io);
  await file.load(false);
  await file.read();
  const previousText = file.text;
  const previousGame = file.forGame;

  disk.writeError = new Error('write failed');
  await assert.rejects(file.write('language = english\n'), /write failed/);
  assert.equal(disk.disk, 'language = turkish\n');
  assert.equal(file.text, previousText);
  assert.equal(file.forGame, previousGame);
});

test('edit starts from the current file, not a stale cached view', async () => {
  const disk = memoryFiles('language = turkish\n');
  const file = new SettingsFile(() => 'save', () => {}, disk.io);
  await file.load(false);
  await file.read();

  disk.disk = 'language = english\n';
  const edited = await file.edit(text => text + 'open_tunnel = on\n');

  assert.equal(edited, 'language = english\nopen_tunnel = on\n');
  assert.equal(disk.disk, edited);
  assert.equal(file.text, edited);
  assert.equal(file.forGame, edited);
});
