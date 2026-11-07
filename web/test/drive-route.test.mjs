import test from 'node:test';
import assert from 'node:assert/strict';
import { driveRoute } from '../tools/drive-route.mjs';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('trace route uses keyboard input and releases keys at the destination', async () => {
  const events = [], logs = [];
  const page = { keyboard: {
    down: async key => { events.push(`down:${key}`); },
    up: async key => { events.push(`up:${key}`); },
  } };
  const feed = driveRoute(page, [[20, 0]], line => logs.push(line));
  feed('[trace] t=1000 px=0 py=0 fx=1 fy=0');
  await tick();
  assert.deepEqual(events, ['down:ArrowUp']);

  feed('[trace] t=2000 px=20 py=0 fx=1 fy=0');
  await tick();
  assert.deepEqual(events, ['down:ArrowUp', 'up:ArrowUp']);
  assert.ok(logs.some(line => line.includes('reached 1/1')));
});

test('trace route steers toward a point to the left', async () => {
  const events = [];
  const page = { keyboard: {
    down: async key => { events.push(`down:${key}`); },
    up: async key => { events.push(`up:${key}`); },
  } };
  const feed = driveRoute(page, [[0, 100]], () => {});
  feed('[trace] t=1000 px=0 py=0 fx=1 fy=0');
  await tick();
  assert.ok(events.includes('down:ArrowUp'));
  assert.ok(events.includes('down:ArrowLeft'));
  feed('[trace] t=2000 px=0 py=100 fx=0 fy=1');
  await tick();
  assert.ok(events.includes('up:ArrowLeft'));
  assert.ok(events.includes('up:ArrowUp'));
});

test('malformed and non-trace lines do not generate input', async () => {
  const events = [];
  const page = { keyboard: {
    down: async key => { events.push(`down:${key}`); },
    up: async key => { events.push(`up:${key}`); },
  } };
  const feed = driveRoute(page, [[1, 1]], () => {});
  feed('[info] no trace here');
  feed('[trace] px=0 py=0 fx=1 fy=0');
  await tick();
  assert.deepEqual(events, []);
});
