// Career free roam's nine race-track maps, their multiplayer room hashes and the game's travel status.
import { N, t } from './i18n';
import { roomHash } from './players';

export const TRACKS: readonly { key: number; name: string }[] = [
  { key: 4711, name: N('URL: Airport Circuit') },
  { key: 4701, name: N('URL: Bayview Speedway') },
  { key: 4311, name: N('Drift: Stadium') },
  { key: 4301, name: N('Drift: Parkade') },
  { key: 4201, name: N('Drag: Bayview Bridge') },
  { key: 4211, name: N('Drag: Central Station') },
  { key: 4221, name: N('Drag: South Runway') },
  { key: 4601, name: N('Street X: Industrial Park') },
  { key: 4605, name: N('Street X: Parkade') },
];

export function trackRoom(base: number, key: number): number {
  return ((base ^ Math.imul(key, 0x9e3779b1)) >>> 0) || 1;
}
export function trackRooms(base: number): number[] { return TRACKS.map(s => trackRoom(base, s.key)); }

/** The spot a friend is in: 1..9 for a known track; 0 for the city or an unknown/older server response. */
export function friendSpot(room: string | undefined, at: number | undefined): number {
  if (typeof at !== 'number' || !Number.isInteger(at)) return 0;
  const base = room === undefined ? 0 : roomHash(room);
  const k = TRACKS.findIndex(s => trackRoom(base, s.key) === at);
  return k < 0 ? 0 : k + 1;
}

export const WHY_COOP = 7;
const WHY: readonly string[] = [
  '', N('Only while you drive in free roam.'), N('Buy a car of your own first.'),
  N('Not during an outrun, a race or a race lobby.'), N('Not during a timed career task.'),
  N('Drive off the marker first.'), N('On the way…'), N('Not with two players on one screen.'),
];
export function travelState(v: number | undefined | null): { at: number; why: number } | null {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 65536) return null;
  const w = v - 65536, at = w & 255, why = w >> 8;
  return at <= TRACKS.length && why < WHY.length ? { at, why } : null;
}
export const whyText = (why: number): string => WHY[why] ? t(WHY[why]) : '';
export const atName = (at: number): string => at >= 1 && at <= TRACKS.length ? t(TRACKS[at - 1].name) : '';
export const SAID_LOCKED = 2, SAID_NOT_FOUND = 3, SAID_NOT_NOW = 4;
export function travelSaid(v: number | undefined | null, last: number): { n: number; what: number; why: number } | null {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 256) return null;
  const n = Math.floor(v / 256), what = v & 15, why = (v >> 4) & 15;
  return n !== last ? { n, what, why } : null;
}
