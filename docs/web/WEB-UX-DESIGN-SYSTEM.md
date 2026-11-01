# TRPOLARIS Web UX Design System

This document defines the first visual foundation for the player-facing web application. It is intentionally separate from the in-game HUD, WebAssembly runtime, Rust server and save storage.

## Design direction

- **Night base:** `#050708`
- **Neon cyan:** `#00ffcc` for primary actions, focus rings and active navigation
- **Racing emerald:** `#10b981` for secondary emphasis and gradients
- **Panel base:** `#18181b` / `#09090b`
- **Glass surfaces:** translucent zinc panels with restrained backdrop blur and thin cyan borders
- **Typography:** Orbitron for short display labels; Rajdhani for the racing interface; readable system fallbacks for body text

## Component model

The player page remains a framework-neutral TypeScript/HTML application. The design tokens use shadcn/ui semantic names (background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input and ring), and the component styling follows the same accessible patterns: visible keyboard focus, clear disabled states, readable contrast, consistent radius and compact controls.

The shadcn/ui React components are not copied into the application. Doing so would introduce a second UI framework into the existing DOM-based game shell. If a future page is intentionally migrated to React, native shadcn/ui components can be evaluated for that isolated surface.

## Libraries

- **Tailwind CSS v4:** utility layer for new page-only layout helpers and design tokens. Its CLI version is pinned in the web build script; only utilities are imported, not Preflight, to avoid resetting the established game UI.
- **Motion for JavaScript:** optional DOM transitions for page changes. CSS remains the fallback and reduced-motion preferences disable motion.
- **tsParticles Slim:** optional low-density hero background, loaded only on the landing page. It is skipped for reduced-motion and data-saving/low-core devices.
- **Lucide:** the navigation's decorative icons are upgraded progressively; the existing inline SVGs remain the fallback when the library cannot be loaded.

All optional visual enhancements are non-blocking. The game can still be launched when a third-party visual module fails to load.

## Guardrails

1. Do not change game runtime, WASM, multiplayer wire protocol, Cloud API or save formats as part of a web-only redesign.
2. Keep all functional text in the existing translation pipeline.
3. Do not make particle effects or animation necessary to understand state or operate controls.
4. Respect `prefers-reduced-motion`, data-saving preferences and mobile GPU budgets.
5. Keep the existing accessible HTML controls and keyboard/gamepad behavior.
