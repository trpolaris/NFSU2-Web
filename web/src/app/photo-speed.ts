/** Maps the Photo Mode movement-speed slider (0..1000) to the runtime multiplier (0.1x..4x). */
export function photoSpeedMultiplier(value: number): number {
  const v = Number.isFinite(value) ? Math.max(0, Math.min(1000, value)) : 500;
  return v < 500
    ? 0.1 ** ((500 - v) / 500)
    : 4 ** ((v - 500) / 500);
}

/** The runtime receives the multiplier in hundredths to avoid floating point event payloads. */
export function photoSpeedValue(value: number): number {
  return Math.round(photoSpeedMultiplier(value) * 100);
}
