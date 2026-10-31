/** Chromium's non-standard Performance.memory, exposed only where supported. */
export interface BrowserHeapInfo {
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
}

type PerformanceWithHeap = Performance & { memory?: BrowserHeapInfo };

/** Return only finite Chromium heap measurements, in MiB. No synthetic fallback values. */
export function browserHeapStats(perf: Performance): Record<string, number> {
  const memory = (perf as PerformanceWithHeap).memory;
  if (!memory) return {};

  const result: Record<string, number> = {};
  const add = (key: string, value: number | undefined) => {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0)
      result[key] = value / 1048576;
  };
  add('js heap used MB', memory.usedJSHeapSize);
  add('js heap committed MB', memory.totalJSHeapSize);
  add('js heap limit MB', memory.jsHeapSizeLimit);
  return result;
}
