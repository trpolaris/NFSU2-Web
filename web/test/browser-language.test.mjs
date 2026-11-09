// First-visit language selection (web/src/app/i18n.ts): only exact language subtags shipped by this branch match.
//   node --test web/test/browser-language.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const entry = `export { browserLanguage, lastLanguage, LANGUAGES } from './web/src/app/i18n.ts';
export { TEMPLATE, resolveEnv, settingsPut } from './web/src/app/settings.ts';`;
const out = await esbuild.build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', write: false, platform: 'neutral' });
const I = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));

test('first supported browser language wins, by BCP 47 language subtag', () => {
  for (const [tags, expected] of [
    [['tr-TR', 'en-US'], 'turkish'],
    [['de-DE', 'tr-TR'], 'german'],
    [['fr-CA'], 'french'],
    [['pt-PT'], 'portuguese'],
    [['zh-CN'], 'chinese'],
    [['zh-Hant-HK'], 'chinese'],
    [['en-GB'], 'english'],
    [['az-AZ'], 'english'],            // unsupported is not guessed as Turkish
    [['az-AZ', 'tr-TR'], 'turkish'],   // the browser's next supported language
    [['nb-NO', 'da-DK'], 'danish'],    // Norwegian is not Danish
    [[], 'english'],
  ]) assert.equal(I.browserLanguage(tags), expected, tags.join(', ') || '(empty)');
});

test('browser navigator fallback reads languages in preference order, then language', () => {
  const was = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const set = value => Object.defineProperty(globalThis, 'navigator', { value, configurable: true, writable: true });
  try {
    set({ languages: ['pl-PL', 'en-US'], language: 'de-DE' });
    assert.equal(I.browserLanguage(), 'polish');
    set({ languages: [], language: 'tr-TR' });
    assert.equal(I.browserLanguage(), 'turkish');
    set({});
    assert.equal(I.browserLanguage(), 'english');
  } finally {
    if (was) Object.defineProperty(globalThis, 'navigator', was);
    else delete globalThis.navigator;
  }
});

test('a saved page language wins; without it, lastLanguage follows the browser', () => {
  const had = {
    navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
    localStorage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'),
  };
  const set = (key, value) => Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  try {
    set('navigator', { languages: ['de-DE'] });
    set('localStorage', { getItem: () => null });
    assert.equal(I.lastLanguage(), 'german');
    set('localStorage', { getItem: () => 'turkish' });
    assert.equal(I.lastLanguage(), 'turkish');
    set('localStorage', { getItem() { throw new Error('SecurityError'); } });
    assert.equal(I.lastLanguage(), 'german');
  } finally {
    for (const [key, descriptor] of Object.entries(had)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test('settings.ini and development URL overrides stay above the browser default', () => {
  const device = { language: I.browserLanguage(['tr-TR']) };
  const resolve = (text, env = {}) => I.resolveEnv(text, env, {}, device);
  assert.equal(resolve(I.TEMPLATE).env.NFSU2_LANGUAGE, 'turkish');
  assert.equal(resolve(I.settingsPut(I.TEMPLATE, 'language', 'polish')).env.NFSU2_LANGUAGE, 'polish');
  assert.equal(resolve(I.TEMPLATE, { NFSU2_LANGUAGE: 'german' }).env.NFSU2_LANGUAGE, 'german');
  assert.equal(I.resolveEnv(I.TEMPLATE, {}, {}, { language: 'english' }).env.NFSU2_LANGUAGE, 'english');
});
