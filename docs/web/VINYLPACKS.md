# Art Factory 28–34 vinyl packs

This branch includes the runtime and pack generator for the Japanese-release Sha_Do Art Factory vinyls 28–34. The seven designs are added after Art Factory 27 as native vinyl parts. No Mods-tab switch is required.

## Required source assets

The source textures are **not included** in this repository. The game data files are also not redistributed. The pack generator expects:

- A valid Need for Speed Underground 2 PC installation folder containing `SPEED2.EXE` and `CARS/<car>/VINYLS.BIN`.
- A separately obtained PC mod folder containing `CARS/<car>/VINYLS.BIN` with the seven Japanese-release Sha_Do designs and their masks.

Use only source assets you are entitled to use. The generator copies only the seven added vinyls and their masks; it does not install the source mod as a whole.

## Generate the server-side data

From the repository root:

```bash
python tools/vinylpacks.py "/path/to/Need for Speed Underground 2" --shado "/path/to/vinyl-source"
```

The generated files are written to:

```text
<Game folder>/VINYLPACKS/CARS/<car>/VINYLS.BIN
```

You can test a single car first with `--cars 350Z`, and adjust parallel workers with `--jobs 4`. The generator verifies the packed texture data by reading the generated JDLZ and TPK structures back before writing each pack.

For a web-hosted game, keep the generated `VINYLPACKS/` folder beside the ordinary game folders in the install/data directory before starting the server. The server's data manifest now explicitly permits and serves this folder. Do not add it to the save overlay.

## Runtime behavior and verification

The runtime applies a pack only when its header is valid and the base `CARS/<car>/VINYLS.BIN` size matches the installed game file. A missing, stale, or invalid pack is ignored and the original file remains active. The runtime combines the pack's replacement header, the original file's unchanged data region, and the pack's added texture tail on reads; the original game file is never rewritten.

A manual shop test script is provided at `tests/scripts/vinylpacks_shop.txt`. It requires a generated pack, a working game installation, and the project's local game-test harness. A successful compile or manifest test alone does not prove the vinyls render correctly in-game.
