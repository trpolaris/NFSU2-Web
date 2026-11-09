import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as esbuild from 'esbuild';

const ROOT = new URL('../..', import.meta.url).pathname;
const built = await esbuild.build({
  stdin: {
    contents: "export { queueCrewInvite, removeCrewInvite, MAX_PENDING_CREW_INVITES } from './web/src/app/crew-invite-queue.ts';",
    resolveDir: ROOT,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  write: false,
  platform: 'node',
});
const url = 'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64');
const { queueCrewInvite, removeCrewInvite, MAX_PENDING_CREW_INVITES } = await import(url);

test('a newer invite to the same crew replaces the older one', () => {
  const first = queueCrewInvite([], { name: 'Alex', crew: 'Night Owls', room: 'North' });
  const next = queueCrewInvite(first, { name: 'Bianca', crew: ' night   owls ', room: 'South' });
  assert.equal(next.length, 1);
  assert.deepEqual(next[0], { name: 'Bianca', crew: 'night owls', room: 'South' });
});

test('the queue keeps only the four newest different crew invites', () => {
  let queue = [];
  for (let i = 1; i <= 6; i++) queue = queueCrewInvite(queue, { name: 'Driver ' + i, crew: 'Crew ' + i, room: '' });
  assert.equal(MAX_PENDING_CREW_INVITES, 4);
  assert.deepEqual(queue.map(item => item.crew), ['Crew 3', 'Crew 4', 'Crew 5', 'Crew 6']);
});

test('invalid invitations and crews already owned are not queued', () => {
  assert.deepEqual(queueCrewInvite([], { name: '', crew: 'Valid crew', room: '' }), []);
  assert.deepEqual(queueCrewInvite([], { name: 'Alex', crew: 'Crew,Two', room: '' }), []);
  assert.deepEqual(queueCrewInvite([], { name: 'Alex', crew: 'A'.repeat(25), room: '' }), []);
  const pending = queueCrewInvite([{ name: 'Sam', crew: 'Night Owls', room: 'A' }], { name: 'Alex', crew: 'night owls', room: 'B' }, ['Night Owls']);
  assert.deepEqual(pending, []);
});

test('declining one invite does not remove a newer invitation to the same crew', () => {
  const old = { name: 'Alex', crew: 'Night Owls', room: 'North' };
  const newer = { name: 'Bianca', crew: 'Night Owls', room: 'South' };
  const queue = queueCrewInvite([old], newer);
  assert.deepEqual(removeCrewInvite(queue, old), [newer]);
  assert.deepEqual(removeCrewInvite(queue, newer), []);
});
