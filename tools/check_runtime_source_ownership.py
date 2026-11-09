#!/usr/bin/env python3
"""Fail if web-only C sources are also listed in web/build.sh's RT list."""

from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
build = (root / "web" / "build.sh").read_text(encoding="utf-8")
rt_line = next((line for line in build.splitlines() if line.startswith('RT="')), None)
if rt_line is None or not rt_line.endswith('"'):
    raise SystemExit("web/build.sh: could not parse the RT source list")

rt_sources = set(rt_line[4:-1].split())
web_sources = {
    path.stem for path in (root / "runtime" / "web").glob("*.c")
}
duplicates = sorted(rt_sources.intersection(web_sources))
if duplicates:
    print("Runtime sources would be compiled twice (RT and WEB): " + ", ".join(duplicates), file=sys.stderr)
    raise SystemExit(1)

print(
    "Runtime source ownership OK: "
    + str(len(rt_sources))
    + " RT entries, "
    + str(len(web_sources))
    + " web entries, no duplicate basenames"
)
