# Construction Tunnel — optional local asset overlay

This feature is **off by default**. It does not replace or modify the original game's `TRACKS` files and does not add EA game assets to this repository.

## Build the pack from your own game copy

Use the original PC game's `TRACKS` directory as input. The generator reads the city and drag layouts plus the free-roam route data, validates their chunk structure and navigation gates, and writes a new three-file overlay. It refuses to overwrite an existing output directory.

```bash
python3 tools/open_tunnel.py "/path/to/original/TRACKS" "/path/to/server/game/MODPACKS/open-tunnel/TRACKS"
```

The output contains:
- `L4RA.BUN`
- `STREAML4RA.BUN`
- `ROUTESL4RA/PathsFreeRoam.bin`
- `tunnel-patch.json` (input hashes and patch audit metadata)

The generator stages all files and publishes the output directory only after every write succeeds. If validation fails, fix the source inputs and choose a new empty output directory; the original game files remain unchanged.

## Enable it

Restart the TRPOLARIS server so the data manifest includes the new files. In the start-page Settings panel, open **Mods** and enable **Drive through the Construction Tunnel, including early in your career.** The equivalent setting is:

```ini
open_tunnel = on
```

Changes apply on the next Play. The server must contain all three generated files. Both the native resolver and browser I/O worker validate the complete set before selecting any overlay file; a missing file makes the entire feature fall back to the original map. Other `MODPACKS` entries remain separate.

All players who share this map in an online session should install the same complete pack and enable it. Different map layouts between clients are not a supported shared-race configuration. The feature can expose later regions earlier than the career progression normally allows.

## Validation

The automated checks cover chunk parser and patch invariants, atomic output publication, resolver selection (unset/off/invalid/on/incomplete), cache predownload selection and TypeScript/native syntax. The real-game driving scenario is `tests/scripts/tunnel_drive.txt` and its route fixture is `tests/scripts/tunnel-route.json`; it requires an original game install, a generated pack and a seeded career save. This repository's CI does not claim that a real-game run has been performed.
