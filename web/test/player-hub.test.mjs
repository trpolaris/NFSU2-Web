import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const react = read('src/hub/main.jsx');
const hubCss = read('src/hub/hub.css');
const hubHtml = read('src/hub/index.html');
const builder = read('build.mjs');
const rustApp = read('server-rs/src/app/mod.rs');
const rustApi = read('server-rs/src/app/player_hub.rs');

test('React player hub is a separate same-origin route and does not replace the WASM game page', () => {
  assert.match(builder, /'hub\/main': 'src\/hub\/main\.jsx'/);
  assert.match(builder, /copyFileSync\('src\/hub\/index\.html'/);
  assert.match(hubHtml, /id="player-hub-root"/);
  assert.match(hubHtml, /href="\/hub\/main\.css"/);
  assert.match(hubHtml, /src="\/hub\/main\.js"/);
  assert.match(rustApp, /if p\.starts_with\("\/api\/v1\/"\)/);
  assert.match(rustApp, /return self\.player_hub_api\(q, s, &p, &u\)\.await/);
});

test('React, Motion and Lucide are pinned and bundled locally for the self-only CSP', () => {
  assert.match(builder, /react@19\.3\.1/);
  assert.match(builder, /react-dom@19\.3\.1/);
  assert.match(builder, /motion@14\.9\.0/);
  assert.match(builder, /lucide-react@1\.66\.0/);
  assert.match(react, /from 'react'/);
  assert.match(react, /from 'motion\/react'/);
  assert.match(react, /from 'lucide-react'/);
  assert.doesNotMatch(react, /https?:\/\/|cdn\.jsdelivr\.net|fonts\.googleapis\.com/);
  assert.doesNotMatch(hubCss, /@import\s+url\(["']?https?:/);
});

test('live player data comes from the Rust switch and does not publish private network identifiers', () => {
  assert.match(rustApi, /self\.lan\.who\(\)\.await/);
  assert.match(rustApi, /filter\(\|p\| p\.left\.is_none\(\)\)/);
  assert.match(rustApi, /mac\.update\(&player\.vip\.to_le_bytes\(\)\)/);
  assert.match(rustApi, /"name": clean_text\(&player\.name, 32\)/);
  assert.match(rustApi, /"activity": activity/);
  assert.match(rustApi, /"connectedSeconds":/);
  const liveHandler = rustApi.slice(rustApi.indexOf('if path == "/api/v1/live/players"'), rustApi.indexOf('let token = cookie_token', rustApi.indexOf('if path == "/api/v1/live/players"')));
  assert.doesNotMatch(liveHandler, /"vip"\s*:|"ip"\s*:|"browser"\s*:|"claim"\s*:/);
  assert.match(react, /api\('\/api\/v1\/live\/players'\)/);
  assert.match(react, /window\.setInterval\(\(\) => \{ void refreshLive\(\); \}, 8000\)/);
});

test('profile and garage writes are browser-session scoped and CSRF protected', () => {
  assert.match(rustApi, /__Host-trp-session/);
  assert.match(rustApi, /HttpOnly; Secure; SameSite=Strict/);
  assert.match(rustApi, /X-TRP-CSRF/);
  assert.match(rustApi, /constant_time_eq\(csrf, &session\.csrf\)/);
  assert.match(rustApi, /player-hub\.json/);
  assert.match(rustApi, /mode\(0o600\)/);
  assert.match(rustApi, /MAX_SESSIONS/);
  assert.match(rustApi, /SESSION_MAX_AGE_MS/);
  assert.match(rustApi, /path == "\/api\/v1\/me" && q\.method == "PUT"/);
  assert.match(rustApi, /path == "\/api\/v1\/garage" && q\.method == "POST"/);
  assert.match(rustApi, /path\.starts_with\("\/api\/v1\/garage\/"\) && q\.method == "DELETE"/);
  assert.match(react, /credentials: 'same-origin'/);
  assert.match(react, /headers\.set\('X-TRP-CSRF', csrf\)/);
  assert.match(react, /api\('\/api\/v1\/me'/);
  assert.match(react, /api\('\/api\/v1\/garage'/);
});

test('garage and career UI clearly distinguishes player-entered data from game telemetry not yet connected', () => {
  assert.match(react, /MANUEL KAYIT/);
  assert.match(react, /oyundan otomatik alınmıyor/);
  assert.match(react, /Kariyer verisi henüz bağlanmadı/);
  assert.match(react, /Oyun verisi bekleniyor/);
  assert.match(react, /oyun save dosyasından araç listesi okunmuyor/);
  assert.match(react, /Oyun içi senkronizasyon sonraki aşamada eklenecek/);
});

test('player hub visual system is responsive and respects reduced-motion preferences', () => {
  assert.match(hubCss, /\.hub-sidebar/);
  assert.match(hubCss, /\.hub-stats-grid/);
  assert.match(hubCss, /\.hub-player-row/);
  assert.match(hubCss, /@media \(max-width: 700px\)/);
  assert.match(hubCss, /@media \(max-width: 430px\)/);
  assert.match(hubCss, /prefers-reduced-motion:\s*reduce/);
  assert.match(react, /AnimatePresence/);
});
