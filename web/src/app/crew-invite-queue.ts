/** A small in-session queue for friend-to-crew invitations. UI and settings writes stay in shell.ts. */
export interface PendingCrewInvite {
  name: string;
  crew: string;
  room: string;
}

export const MAX_PENDING_CREW_INVITES = 4;

function clean(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/gu, ' ').trim()
    : '';
}
function key(value: string): string {
  return clean(value).toLowerCase();
}

/** Add or replace an invite. The same crew has only one pending row; the newest sender wins. */
export function queueCrewInvite(
  queue: readonly PendingCrewInvite[],
  raw: PendingCrewInvite,
  ownCrews: readonly string[] = [],
): PendingCrewInvite[] {
  const name = clean(raw?.name);
  const crew = clean(raw?.crew);
  const room = clean(raw?.room);
  if (!name || !crew || [...name].length > 64 || [...crew].length > 24 || [...room].length > 64) return [...queue];
  if (/[,;#\x00-\x1F\x7F]/u.test(crew)) return [...queue];

  const withoutThisCrew = queue.filter(item => key(item.crew) !== key(crew));
  if (ownCrews.some(owned => key(owned) === key(crew))) return withoutThisCrew;
  return [...withoutThisCrew, { name, crew, room }].slice(-MAX_PENDING_CREW_INVITES);
}

/** Remove only the invite the player acted on; a newer invite for the same crew is left alone. */
export function removeCrewInvite(
  queue: readonly PendingCrewInvite[],
  target: PendingCrewInvite,
): PendingCrewInvite[] {
  return queue.filter(item =>
    !(key(item.name) === key(target.name) && key(item.crew) === key(target.crew) && key(item.room) === key(target.room)),
  );
}
