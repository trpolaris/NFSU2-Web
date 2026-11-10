// Bundles the web app (TypeScript) with esbuild:
//   web/dist      the player's page: what the server serves to everyone (and web/deploy/pack.sh ships)
//   web/dist-dev  the test pages (test/*) and every source map: what the server serves only with --dev
//                 (it never looks in this folder without it, so no spelling of a path reaches them)
// One build; the outputs are sorted into the two folders as they are written.
import * as esbuild from 'esbuild';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { bootTexts, catalog } from './tools/i18n-keys.mjs';
const watch = process.argv.includes('--watch');
const DIST = 'dist', DEV = 'dist-dev';
const opts = {
  entryPoints: {
    'main': 'src/main.ts',
    'lastfm': 'src/lastfm-callback.ts',
    'ui/main': 'src/ui/main.jsx',
    'hub/main': 'src/hub/main.jsx',
    'hub/chat-window': 'src/hub/chat-window.jsx',
    'host/game-worker': 'src/host/game-worker.ts',
    'host/io-worker': 'src/host/io-worker.ts',
    'host/predownload-worker': 'src/host/predownload-worker.ts',
    'gpu/png-worker': 'src/gpu/png-worker.ts',
    'sw': 'src/sw.ts',
    'test/hostcheck': 'src/test/hostcheck.ts',
    'test/play': 'src/test/play.ts',
    'test/shadercheck': 'src/test/shadercheck.ts',
    'test/aicheck': 'src/test/aicheck.ts',
    'audio/worklet': 'src/audio/worklet.ts',
  },
  outdir: DIST, bundle: true, format: 'esm', target: ['chrome140', 'firefox145'], sourcemap: true, minify: !watch && !process.env.NOMINIFY,
  logLevel: 'info', write: false,
  // registry-defaults.txt and similar seeds go into the page as strings, the stylesheet's pictures as data: URLs
  loader: { '.txt': 'text', '.png': 'dataurl', '.jsx': 'jsx' },
  jsx: 'automatic',
  jsxImportSource: 'react',
};
for (const [k, v] of Object.entries(opts.entryPoints)) if (!fs.existsSync(v)) delete opts.entryPoints[k];

// A classic script runs before the page's module entry points and can report a blocked main.js.
const bootOpts = {
  ...opts,
  entryPoints: { boot: 'src/boot.ts' },
  format: 'iife',
  define: { BOOT_TEXTS: JSON.stringify(bootTexts()) },
};

// test pages and source maps go to dist-dev (same relative path: /test/x.js, /main.js.map); the rest to dist
const devOnly = rel => rel.startsWith('test/') || rel.endsWith('.map');
function emit(files) {
  for (const f of files) {
    const rel = path.relative(path.resolve(DIST), f.path).split(path.sep).join('/');
    const out = path.join(devOnly(rel) ? DEV : DIST, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, f.contents);
  }
}
// an older build wrote test pages and maps into dist: never leave them there
fs.rmSync(path.join(DIST, 'test'), { recursive: true, force: true });
for (const f of fs.existsSync(DIST) ? fs.readdirSync(DIST, { recursive: true }) : []) if (String(f).endsWith('.map')) fs.rmSync(path.join(DIST, String(f)));
fs.mkdirSync(path.join(DEV, 'test'), { recursive: true });
fs.mkdirSync(DIST, { recursive: true });

// Pinned Tailwind v4 utility build. Only utilities are imported (no Preflight),
// so existing game and browser controls keep their established CSS semantics.
// The CLI is installed in npm's ephemeral npx cache; expose just its CSS package
// beside the source stylesheet while it resolves @import paths, then remove it.
const tailwindPackageArgs = [
  '--yes',
  '--package=@tailwindcss/cli@4.3.3',
  '--package=tailwindcss@4.3.3',
];
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

 // The React hub is bundled locally (no CDN at runtime). Pin the runtime packages here so
 // both the Docker build and a plain "npm run build" use the same dependency set.
 const reactPackageArgs = [
   '--yes',
   '--package=react@19.3.1',
   '--package=react-dom@19.3.1',
   '--package=motion@14.9.0',
   '--package=lucide-react@1.66.0',
 ];
 function prepareReactResolver() {
   const probe = spawnSync(npx, [
     ...reactPackageArgs,
     'node',
     '-e',
     'const p = process.env.PATH.split(require("node:path").delimiter).find(x => require("node:path").basename(x).toLowerCase() === ".bin" && x.includes("node_modules")); console.log(p ? require("node:path").resolve(p, "..") : "");',
   ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], shell: process.platform === 'win32' });
   if (probe.error || probe.status !== 0) {
     throw new Error(`Could not locate the pinned React package cache: ${probe.error?.message ?? probe.stderr ?? ''}`);
   }
   const modules = probe.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
   if (!modules) throw new Error('Could not locate the npx node_modules directory for the React hub.');
   for (const name of ['react', 'react-dom', 'motion', 'lucide-react']) {
     if (!fs.existsSync(path.join(modules, name, 'package.json'))) {
       throw new Error(`Pinned React hub dependency is missing ${name}.`);
     }
   }
   return modules;
 }
 const reactNodeModules = prepareReactResolver();
 opts.nodePaths = [reactNodeModules];
const tailwindArgs = [
  ...tailwindPackageArgs,
  'tailwindcss',
  '-i', 'src/app/tailwind.css',
  '-o', path.join(DIST, 'tailwind.css'),
  '--minify',
];
const resolverDir = path.resolve('src/app/node_modules');
const resolverPackage = path.join(resolverDir, 'tailwindcss');
let createdResolverDir = false;
let createdResolverPackage = false;

function prepareTailwindResolver() {
  const probe = spawnSync(npx, [
    ...tailwindPackageArgs,
    'node',
    '-e',
    'const p = process.env.PATH.split(require("node:path").delimiter).find(x => require("node:path").basename(x).toLowerCase() === ".bin" && x.includes("node_modules")); console.log(p ? require("node:path").resolve(p, "..") : "");',
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], shell: process.platform === 'win32' });
  if (probe.error || probe.status !== 0) {
    throw new Error(`Could not locate the pinned Tailwind package cache: ${probe.error?.message ?? probe.stderr ?? ''}`);
  }

  const cacheModules = probe.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  if (!cacheModules) throw new Error('Could not locate the npx node_modules directory for Tailwind CSS.');
  const cachePackage = path.join(cacheModules, 'tailwindcss');
  for (const file of ['theme.css', 'utilities.css']) {
    if (!fs.existsSync(path.join(cachePackage, file))) {
      throw new Error(`Pinned Tailwind CSS package is missing ${file}.`);
    }
  }

  if (!fs.existsSync(resolverDir)) {
    fs.mkdirSync(resolverDir, { recursive: true });
    createdResolverDir = true;
  }

  if (fs.existsSync(resolverPackage)) {
    const installed = JSON.parse(fs.readFileSync(path.join(resolverPackage, 'package.json'), 'utf8'));
    if (installed.version !== '4.3.3') {
      throw new Error(`Unexpected local Tailwind CSS version ${installed.version}; expected 4.3.3.`);
    }
  } else {
    fs.cpSync(cachePackage, resolverPackage, { recursive: true });
    createdResolverPackage = true;
  }
}

function cleanupTailwindResolver() {
  if (createdResolverPackage) fs.rmSync(resolverPackage, { recursive: true, force: true });
  if (createdResolverDir && fs.existsSync(resolverDir) && fs.readdirSync(resolverDir).length === 0) {
    fs.rmSync(resolverDir, { recursive: true, force: true });
  }
}

prepareTailwindResolver();
if (watch) {
  const tailwind = spawn(npx, tailwindArgs, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  tailwind.on('error', error => {
    console.error('[tailwind] could not start the pinned CLI:', error);
    cleanupTailwindResolver();
    process.exitCode = 1;
  });
  tailwind.on('exit', code => {
    cleanupTailwindResolver();
    if (code && code !== 0) process.exitCode = code;
  });
  process.once('exit', cleanupTailwindResolver);
} else {
  try {
    const tailwind = spawnSync(npx, tailwindArgs, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (tailwind.error || tailwind.status !== 0) {
      throw new Error(`Tailwind CSS build failed (exit ${tailwind.status ?? 'unknown'}): ${tailwind.error?.message ?? ''}`);
    }
  } finally {
    cleanupTailwindResolver();
  }
}
// the start page (its script and stylesheet are main.js / main.css), and its files as they are (src/static: the
// app's manifest and icons, for installing it on a phone's home screen or as a desktop app)
fs.copyFileSync('index.html', path.join(DIST, 'index.html'));
fs.mkdirSync(path.join(DIST, 'hub'), { recursive: true });
fs.copyFileSync('src/hub/index.html', path.join(DIST, 'hub', 'index.html'));
fs.copyFileSync('src/hub/chat.html', path.join(DIST, 'hub', 'chat.html'));
for (const f of fs.readdirSync('src/static')) fs.copyFileSync(path.join('src/static', f), path.join(DIST, f));
// the start page's languages (src/app/lang, i18n.ts): /lang/<language>.json, fetched once a player picks one
fs.rmSync(path.join(DIST, 'lang'), { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'lang'));
for (const f of fs.readdirSync('src/app/lang')) if (f.endsWith('.json'))
  fs.writeFileSync(path.join(DIST, 'lang', f), JSON.stringify(JSON.parse(fs.readFileSync(path.join('src/app/lang', f), 'utf8'))));
const page = name => `<!doctype html><meta charset=utf-8><title>${name}</title><script type=module src="/test/${name}.js"></script>`;
for (const name of ['play', 'hostcheck', 'shadercheck', 'aicheck']) fs.writeFileSync(path.join(DEV, 'test', `${name}.html`), page(name));
// TRPOLARIS runtime translation diagnostics manifest. Extra strings in upstream language packs are allowed;
 // only source-side dynamic keys are rejected.
const { keys, bad } = catalog();
if (bad.length) throw new Error(`Translation catalogue has dynamic keys that need N("literal text"):\n${bad.join('\n')}`);
const keyManifest = [...keys.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, meta]) => ({
  key, ...(meta.plural ? { plural: true, one: meta.one } : {}), ...(meta.html ? { html: true } : {}),
}));
fs.writeFileSync(path.join(DIST, 'i18n-key-manifest.json'), JSON.stringify(keyManifest));
// the player's page takes its address's test parameters only from a server that serves this (--dev: shell.ts)
fs.writeFileSync(path.join(DEV, 'test', 'dev.json'), '{"dev":true}\n');
if (watch) {
  for (const options of [opts, bootOpts]) {
    const ctx = await esbuild.context({ ...options, plugins: [{ name: 'emit', setup(b) { b.onEnd(r => { if (r.outputFiles) emit(r.outputFiles); }); } }] });
    await ctx.watch();
  }
} else {
  for (const options of [opts, bootOpts]) emit((await esbuild.build(options)).outputFiles);
}
