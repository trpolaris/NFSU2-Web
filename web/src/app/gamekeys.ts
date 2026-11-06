import type { GameSession } from './game';

/** runtime/dinput_kbd.c PAGE_KEYS order: Add Friend is bit 1. */
export const KEY_FRIEND = 1;

/** True while the game's live action map binds the page's reserved key. */
export function gameHas(session: GameSession | null | undefined, bit: number): boolean {
  if (!session || bit < 0) return false;
  const status = session.status?.read();
  if (!status || !status.has('keys')) return true; // fail closed if the live key map is unreadable or its status slot could not be allocated
  const value = status.get('keys')!;
  return ((value >>> bit) & 1) === 1;
}
