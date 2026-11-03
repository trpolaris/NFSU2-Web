# Upstream Integration Ledger — 2026-11-03

This branch selectively ports compatible upstream changes from `th0mk/nfsu2-web` while keeping the TRPOLARIS application and React migration as the integration baseline.

## Integrated

### Right-stick look camera and Look Back
- Upstream commit: `77a2a70643d286369e252436f978c795a3005057`
- Added `runtime/look.c`.
- Ported the controller Look Back mapping into `runtime/dinput_pad.c`.
- Ported the end-of-frame camera restore hook into `runtime/career.c`.
- Connected the look camera to the existing camera setup wrapper in `runtime/overrides.c` without replacing the TRPOLARIS wrapper.
- Added `look` to the native/WASM source list in `link.sh`.
- Added upstream regression script `tests/scripts/pad_look.txt`.

### Free-roam curve extrapolation
- Upstream commit: `8ccb072a19d7036f49787662ce12af8dd61e8d03`
- Ported curve-aware extrapolation into `runtime/roam_core.c`.
- Ported its configuration declaration into `runtime/roam_core.h`.
- Ported the corresponding cases into `tests/roam_unit.c`.
- Kept the TRPOLARIS-specific `runtime/roam_game.c` unchanged. The new interpolation mode defaults to enabled in the core module.

## Deferred — conflicts or integration dependencies

- Fanatec steering-wheel/pedal support (`132d58b3bd83a4f68d30d3ec7852c440b2588a64`): patches do not apply cleanly to the current TRPOLARIS `wheel.ts`, `gamepad.ts`, and `wheel-setup.ts`. No partial wheel implementation or tests were committed.
- Multiplayer career credits (`0bc01cedb1768e26330e48caaaa77d67f4f08395`): the upstream feature spans race, save, and FreeRoam state. Core files including `mprace.c`, `roam.c`, and `roam_game.c` have material TRPOLARIS divergences. The feature was not partially applied.
- Worker-hosted network link (`181a6ab73dc5818b8392816087fa95a255783aeb`): the upstream worker protocol and telemetry expect a different network interface. Not enabled until the worker, clock handling, React service adapter, and offline cache can be ported together.
- Trunk audio rendering (`68128859237c2084afdac3a5cdab588b8ca493b7`): depends on the upstream show-off subsystem and FreeRoam hooks that are not present in the same form here. Deferred.

## Validation status

- Patch-context validation: passed for every integrated hunk.
- Automated compile, WASM build, browser regression, and multiplayer runtime tests: not run in this integration environment.
- The integration branch is intentionally separate from `main`. Do not merge until CI and runtime checks pass.
