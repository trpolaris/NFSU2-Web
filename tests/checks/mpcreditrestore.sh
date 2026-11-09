#!/bin/bash
# Verify that career profile loading read the existing MPWINS.DAT sidecar.
set -eu
LOG=${1:?usage: mpcredit_restore.sh <log.txt>}
RUN_DIR="$(cd "$(dirname "$LOG")" && pwd)"
SAVE="$RUN_DIR/save"
FILE="$(find "$SAVE" -type f -name MPWINS.DAT -print -quit 2>/dev/null || true)"
[ -n "$FILE" ] && [ -f "$FILE" ] || { echo "seeded MPWINS.DAT was not found in the run save overlay" >&2; exit 1; }
grep -aqF "MPWINS.DAT read:" "$LOG" || { echo "profile load did not report reading MPWINS.DAT" >&2; exit 1; }
MAGIC="$(dd if="$FILE" bs=1 count=4 2>/dev/null || true)"
[ "$MAGIC" = "N2MW" ] || { echo "restored MPWINS.DAT has invalid magic" >&2; exit 1; }
COUNT="$(od -An -tu4 -j8 -N4 "$FILE" 2>/dev/null | tr -d '[:space:]')"
case "$COUNT" in ''|*[!0-9]*) echo "restored MPWINS.DAT has invalid count" >&2; exit 1 ;; esac
[ "$COUNT" -ge 1 ] && [ "$COUNT" -le 128 ] || { echo "restored MPWINS.DAT count is outside bounds: $COUNT" >&2; exit 1; }
BYTES="$(wc -c < "$FILE" | tr -d '[:space:]')"
EXPECTED=$((12 + COUNT * 8))
[ "$BYTES" -eq "$EXPECTED" ] || { echo "restored MPWINS.DAT size mismatch: $BYTES != $EXPECTED" >&2; exit 1; }
echo "MPWINS.DAT reload verified: $COUNT entry/entries, $BYTES bytes"
