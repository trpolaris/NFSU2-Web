# Upstream Integration Ledger — 2026-11-03

This branch selectively ports compatible changes from `th0mk/nfsu2-web` while keeping the TRPOLARIS application, React migration, Cloud services, and custom FreeRoam changes as the integration baseline.

## Integrated

### Invalid saved FreeRoam position guard
- Upstream commit: `0f17d0a736a08913888482a0bf0b4f8a25513a21` (partial, deliberately scoped).
- Ported the independent `runtime/carspot.c` guard, wired it into the main-loop hook in `runtime/roam.c`, and added it to `link.sh`.
- A non-finite or out-of-world Career saved position is replaced with the known career starting position before a later world load can restore the invalid coordinates.
- Added `tests/scripts/carspot_nan.txt` for the saved-position case.
- The same upstream commit's larger `roam_game.c` changes (rollback of invalid collision results and extra car rescue checks) are **not** included: they modify heavily customized TRPOLARIS FreeRoam contact/physics code and need a separate port review.

### Radio track completion and dual-reader synchronization
- Upstream commit: `fbe1cef92cd70369fab83fcfc811b70e0947980a`
- Ported the matching upstream changes to `runtime/radio.c`, `tests/radio_mixer_stub.h`, and `tests/radio_unit.c`.
- The two music readers now use one snapshot of the page's written/total counters per mixer step and receive silence after the track ends; neither reader reports end-of-stream independently.
- This avoids the game's mixer freeing one reader/voice while the other still consumes the shared song stream/decoder.
- Added regression coverage for readers ending together, including a page write occurring between the two reader calls. Tests have not been run in this integration session.

### Blocked game-script startup warning
- Upstream commit: `701f93585742474051a1514dbaa7f6db60454602`
- Added `web/src/boot.ts`, emitted as a standalone classic `/boot.js` and loaded before the module entry points.
- Shows a localized warning and Reload action when `/main.js` fails to load or does not start within 15 seconds.
- Added `web/src/app/started.ts`, imported first by the player entry point; a late start clears the warning and restores the original status text.
- Added build-time extraction of the required strings from all 15 available locale files. The warning uses the existing `nfsu2-page-language` preference and current hostname.
- Leaves the React UI, runtime loader, and existing startup flow in place.

### Right-stick look camera and Look Back
- Upstream commit: `77a2a70643d286369e252436f978c795a3005057`
- Added `runtime/look.c`.
- Ported the controller Look Back mapping into `runtime/dinput_pad.c`.
- Ported the end-of-frame camera restore hook into `runtime/career.c`.
- Connected the look camera to the existing TRPOLARIS camera setup wrapper in `runtime/overrides.c`; the local wrapper was not replaced.
- Added `look` to the native/WASM source list in `link.sh`.
- Added `tests/scripts/pad_look.txt`.

### Free-roam curve extrapolation
- Upstream commit: `8ccb072a19d7036f49787662ce12af8dd61e8d03`
- Ported curve-aware extrapolation into `runtime/roam_core.c`.
- Ported the configuration declaration into `runtime/roam_core.h`.
- Ported the corresponding unit-test cases into `tests/roam_unit.c`.
- Kept the TRPOLARIS-specific `runtime/roam_game.c` unchanged. The interpolation mode defaults to enabled in the core module.

### Older Safari storage compatibility
- Upstream commit: `02e8314b1f8c630f4c1c5dd9f0ff420acde617f6`
- Added a browser capability check in `web/src/app/checks.ts` for `FileSystemFileHandle.createWritable`, which the game needs when it writes save/configuration files.
- Added the Turkish explanation and matching translations to the available locale files (15 locale JSON files in this repository).
- Added `web/test/checks-storage.test.mjs` as a regression test.
- The warning is reported as `STORAGE-OLD`; it does not silently pretend that storage is usable.

### Fanatec wheel-base support — limited first port
- Upstream commit: `132d58b3bd83a4f68d30d3ec7852c440b2588a64`
- Added Fanatec model/axis/button mappings in `web/src/input/wheel.ts`, including known CSL DD, DD1/DD2, CSL Elite, ClubSport and selected older wheel identifiers.
- Added filtering for the duplicate all-zero HID collection that can appear alongside a Fanatec base in Windows.
- Updated `web/src/app/wheel-setup.ts` so calibration targets the actual Gamepad index, not just the shared device name.
- Updated `web/test/wheel.test.mjs` with Fanatec mapping coverage.
- This is intentionally a partial port: pedals connected through the wheel base are mapped; independent USB pedal sets and their multi-device learning workflow are deferred.

## Deferred — conflicts or integration dependencies

- Multiplayer career credits (`0bc01cedb1768e26330e48caaaa77d67f4f08395`): spans race, save, FreeRoam, lobby protocol, server and UI. Core files such as `mprace.c` and `roam_game.c` have substantial TRPOLARIS-specific differences. Not partially applied.
- Worker-hosted network link (`181a6ab73dc5818b8392816087fa95a255783aeb`): the worker protocol and telemetry expect a different network interface. Needs a coordinated port across the network link, clock handling, React service adapter, build entries and offline cache.
- Trunk/hood/door show-off and trunk audio (`68128859237c2084afdac3a5cdab588b8ca493b7`): depends on upstream show-off and FreeRoam hooks not present in the same form locally.
- Quick Chat countdown at car meets (`833d2274995a27cd20ed007b8898f975f38fbedc`): FreeRoam runtime, status transport, quick-chat UI and tests must move together; only part of the runtime patch matched.
- Lobby grouping/focus improvements (`85c39ac14279f64204745d31f6ff20bac53001f5`): local `roam_game.c` and lobby UI differ; not partially applied.
- Cloud-save re-prompt (`1e3ab1c1a1b03a6c296cd57e1645dcdfc435961a`): the upstream shell/playtime/vault UI was substantially rewritten by the React migration.
- Renderer Enhanced Contrast edge fix (`dc4354042ce0660bc1aa577464011f814e6af901`): several GPU/WGSL hunks conflict; deferred to avoid an unverified rendering-path change.
- Country-based network RTT display and the 14,000-player server/deployment changes: require a separate Rust/server and deployment capacity review. Server memory/CPU/Cloudflare topology must not be changed blindly.
- Separate USB pedals, car-meet capacity, weather sync, pause-menu save, photo-mode upgrades and other FreeRoam changes remain under review for their dependencies and compatibility.

## Validation status

- Integrated patches were checked against the current TRPOLARIS file contents before writing.
- Regression tests were added/updated, but the tests have **not** been run locally in this integration session, as requested.
- Native build, WASM build, TypeScript check, browser tests, Rust workspace tests, and multiplayer runtime tests remain pending.
- GitHub Actions may run automatically for the draft PR; its result must be checked before treating the branch as validated.
- The integration branch is intentionally separate from `main`. Do not merge until the full validation pass is completed.
