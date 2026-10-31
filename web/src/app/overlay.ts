// The frame-rate counter over the game (F8: off, on, detailed).  The game's
// own rate comes from its presented-frame counter (HOST_KIND_STATUS, see
// status.ts); until a status block exists it falls back to the page's
// requestAnimationFrame rate, and says so.

import type { StatusReader } from './status';
import { linkStateLabel, networkQualityLabel } from './network-quality';
import { overlayMetrics } from './overlay-metrics';
import { FramePacing } from './frame-pacing';
import { N, dateLocale, t } from './i18n';
import { browserHeapStats } from './browser-memory';

export type FpsMode = 'off' | 'on' | 'detailed';
export const FPS_MODES: FpsMode[] = ['off', 'on', 'detailed'];

const METRIC_LABELS: Record<string, string> = {
  "frames_dropped": N("Frames dropped"),
  "textures": N("Texture count"),
  "drive": N("Drive state"),
  "rate": N("Game update rate"),
  "pause": N("Pause state"),
  "roam_cars": N("Free roam cars"),
  "roam_friends": N("Free roam players"),
  "input_events": N("Input events"),
  "keys_held": N("Keys held"),
  "pad_connected": N("Controller connected"),
  "input_dropped": N("Input events dropped"),
  "lan online": N("LAN connection"),
  "lan link state": N("LAN link state"),
  "lan quality": N("LAN link quality"),
  "lan friends": N("LAN players"),
  "lan rtt ms": N("LAN RTT"),
  "lan rtt avg ms": N("LAN RTT average"),
  "lan rtt max ms": N("LAN RTT maximum"),
  "lan reconnects": N("LAN reconnects"),
  "lan frames in": N("LAN frames received"),
  "lan frames out": N("LAN frames sent"),
  "lan rx drops": N("LAN receive drops"),
  "lan tx wait avg ms": N("LAN send wait average"),
  "lan tx wait max ms": N("LAN send wait maximum"),
  "audio fill ms": N("Audio buffer fill"),
  "audio underruns": N("Audio underruns"),
  "audio latency ms": N("Audio latency"),
  "audio running": N("Audio output running"),
  "audio rate": N("Audio sample rate"),
  "gpu encode ms": N("WebGPU command encoding"),
  "gpu render ms": N("GPU execution average"),
  "gpu render max ms": N("GPU execution maximum"),
  "gpu texture memory MB": N("Tracked GPU texture memory"),
  "gpu unpacked texture MB": N("Unpacked GPU texture memory"),
  "draws": N("Draw calls"),
  "passes": N("Render passes"),
  "pipelines": N("GPU pipelines"),
  "gpu errors": N("GPU errors"),
  "js heap used MB": N("JavaScript heap used"),
  "js heap committed MB": N("JavaScript heap committed"),
  "js heap limit MB": N("JavaScript heap limit"),
};

function metricLabel(key: string): string {
  return t(METRIC_LABELS[key] ?? N(key.replace(/_/g, ' ')));
}

export class FpsOverlay {
  mode: FpsMode = 'off';
  private raf = 0;
  private rafTimes: number[] = [];
  private pacing = new FramePacing();
  private samples: { t: number; frames: number; tris: number }[] = [];
  private lastPaint = 0;
  reader: StatusReader | null = null;
  extra: () => Record<string, number> = () => ({});
  memory: WebAssembly.Memory | null = null;
  /** latest game frame rate (for tests and the page) */
  gameFps = 0;
  pageFps = 0;

  constructor(private el: HTMLElement) {}

  set(mode: FpsMode) {
    this.mode = mode;
    this.el.hidden = mode === 'off';
    if (mode !== 'off' && !this.raf) this.raf = requestAnimationFrame(this.tick);
    if (mode === 'off') {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.pacing.reset();
    }
  }
  cycle(): FpsMode { const m = FPS_MODES[(FPS_MODES.indexOf(this.mode) + 1) % FPS_MODES.length]; this.set(m); return m; }
  stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; this.samples = []; this.rafTimes = []; this.pacing.reset(); this.el.hidden = true; }

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    this.pacing.push(now);
    this.rafTimes.push(now);
    while (this.rafTimes.length > 2 && now - this.rafTimes[0] > 1000) this.rafTimes.shift();
    if (now - this.lastPaint < 250) return;
    this.lastPaint = now;
    const rt = this.rafTimes;
    this.pageFps = rt.length > 1 ? (rt.length - 1) * 1000 / (rt[rt.length - 1] - rt[0]) : 0;
    const st = this.reader?.read() ?? null;
    if (st?.has('frames')) {
      // the game's own clock: frames_t is when the C side read frames (the page's
      // sampling times do not line up with its updates); a block without it
      // (an older build) falls back to the page's time
      const t = st.get('frames_t') ?? now, f = st.get('frames')!;
      const last = this.samples[this.samples.length - 1];
      if (!last || t !== last.t) this.samples.push({ t, frames: f, tris: st.get('tris') ?? 0 });
      while (this.samples.length > 2 && t - this.samples[0].t > 1000) this.samples.shift();
      const a = this.samples[0], b = this.samples[this.samples.length - 1];
      if (b.t > a.t && b.frames >= a.frames) this.gameFps = (b.frames - a.frames) * 1000 / (b.t - a.t);
      else if (this.samples.length < 2) this.gameFps = 0;
    }
    this.paint(st);
  };

  private paint(st: Map<string, number> | null) {
    const game = st?.has('frames');
    const fps = game ? this.gameFps : this.pageFps;
    const big = document.createElement('div');
    big.textContent = String(Math.round(fps));
    const small = document.createElement('small'); small.textContent = game ? 'fps' : t(N('Page FPS'));
    big.append(small);
    const parts: Node[] = [big];
    if (this.mode === 'detailed') {
      const dl = document.createElement('dl');
      const add = (k: string, v: string) => { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; dl.append(dt, dd); };
      if (game && this.gameFps > 0) add(t(N('Frame time')), `${fixed(1000 / this.gameFps)} ms`);
      add(t(N('Page refresh')), `${fmt(this.pageFps)} Hz`);
      const pacing = this.pacing.snapshot();
      if (pacing) {
        add(t(N('Page frame P50')), `${fixed(pacing.p50Ms)} ms`);
        add(t(N('Page frame P95')), `${fixed(pacing.p95Ms)} ms`);
        add(t(N('Page frame max')), `${fixed(pacing.maxMs)} ms`);
        add(t(N('Page frames over 50 ms')), fmt(pacing.over50Ms));
      }
      if (game && this.samples.length > 1) {
        const a = this.samples[0], b = this.samples[this.samples.length - 1];
        const df = b.frames - a.frames;
        if (df > 0 && b.tris >= a.tris) add(t(N('Triangles per frame')), fmt(Math.round((b.tris - a.tris) / df)));
      }
      const extra = { ...this.extra(), ...browserHeapStats(performance) };
      for (const [key, value] of overlayMetrics(st, extra)) {
        add(metricLabel(key), value === null ? '—' : fmtExtra(key, value));
      }
      if (this.memory) add(t(N('WASM allocated memory')), `${fmt(this.memory.buffer.byteLength / 1048576)} MB`);
      parts.push(dl);
    }
    this.el.replaceChildren(...parts);
    this.el.dataset.fps = fps.toFixed(1);
    this.el.dataset.source = game ? 'game' : 'page';
  }
}

function fmtExtra(key: string, value: number): string {
  if (key === 'lan link state') return linkStateLabel(value);
  if (key === 'lan quality') return networkQualityLabel(value);
  return fmt(value);
}

function fmt(v: number) { return v.toLocaleString(dateLocale(), { maximumFractionDigits: Number.isInteger(v) ? 0 : 2 }); }
function fixed(v: number) { return v.toLocaleString(dateLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
