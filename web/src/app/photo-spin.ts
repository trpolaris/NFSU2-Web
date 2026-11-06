/** Convert the photo panel's -600..600 auto-turn slider to the game's tenths of a degree/second.
 * Its middle tenth is deliberately neutral so the camera can be left fully stopped. */
export const PHOTO_SPIN_OFF = 60;
export function photoSpinValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const v = Math.round(Math.max(-600, Math.min(600, value)));
  return Math.abs(v) < PHOTO_SPIN_OFF ? 0 : v;
}
