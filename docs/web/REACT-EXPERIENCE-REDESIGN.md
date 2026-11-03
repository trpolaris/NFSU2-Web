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


## Remaining route composition

Mod Library, Saves, Controls, Settings/Accessibility, System (updates, diagnostics and game data), and About are now mounted under React route compositions. Each route gets a shared animated intro and responsive feature container. Existing section nodes are temporarily moved into those routes with placeholder-backed islands so the existing platform, settings, saves, input and diagnostics controllers retain their event handlers and DOM IDs. The compatibility host remains until those inner controls are converted to typed React components.


## React settings bridge

Two primary Online toggles — Free Roam with others and Online mode — are now controlled by React. They read through the existing SettingsPanel current method and write through its existing set method. The bridge also exposes the current tab's read-only state and a refresh signal. This does not bypass the existing save-file ownership check or change the settings.ini format. Room/name and blocked-player inputs, crew/colour editing, Quick Chat switches and the 16-phrase editor are now React-owned. Horn preview and its audio control remain on the existing specialized controller.


The Online route also now has React text editors for the driver's display name and room name. Their save action calls a dedicated SettingsPanel method that uses the same name normalization and per-key validation as the original controls. Crews, horn preview, blocked-player lists and quick-chat phrase editing remain on the legacy controller for this stage.


Additional simple Free Roam preferences are now React-managed too: Ghost Mode (including its inverted settings-file meaning), Quick Chat enablement, the nearby-player car limit, and the blocked-player name list. The room/name/blocked-name controls use the same SettingsPanel validation path. Horn preview remains on the original specialized renderer because it owns the audio preview lifecycle; crew and phrase editing now use the React controls described below.


## Crew editor migration

The Free Roam Crew editor is now React-owned. It uses the existing pure crew rules (checkCrew, CREW_MAX, CREW_PALETTE, freeColour and crewsOf) and keeps each crew's selected colour with its name. A dedicated SettingsPanel method validates and writes roam_crew and roam_crew_colours together in one settings update, so leaving a crew or changing its colour does not desynchronize the two lists. The legacy crew editor is hidden only inside the React route; the existing /players crew counts and server visibility logic are unchanged.


## Quick Chat phrase editor migration

The 16-slot Quick Chat editor is now a React interface backed by the existing phrase catalogue and category definitions. Each of the four groups can select a category, and each of its four slots only offers phrases from that category. The phrase ids and category ids are validated with the same settings validators and written together in one save. Defaults are restored as commented template values when the default set is chosen. The in-game phrase picker and typed chat pipeline are unchanged.


## About page migration

The About route is now fully rendered by React, including the original feature summary, project links, independent-project notice and translation/texture credits. The original `#changes` and `#about` nodes are hidden inside the compatibility host but no longer used as the route content. All external destinations and attribution text are retained.


## Mod Library route migration

The Mod Library route now has a React-owned composition for community picks, saved mod links, category filters and the add/import/export form. The live pack list, custom link list, count/filter controls, installed-pack check action and add-link form are moved individually into React slots so the existing browser-local storage, safe URL/path validation, duplicate checks, 100-link cap, import/export format and server manifest checks remain unchanged. No mod files are installed or written to the server.


## Saves route migration

The Saves route uses a React dashboard. Local profile cards, profile renaming, backup export and restore are React-owned controls backed by a narrow typed bridge into the existing SavesPanel. The bridge reads the existing OPFS profile snapshot and delegates rename/import/export to the same validation, confirmation and file-transaction routines; save formats and storage behavior are unchanged.

The #saves root remains mounted as a compatibility island for the screenshot list and TRPOLARIS Cloud form. ScreenshotsPart and VaultPanel keep their current DOM anchors, event handlers, OPFS operations, encryption, same-origin API calls and conflict handling. The legacy profile list and backup toolbar remain in the mounted root only as compatibility anchors and are not displayed beside the React controls.

Next, migrate screenshot viewing/deletion and the Cloud keyphrase/conflict controls through typed adapters. Do not change save formats, OPFS paths, Cloud routes, encryption behavior or server storage as part of this presentation-layer work.


## Controls route migration

The Controls route now has a React-owned responsive dashboard and layout for keyboard, gamepad and touch control sections. The complete existing #controls section is mounted as one compatibility island so the original controlsSheet can still find #keys and retain its tab keyboard navigation, Xbox/PlayStation labels, live controller-follow behavior, wheel drawing, touch steering, level-horizon, control-size and menu-size settings. The game input mappings and runtime input pipeline are unchanged.

## System route migration

The System page is now composed in React with three sections: Updates & Security, Browser and Runtime Diagnostics, and local Game Data. The full #updates, #diagnostics, and #game-data service roots remain individually mounted so their existing actions and progress updates continue to target the same elements. Preload/download logic, cache deletion, update checks, translation audits, privacy actions and diagnostic reporting are unchanged.

## Settings route migration

The Settings route now has a React dashboard for validated game options, configuration profiles, quick presets and Accessibility. The complete #settings root remains a single mounted unit for SettingsPanel; the #accessibility section is kept intact for the browser preference controller. This preserves settings.ini validation, read-only ownership checks, profile import/export, presets, raw-file editing and the device accessibility preferences.


## Accessibility controls migration

The three browser accessibility preferences — Larger text, Reduce animations and High contrast — now render as React-controlled switches. A narrow adapter reads and writes the existing browser preference store and keeps the original checkbox elements and document-level data attributes synchronized. The localStorage key and preference names remain unchanged.


## Mod Library list migration

Recommended packs and saved mod-link lists are now rendered as React cards. Search, category and favorites-only filters are React state. The bridge returns a snapshot from the existing known community packs, browser-local custom mod storage, favorites key and server manifest status map. Favorite toggles and deletion call the existing storage helpers; installed-pack checks still call the original /data-manifest validator. The add/import/export form remains on its original DOM controller for this stage.


The Add/Import/Export form is now React-rendered too. It calls a narrow bridge into the existing platform helpers: adding still validates printable names, HTTP/HTTPS URLs, safe relative game-data paths, duplicate pairs and the 100-link cap; import still accepts only the schema-1 JSON format with a 256 KB file limit; export keeps the existing JSON schema and filename. The original handlers remain available only for hidden legacy elements and are no longer the visible form.
