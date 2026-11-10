/** Country and same-origin HTTP round-trip measurement for the multiplayer panel.
 * Country is only present when the server sits behind a trusted proxy that supplies CF-IPCountry.
 * RTT is the elapsed time for this browser's GET /country request, not a game-packet latency guarantee. */
export interface CountryRtt {
  country: string | null;
  rttMs: number;
}

export async function measureCountryRtt(
  fetcher: typeof fetch = fetch,
  now: () => number = () => performance.now(),
): Promise<CountryRtt> {
  const started = now();
  const response = await fetcher('/country', { cache: 'no-store' });
  const rttMs = Math.round(Math.max(0, now() - started));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json() as { country?: unknown };
  const raw = body && typeof body.country === 'string' ? body.country : '';
  const country = /^[a-z]{2}$/i.test(raw) ? raw.toLowerCase() : null;
  return { country, rttMs };
}

/** A flag glyph for a validated ISO-3166 alpha-2 code. */
export function countryFlag(country: string | null): string {
  if (!country || !/^[a-z]{2}$/i.test(country)) return '';
  return String.fromCodePoint(...[...country.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65));
}
