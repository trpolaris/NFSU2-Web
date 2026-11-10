// How many play on this server now, for the start page's Multiplayer settings: the server's /players (three
// counts, whether it is full, how many wait in line for a place and whether free roam is busy, nothing else; with a Room setting, how many are in
// free roam in that room too, and with crews how many in each).  Asked every 15 s, and only while the start page is visible and no game runs; a
// server without the route shows nothing.  Whether the server answered at all goes to reached() (offline mode).

/** roam: driving in free roam or paused there (null, or missing from an older server: not shown);
 *  roamBusy: free roam gives fewer cars a player now (the server's hub cut its links), so the first Play does not ask about it;
 *  room: of roam, those in the room asked for (/players?room=, missing without one or from an older server);
 *  crews: of roam, those in each crew asked for, in the order asked (/players?crews=, the same) */
export interface PlayerCounts {
  players: number; online: number | null; roam?: number | null; full?: boolean; roamBusy?: boolean; room?: number; rooms?: number[]; crews?: number[]; spots?: number[];
  /** pages waiting in line for a place (missing from an older server) */
  queue?: number;
}

import { t, tn, type Msg } from './i18n';

const EVERY_MS = 15_000;

/** The Room setting's hash, as roam_core.c rc_room_hash makes it (FNV-1a of the name's UTF-8 without its spaces and
 *  with its capitals A to Z small; 0: no room), for /players?room= */
export function roomHash(name: string): number {
  let h = 0x811c9dc5, kept = 0;
  for (let b of new TextEncoder().encode(name)) {
    if (b === 0x20 || (b >= 0x09 && b <= 0x0d)) continue;
    if (b >= 0x41 && b <= 0x5a) b += 0x20;
    h = Math.imul(h ^ b, 0x01000193) >>> 0; kept++;
  }
  return !kept ? 0 : h || 1;
}

/** The line the page shows ('' for an answer it cannot read); room: the player's Room setting, when free roam is on
 *  ('' for none): free roam shows only that room's players, which the line says, with how many are there. */
export function playersText(c: PlayerCounts, room = ''): string {
  if (!Number.isInteger(c.players) || c.players < 0) return '';
  if (c.players === 0) return t('On this server now: nobody is playing.');
  const known = (k: number | null | undefined): k is number => Number.isInteger(k) && k! >= 0;
  const list = [tn(c.players, '{n} player', '{n} players')];
  if (known(c.online)) list.push(t('{n} in Online mode', { n: c.online }));
  if (known(c.roam)) list.push(t('{n} in free roam', { n: c.roam }));
  room = room.trim();
  const inRoom = !room ? '' : ' ' + (!known(c.room) ? t('You are in room "{room}".', { room })
    : c.room === 0 ? t('You are in room "{room}": nobody in free roam there.', { room }) : t('You are in room "{room}": {n} in free roam there.', { room, n: c.room }));
  const waiting = Number.isInteger(c.queue) && c.queue! > 0 ? c.queue! : 0;
  const full = c.full !== true ? ''
    : ' ' + (waiting ? tn(waiting, 'The server is full and {n} is waiting in line for a place. At Play you can wait in line, playing alone until it is your turn, or play offline.',
      'The server is full and {n} are waiting in line for a place. At Play you can wait in line, playing alone until it is your turn, or play offline.')
      : t('The server is full: playing with others waits until a place frees up.'));
  return t('On this server now: {list}.', { list: list.join(', ') }) + inRoom + full;
}

/** 1st, 2nd, 3rd, 4th, ..., 11th, 12th, 13th, ..., 21st */
function ordinal(k: number): string {
  const t = k % 100, u = k % 10;
  return `${k}${t >= 11 && t <= 13 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th'}`;
}

/** The line over the game while it waits in line for a place on a full server (net's NetQueue): where it is, and
 *  about how long that is (once the server can tell). */
export function queueText(q: { pos: number; of: number; eta?: number }): string {
  const e = q.eta;
  const wait = e === undefined ? '' : e < 60 ? t('less than a minute') : e < 90 * 60 ? t('about {n} min', { n: Math.round(e / 60) }) : t('about {n} h', { n: Math.round(e / 3600) });
  const v = { pos: ordinal(q.pos), n: q.pos, of: q.of, wait };
  if (q.pos <= 1) return wait ? t('The server is full. In line for a place: next ({wait}).', v) : t('The server is full. In line for a place: next.');
  return wait ? t('The server is full. In line for a place: {pos} of {of} ({wait}).', v) : t('The server is full. In line for a place: {pos} of {of}.', v);
}

/** Whether the server answers (any answer but a 5xx from a proxy in front of it), within ms. */
export async function serverAnswers(ms: number): Promise<boolean> {
  try { return (await fetch('/players', { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(ms) })).status < 500; }
  catch { return false; }
}

/** How many are in free roam in each world asked for (room hashes, in order; 0 is the main world), by hash. */
export function worldCounts(c: PlayerCounts, asked: readonly number[]): Map<number, number> {
  const m = new Map<number, number>();
  if (Array.isArray(c.rooms)) asked.forEach((h, i) => {
    const n = c.rooms![i];
    if (Number.isInteger(n) && n >= 0) m.set(h, n);
  });
  return m;
}

/** Ask the server for counts in up to eight worlds. Older servers simply return no rooms field. */
export async function askWorlds(hashes: readonly number[], ms: number): Promise<Map<number, number> | null> {
  const rooms = hashes.slice(0, 8);
  if (!rooms.length) return new Map();
  try {
    const r = await fetch(`/players?rooms=${rooms.join(',')}`, { cache: 'no-store', signal: AbortSignal.timeout(ms) });
    return r.ok ? worldCounts(await r.json() as PlayerCounts, rooms) : null;
  } catch { return null; }
}

/** The count for each exact race-track spot room, in the requested order. */
export function spotCounts(c: PlayerCounts, asked: readonly number[]): Map<number, number> {
  const m = new Map<number, number>();
  if (Array.isArray(c.spots)) asked.forEach((h, i) => {
    const n = c.spots![i];
    if (Number.isInteger(n) && n >= 0) m.set(h, n);
  });
  return m;
}

/** Ask for up to sixteen exact track-spot counts. Older servers have no `spots` field, so ask their room counts in
 *  batches of eight instead. */
export async function askSpots(hashes: readonly number[], ms: number): Promise<Map<number, number> | null> {
  const spots = hashes.slice(0, 16);
  if (!spots.length) return new Map();
  try {
    const r = await fetch(`/players?spots=${spots.join(',')}`, { cache: 'no-store', signal: AbortSignal.timeout(ms) });
    if (!r.ok) return null;
    const c = await r.json() as PlayerCounts;
    if (Array.isArray(c.spots)) return spotCounts(c, spots);
  } catch { return null; }
  const first = await askWorlds(spots.slice(0, 8), ms);
  if (spots.length <= 8) return first;
  const second = await askWorlds(spots.slice(8), ms);
  return first ? new Map([...first, ...(second ?? [])]) : null;
}

/** How many are in free roam in each crew asked for (their hashes, in the order asked), by hash; none from an older
 *  server (no crews in its answer) or for a count it does not give. */
export function crewCounts(c: PlayerCounts, asked: readonly number[]): Map<number, number> {
  return byHash(c.crews, asked);
}
/** How many are in free roam in each world asked for (their rooms' hashes, 0 the main world, in the order asked), by
 *  hash; as crewCounts */
export function worldCounts(c: PlayerCounts, asked: readonly number[]): Map<number, number> {
  return byHash(c.rooms, asked);
}
function byHash(counts: number[] | undefined, asked: readonly number[]): Map<number, number> {
  const m = new Map<number, number>();
  if (Array.isArray(counts)) asked.forEach((h, i) => { const n = counts[i]; if (Number.isInteger(n) && n >= 0) m.set(h, n); });
  return m;
}

/** How many are in free roam in each of these worlds now (worldCounts; their hashes: worlds.ts worldRooms), asked once
 *  as askCrews asks: the page menu's World.  null: no answer within ms. */
export async function askWorlds(rooms: readonly number[], ms: number): Promise<Map<number, number> | null> {
  try {
    const r = await fetch(`/players?rooms=${rooms.join(',')}`, { cache: 'no-store', signal: AbortSignal.timeout(ms) });
    return r.ok ? worldCounts(await r.json() as PlayerCounts, rooms) : null;
  } catch { return null; }
}

/** How many are at each of these race tracks' spots now (their rooms: tracks.ts trackRooms), by room, asked once as
 *  askWorlds asks: the page menu's Tracks.  A server of before this has no `spots` (and counted a world without its
 *  tracks): its `rooms`, then, 8 at a time.  null: no answer within ms. */
export async function askSpots(rooms: readonly number[], ms: number): Promise<Map<number, number> | null> {
  try {
    const r = await fetch(`/players?spots=${rooms.join(',')}`, { cache: 'no-store', signal: AbortSignal.timeout(ms) });
    if (!r.ok) return null;
    const c = await r.json() as PlayerCounts;
    if (Array.isArray(c.spots)) return byHash(c.spots, rooms);
  } catch { return null; }
  const parts = await Promise.all([askWorlds(rooms.slice(0, 8), ms), askWorlds(rooms.slice(8), ms)]);
  return parts[0] ? new Map([...parts[0], ...(parts[1] ?? [])]) : null;
}

/** How many are in free roam in each of these crews now (crewCounts), asked once, whatever the page does, and
 *  without watchPlayers' line or its say on whether the server answers: the page menu's Crews while a game runs.  The
 *  player counts there too, once its game is in free roam in that crew (the server's hub heard its HELLO).  null: no
 *  answer within ms. */
export async function askCrews(hashes: readonly number[], ms: number): Promise<Map<number, number> | null> {
  const mine = hashes.slice(0, 4);
  if (!mine.length) return new Map();
  try {
    const r = await fetch(`/players?crews=${mine.join(',')}`, { cache: 'no-store', signal: AbortSignal.timeout(ms) });
    return r.ok ? crewCounts(await r.json() as PlayerCounts, mine) : null;
  } catch { return null; }
}

/** show(line, crews) at once and every 15 s while idle() and the page is visible (crews: crewCounts); reached(whether
 *  the server answered); room(): the Room setting while free roam is on ('' for none); crews(): the Crews setting's
 *  hashes ([] for none, at most 4); last(): the newest answer (null before the first, or from a server without
 *  the route); fresh(ms): asked now, whatever the page does (Play: whether the server is full), within ms, then the
 *  newest answer.  An answer that comes after a later question's is not shown: it was asked with the settings of
 *  before (the page's first question goes before settings.ini is read, the next one at once after it). */
export function watchPlayers(show: (line: Msg, crews: Map<number, number>) => void, idle: () => boolean, reached?: (ok: boolean) => void,
                             room: () => string = () => '', crews: () => number[] = () => []) {
  let gone = false, last: PlayerCounts | null = null, asked = 0;
  const get = async (ms: number) => {
    if (gone) return;
    const n = ++asked;
    try {
      const worlds = rooms(), mine = crews().slice(0, 4);
      const q = [worlds.length ? `rooms=${worlds.join(',')}` : '', mine.length ? `crews=${mine.join(',')}` : ''].filter(Boolean).join('&');
      const r = await fetch(q ? `/players?${q}` : '/players', { cache: 'no-store', signal: AbortSignal.timeout(ms) });
      reached?.(r.status < 500);
      if (r.status === 404) { gone = true; last = null; show(() => '', new Map()); return; }
      if (!r.ok) return;
      const c = await r.json() as PlayerCounts;
      if (n !== asked) return;
      last = c; show(() => playersText(c, inRoom), crewCounts(c, mine));
    } catch { reached?.(false); }
  };
  const ask = async () => { if (document.visibilityState === 'visible' && idle()) await get(5000); };
  window.setInterval(() => void ask(), EVERY_MS);
  document.addEventListener('visibilitychange', () => void ask());
  void ask();
  return { now: () => void ask(), last: () => last, fresh: async (ms: number) => { await get(ms); return last; } };
}
