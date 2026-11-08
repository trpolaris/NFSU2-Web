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
- Added a Friends panel inside the existing F9 **Sürücü ağı** tab: incoming/outgoing requests, friend roster, Online/offline/Free Roam room status, name filter, add-by-name, remove/block, Discord username, direct message sending and waiting-message mailbox. The roster now renders 20 friends per page with previous/next controls; filtering resets to the first page and empty/short results hide the pager.
- Extended RoamHub with mutually accepted friend lists, first-priority links between friends, room labels and Free Roam whereabouts. The page syncs its current room and friend list when its LAN connection becomes ready; a friend who enters Free Roam later inherits the already-synced reciprocal link without another manual refresh.
- The hub uses one live player per claimed-name owner for friend-priority links, handles multiple open pages for the same owner, preserves the remaining page's links when one tab leaves, and suppresses stale vehicle positions in the Friends presence response. Rust integration tests cover multi-page cleanup, late arrivals, room labels and stale whereabouts.
- Added server-to-page friend-mail delivery through owner-scoped LAN peers, sent as WebSocket text notifications and displayed in the F9 mailbox. Queued messages are also read by the room-sync request; `HEAD` remains side-effect-free.
- The separate start-page Friends & Crews tab, bumper-contact FriendPrompt, Join action, and race/crew invitations have since been integrated in this branch.

### Keyboard and controllers
- Ported the learned Windows AltGr handling: on browsers which synthesize Left Ctrl before Right Alt/AltGraph, the synthetic Ctrl no longer triggers the game's Ctrl binding.
- Added modifier-code recovery when a browser omits KeyboardEvent.code.
- Added regression test coverage for AltGr.
- Ported known HID layouts for Xbox Bluetooth controllers in Firefox on macOS (LT/RT order) and the Zikway HID controller.
- Updated controller classification and HID-reader tests for Xbox and Zikway.

### Mobile touch
- Ported the iPhone/Safari two-finger garage-turn fix: either finger can arrive first, Safari's native pinch/pan is prevented while two fingers are on the game, stale cancelled gestures are cleared, and the middle-button drag is released cleanly.
- Added tests for both pointer arrival orders and a gesture cancelled without a final pointer event.

### WebKit/iPhone memory and cached reads
- On WebKit/iPhone, the page can hold a buffer-backed `GameMemory` wrapper instead of a live `WebAssembly.Memory` object. The I/O worker creates the shared memory, passes the Memory itself to game workers through MessagePorts, and sends the page a refreshed buffer when memory grows.
- OPFS cache reads can copy cached blocks directly into off-page game memory; the read path records direct cache hits and retains the fallback path when direct reads are unavailable.
- The GPU encoder checks that a render queue's base/capacity still fits the page's current buffer after memory growth, preventing stale queue reads.
- Unit/regression coverage is present in `web/test/memory.test.mjs`, `web/src/host/io-worker.ts` and GPU paths. Real iPhone Safari/WebKit device validation remains outstanding.

### Upstream gameplay and server ports — 7 November
- Ported the latest six-file name-filter update across runtime C, Rust normalization/cross-check/tests and browser JS/tests while preserving TRPOLARIS's Unicode and existing filter API.
- Ported the remote-car engine-texture list update so another player's open hood can load that car's engine texture. The two-client in-game visual check remains outstanding.
- Added optional server race bans: `NFSU2_CAR_BANS` accepts positive `kw` and/or `rating` thresholds; either threshold can trigger the existing two-week ban. Empty or malformed policy disables it. `NFSU2_BAN_WEBHOOK` optionally posts a Discord notice; the URL must remain secret.
- The LAN switch address pool is now 10.77.0.0/17 with up to 24,000 peer addresses. This is an admission/address ceiling; the Free Roam hub retains a separate 6,144-player ceiling and 24k real load capacity is not proven.
- The claims store hard cap is 5,000,000, with the 180-day hold retained. The cap itself has not been deployment-scale load tested.
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

### Hidden Races
- Added bounded race-table handling in `runtime/hiddenraces.c`: clear the hidden-race bit only for validated race-table entries and constrain the stage's event count to the supported maximum.
- The feature is opt-in through `NFSU2_SHOW_HIDDEN_RACES` and the existing `show_hidden_races` Game Settings / `settings.ini` option; it defaults off and does not rewrite career progress.
- Native table and browser-setting regression tests are included. Original-game marker/unlock behaviour still requires a seeded career session.

### Multiplayer Career Credits and profile persistence
- `runtime/roam_game.c` applies career-stage, event, URL, and already-won eligibility checks before advertising creditable races; it passes the credit flag and separate friend/crew masks into the existing lobby trip data.
- `runtime/mprace.c` evaluates the finished race and qualifying friend/crew result, calculates the credit margin and calls `mpcredit_win()`. The runtime applies the game's career win, prize, sponsor and movie flow rather than maintaining a second career progression model.
- Pending and applied-but-unsaved wins are kept beside the career profile in `MPWINS.DAT`; profile-load, profile-write and profile-delete hooks restore, retain or clean up the sidecar as appropriate.
- `mpcredit_store.c/.h` retains the existing v1 binary layout (magic, version, count, then race-hash/float pairs) for compatibility with previously written files. It replaces the file through a unique exclusive 0600 temporary file and atomic rename; the reader validates the entire file and rejects truncated, unsupported, over-capacity, trailing-data and non-finite-margin records without returning partial results.
- The in-memory pending/applied-but-unsaved queue has one combined 128-record cap, matching the sidecar capacity. Duplicate race hashes are refused across both queues; when full, a new career credit is rejected before the game's career win/prize/stage state is mutated. This prevents a win from being awarded but unable to fit in `MPWINS.DAT`.
- `tests/mpcredit_store_unit.c` covers the v1 layout, read/write round-trip, size limits, malformed records, NaN margins and preservation of a previous complete file after a rejected write.
- The test-only `mpcredit NAME[,NAME...] [MARGIN]` command is registered with `career_is_cmd()` and dispatched by `career_cmd()`. The optional `mpcreditpending` scenario writes a pending sidecar; `mpcreditrestore` starts a second run from the first run's save tree and checks that profile loading reads it.
- These game scenarios require original game files, a saved career tree and an available/unwon race name in `MP_RACE`; they have not been run in GitHub-hosted CI. Real two/three-player reward, friend/crew split and race-result verification remain open.
- The WebAssembly source manifest in `web/build.sh` includes both `hiddenraces` and `mpcredit_store`; the native macOS `link.sh` `CSRC` list was also corrected to include both sources. A native-manifest grep check is now part of Multiplayer CI so these objects cannot silently drop out of the native link.

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
- Separate USB pedal support: known Fanatec pedal IDs map to gas/brake; other non-standard devices can be learned through the existing Controller wheel calibration. Pedal-only controllers are excluded from primary-pad selection, their live axes feed the wheel's virtual triggers, and saved mappings fall back to the wheel's own pedals when the external device is unplugged.
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

### Name-claim store contention
- Ported the upstream hourly expiry-sweep throttle and a one-minute retry window while the name store is full.
- Name JSON serialization now snapshots live claims and changed-owner metadata under the read lock, then sorts and writes JSON after releasing it, so Online and Free Roam readers do not wait for string formatting.
- Current claim store hard cap is 5,000,000 with a 180-day hold. This is the implemented code limit; a 5M-record deployment has not been memory/disk/write-load tested.
- Successful Cloud Save reads (including ETag/304 and earlier-version reads) and writes now refresh the current claimed name through the existing one-hour activity throttle; failed, missing and conflicting operations do not.
- Added a Rust regression test for the sweep interval and for expired claims remaining logically free before physical cleanup.
### Unsaved-career quit warning
- The first in-game Quit game action asks for confirmation when the current session has not saved yet or its last save is at least 10 minutes old.
- The warning states the last save time/profile (or that this session has not saved) and explains how to save from the game's pause menu. Cancel leaves the running game open.
- A recent save keeps the original one-click quit behavior; the existing second-request and forced-close safeguards remain unchanged.

### Friends list pagination
- Added compact previous/next controls to the existing F9 Friends roster, showing 20 rows per page without changing the panel's card layout or styling.
- Filtering resets to page one; the visible page is clamped after a refresh shrinks the list; the pager is hidden for 20 or fewer matches.
- Added browser regression coverage for first/middle/last pages, filtering to one result, empty matches and page clamping after refresh.

### Live friend crew invites and room changes
- The Online Friends & Crews panel can invite a mutual friend who is currently in Free Roam to one of the sender's saved crews. The authenticated `POST /friends` operation enforces the shared invite budget, validates the crew and room names, and sends a LAN notification only to the recipient's open game pages.
- The recipient gets an in-game card with a Join action. Acceptance writes room, crew names and crew colours together through the existing settings validator, then updates the active game's crew hashes and the room mailbox.
- Crew invitations now have a four-entry in-session queue in the existing Crews dialog. The 20-second HUD card is only the immediate prompt; the invitation remains available for Join/Decline after it disappears. A full four-crew roster leaves the invitation pending until the player leaves a crew. Repeated invitations replace the older entry for that crew.
- Front-bumper FriendPrompt is integrated for active Free Roam: opposing front bumpers must touch for 3 seconds before the game emits `NET_KIND_FRIEND` (19). The authenticated `/friends` API classifies the contact using existing claimed-name and EA Messenger records; the prompt distinguishes a new friend, incoming request, pending request, existing friend, and unclaimed player. It only sends Add/Accept after an explicit click or safe F-key action.
- The room mailbox reuses bytes 436–503 of the existing 512-byte header: room generation at 436, sixteen little-endian UTF-8 words at 440–503. The page writes all name words before publishing the generation. The writer refuses old short mailboxes; names are capped at 63 UTF-8 bytes without splitting a character.
- The runtime applies a new room only while the player is actually driving in Free Roam; race, duel and multiplayer-lobby states defer the change. The C and TypeScript layouts are covered by a native compile check and browser unit tests.
- FriendPrompt also supports the configurable F key (default F). It checks the live `keys` status bit from `runtime/dinput_kbd.c` before handling it, respects `NFSU2_KEY_FRIEND=off` or a configured replacement, and leaves typing fields/modal dialogs alone. If the live key map is not readable yet, the shortcut fails closed. Delayed Join/Decline and bumper-contact prompts are integrated.

### GPS Distance HUD
- Ported upstream's GPS destination distance label beneath the game's native direction arrow. It reports straight-line distance (not road distance) in the current Speedometer Units, updates only when the text changes, and hides when GPS is inactive or a race is running.
- Added the gps_distance setting to the existing Game settings group and settings.ini template. It defaults off, is exposed through the current panel's existing More game settings section, and has a Turkish translation. No new page, mod catalogue or replacement UI was introduced.
- Added the runtime hook and package-owned HUD text cloning helper to both native and WebAssembly runtime object lists. The current fork does not include Split Screen/Co-op, so the port intentionally handles Player 1 only; Player 2–4 support must follow a future co-op integration.
- Added native C tests for unit formatting, HUD visibility, route state, race hiding, Player 1 filtering and disabled defaults, plus a browser test for the persisted setting. The FE label clone now uses bounded stack scratch for its hash, so enabling GPS Distance no longer forces initialization of Free Roam's optional 512 KB global heap just to create that label.

### Art Factory 28–34 vinyl packs

- Added native game-part support for seven Sha_Do Art Factory designs after Art Factory 27. The original GLOBALB chunk remains unchanged; the runtime gives the game a guarded copy with the seven new entries.
- Added `VPAK` overlay reads for each car's `VINYLS.BIN`, with base-file and pack-size checks. Without a valid `VINYLPACKS/` pack, the original game file is read unchanged.
- Added `tools/vinylpacks.py`, native/WASM build wiring, server manifest allow-listing and an install-folder audit entry.
- Source textures are not bundled. Generate `VINYLPACKS/` from a separately obtained compatible PC mod containing the Japanese-release designs with `python tools/vinylpacks.py "<game folder>" --shado "<mod folder>"`. See `docs/web/VINYLPACKS.md`.
- Validation script: `tests/scripts/vinylpacks_shop.txt`; real in-game shop validation still requires the game and generated assets.

## Not yet integrated / requires coordinated work

- **Friends UI/gameplay completion:** the authenticated `/friends` API, F9 panel, direct messaging, RoamHub buddy-priority links, room whereabouts, LAN page-mail notifications, 20-row pagination/filtering, start-page Friends & Crews tab, crew invitations, pending Join/Decline queue, click-to-send bumper-contact FriendPrompt, and safe configurable F shortcut are integrated.
- **Mods/Mod Packs:** the parser and builder exist, but the current runtime deliberately sets mod activation off and removed the old `ug2net_parts` / `others_mod_parts` UI settings. Rim shop integration is not currently a usable player feature; it must be re-enabled as a coordinated runtime/UI/save/test change.
- **World map/minimap and Car Meet (runtime ported; live-game validation pending):** Rust MAPREQ/MAPD supports legacy snapshot compatibility and slot-keyed deltas (MAPD=18; typed chat remains 17); NEARREQ=19/NEARD=20 uses the hub's spatial grid and load-aware pacing. The C core handles MAPD multipart assembly, NEARD slot deltas and room transitions. The native World Map consumes MAPD; the active game loop polls NEARD and draws Player-type minimap arrows for nearby hub players and friends without loaded cars, with stand-in records, cloned `AIRACERINDICATOR_0` icons, pool management, position extrapolation, duplicate suppression and HUD/icon-list rebuild handling. `NFSU2_ROAM_NEAR` defaults to 64 (0–96, 0 disables). `roam mp near [all]` reports arrow positions/distance/icon flags. Car Meet code tracks 25 m stationary tolerance over 60 seconds, clusters at least 24 parked players within 50 m, creates map star/label/item and GPS trigger, handles legend selection, and clears GPS within 40 m. `roam mp meet` reports marker/label/item/trigger state; `tests/scripts/roam_crowd_meet.txt` sets up 24 stationary simulated players and captures the map state. Native protocol tests cover NEARD snapshots/deltas/stale replies and room transitions. Real native/WASM game builds, marker visibility/orientation, legend hide/show, meet selection/GPS arrival and live two-client sessions still require manual game validation.
- **24,000-player deployment validation:** the LAN switch supports a 24,000-address `/17` pool and image/Compose peer ceiling; the Free Roam hub separately caps at 6,144. This is not a 24k active Free Roam performance claim. Profile connections, memory, file descriptors, proxy limits, network throughput and container sizing under staged load before promising or enabling a high player target.
### Quick Race options
- Ported upstream's isolated Quick Race option hooks without changing Career, split-screen, Online or LAN settings: laps now wrap through 1–127; non-Drag modes can select up to five opponents; Drag keeps its track-specific 3/2 limit; Lap KO no longer freezes lap/opponent controls and selects five laps plus the supported opponent count; one-lap races that count laps use the existing COMPLETED/progress HUD behavior.
- Added `runtime/quickrace.c`, hook dispatch from `runtime/debug.c`, native and WebAssembly source-manifest entries, a native C unit test covering wraparound, mode isolation, Drag limits, Lap KO and one-lap progress, and a browser/game input script at `tests/web/scripts/quickrace_options.txt`.
- The unit test is CI-covered. The interactive game script requires the user's original NFSU2 files and has not been run against them in hosted CI; verify the menus and a one-lap race locally.

- **Vehicle show-off:** hood/trunk/door state, speakers/audio and remote animation need the upstream show-off runtime system adapted to the local FreeRoam implementation.
- **Photo Mode expansion:** camera paths, scene/picture options, lens effects, higher-resolution output and freeze-time still need a wider runtime/React integration. Auto-turn and movement-speed controls are already ported into the existing simpler TRPOLARIS panel; the remaining controls should be added incrementally without replacing its design.
- **Co-op/split-screen:** local 2–4 player support spans renderer, memory, controls, career and race systems; it is not a safe file-level copy.
- **Lobby/Quick Chat:** multi-lobby focus/grouping, stage eligibility, friend/crew invites and countdown messages remain to be ported with tests.
- **Vinyls/car parts:** hidden Special vinyls, car-specific filters, unique unlocks and Visual Reputation Remover still need separate manifests/runtime modules.
- **Other platform and game fixes:** the upstream Xbox One S 2016 Bluetooth firmware (`045e:02e0`) Chrome/Android HID mapping is ported with dedicated tests. Remaining phone/browser fixes beyond the WebKit memory work, synchronized weather, pause-menu save, save recovery, Last.fm/EA Trax, country RTT, and remaining collision/effects changes remain under review.

## Validation status

- Code snapshot `7a8e163d59605d0eba623e3af613afbfbb70f727` on `integration/upstream-2026-11-06`; PR #21 remains open/Draft and targets `main`. Multiplayer/Regression CI [run 42504043771](https://github.com/trpolaris/NFSU2-Web/actions/runs/42504043771) has passed native runtime and manifest checks, Hidden Races/MPWINS/catchup unit tests, lifter ISA, test-runner syntax, TypeScript and web production build; Rust workspace tests are running and later validation steps have not completed. Exact-head `image-rs` [run 42504043758](https://github.com/trpolaris/NFSU2-Web/actions/runs/42504043758) succeeded. Native/WASM game builds and original-game multiplayer reward/save tests remain outstanding.
- The native ASan/UBSan protocol suite covers room transitions and NEARD full snapshots, delta updates/removals and stale-response rejection. The configured-peer room-reset fixture verifies endpoint preservation for re-handshake; the NEARD delta fixture sends the exact 11-byte payload required by one placed entry plus one removal.
- The NEARD-only minimap Player-icon/arrow renderer and Car Meet marker/legend/selection/GPS implementation are ported. `roam mp near` and `roam mp meet` expose runtime state. `roam_crowd_meet.txt` now uses `tests/fixtures/roam_meet_stationary.csv` to park 24 simulated players at (1780, -884), about 85 m from the career spawn; both crowd and host use `CarMeetTest`, so the GPS arrival radius can be exercised by driving. Real native/WASM builds, marker visibility/orientation, legend hide/show, GPS route selection/arrival and live two-client sessions still require manual game validation.
- The PR remains a draft. `main` and production deployment are unchanged.
