#!/usr/bin/env python3
from __future__ import annotations
import os
import re
import subprocess
import tempfile
from pathlib import Path

UPSTREAM_SHA = "9e0230212776f6c9a4d0db30c1963e9730138553"
BRANCH = "feat/remaining-runtime-features-2026-11"
REPORT = Path("docs/UPSTREAM-SYNC-2026-11-09.md")
SKIP_EXACT = {"README.md", "CHANGELOG.md", "AGENTS.md", "CLAUDE.md"}
SKIP_PREFIX = (".github/", "discord-bot/", "docs/screenshots/")

def run(args, check=True, text=False):
    return subprocess.run(args, check=check, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=text)

def git(*args, check=True, text=False):
    return run(["git", *args], check=check, text=text).stdout

def git_blob(commit, path):
    r = run(["git", "show", commit + ":" + path], check=False)
    return None if r.returncode else r.stdout

def git_mode(commit, path):
    r = run(["git", "ls-tree", commit, "--", path], check=False, text=True)
    if r.returncode or not r.stdout.strip():
        return 0o644
    mode = r.stdout.split(None, 1)[0]
    return 0o755 if mode == "100755" else 0o644

def allowed(path):
    return path not in SKIP_EXACT and not path.startswith(SKIP_PREFIX)

def write_file(path, data, mode):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(data)
    os.chmod(p, mode)

def parse_name_status(data):
    fields = data.split(b"\0")
    out, i = [], 0
    while i < len(fields) and fields[i]:
        status = fields[i].decode()
        i += 1
        path = fields[i].decode("utf-8", "surrogateescape")
        i += 1
        out.append((status, path))
    return out

def merge_text(path, ours, base, theirs):
    with tempfile.TemporaryDirectory(prefix="nfsu2-upstream-") as td:
        p = Path(td)
        po, pb, pt = p / "ours", p / "base", p / "theirs"
        po.write_bytes(ours)
        pb.write_bytes(base)
        pt.write_bytes(theirs)
        r = run([
            "git", "merge-file", "--ours", "-p",
            "-L", "TRPOLARIS", "-L", "upstream-base", "-L", "upstream-2026-11-09",
            str(po), str(pb), str(pt)
        ], check=False)
        if r.returncode > 1:
            return ours, False, False
        return r.stdout, r.returncode == 1, True

def main():
    branch = git("branch", "--show-current", text=True).strip()
    if branch != BRANCH:
        raise SystemExit("Wrong branch; refusing to modify " + branch)

    fetch = run(["git", "fetch", "--no-tags", "https://github.com/th0mk/nfsu2-web.git", "main"], check=True)
    upstream = git("rev-parse", "FETCH_HEAD", text=True).strip()
    if upstream != UPSTREAM_SHA:
        raise SystemExit("Upstream main changed: expected " + UPSTREAM_SHA + " got " + upstream)

    base = git("merge-base", "HEAD", UPSTREAM_SHA, text=True).strip()
    if not base:
        raise SystemExit("No common Git ancestor; refusing a blind copy")
    print("UPSTREAM_MERGE_BASE=" + base)

    changes = parse_name_status(git("diff", "--name-status", "-z", "--no-renames", base, UPSTREAM_SHA))
    added, merged, deleted, skipped, conflicts = [], [], [], [], []
    for status, path in changes:
        if not allowed(path):
            skipped.append(path)
            continue
        mode = git_mode(UPSTREAM_SHA, path)
        current = Path(path)
        base_data = git_blob(base, path)
        theirs = git_blob(UPSTREAM_SHA, path)

        if status == "A":
            if current.exists():
                skipped.append(path + " (existing TRPOLARIS file kept)")
            elif theirs is not None:
                write_file(path, theirs, mode)
                added.append(path)
            continue

        if status == "D":
            if current.exists() and base_data is not None and current.read_bytes() == base_data:
                current.unlink()
                deleted.append(path)
            else:
                skipped.append(path + " (fork version retained)")
            continue

        if status != "M" or not current.exists() or base_data is None or theirs is None:
            skipped.append(path + " (not a safe text merge)")
            continue

        ours = current.read_bytes()
        if ours == theirs:
            continue
        local_mode = current.stat().st_mode & 0o777
        if b"\0" in ours or b"\0" in base_data or b"\0" in theirs:
            if ours == base_data:
                write_file(path, theirs, mode)
                merged.append(path + " (binary, fork unchanged)")
            else:
                skipped.append(path + " (binary fork change retained)")
            continue
        try:
            ours.decode("utf-8")
            base_data.decode("utf-8")
            theirs.decode("utf-8")
        except UnicodeDecodeError:
            if ours == base_data:
                write_file(path, theirs, mode)
                merged.append(path + " (non-UTF8, fork unchanged)")
            else:
                skipped.append(path + " (non-UTF8 fork change retained)")
            continue

        result, had_conflict, ok = merge_text(path, ours, base_data, theirs)
        if not ok:
            skipped.append(path + " (merge tool error; fork retained)")
            continue
        if result != ours:
            write_file(path, result, local_mode)
            merged.append(path)
            if had_conflict:
                conflicts.append(path)

    # Keep existing TRPOLARIS CI definitions, but allow this workflow to dispatch
    # exact-HEAD validation after the import commit is pushed.
    workflow_paths = [
        ".github/workflows/multiplayer-ci.yml",
        ".github/workflows/wasm-runtime-duplicate-check.yml",
        ".github/workflows/image-rs.yml",
    ]
    for name in workflow_paths:
        p = Path(name)
        if not p.exists():
            skipped.append(name + " (not found for dispatch enablement)")
            continue
        content = p.read_text(encoding="utf-8")
        if re.search(r"(?m)^\\s*workflow_dispatch\\s*:", content):
            continue
        updated, n = re.subn(r"(?m)^on:\\s*\\n", "on:\\n  workflow_dispatch:\\n", content, count=1)
        if n:
            p.write_text(updated, encoding="utf-8")
        else:
            skipped.append(name + " (could not add workflow_dispatch safely)")

    # Ensure every Rust crate has canonical formatting after the merge.
    fmt = run(["cargo", "fmt", "--manifest-path", "web/server-rs/Cargo.toml", "--all"], check=False)
    if fmt.returncode:
        raise SystemExit(fmt.stderr.decode("utf-8", "replace"))

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    report = [
        "# Upstream sync report — 9 November 2026",
        "",
        "- Upstream: th0mk/nfsu2-web",
        "- Exact upstream commit: " + UPSTREAM_SHA,
        "- Actual Git merge base: " + base,
        "- Target branch: " + BRANCH,
        "- Policy: three-way merge; conflicting hunks keep the TRPOLARIS version.",
        "- Retained TRPOLARIS CI workflows; upstream workflow files and Discord bot were not imported.",
        "",
        "## Summary",
        "",
        "- New files imported: " + str(len(added)),
        "- Existing files merged: " + str(len(merged)),
        "- Files with overlapping hunks kept on TRPOLARIS side: " + str(len(conflicts)),
        "- Upstream deletions applied where the fork was unchanged: " + str(len(deleted)),
        "- Files skipped or retained unchanged: " + str(len(skipped)),
        "",
        "## New files",
        "",
    ]
    report += ["- " + p for p in added]
    report += ["", "## Merged files", ""]
    report += ["- " + p for p in merged]
    report += ["", "## Conflicting files (TRPOLARIS hunks retained)", ""]
    report += ["- " + p for p in conflicts]
    report += ["", "## Skipped files", ""]
    report += ["- " + p for p in skipped]
    REPORT.write_text("\\n".join(report) + "\\n", encoding="utf-8")

    # Remove the one-shot importer from the branch once it has run.
    for temp in [Path(".github/scripts/import_upstream.py"), Path(".github/workflows/upstream-import-once.yml")]:
        if temp.exists():
            temp.unlink()

    git("add", "-A")
    staged = git("diff", "--cached", "--name-only", text=True).strip()
    if not staged:
        raise SystemExit("No changed files to commit")
    git("config", "user.name", "github-actions[bot]")
    git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")
    git("commit", "-m", "sync: import compatible upstream changes through 2026-11-09")
    git("push", "origin", "HEAD:refs/heads/" + BRANCH)
    new_head = git("rev-parse", "HEAD", text=True).strip()
    print("UPSTREAM_SYNC_COMMIT=" + new_head)
    print("UPSTREAM_NEW_FILES=" + str(len(added)))
    print("UPSTREAM_MERGED_FILES=" + str(len(merged)))
    print("UPSTREAM_CONFLICTS_KEPT=" + str(len(conflicts)))
    print("UPSTREAM_SKIPPED_FILES=" + str(len(skipped)))

    # GITHUB_TOKEN pushes do not emit another push event. Explicitly dispatch
    # the repo's retained CI workflows against the new exact branch head.
    env = dict(os.environ)
    env["GH_TOKEN"] = os.environ["GITHUB_TOKEN"]
    dispatch = [
        "multiplayer-ci.yml",
        "wasm-runtime-duplicate-check.yml",
        "image-rs.yml",
    ]
    for workflow in dispatch:
        r = run(["gh", "workflow", "run", workflow, "--ref", BRANCH], check=False)
        print("DISPATCH_" + workflow + "=" + ("ok" if r.returncode == 0 else "failed: " + r.stderr.decode("utf-8", "replace")[:300]))

if __name__ == "__main__":
    main()
