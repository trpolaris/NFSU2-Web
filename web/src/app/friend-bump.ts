export interface FriendBump { id: number; name: string; on: boolean }

/** Parse the small JSON event emitted by the native Free Roam front-bumper detector. */
export function parseFriendBump(json: string): FriendBump | null {
  let value: unknown;
  try { value = JSON.parse(json); } catch { return null; }
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const id = item.id;
  const name = typeof item.name === 'string' ? item.name.trim() : '';
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0 || !name || [...name].length > 64) return null;
  if (item.on !== 0 && item.on !== 1) return null;
  return { id, name, on: item.on === 1 };
}
