# Upstream Integration — 2026-11-06

This branch ports compatible changes from `th0mk/nfsu2-web` into TRPOLARIS while preserving the existing React experience, F9 control center, Mini Chat HUD, standalone chat window, Player Hub/Admin Console, and Rust server protocol.

## Integrated on this branch

### Lobby car performance gauge
- Added a backward-compatible car-look extension carrying the game's rated vehicle class and performance rating.
- Existing peers skip the unknown extension; new peers cache remote ratings by player/config generation.
- The lobby calculates the fastest other car against the local car after applying the race's engine-balancing rules (85% of the adjustment) and displays a compact gauge inside the existing lobby card.
- Added car-record round-trip, unknown-extension and out-of-range tests.

### Friends capacity, web API and Free Roam bridge
- Increased the existing EA Messenger Buddy friend list from 50 to 250; blocked and recently-met lists remain at 50.
- Ported upstream page-level Buddy operations through `OnlineHost` and the existing per-persona EA Messenger store; no separate browser-side friend database was introduced.
- Added authenticated, same-origin `GET/POST /friends` endpoints using the existing claimed-name/keyphrase token. Supported operations: list and retrieve waiting messages, request by name, accept/decline, remove, block, send messages and update the Discord username.
- Added a Friends panel inside the existing F9 **Sürücü ağı** tab: incoming/outgoing requests, friend roster, Online/offline/Free Roam room status, name filter, add-by-name, remove/block, Discord username, direct message sending and waiting-message mailbox.
- Extended RoamHub with mutually accepted friend lists, first-priority links between friends, room labels and Free Roam whereabouts. The page syncs its current room and friend list when its LAN connection becomes ready.
- Added server-to-page friend-mail delivery through owner-scoped LAN peers, sent as WebSocket text notifications and displayed in the F9 mailbox. Queued messages are also read by the room-sync request; `HEAD` remains side-effect-free.
- The separate start-page Friends & crews tab, bumper-contact FriendPrompt, Join action, and race/crew invitations remain to be integrated.

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

### Remote vehicle tyre smoke and nitrous effects
- Remote cars are deliberately outside the game's normal car index, so the world's normal effect step skipped their tyre smoke, dirt and nitrous particles.
- Remote poses now populate the wheel-contact flags from received slip data and call the game's native `0x5F5730` effects routine for visible, unindexed cars while the local world is running.
- The previous hand-written nitrous flame/purge call has been removed; the native effect routine handles both tyre and nitrous effects from the car's received state.
- When a peer is paused or its interpolated pose is held, nitrous and wheel slip are cleared so an absent final network snapshot cannot leave smoke or nitrous effects stuck.
- Added `mp waitsmoke` as a test assertion and updated the paired `roam_mp_drift_a.txt` / `roam_mp_drift_b.txt` manual scenario to check that effects appear while drifting and stop after braking. This still needs a real two-client game-session run.

### Keyboard focus recovery and modifier repeats
- The browser may mark a modifier's first keydown as a repeat; the runtime now accepts that first Alt/Shift/Ctrl press rather than silently dropping it.
- Keys released by a focus/visibility/Meta transition are marked as still physically held; their next browser autorepeat re-presses them in the game, while a real keyup clears the marker.
- Escape remains intentionally released when the page leaves fullscreen, so the fullscreen shortcut cannot become stuck.
- Normal non-modifier repeats that begin without a held key are still ignored unless a focus-loss release recorded that key as held.

### Career car record recovery
- A profile may point the career at a car handle not represented in any of its ten garage slots (distinct from an empty extended slot).
- Once the prologue is complete, the profile-load repair now selects the first owned car instead, preventing the car lot from treating a missing career car as a valid trade candidate.
- The prologue/first-car path is preserved; this case only repairs an already-started career with an owned car.

### Mobile GPU compatibility
- The WebGPU adapter name is now retained for the current tab and included in mobile device-default selection.
- PowerVR B-Series phone adapters default to windowed mode because filling the screen can exhaust WebGPU memory; other adapters keep the existing fullscreen default.
- An explicit user setting remains higher priority than this device default.
- Added a regression test for B-Series detection and unaffected D-Series/Adreno phones.

### Photo Mode auto-turn
- Added a continuous camera yaw rate to the existing runtime photo camera and a backward-compatible PH_SPIN input event.
- Added an Auto turn slider to the current Photo Mode panel without changing its existing layout style. The centre tenth of the slider is a neutral dead zone; values outside it turn in either direction.
- Auto turn starts off every time Photo Mode opens. Reset, R, and controller X reset the camera and disable auto-turn; double-clicking the slider also stops it.
- Added a TypeScript range/dead-zone test and extended the Quick Race photo-mode script to cover clockwise/counter-clockwise turning, stop, and Reset. The live game script still needs execution.
- Added the upstream camera movement-speed control to the existing panel: a 0.1×–4× slider with 1× default, a double-click reset, and a backward-compatible `PH_SPEED` input event. The multiplier applies to keyboard and gamepad camera translation; Shift's existing 3× boost remains multiplicative.
- Added bounds/monotonicity tests for the speed scale and extended `tests/scripts/photo_mode.txt` to exercise 2× speed then restore 1×. The in-game scenario still needs a real run.
- Added the upstream Keep height option for the free camera using `PH_LEVEL`: forward movement follows the ground plane instead of the camera pitch; the option is disabled outside Free mode and defaults off on each Photo Mode visit. The existing panel style is retained and the Turkish label is translated.
- Extended `tests/scripts/photo_mode.txt` to exercise Keep height on/off while the free camera is active. The in-game scenario still needs a real run.

### Steam Controller and Steam Deck through WebHID
- Added the upstream WebHID reader for the 2015 Steam Controller (USB/dongle), 2026 Steam Controller and Steam Deck, including their button/axis maps, lizard-mode handoff and supported rumble behavior.
- PadPoller now sees browser gamepads and permitted Valve WebHID devices through one indexed allPads() list. Controller selection, family naming, controller detection and steering-wheel/pedal setup all use that combined list.
- Added a connect action and connection status beneath the existing controller-family selector, shown only where WebHID is available; the rest of the panel layout is unchanged.
- Allowed the page's own WebHID permission in the server Permissions-Policy. Other device APIs remain disabled.
- Added parser, mapping, connection lifecycle, focus/lizard-mode, dongle and rumble tests in web/test/steampad.test.mjs. Real controller hardware is not attached to CI, so pairing and rumble still need a browser/hardware check.

### Touch Reset safety at speed
- The native status block now publishes a hysteretic `fast` flag: it turns on above 30 km/h and turns off below 25 km/h. The thresholds avoid rapid show/hide flicker at the boundary.
- The existing Reset touch control is hidden with CSS `visibility`, preserving its exact layout slot rather than shifting the neighbouring controls.
- When speed stows Reset, any captured finger, pending tap timer and held `KeyR` are released immediately. Older/no-speed status blocks leave Reset visible.
- Added fake-page/fake-clock regression tests for the hide/restore transition, in-flight finger release, and missing-status compatibility. A real phone/game pass is still required.

### Saved-log anonymization performance
- Replaced per-name regular-expression alternations with a single-pass token scanner for ordinary names and an indexed scan for short/ambiguous names that must be surrounded by the log's known PRE/POST context.
- Kept the current privacy categories, player-word safeguards, IPv4/VLAN masking and stable per-browser aliases unchanged.
- Added regression cases for names with spaces, punctuation, Unicode/emoji, adjacent names and partial-word collisions, plus a 4,000-name / 160 KiB saved-log performance test.
- LastGameKeeper measures each saved-log copy and logs a warning once if one takes more than 50 ms.

## Not yet integrated / requires coordinated work

- **Friends UI/gameplay completion:** the authenticated `/friends` API, initial F9 panel, direct messaging, RoamHub buddy-priority links, room whereabouts and LAN page-mail notifications are integrated. The separate start-page Friends & crews tab, bumper-contact FriendPrompt, Join action and race/crew invitations remain.
- **Mods/Mod Packs:** built-in catalogue, Blitz rims, maker details, mod toggles, OEM stand-ins and the Shown/Original remote-car view need the runtime modpack module, manifests and save compatibility.
- **World map/minimap:** current TRPOLARIS map uses a 512-player snapshot. Upstream's 2,048-player live map deltas, smooth markers and car-meet markers/GPS require a coordinated C/TypeScript/Rust protocol change. Upstream uses message type 17 for MAPD while TRPOLARIS uses 17 for typed FreeRoam chat; do not reuse it without an explicit message-ID/version migration.
- **Multiplayer career credits:** requires race eligibility, friend/crew credit masks, career save/result accounting, lobby protocol and UI changes.
- **24,000-player capacity:** requires load testing and review of Rust hub memory, connection/stream limits, networking, container resources and deployment topology. Do not copy upstream limits blindly.
- **Vehicle show-off:** hood/trunk/door state, speakers/audio and remote animation need the upstream show-off runtime system adapted to the local FreeRoam implementation.
- **Photo Mode expansion:** camera paths, scene/picture options, lens effects, higher-resolution output and freeze-time still need a wider runtime/React integration. Auto-turn and movement-speed controls are already ported into the existing simpler TRPOLARIS panel; the remaining controls should be added incrementally without replacing its design.
- **Co-op/split-screen:** local 2–4 player support spans renderer, memory, controls, career and race systems; it is not a safe file-level copy.
- **Lobby/Quick Chat:** multi-lobby focus/grouping, stage eligibility, friend/crew invites and countdown messages remain to be ported with tests.
- **Vinyls/car parts:** Art Factory 28–34, hidden Special vinyls, car-specific filters, unique unlocks and Visual Reputation Remover need their manifests/runtime modules.
- **Other platform and game fixes:** independent USB pedals, further phone/browser fixes, synchronized weather, pause-menu save, save recovery, Last.fm/EA Trax, country RTT, and runtime collision/tire-smoke fixes remain under review.

## Validation status

- GitHub Actions are running for the draft PR. Check the PR's latest head before merging.
- No native/WASM build, Rust tests, browser suite, or live multiplayer game session has been run in this integration session.
- The PR remains a draft. `main` and production deployment are unchanged.
