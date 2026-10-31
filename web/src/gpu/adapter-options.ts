/**
 * Chrome on Windows currently ignores powerPreference when choosing a WebGPU
 * adapter and emits a console warning. Omit the ineffective option there;
 * retain the high-performance request on platforms that support it.
 */
export function adapterOptionsFor(userAgent: string): GPURequestAdapterOptions | undefined {
  return /Windows/i.test(userAgent) ? undefined : { powerPreference: 'high-performance' };
}
