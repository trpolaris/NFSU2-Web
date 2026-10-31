#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(pwd -P)"
fail() { local code="$1"; shift; echo "[GIT-UPDATE-ERROR][$code] $*" >&2; exit "$code"; }
git_safe() { git -c "safe.directory=$PROJECT_DIR" -C "$PROJECT_DIR" "$@"; }

[[ -d "$PROJECT_DIR/.git" || -f "$PROJECT_DIR/.git" ]] || fail 10 "Git metadata not found in $PROJECT_DIR"
command -v git >/dev/null 2>&1 || fail 11 "git executable not found in Ubuntu"

origin="$(git_safe config --local --get remote.origin.url 2>&1)" || fail 12 "Cannot read origin remote: $origin"
normalize_remote() {
  local v="${1,,}"
  v="${v#https://github.com/}"; v="${v#http://github.com/}"
  v="${v#ssh://git@github.com/}"; v="${v#git://github.com/}"
  v="${v#git@github.com:}"; v="${v#github.com:}"
  v="${v%.git}"; v="${v%/}"
  printf '%s' "$v"
}
remote_key="$(normalize_remote "$origin")"
[[ "$remote_key" == "trpolaris/nfsu2-web" ]] || fail 13 "Unexpected origin remote '$origin'"

branch="$(git_safe symbolic-ref --quiet --short HEAD 2>&1)" || fail 14 "HEAD is detached; checkout a branch before updating: $branch"
[[ -n "$branch" ]] || fail 14 "Current branch name is empty"
status="$(git_safe status --porcelain --untracked-files=all 2>&1)" || fail 15 "Git status failed: $status"
stash_ref=""
if [[ -n "$status" ]]; then
  echo "[GÜNCELLEME] Yerel değişiklikler Git stash içine güvenli şekilde alınıyor."
  before="$(git_safe rev-parse -q --verify refs/stash 2>/dev/null || true)"
  if ! git_safe stash push --include-untracked -m "TRPOLARIS-ControlCenter-update-$(date +%Y%m%d-%H%M%S)"; then
    fail 16 "Could not stash local changes; no pull was attempted."
  fi
  after="$(git_safe rev-parse -q --verify refs/stash 2>/dev/null || true)"
  if [[ -n "$after" && "$after" != "$before" ]]; then stash_ref="$(git_safe stash list -1 --format='%gd')"; fi
fi
restore_stash() {
  [[ -n "$stash_ref" ]] || return 0
  echo "[GÜNCELLEME] Yerel değişiklikler geri yükleniyor."
  if ! git_safe stash pop "$stash_ref"; then
    echo "[UYARI] Stash otomatik birleştirilemedi; yedek Git stash içinde korundu: $stash_ref" >&2
    return 1
  fi
  stash_ref=""
}

echo "[GÜNCELLEME] origin/$branch indiriliyor: $origin"
if git_safe fetch --prune origin "+refs/heads/$branch:refs/remotes/origin/$branch"; then
  :
else
  fetch_error=$?
  restore_stash || fail 33 "Fetch failed and local stash restore conflicted. Stash remains saved."
  fail 31 "git fetch failed (command exit $fetch_error). Check GitHub/network/credential output above."
fi
if git_safe merge --ff-only "refs/remotes/origin/$branch"; then
  :
else
  merge_error=$?
  restore_stash || fail 33 "Fast-forward merge failed and stash restore conflicted. Stash remains saved."
  fail 32 "Fast-forward update is not possible (command exit $merge_error). Local commits were not overwritten."
fi
restore_stash || fail 34 "Updated source, but local changes conflicted while restoring. Stash remains saved."
echo "[GÜNCELLEME] GitHub güncellemesi tamamlandı: branch=$branch commit=$(git_safe rev-parse --short HEAD)"
