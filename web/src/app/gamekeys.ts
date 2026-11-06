import type { GameSession } from './game';

/** runtime/dinput_kbd.c PAGE_KEYS order: Add Friend is bit 1. */
export const KEY_FRIEND = 1;

/** True while the game's live action map binds the page's reserved key. */
export function gameHas(session: GameSession | null | undefined, bit: number): boolean {
  if (!session || bit < 0) return false;
  const value = session.status?.read()?.get('keys') ?? 0;
  return ((value >>> bit) & 1) === 1;
}
