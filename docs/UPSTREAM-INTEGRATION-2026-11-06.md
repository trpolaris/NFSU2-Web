# Upstream Integration — 2026-11-06

This branch ports compatible changes from `th0mk/nfsu2-web` into TRPOLARIS while preserving the existing React experience, F9 control center, Mini Chat HUD, standalone chat window, Player Hub/Admin Console, and Rust server protocol.

## Integrated on this branch

### Lobby car performance gauge
- Added a backward-compatible car-look extension carrying the game's rated vehicle class and performance rating.
- Existing peers skip the unknown extension; new peers cache remote ratings by player/config generation.
- The lobby calculates the fastest other car against the local car after applying the race's engine-balancing rules (85% of the adjustment) and displays a compact gauge inside the existing lobby card.
- Added car-record round-trip, unknown-extension and out-of-range tests.

### Friends capacity
- Increased the existing EA Messenger Buddy friend list from 50 to 250.
- Kept blocked and recently-met lists at 50.
- Updated JSON load limits and mutual-friend/request capacity checks.
- Expanded the load fixture to 300 entries and verifies the 250-friend limit.
- This raises the EA Messenger Buddy roster limit only. The TRPOLARIS Rust server does not yet expose the upstream `/friends` HTTP API / OnlineHost bridge, and the current Free Roam hub does not yet prioritize buddy links; start-page paging/filtering and F9 friend-request screens therefore remain unintegrated.

### Keyboard and controllers
- Ported the learned Windows AltGr handling: on browsers which synthesize Left Ctrl before Right Alt/AltGraph, the synthetic Ctrl no longer triggers the game's Ctrl binding.
- Added modifier-code recovery when a browser omits KeyboardEvent.code.
- Added regression test coverage for AltGr.
- Ported known HID layouts for Xbox Bluetooth controllers in Firefox on macOS (LT/RT order) and the Zikway HID controller.
- Updated controller classification and HID-reader tests for Xbox and Zikway.

### Mobile touch
- Ported the iPhone/Safari two-finger garage-turn fix: either finger can arrive first, Safari's native pinch/pan is prevented while two fingers are on the game, stale cancelled gestures are cleared, and the middle-button drag is released cleanly.
- Added tests for both pointer arrival orders and a gesture cancelled without a final pointer event.

### Existing UI/help fixes
- Scoped Xbox/PlayStation button-family radio handling to its own controls panel so wheel controls cannot change the selected controller family.
- Added a first-crew creation hint to the existing Crew control without changing its layout.

### Career free-roam marker recovery
- Added a small runtime frame hook that watches the career's settled Free Roam HUD while the game's Engage manager is idle.
- If the career's `+0x7138` engaging flag or showcase-preview flag remains set for 120 frames (2 seconds at 60 fps), clear only the stale flag and log the recovery. Normal transitions, active races, menus and loading screens are left alone.
- Added `tests/scripts/engage_stuck.txt`, which sets both flags, checks that they clear, then confirms a shop marker opens.
- Added the opt-in `engagestuck` scenario to `web/tools/run-suite.mjs`. It requires a career save via `NFSU2_SAVE_SEED`; it is not part of the default no-save suite.

### Multiplayer race-trip lobby recovery
- The race trip now detects when Enter on the Online menu opens a remembered non-Lobby icon (Car Select, Options, Rankings, EA Messenger, etc.).
- It backs out and retries the Lobby selection, stepping the icon carousel left on subsequent attempts, with a six-attempt bound and a clear failure message rather than silently waiting for the host's race to disappear.
- The way back from a race also closes these detour screens before returning to the career.
- Added `tests/scripts/mprace_lobby_b_detour.txt` as a two-client manual regression scenario paired with `mprace_lobby_a.txt`. It must be exercised against a seeded career and live multiplayer session; it is not an automated CI pass.

## Not yet integrated / requires coordinated work

- **Friends UI and API:** the 250-entry server capacity is in place, but start-page pagination/filtering, F9 request management, friend/crew invites, Discord names and online/offline roster UI still need to be wired to the existing Buddy service and custom React/F9 components.
- **Mods/Mod Packs:** built-in catalogue, Blitz rims, maker details, mod toggles, OEM stand-ins and the Shown/Original remote-car view need the runtime modpack module, manifests and save compatibility.
- **World map/minimap:** current TRPOLARIS map uses a 512-player snapshot. Upstream's 2,048-player live map deltas, smooth markers and car-meet markers/GPS require a coordinated C/TypeScript/Rust protocol change. Upstream uses message type 17 for MAPD while TRPOLARIS uses 17 for typed FreeRoam chat; do not reuse it without an explicit message-ID/version migration.
- **Multiplayer career credits:** requires race eligibility, friend/crew credit masks, career save/result accounting, lobby protocol and UI changes.
- **24,000-player capacity:** requires load testing and review of Rust hub memory, connection/stream limits, networking, container resources and deployment topology. Do not copy upstream limits blindly.
- **Vehicle show-off:** hood/trunk/door state, speakers/audio and remote animation need the upstream show-off runtime system adapted to the local FreeRoam implementation.
- **Photo Mode:** camera paths, scene/picture options, lens effects, higher-resolution output and freeze-time need a wider runtime/React integration. The current TRPOLARIS Photo Mode is a separate, simpler panel; the upstream auto-turn slider behavior has no direct equivalent.
- **Co-op/split-screen:** local 2–4 player support spans renderer, memory, controls, career and race systems; it is not a safe file-level copy.
- **Lobby/Quick Chat:** multi-lobby focus/grouping, stage eligibility, friend/crew invites and countdown messages remain to be ported with tests.
- **Vinyls/car parts:** Art Factory 28–34, hidden Special vinyls, car-specific filters, unique unlocks and Visual Reputation Remover need their manifests/runtime modules.
- **Other platform and game fixes:** independent USB pedals, full Steam Controller/Steam Deck support, further phone/browser fixes, synchronized weather, pause-menu save, save recovery, Last.fm/EA Trax, country RTT, and runtime collision/tire-smoke fixes remain under review.

## Validation status

- GitHub Actions are running for the draft PR. Check the PR's latest head before merging.
- No native/WASM build, Rust tests, browser suite, or live multiplayer game session has been run in this integration session.
- The PR remains a draft. `main` and production deployment are unchanged.
