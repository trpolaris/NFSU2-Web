# Community Mod Packs

The repository contains an experimental `MODPACKS/` parser and a builder for community-added rim parts. Rim brands are
now available as an **explicit opt-in** feature. They remain off by default, and a pack is only used when the game has
a compatible `MODPACKS/PARTS.BIN` and the player's `mod_rims` setting is enabled.

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

## Enable in the game

1. Build or install a compatible pack in the game's data folder so that `MODPACKS/PARTS.BIN` is present.
2. Open the start page's **Settings → Mods → More mod settings** and turn on **Enable mod rim brands** (or set
   `mod_rims = on` in `settings.ini`).
3. Press **Play** again. The setting is passed as `NFSU2_MOD_RIMS=1`; each pack's declared environment key controls
   whether its brands appear in the rim shop.
4. Turn the setting off to hide mod brands from the shop. Parts already stored on a car are preserved; the setting
   does not delete a saved mod part.

The toggle is deliberately off by default. Enabling it without a valid pack does not add shop entries. Back up the
profile before buying or saving mod parts. The feature remains experimental until it has been tested in the original
game with the exact mod assets and save files being used.

## Runtime status

- `runtime/modpacks.c` parses and validates `MODPACKS/PARTS.BIN`.
- Each pack is gated by its own environment key; the browser setting writes `1` or `0` for `NFSU2_MOD_RIMS`.
- The old `ug2net_parts` and `others_mod_parts` settings are not supported and are not restored.
- `MODPARTS.DAT` keeps mod-specific parts separate from original profile data. Keep backups when experimenting;
  saves that contain mod parts still require the matching pack for those parts to render as intended.

## Verification

`tests/scripts/modpacks_*.txt` describe manual integration scenarios for the original game. CI checks the opt-in
configuration and setting path, but a successful compile or builder run does not replace Body Shop, purchase, save,
reload and two-client validation with a compatible game installation.
