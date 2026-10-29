import { catalog, LANGUAGE_FILES, langFile, check } from './i18n-keys.mjs';
import fs from 'node:fs';

const { keys, bad } = catalog();
let structural = 0;
let untranslated = 0;
for (const message of bad) { console.error(`Key extraction: ${message}`); structural++; }
for (const lang of LANGUAGE_FILES) {
  const problems = check(lang, keys);
  structural += problems.length;
  let dict = {};
  try { dict = JSON.parse(fs.readFileSync(langFile(lang), 'utf8')); } catch { /* reported by check */ }
  const same = [...keys.keys()].filter(key => typeof dict[key] === 'string' && dict[key] === key);
  untranslated += same.length;
  console.log(`${lang.padEnd(10)} ${problems.length ? `STRUCTURE ${problems.length}` : 'structure ok'}; ${same.length} English-identical strings`);
}
console.log(`Total: ${keys.size} keys, ${LANGUAGE_FILES.length} languages, ${structural} structural problems, ${untranslated} English-identical entries.`);
if (structural) process.exitCode = 1;
if (process.argv.includes('--strict') && untranslated) process.exitCode = 1;
