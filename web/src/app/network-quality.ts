import type { NetState } from '../net';
import { N, t } from './i18n';

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
  1: N('Online'),
  2: N('Queued'),
  3: N('Connecting'),
  4: N('Waiting'),
  5: N('Offline'),
  6: N('Idle'),
  7: N('Away'),
  8: N('Closed'),
};

const QUALITY_LABELS: Record<number, string> = {
  0: N('Unknown'),
  1: N('Poor'),
  2: N('Fair'),
  3: N('Good'),
  4: N('Excellent'),
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
  return t(STATE_LABELS[code] ?? N('Unknown'));
}

export function networkQualityLabel(code: number): string {
  return t(QUALITY_LABELS[code] ?? N('Unknown'));
}
