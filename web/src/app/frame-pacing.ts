/** Rolling requestAnimationFrame interval statistics for the page thread. */
export interface FramePacingSnapshot {
  /** Number of frame intervals in the rolling window. */
  samples: number;
  /** Nearest-rank median interval, in milliseconds. */
  p50Ms: number;
  /** Nearest-rank 95th percentile interval, in milliseconds. */
  p95Ms: number;
  /** Longest interval in the rolling window, in milliseconds. */
  maxMs: number;
  /** Intervals over 50 ms in the rolling window. */
  over50Ms: number;
}

const WINDOW_SIZE = 240;
const SUSPEND_GAP_MS = 1_000;
const STUTTER_MS = 50;

/**
 * Measures page-thread frame pacing without creating work on every read.
 *
 * Gaps over one second are treated as a suspended/background tab, not as a
 * gameplay hitch. The previous timestamp is retained so sampling resumes
 * immediately on the next animation frame.
 */
export class FramePacing {
  private previous: number | null = null;
  private intervals: number[] = [];

  push(timestamp: number): void {
    if (!Number.isFinite(timestamp)) return;
    if (this.previous === null) {
      this.previous = timestamp;
      return;
    }

    const delta = timestamp - this.previous;
    this.previous = timestamp;

    if (!(delta > 0)) {
      this.intervals = [];
      return;
    }
    if (delta > SUSPEND_GAP_MS) {
      this.intervals = [];
      return;
    }

    this.intervals.push(delta);
    if (this.intervals.length > WINDOW_SIZE) this.intervals.shift();
  }

  snapshot(): FramePacingSnapshot | null {
    if (!this.intervals.length) return null;

    const sorted = this.intervals.slice().sort((a, b) => a - b);
    const nearestRank = (p: number) => sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
    return {
      samples: sorted.length,
      p50Ms: nearestRank(0.50),
      p95Ms: nearestRank(0.95),
      maxMs: sorted[sorted.length - 1],
      over50Ms: this.intervals.reduce((n, ms) => n + (ms > STUTTER_MS ? 1 : 0), 0),
    };
  }

  reset(): void {
    this.previous = null;
    this.intervals = [];
  }
}
