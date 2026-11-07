# Construction Tunnel — optional local asset overlay

This feature is **off by default**. It does not replace or modify the original game's `TRACKS` files and does not add EA game assets to this repository.

## Build the pack from your own game copy

Use the original PC game's `TRACKS` directory as input. The generator reads the city and drag layouts plus the free-roam route data, validates their chunk structure and navigation gates, and writes a new three-file overlay. It refuses to overwrite an existing output directory.

```bash
python3 tools/open_tunnel.py "/path/to/original/TRACKS" "/path/to/server/game/MODPACKS/open-tunnel/TRACKS"
```

The output contains `L4RA.BUN`, `STREAML4RA.BUN`, `ROUTESL4RA/PathsFreeRoam.bin` and `tunnel-patch.json` (input hashes and audit metadata).

The generator stages all files and publishes the output directory only after every write succeeds. If validation fails, fix the source inputs and choose a new empty output directory; the original game files remain unchanged.

## Enable it

Restart the TRPOLARIS server so the data manifest includes the new files. In the start-page Settings panel, open **Mods** and enable **Drive through the Construction Tunnel, including early in your career.** The equivalent setting is:

```ini
open_tunnel = on
```

Changes apply on the next Play. The server must contain all three generated files. Both the native resolver and browser I/O worker validate the complete set before selecting any overlay file; a missing file makes the entire feature fall back to the original map. Other `MODPACKS` entries remain separate.

All players who share this map in an online session should install the same complete pack and enable it. Different map layouts between clients are not a supported shared-race configuration. The feature can expose later regions earlier than the career progression normally allows.

## Real-game driving check

With an existing career save and the original PC game installed on the server, run:

```bash
node web/tools/roam-pair.mjs --page app --solo --a "Tunnel:tunnel_drive.txt" --seed "/path/to/career-save" --data "/path/to/original/game" --env NFSU2_OPEN_TUNNEL=1 --drive-route tests/scripts/tunnel-route.json
```

The scenario records trace positions, follows the route using keyboard inputs, checks that the north and south career gates were crossed, and saves screenshots at the approach, entry, middle and exit. The route driver does not write vehicle position, velocity, collision state or streaming state.

## Automated checks

CI covers the generator's Python syntax and synthetic chunk/patch invariants, native resolver selection (unset/off/invalid/on/incomplete), predownload/cache overlay selection, the trace-route helper, and web/runtime build checks. The real-game drive still requires the original game files and a seeded career save; CI does not claim that the live run has been performed.
