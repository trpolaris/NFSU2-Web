// Free Roam worlds: the main world, four public worlds, and a player's own named room.
// World names have fixed English hashes so players meet in the same world regardless of UI language.
import { roomHash } from './players';
import { t } from './i18n';

export const WORLDS = ['World 1', 'World 2', 'World 3', 'World 4'] as const;
const HASHES = WORLDS.map(roomHash);

/** World 4 keeps Ghost mode off for every player in it. */
export const NO_GHOST = 4;

/** Which public world a room is (1-4); 0 is the main world or a player's own named world. */
export function worldOf(room: string): number {
  const h = roomHash(room);
  return HASHES.indexOf(h) + 1;
}

/** The main world: no name, or only whitespace. */
export const isMain = (room: string) => roomHash(room) === 0;

/** A named world other than World 1 to 4. */
export const isOwn = (room: string) => !isMain(room) && !worldOf(room);

/** Whether the room is World 4, where Ghost mode is always off. */
export const noGhost = (room: string) => worldOf(room) === NO_GHOST;

/** A room's display name for a selector. */
export function worldName(room: string): string {
  const n = worldOf(room);
  return n === NO_GHOST ? t('World {n} (Ghost mode off)', { n })
    : isOwn(room) ? room.trim() : worldNamed(room);
}

/** A room's display name in a sentence. */
export function worldNamed(room: string): string {
  if (isMain(room)) return t('Main world');
  const n = worldOf(room);
  return n ? t('World {n}', { n }) : t('"{name}"', { name: room.trim() });
}

/** Hashes requested from /players?rooms=, in stable order; an own named room is added when one is selected. */
export const worldRooms = (own: string): number[] =>
  [0, ...HASHES, ...(isOwn(own) ? [roomHash(own)] : [])];
