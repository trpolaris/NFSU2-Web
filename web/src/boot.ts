// The start page's word when the game's own script never starts. An antivirus or network filter that blocks
// main.js can leave index.html on "Loading the game." with nothing of ours running. This small classic script runs
// first, before the module entry points, and explains the likely block with a Reload action.
// Its texts are embedded at build time because the page's language files may not have loaded yet.

import { lastLanguage } from './app/i18n';

declare const BOOT_TEXTS: Record<string, Record<string, string>>;

const WAIT_MS = 15_000;
const N = (s: string) => s;
const started = () => document.documentElement.hasAttribute('data-started');

let shown = false;
function show() {
  if (shown || started()) return;
  const status = document.getElementById('status');
  const sub = document.getElementById('status-sub');
  const reload = document.getElementById('reload') as HTMLButtonElement | null;
  if (!status || !sub || !reload) return;

  shown = true;
  const lang = lastLanguage();
  const t = (key: string) => BOOT_TEXTS[lang]?.[key] ?? key;
  const previous = [status.textContent, sub.textContent, reload.textContent, reload.hidden] as const;

  status.textContent = t(N('Not loading'));
  sub.textContent = t(N('Your antivirus or network is probably blocking the game. Allow {site} in it, then reload.'))
    .replace('{site}', location.hostname);
  reload.textContent = t(N('Reload'));
  reload.hidden = false;
  reload.addEventListener('click', () => { if (!started()) location.reload(); });

  addEventListener('nfsu2-started', () => {
    [status.textContent, sub.textContent, reload.textContent, reload.hidden] = previous;
  }, { once: true });
}

// A failed or blocked main.js request. Capture is needed for script-element error events.
addEventListener('error', event => {
  const target = event.target;
  if (target instanceof HTMLScriptElement && new URL(target.src, location.href).pathname === '/main.js') show();
}, true);

// Also catch a script that loaded but never reached its first application module.
setTimeout(show, Math.max(0, WAIT_MS - performance.now()));
