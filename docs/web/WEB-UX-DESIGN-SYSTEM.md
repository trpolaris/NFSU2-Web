# TRPOLARIS Web — Player Hub Visual System + NFSU2 Architecture

This document describes the shared player-facing visual system and the React Player Hub. The existing game page and the Hub remain separate front-end routes served by the same Rust process and the same origin. The Hub is the visual reference for the shared shell; the game runtime itself remains in its original DOM/TypeScript environment.

## 1. Visual direction

The **Player Hub** visual system is the shared reference for both surfaces:

- **Obsidian/navy base:** #080c14 with layered navy and graphite surfaces.
- **Deep panels:** #111b2a, #152237 and #1a2940 for cards, sidebars and content areas.
- **Signal coral:** #ff6945 for primary actions, active navigation and key highlights.
- **Electric lavender:** #a69aff for secondary accents and ambient lighting.
- **Status green:** #66d7b0 for connected/healthy state indicators.
- **Typography:** system-first sans serif for legibility, with compact monospace eyebrow labels and technical metadata.
- **Surfaces:** rounded deep-blue panels, low-contrast borders, restrained blur and layered shadows.
- **Composition:** desktop sidebar, content topbar, centered page content, dashboard-style cards and a responsive navigation treatment.

The Hub remains the reference implementation for the dashboard shell, live player list, profile editor, garage and statistics pages. The main game page consumes the same palette, sidebar/topbar composition, panel surfaces, button language and responsive rhythm through `web/src/app/hub-integration.css`. The game hero artwork and launch dock remain part of the main game page.

## 2. Application architecture

The repository contains two front-end routes:

| Surface | Entry | Purpose |
|---|---|---|
| Existing game page | web/src/main.ts + web/index.html | Game launch, browser checks, controls, saves, WASM/WebGPU and gameplay |
| React player hub | web/src/hub/main.jsx + web/src/hub/index.html | Dashboard, live Online roster, browser-private profile and garage UI |

Both bundles are produced by the existing `web/build.mjs`. The Rust server serves the built Hub at `/hub/` and its assets under `/hub/*`; the original game remains at `/`. There is no second server, second port or separate deployment process.

### Shared navigation and visual shell

- The game page uses the Hub-inspired desktop sidebar and topbar layout. Its existing page links remain in the left navigation.
- The main page's `Player Hub` anchor points to `/hub/` without `target="_blank"`, so it opens in the current tab.
- The Hub's `Oyuna dön` anchor points to `/`, also in the current tab.
- The game page's responsive navigation becomes a horizontally scrollable row on narrow screens. The Hub retains its own mobile sidebar/backdrop behavior.
- Shared visual styling does not mean the game runtime is mounted inside React or that the two routes are combined into one DOM tree.

### Front-end stack

- **React 19.3.1** and React DOM for the Hub component tree.
- **TypeScript** remains the typed application language for the game runtime and supporting modules; the Hub entry is JSX and is bundled by the same esbuild build.
- **Tailwind CSS 4.3.3** remains the build-time utility layer. Preflight stays disabled so it does not reset existing game controls.
- **Motion 14.9.0** provides React transitions and view animations in the Hub; the original game shell uses native Web Animations API and CSS motion.
- **Lucide React 1.66.0** provides locally bundled SVG icons in the Hub.
- Runtime dependencies are pinned in the build script and bundled into `web/dist`; the browser does not fetch code or fonts from a CDN. This is compatible with the Rust server's self-only Content Security Policy.

The project is not converted wholesale to React. The game runtime, worker lifecycle, renderer, audio, controller input, WASM process and save subsystem stay in their existing DOM/TypeScript environment. React is an additional UI layer for account-like and community-facing pages, not a rewrite of the game.

## 3. Rust API contract

The same Rust server exposes a versioned same-origin API for the Hub:

| Endpoint | Method | Purpose |
|---|---|---|
| /api/v1/session | GET | Create or resume a browser-private Hub session and obtain its CSRF token |
| /api/v1/live/players | GET | Current active player names, activity labels and connected duration |
| /api/v1/me | GET | Read the current browser session's profile |
| /api/v1/me | PUT | Update the current profile |
| /api/v1/garage | GET | Read the current session's garage entries |
| /api/v1/garage | POST | Add a player-entered garage entry |
| /api/v1/garage/:id | DELETE | Remove one garage entry owned by the current session |

The React client uses same-origin requests with `credentials: same-origin`. Mutations require the session CSRF token in `X-TRP-CSRF`; the Rust API also checks the request origin. The session cookie is HttpOnly, Secure, SameSite=Strict, host-only and path-wide. Only a SHA-256 hash of the random session token is used as the on-disk session key.

### Persistent data in v1

The Hub writes its private session/profile/garage state to `player-hub.json` inside the existing Rust `/state` volume. Writes use a temporary file, mode `0600`, sync and atomic rename. Expired sessions are removed as new sessions are created; the store has a fixed session capacity and returns an error instead of evicting active users.

This first slice intentionally uses a small JSON store so it can ship without adding a database service or changing the existing Compose topology. It is not yet a public account system: profiles are private to the browser session and do not roam between devices. A future authenticated identity layer can migrate the same API contract to SQLite or PostgreSQL without changing the React pages.

## 4. Data truth and game telemetry

The Hub only labels data according to its actual source.

### Available now

- **Live player roster:** read from the existing Rust LAN switch's active Who list. The API maps the existing status to Online, LAN screens, free roam or menus.
- **Player summary counts:** read from the existing `/players` endpoint.
- **Private profile fields:** user-entered display name, short bio and favorite-car label.
- **Garage entries:** user-entered manufacturer, model, optional year and notes.

The live player API returns an opaque per-process id, sanitized display name, activity and connected duration. It does not return virtual IP addresses, real client addresses, browser identifiers, claim tokens or private session data.

### Not yet connected to the game

- The actual set of cars in a player's NFSU2 save.
- In-game modifications, visual parts, performance builds and vehicle screenshots.
- Career progress, cash, reputation, race wins, event history and personal bests.
- A durable identity that links the private browser profile to the player's claimed name across devices.

These values are not fabricated or inferred from the current `/players` count. The UI labels garage entries as manual and career statistics as awaiting game data. The next telemetry phase needs an explicit, versioned message from the WASM/runtime boundary to the Rust server, plus validation and a durable owner binding before automatic synchronization is enabled.

## 5. Motion and accessibility

- Motion in the React Hub uses the locally bundled Motion package.
- The original game page uses native Web Animations API and CSS transition primitives.
- The original hero atmosphere uses a low-density local canvas particle field with a capped device-pixel ratio.
- `prefers-reduced-motion`, Save-Data and low-core device checks suppress non-essential effects in the game shell; Hub CSS also respects reduced motion.
- Animations never carry information required to operate the game or understand status.
- Inputs and actions retain labels, focus-visible states and disabled states.

## 6. Guardrails

1. Keep the existing game page at `/`; the React Hub remains at `/hub/`.
2. Preserve all game runtime DOM anchors and TypeScript event hooks.
3. Do not change gameplay, WASM, renderer/HUD, audio, controller behavior or multiplayer wire protocol as part of the Hub visual integration.
4. Do not expose real client IPs, virtual LAN addresses, browser IDs, claim tokens, session cookies or CSRF tokens in live player rows.
5. Keep profile and garage reads/writes scoped to the current private browser session.
6. Do not label manually entered vehicles or placeholder stats as verified game telemetry.
7. Serve all scripts, styles and icons from the same origin; keep the existing restrictive CSP.
8. Keep the same Rust process, Docker service, port and persistent volumes. No second backend or port is introduced.
