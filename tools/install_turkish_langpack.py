#!/usr/bin/env python3
"""Install this project's bundled NFSU2 Turkish language pack into a game-data folder.

Usage: python tools/install_turkish_langpack.py "C:/Games/Need for Speed Underground 2"
The source game files are never modified; only LANGPACKS/turkish is created/updated.
"""
from __future__ import annotations
import argparse
import shutil
import sys
from pathlib import Path

FILES = (
    Path("LANGUAGES/English.bin"),
    Path("LANGUAGES/LanguageTextures.bin"),
    Path("GLOBAL/GLOBALA.BUN"),
)

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("game_folder", type=Path, help="original NFSU2 game-data root, containing LANGUAGES/")
    args = parser.parse_args()
    game = args.game_folder.expanduser().resolve()
    source = Path(__file__).resolve().parents[1] / "LANGPACKS" / "turkish"
    if not game.is_dir():
        print(f"Game-data folder does not exist: {game}", file=sys.stderr); return 2
    if not (game / "LANGUAGES").is_dir():
        print(f"No LANGUAGES/ folder found under {game}; pass the game's data root, not the project folder.", file=sys.stderr); return 2
    missing = [str(rel) for rel in FILES if not (source / rel).is_file()]
    if missing:
        print("The bundled Turkish pack is incomplete: " + ", ".join(missing), file=sys.stderr); return 2
    installed = game / "LANGPACKS" / "turkish"
    for rel in FILES:
        src, dst = source / rel, installed / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        print(f"Installed {dst.relative_to(game).as_posix()} ({dst.stat().st_size:,} bytes)")
    print("Turkish game data installed. Rebuild/redeploy the app and runtime containing Turkish language support.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
