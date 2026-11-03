const EXACT = new Set([
  'amk', 'aq', 'amq', 'amina', 'aminakoyim', 'aminakoyayim', 'aminasokim',
  'ananisik', 'ananisikeyim', 'amcik', 'amcigi', 'amcigim', 'amciklar',
  'sik', 'siki', 'sikim', 'sikerim', 'sikeyim', 'sikiyim', 'sikiyor', 'sikmek',
  'siktim', 'sikti', 'sikis', 'sikik', 'siktir', 'siktirgit',
  'orospu', 'orospucocugu', 'orospuevladi', 'pic', 'pici', 'picin', 'picoglu',
  'yarrak', 'yarak', 'yarram', 'yarra', 'pezevenk', 'kahpe', 'serefsiz', 'pust', 'surtuk',
  'kurwa', 'fuck', 'shit', 'bitch', 'asshole', 'asshat', 'cunt', 'dickhead',
  'cock', 'bastard', 'motherfucker', 'wanker', 'twat', 'bollocks',
]);
const PREFIXES = [
  'amina', 'amcik', 'sikt', 'siker', 'sikey', 'sikiy', 'sikim',
  'orosp', 'yarr', 'serefsiz', 'pezevenk', 'surtuk',
  'kurw', 'fuck', 'shit', 'bitch', 'cunt', 'asshole', 'asshat',
  'motherfuck', 'wanker', 'twat', 'bollock',
];
const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a',
  '5': 's', '$': 's', '7': 't', '+': 't', '6': 'g', '9': 'g', '8': 'b',
};

function normalizeToken(value: string): string {
  const text = [...value.normalize('NFKD').replace(/\\p{M}/gu, '').toLowerCase()]
    .map(char => LEET[char] ?? char).join('');
  return text.replace(/[^a-z]/g, '');
}
function blockedToken(token: string): boolean {
  return !!token && (EXACT.has(token) || PREFIXES.some(prefix => token.startsWith(prefix)));
}

export function hasChatProfanity(message: string): boolean {
  if (typeof message !== 'string' || !message.trim()) return false;
  const words = message.match(/[\\p{L}\\p{N}@!$+|]+/gu) ?? [];
  const normalized = words.map(normalizeToken).filter(Boolean);
  if (normalized.some(blockedToken)) return true;
  let run = '';
  for (const token of normalized) {
    if (token.length === 1) {
      run += token;
      if (blockedToken(run)) return true;
      if (run.length > 12) run = run.slice(-12);
    } else run = '';
  }
  return false;
}
