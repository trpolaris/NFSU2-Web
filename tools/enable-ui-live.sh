#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE="compose.local.yml"
ENV_FILE=".env.local"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker CLI was not found in this WSL shell. Start Docker Desktop and enable Ubuntu integration." >&2
  exit 2
fi

# Some installs use Docker Desktop's socket as the current user; others use sudo docker.
DOCKER=(docker)
if ! docker info >/dev/null 2>&1; then
  if command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1; then
    DOCKER=(sudo docker)
  else
    echo "ERROR: Docker is not reachable. Start Docker Desktop and verify WSL integration." >&2
    exit 4
  fi
fi
if [[ ! -f "$COMPOSE" ]]; then
  echo "ERROR: $ROOT/$COMPOSE was not found. Run this from the installed WSL project that contains compose.local.yml." >&2
  exit 2
fi
if [[ ! -d "web/dist" ]]; then
  echo "ERROR: web/dist is missing. Run 'cd web && npm ci && npm run build' first." >&2
  exit 2
fi

BACKUP="${COMPOSE}.before-ui-live.$(date +%Y%m%d-%H%M%S)"
cp -p "$COMPOSE" "$BACKUP"

if ! python3 - "$COMPOSE" <<'PY'
from pathlib import Path
import re, sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
lines = text.splitlines(keepends=True)
server_start = next((i for i, line in enumerate(lines) if re.match(r"^  server:\s*(?:#.*)?$", line)), None)
if server_start is None:
    print("ERROR: could not find services.server in compose.local.yml", file=sys.stderr)
    raise SystemExit(2)

server_end = len(lines)
for i in range(server_start + 1, len(lines)):
    if re.match(r"^(?:  [A-Za-z0-9_-]+:|[A-Za-z][A-Za-z0-9_-]*:)\s*(?:#.*)?$", lines[i]):
        server_end = i
        break

server_block = "".join(lines[server_start:server_end])
mount = "./web/dist:/app/web/dist:ro"
if "/app/web/dist" in server_block:
    print("Live UI mount is already present in the server service.")
    raise SystemExit(0)

volumes_index = next(
    (i for i in range(server_start + 1, server_end)
     if re.match(r"^    volumes:\s*(?:#.*)?$", lines[i])),
    None
)
if volumes_index is not None:
    lines.insert(volumes_index + 1, f"      - {mount}\n")
else:
    # A service without other volumes can still receive a new block at the end
    # of the server service, before the next service/top-level key.
    lines[server_end:server_end] = ["    volumes:\n", f"      - {mount}\n"]

path.write_text("".join(lines), encoding="utf-8")
print("Added read-only live mount: ./web/dist -> /app/web/dist")
PY
then
  echo "ERROR: compose.local.yml was not changed. Backup: $BACKUP" >&2
  exit 2
fi

if ! "${DOCKER[@]}" compose --env-file "$ENV_FILE" -f "$COMPOSE" config -q; then
  cp -p "$BACKUP" "$COMPOSE"
  echo "ERROR: Compose validation failed; original file restored from $BACKUP" >&2
  exit 3
fi

"${DOCKER[@]}" compose --env-file "$ENV_FILE" -f "$COMPOSE" up -d --force-recreate server

echo
echo "Live UI mount is active. No Docker image rebuild was performed."
echo "For future interface changes, run: (cd web && npm run build)"
echo "Backup: $BACKUP"
