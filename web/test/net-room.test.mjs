// The current Free Roam room changed by a live invite, in the mailbox's reserved words
// (web/src/net/index.ts setRoom; runtime/web/net_proto.h room_gen/room_name).
//   node --test web/test/net-room.test.mjs
// - 16 little-endian words hold at most 63 UTF-8 bytes and a trailing NUL
// - all name words are written before the generation counter
// - set before attach is published when the Free Roam mailbox registers
// - shorter v2 mailboxes never receive writes past their 256-byte header
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const entry = `export { attachNet } from './web/src/net/index.ts'; export * as P from './web/src/net/proto.ts';`;
const js = (await esbuild.build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', write: false, platform: 'neutral' })).outputFiles[0].text;
const { attachNet, P } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

const NET = 4; // HostKind.Net
const PTR = 65536;
const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

function fakeProc() {
  const memory = new WebAssembly.Memory({ initial: 16, maximum: 16, shared: true });
  const regs = new Map(), waiters = new Map();
  return {
    memory,
    exited: new Promise(() => {}),
    registered(kind) {
      if (regs.has(kind)) return Promise.resolve(regs.get(kind));
      return new Promise(resolve => (waiters.get(kind) ?? waiters.set(kind, []).get(kind)).push(resolve));
    },
    register(kind, ptr, size) {
      const value = { ptr, size };
      regs.set(kind, value);
      for (const resolve of waiters.get(kind) ?? []) resolve(value);
      waiters.delete(kind);
    },
  };
}

function mailbox(proc, ver = P.NET_VERSION) {
  const hdr = ver === 2 ? P.NET_V2_HDR_BYTES : P.NET_HDR_BYTES;
  const size = ver === 2 ? P.NET_V2_MAILBOX_BYTES : P.NET_MAILBOX_BYTES;
  const i32 = new Int32Array(proc.memory.buffer, PTR, size / 4);
  Object.assign(i32, {
    [P.W_MAGIC]: P.NET_MAGIC | 0,
    [P.W_VERSION]: ver,
    [P.W_HDR_BYTES]: hdr,
    [P.W_SLOT_BYTES]: P.NET_SLOT_BYTES,
    [P.W_TX_SLOTS]: P.NET_TX_SLOTS,
    [P.W_RX_SLOTS]: P.NET_RX_SLOTS,
    [P.W_TX_OFF]: hdr,
    [P.W_RX_OFF]: hdr + P.NET_TX_SLOTS * P.NET_SLOT_BYTES,
  });
  return { i32, size };
}

function watchRoomStores() {
  const original = Atomics.store, seen = [];
  Atomics.store = function (array, index, value) {
    const word = (array.byteOffset + index * 4 - PTR) / 4;
    if (word === P.W_ROOM_GEN || (word >= P.W_ROOM_NAME && word < P.W_ROOM_NAME + P.ROOM_WORDS)) {
      seen.push([word, value >>> 0]);
    }
    return original.call(Atomics, array, index, value);
  };
  return { seen, stop: () => { Atomics.store = original; } };
}

function encodedWords(name) {
  const bytes = new TextEncoder().encode(name);
  const padded = new Uint8Array(P.ROOM_WORDS * 4);
  padded.set(bytes.subarray(0, P.ROOM_BYTES));
  const words = [];
  for (let i = 0; i < P.ROOM_WORDS; i++) {
    const at = i * 4;
    words.push((padded[at] | padded[at + 1] << 8 | padded[at + 2] << 16 | padded[at + 3] << 24) >>> 0);
  }
  return words;
}
const expectedStores = (name, generation) => [
  ...encodedWords(name).map((word, index) => [P.W_ROOM_NAME + index, word]),
  [P.W_ROOM_GEN, generation],
];
function decodedRoom(i32) {
  const bytes = new Uint8Array(P.ROOM_WORDS * 4);
  for (let i = 0; i < P.ROOM_WORDS; i++) {
    const word = i32[P.W_ROOM_NAME + i] >>> 0;
    for (let k = 0; k < 4; k++) bytes[4 * i + k] = word >>> (8 * k) & 255;
  }
  const end = bytes.indexOf(0);
  return new TextDecoder().decode(bytes.subarray(0, end < 0 ? bytes.length : end));
}

test('room mailbox offsets occupy the pad after the crews without changing the 512-byte header', () => {
  assert.equal(P.W_CREWS_GEN * 4, 400);
  assert.equal(P.W_ROOM_GEN * 4, 436);
  assert.equal(P.W_ROOM_NAME * 4, 440);
  assert.equal(P.W_ROOM_NAME, P.W_ROOM_GEN + 1);
  assert.equal((P.W_ROOM_NAME + P.ROOM_WORDS) * 4, 504);
  assert.ok((P.W_ROOM_NAME + P.ROOM_WORDS) * 4 <= P.NET_HDR_BYTES);
  assert.equal(P.ROOM_WORDS, 16);
  assert.equal(P.ROOM_BYTES, 63);
});

test('a room set before attach is published; live changes and clearing write name before generation', async () => {
  const proc = fakeProc(), watch = watchRoomStores();
  const link = attachNet(proc, {});
  try {
    assert.equal(link.setRoom('Night Owls'), false, 'not attached yet');
    assert.deepEqual(watch.seen, []);
    const { i32, size } = mailbox(proc);
    proc.register(NET, PTR, size);
    await tick(20);
    assert.deepEqual(watch.seen, expectedStores('Night Owls', 1));
    assert.equal(i32[P.W_ROOM_GEN], 1);
    assert.equal(decodedRoom(i32), 'Night Owls');

    watch.seen.length = 0;
    assert.equal(link.setRoom('Blue Room'), true);
    assert.deepEqual(watch.seen, expectedStores('Blue Room', 2));
    assert.equal(decodedRoom(i32), 'Blue Room');

    watch.seen.length = 0;
    assert.equal(link.setRoom(''), true, 'empty name means the default/shared room');
    assert.deepEqual(watch.seen, expectedStores('', 3));
    assert.equal(decodedRoom(i32), '');
  } finally {
    link.close();
    watch.stop();
  }
});

test('UTF-8 room names are capped at 63 bytes without writing a partial character', async () => {
  const proc = fakeProc(), watch = watchRoomStores();
  const link = attachNet(proc, {});
  try {
    const { i32, size } = mailbox(proc);
    proc.register(NET, PTR, size);
    await tick(20);
    watch.seen.length = 0;
    const input = 'x'.repeat(62) + '😀';
    assert.equal(link.setRoom(input), true);
    assert.deepEqual(watch.seen, expectedStores('x'.repeat(62), 1));
    assert.equal(decodedRoom(i32), 'x'.repeat(62));
  } finally {
    link.close();
    watch.stop();
  }
});

test('an older short mailbox is never written beyond its header', async () => {
  const proc = fakeProc(), watch = watchRoomStores();
  const link = attachNet(proc, {});
  try {
    assert.equal(link.setRoom('Blue Room'), false);
    const { i32, size } = mailbox(proc, 2);
    proc.register(NET, PTR, size);
    await tick(20);
    assert.equal(link.setRoom('Night Owls'), false);
    assert.deepEqual(watch.seen, []);
    assert.equal(i32[P.W_ROOM_GEN] ?? 0, 0);
  } finally {
    link.close();
    watch.stop();
  }
});
