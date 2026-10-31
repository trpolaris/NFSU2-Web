/**
 * The detailed F8 overlay is a troubleshooting view, not a dump of every
 * instrumentation counter. Keep the useful game/input counters, omit the
 * drift and photo-mode internals, and show the complete LAN diagnostic set.
 */
export type OverlayMetric = readonly [key: string, value: number | null];

const STATUS_KEYS = new Set([
  'frames_dropped',
  'textures',
  'drive',
  'rate',
  'pause',
  'roam_cars',
  'roam_friends',
  'input_events',
  'keys_held',
  'pad_connected',
  'input_dropped',
]);

const NETWORK_KEYS = [
  'lan online',
  'lan link state',
  'lan quality',
  'lan friends',
  'lan rtt ms',
  'lan rtt avg ms',
  'lan rtt max ms',
  'lan reconnects',
  'lan frames in',
  'lan frames out',
  'lan rx drops',
  'lan tx wait avg ms',
  'lan tx wait max ms',
] as const;

const NETWORK_KEY_SET = new Set<string>(NETWORK_KEYS);

const SUBSYSTEM_KEYS = new Set([
  'audio fill ms',
  'audio underruns',
  'audio latency ms',
  'audio running',
  'audio rate',
  'gpu encode ms',
  'draws',
  'passes',
  'pipelines',
  'gpu errors',
]);

/**
 * Pick the compact set shown by F8's detailed mode.
 * If an older network adapter only supplies the original three LAN counters,
 * keep the additional diagnostic rows visible as an em dash rather than
 * silently hiding them or presenting made-up zeroes.
 */
export function overlayMetrics(
  status: ReadonlyMap<string, number> | null,
  extra: Readonly<Record<string, number>>,
): OverlayMetric[] {
  const rows: OverlayMetric[] = [];

  if (status) {
    for (const [key, value] of status) {
      if (STATUS_KEYS.has(key)) rows.push([key, value]);
    }
  }

  const hasLan = ['lan online', 'lan friends', 'lan rtt ms'].some(key =>
    Object.prototype.hasOwnProperty.call(extra, key),
  );
  if (hasLan) {
    for (const key of NETWORK_KEYS) {
      const value = extra[key];
      rows.push([key, typeof value === 'number' && Number.isFinite(value) ? value : null]);
    }
  }

  for (const [key, value] of Object.entries(extra)) {
    if (SUBSYSTEM_KEYS.has(key)) rows.push([key, value]);
  }

  return rows;
}
