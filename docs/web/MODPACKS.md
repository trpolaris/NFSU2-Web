# Community Mod Packs

The repository contains an experimental `MODPACKS/` parser and a builder for community-added rim parts. The current
runtime deliberately disables mod rim shop activation: `g.on[]` is forced off, and the corresponding settings rows
were removed from the page. As a result, a successfully generated pack is **not currently a usable Body Shop feature**.
Do not treat the old `ug2net_parts` / `others_mod_parts` settings or the old rim regression scripts as supported
player-facing controls.

## Builder (experimental)

The current command line is:

```sh
python3 tools/modpacks.py "/path/to/Need for Speed Underground 2" \
  --mod "/path/to/extracted/mod" --brands BLITZ --out "/path/to/output"
```

`--mod` is required. The source folder must contain the PC mod's `1 - Mod Files` directory (or be that directory).
`--brands` defaults to `BLITZ`; `--out` is optional and defaults to the game folder. The builder validates the game
folder (`SPEED2.EXE`) and checks the source part database, brand, geometry and textures before writing pack files.

The builder currently focuses on the mod's new rim brands and their required assets. It does not copy removals or
replacements of original game parts. Original game files and third-party mod assets are not committed to this
repository; obtain compatible source assets separately and respect their licence.

## Runtime status

- `runtime/modpacks.c` parses and validates `MODPACKS/PARTS.BIN`.
- Rim shop entries are intentionally disabled at present, regardless of pack contents or `NFSU2_MOD_RIMS` in
  `settings.ini`; the current web settings page does not expose a mod-rim toggle.
- The former `ug2net_parts` and `others_mod_parts` controls are not present in the current settings registry.
- Do not rely on the old `MODPARTS.DAT` workflow as a supported end-user feature until the runtime and UI path are
  re-enabled and retested together.

## Verification

`tests/scripts/modpacks_*.txt` are historical integration scenarios, not proof that rim shopping is enabled on
this HEAD. A successful builder run or compile does not replace validation with a compatible game installation.
