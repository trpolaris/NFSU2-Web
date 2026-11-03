# TRPOLARIS React Web Experience

## Goal

The main web experience (/) and Player Hub (/hub/) should share one coherent, responsive design language and use React for their user-facing page composition. Motion should improve hierarchy and feedback without making navigation slower or consuming unnecessary GPU time.

## Current migration slice

The main page now has a React + Motion application frame:

- React owns the left navigation, active-route presentation, top bar, system-state indicator, language/install control placements and Player Hub shortcuts.
- The React frame includes desktop, compact-tablet and mobile navigation layouts.
- Page changes use a short Motion transition. The active navigation marker uses a shared layout animation.
- The existing page root is mounted in a dedicated compatibility slot. This deliberately preserves the DOM IDs and event hooks currently used by the TypeScript application shell.
- When a game session is starting or playing, the surrounding React application frame becomes inert, preserving the previous rule that page controls must not compete with the active game surface.
- The page and Hub remain same-origin. No CDN scripts or remote font imports are introduced.

Player Hub is already a separate React application. Its current iteration adds an animated active-navigation marker, ambient background layers, subtle card feedback and a truthful disconnected state.

## Target component structure

The intended main-page composition is:

    ExperienceRoot
    ├── ExperienceShell
    │   ├── PrimaryNavigation
    │   ├── StatusBar
    │   └── RouteViewport
    │       ├── HomePage
    │       ├── OnlinePage
    │       ├── ModLibraryPage
    │       ├── SavesPage
    │       ├── ControlsPage
    │       ├── SettingsPage
    │       ├── AccessibilityPage
    │       ├── UpdatesPage
    │       ├── DiagnosticsPage
    │       ├── GameDataPage
    │       └── AboutPage
    └── GameRuntimeAdapter
        ├── StartupChecks
        ├── GameSession
        ├── LocalSaveStorage
        └── NetworkAndInputServices

The target structure separates view rendering from the game runtime. React should own the pages and reusable interface components; the TypeScript services should continue to own browser capabilities, game lifecycle, storage, input, audio, networking and diagnostics.

## Migration order

1. **App shell and navigation** — completed as the first migration slice. Keep the compatibility host until every dependent panel has moved.
2. **Home / launch screen** — React now owns the hero, visual composition and quick-access cards. The live game launch dock and status console are temporarily mounted as DOM islands so the existing TypeScript runtime keeps its event listeners and progress updates. The next sub-step is to replace those islands with a typed runtime adapter.
3. **Online and community views** — connect the current /players and same-origin status sources through a read-only external store.
4. **Saves and cloud** — move the forms and status states into React while retaining the existing save and cloud service contracts.
5. **Controls and settings** — preserve the validated settings model and input-device behavior; do not let React rerenders overwrite live device state.
6. **Mod library, diagnostics, accessibility, updates and about** — move the remaining content panels and their tests.
7. **Remove the compatibility host** — only after the DOM selectors, event listeners and runtime hooks have been replaced by typed adapters and regression coverage.

## Runtime and API boundaries

The React migration is a presentation-layer change:

- Do not replace or re-render the WebAssembly game canvas, WebGPU renderer, audio worklets, workers or in-game HUD through React.
- Do not change Rust routes, WebSocket message formats, CSRF/session behavior, save formats, multiplayer contracts or server storage.
- Keep local game settings and save data in their existing storage services.
- Expose runtime state to React through typed snapshots/subscriptions rather than allowing React components to mutate engine internals.
- Retain the current Player Hub API routes and same-origin credential handling.

The compatibility host is temporary. It prevents existing runtime selectors from breaking while each view is migrated, but it is not the final component architecture.

## Motion and accessibility rules

- Use short route transitions and restrained hover/press feedback.
- Prefer transform and opacity animations over expensive layout or filter animations.
- Respect prefers-reduced-motion; navigation and controls must remain fully understandable without animation.
- Keep focus-visible indicators, semantic landmarks, button labels and keyboard navigation.
- Make small-screen navigation reachable without covering form controls or game launch status.
- Avoid continuous decorative animation on the game canvas or during active gameplay.

## Validation checklist

For each migrated view:

- npm run check
- npm run build
- node --test --test-concurrency=1 web/test/*.test.mjs
- Verify navigation and browser back/forward behavior.
- Verify keyboard focus and reduced-motion mode.
- Verify viewport widths around 360, 768, 1024 and 1440 pixels.
- Verify page controls do not interfere with a starting or active game session.

A migration step is complete only when its old DOM hooks are either intentionally retained in the compatibility host or replaced by tested typed interfaces. The compatibility host must not be removed just because the React shell renders successfully.


## Home dashboard migration note

The React home page uses the existing car artwork/particle canvas and keeps the original live Play dock and status console mounted via placeholder-backed DOM islands. The hidden legacy home container remains in the compatibility host to preserve runtime references. When the game enters its starting/playing phase, the React dashboard unmounts and restores those live nodes to the original app container; the legacy runtime then applies its own app inert state while the separate game stage remains interactive. Navigation chrome becomes inert during the active game session, but the React root itself is never inert because the game stage is outside it.


## React localization bridge

The existing language dictionaries remain the source of truth. The game entry exposes the already-loaded translatePage function to the React shell, and the shell reapplies it after route/phase remounts. React UI labels use the same English source keys as the original dictionaries, so the existing language selector and all shipped language files continue to drive the visible shell and home dashboard.


## Online / Free Roam migration slice

The Online route now has a React + Motion page composition with a live-multiplayer hero and feature cards for Free Roam, the game's Online mode, and rooms/crews. The existing #online section is mounted into the React route using a placeholder-backed compatibility island. Its SettingsController still owns validated settings writes, room/crew controls, horn preview and the live status line from /players; this avoids duplicating or bypassing the existing settings model while the visual route migrates.

Next, the controls inside #online-body should move from the imperative SettingsController.group()/row() renderer into typed React field components backed by a narrow settings adapter. Keep watchPlayers, playersText, crewCounts, roomHash and the same /players query contract as the source of live counts. Do not invent player totals or room/crew availability when the server does not report them.
