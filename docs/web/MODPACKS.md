# Community Mod Packs

The runtime loads `MODPACKS/` from the game-data directory. The pack is shared by every client so a remote car can use the same community-added parts. A setting controls whether a mod's parts are offered in the local shop; it does not remove parts already fitted to a car.

## Build the first pack

1. Obtain the compatible **underground2.net** mod separately from its author and extract it. The builder expects the folder containing `1 - Mod Files`, or that folder itself.
2. Run the builder from the repository root:

```sh
python3 tools/modpacks.py "/path/to/Need for Speed Underground 2" \
  --ug2net "/path/to/extracted/underground2.net"
```

The default output is the game folder's `MODPACKS/` directory. To stage the generated data elsewhere, add `--out "/path/to/output"`. The default brand set is `BLITZ`; `--brands` can select additional brands supported by the source mod.

The builder includes only the new parts and the files they add. It does not copy the mod's removals or replacements of original game parts. Original game files and third-party mod assets are not committed to this repository.

## Settings

- `ug2net_parts = off` by default. Set it to `on` to offer Blitz rims in the Body Shop. Rims already fitted remain available when the shop switch is off.
- `others_mod_parts = shown` (default) displays mod parts on other players' cars. `original` substitutes compatible stock stand-ins. Your own car is not changed by this option.

The original profile continues to store stock parts. Added parts are stored in `MODPARTS.DAT` beside the profile, allowing the original game or a client without the pack to load the profile with its stock parts. Keep this sidecar with its matching profile when backing up or moving saves.

## Verification

The runtime regression scenarios are in `tests/scripts/modpacks_*.txt`:

- `modpacks_boot.txt`: game startup and pack discovery
- `modpacks_rims.txt`: Body Shop brand and rim availability
- `modpacks_rims_roam.txt`: remote-car rendering across clients with different shop settings
- `modpacks_rims_save.txt`: save/load compatibility without the pack

A successful compile or automated scenario does not replace testing with the generated pack and a compatible game installation.
