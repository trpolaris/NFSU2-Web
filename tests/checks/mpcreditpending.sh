#!/bin/bash
# Verify that mpcredit_pending.txt left a structurally valid MPWINS.DAT in the
# per-run save overlay, rather than only logging a queued in-memory test win.
set -eu
LOG=${1:?usage: mpcredit_pending.sh <log.txt>}
RUN_DIR="$(cd "$(dirname "$LOG")" && pwd)"
SAVE="$RUN_DIR/save"
FILE="$(find "$SAVE" -type f -name MPWINS.DAT -print -quit 2>/dev/null || true)"
[ -n "$FILE" ] && [ -f "$FILE" ] || { echo "MPWINS.DAT was not created" >&2; exit 1; }
MAGIC="$(dd if="$FILE" bs=1 count=4 2>/dev/null || true)"
[ "$MAGIC" = "N2MW" ] || { echo "MPWINS.DAT has an invalid magic header" >&2; exit 1; }
COUNT="$(od -An -tu4 -j8 -N4 "$FILE" 2>/dev/null | tr -d '[:space:]')"
case "$COUNT" in ''|*[!0-9]*) echo "MPWINS.DAT has an invalid entry count" >&2; exit 1 ;; esac
[ "$COUNT" -ge 1 ] && [ "$COUNT" -le 64 ] || { echo "unexpected MPWINS.DAT entry count: $COUNT" >&2; exit 1; }
BYTES="$(wc -c < "$FILE" | tr -d '[:space:]')"
EXPECTED=$((12 + COUNT * 8))
[ "$BYTES" -eq "$EXPECTED" ] || { echo "MPWINS.DAT size mismatch: $BYTES != $EXPECTED" >&2; exit 1; }
grep -aqF "MPWINS.DAT written atomically" "$LOG" || { echo "atomic MPWINS.DAT write was not logged" >&2; exit 1; }
TMP="$(find "$SAVE" -type f -name 'MPWINS.DAT.tmp.*' -print -quit 2>/dev/null || true)"
[ -z "$TMP" ] || { echo "MPWINS.DAT temporary file was left behind: $TMP" >&2; exit 1; }
echo "MPWINS.DAT sidecar verified: $COUNT entry/entries, $BYTES bytes"
