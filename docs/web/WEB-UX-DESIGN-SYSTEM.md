# TRPOLARIS Web — Midnight Run Visual System

This document defines the redesigned player-facing experience. It applies to the website shell and its content surfaces only. The in-game renderer/HUD, WebAssembly runtime, Rust server, multiplayer protocol, game data and save formats remain outside the redesign.

## Visual direction

The new direction is **Midnight Run**: a premium, cinematic street-racing interface with a more deliberate information hierarchy.

- **Obsidian base:** `#080b12` with layered navy/graphite surfaces.
- **Signal coral:** `#ff6945` for primary actions, active states and key highlights.
- **Electric lavender:** `#a69aff` for secondary accents and ambient lighting.
- **Steel surfaces:** deep blue-grey panels with low-contrast borders, restrained blur and layered shadows.
- **Typography:** system-first sans serif for legibility, with condensed display styling for the hero headline.
- **Composition:** compact brand bar, vertical desktop navigation rail, cinematic vehicle stage, separate launch dock and compact status/action panels. At mobile widths the navigation becomes a horizontally scrollable bottom dock.

## Interaction and motion

- Motion design uses the browser's Web Animations API and CSS transition primitives for page transitions, entrance/reveal motion, hover/press feedback and progress activity. This keeps animation local and compatible with the server's self-only Content Security Policy.
- The hero atmosphere uses a small local canvas particle field with a capped device-pixel ratio and low particle count.
- The vehicle art is an inline vector illustration; no remote image dependency is required.
- A shared component-polish layer standardizes action buttons, segmented option groups, checkbox switches, fields, disclosure panels, profile rows, mod cards, keyboard keycaps and diagnostic tiles.
- CSS hover/press states add restrained depth and feedback to buttons, navigation and action cards.
- `prefers-reduced-motion`, Save-Data and low-core device checks suppress or reduce non-essential effects.
- Animations never carry information required to operate the game or understand status.

## Component model

The application remains framework-neutral TypeScript/HTML/CSS. Tailwind CSS v4 is retained as an optional utilities layer, imported without Preflight so the existing game controls are not reset. Semantic design tokens and accessible surface patterns follow shadcn/ui conventions: clear focus rings, readable contrast, consistent radii, explicit disabled states and restrained cards.

Native shadcn/ui React components are not introduced because the current player page is a DOM-based application; adding React would create a second UI runtime without improving the existing game shell.

## Icons and dependencies

- Navigation and action icons remain small local inline SVGs with Lucide-style outline geometry. No icon CDN is required.
- Tailwind CSS v4 continues to provide the build-time utility layer; the richer controls use scoped CSS primitives so no framework runtime is introduced.
- Motion effects use local Web Animations API and CSS transitions rather than a remote module.
- Ambient particles use a small local canvas implementation with low-power and reduced-motion guards rather than fetching tsParticles from a CDN.
- The production page therefore remains compatible with the current restrictive CSP (`script-src 'self'`, `style-src 'self'`, `font-src 'self'`).

## Guardrails

1. Preserve all runtime anchors and existing TypeScript event hooks used by the game modules.
2. Do not change gameplay, WASM, multiplayer wire protocol, Cloud API, passphrase handling or save storage.
3. Keep user-facing functional text in the existing translation pipeline.
4. Use only real server-provided values; do not fabricate online players or server metrics.
5. Respect reduced-motion, data-saving and low-power device preferences.
6. Keep the existing HTML controls, keyboard/gamepad behavior and accessibility hooks intact.
7. Keep the redesign scoped to the player-facing page; the in-game HUD and game canvas remain unchanged.
