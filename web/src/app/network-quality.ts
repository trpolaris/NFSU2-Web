import type { NetState } from '../net';

/** Stable numeric codes for the existing detailed in-game overlay. */
const STATE_CODES: Record<NetState, number> = {
  waiting: 4,
  connecting: 3,
  online: 1,
  offline: 5,
  queued: 2,
  idle: 6,
  away: 7,
  closed: 8,
};

const STATE_LABELS: Record<number, string> = {
  1: 'online',
  2: 'queued',
  3: 'connecting',
  4: 'waiting',
  5: 'offline',
  6: 'idle',
  7: 'away',
  8: 'closed',
};

const QUALITY_LABELS: Record<number, string> = {
  0: 'unknown',
  1: 'poor',
  2: 'fair',
  3: 'good',
  4: 'excellent',
};

/** Encode the link state for the numeric metrics contract used by FpsOverlay.extra. */
export function linkStateCode(state: NetState): number {
  return STATE_CODES[state];
}

/**
 * Estimate switch-link quality from the latest measured WebSocket round trip.
 * This is a UI hint, not a packet-loss measurement or a guarantee of game latency.
 * 0 = unknown/not connected, 1 = poor, 2 = fair, 3 = good, 4 = excellent.
 */
export function networkQualityCode(state: NetState, rttMs: number): number {
  if (state !== 'online' || !Number.isFinite(rttMs) || rttMs <= 0) return 0;
  if (rttMs <= 50) return 4;
  if (rttMs <= 100) return 3;
  if (rttMs <= 180) return 2;
  return 1;
}

export function linkStateLabel(code: number): string {
  return STATE_LABELS[code] ?? 'unknown';
}

export function networkQualityLabel(code: number): string {
  return QUALITY_LABELS[code] ?? 'unknown';
}
