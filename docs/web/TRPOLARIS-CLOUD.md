# TRPOLARIS Cloud

TRPOLARIS Cloud is the branded cloud-save service used by NFSU2 Web. It keeps the existing account-free, passphrase-based workflow: a player creates or enters an eight-word passphrase, and the browser encrypts save data before it leaves the device.

## Current protocol

New clients use:

- `GET /cloud/v1/saves` — read the current encrypted snapshot.
- `GET /cloud/v1/saves?earlier` — read the previous-day recovery snapshot.
- `PUT /cloud/v1/saves` — create or update a snapshot using `If-None-Match: *` or `If-Match: <etag>`.
- `DELETE /cloud/v1/saves` — delete the snapshots associated with that passphrase.

The bearer token is derived from the passphrase and sent in the Authorization header, never in the URL. The browser derives the AES-GCM encryption key locally and sends only the encrypted archive. The server indexes the record by a hash of the token; it does not receive the passphrase or encryption key.

The response's ETag is the current revision. TRPOLARIS Cloud metadata is returned in `x-trpolaris-cloud-saved` and `x-trpolaris-cloud-earlier`. Updates use conditional writes so two browsers cannot silently overwrite one another.

## Backward compatibility and existing saves

The old `/vault` endpoint remains enabled as a compatibility route. Both API paths use the same records and the same state volume. Older clients can continue to read and write existing passphrases while new clients use `/cloud/v1/saves`. Responses include the old `x-vault-*` headers as well as the new TRPOLARIS Cloud headers.

**No data-directory migration is performed in this version.** Existing records under the server's `state/vault` directory remain in place. Do not delete or rename that directory, and do not remove the persistent Docker state volume. This is what lets the API transition happen without invalidating already-linked browsers.

## What is retained from the inherited implementation

The passphrase-based encryption, synchronization/conflict handling, and `nfsu2-vault` storage engine are derived from the MIT-licensed [th0mk/nfsu2-web](https://github.com/th0mk/nfsu2-web) implementation. TRPOLARIS owns the new product identity, versioned API surface, integration and future extensions, but does not erase the upstream authorship of the inherited components. The repository's MIT license and attribution remain in place.

The storage engine and operational limits are intentionally retained in this first compatibility phase. Replacing the on-disk engine or introducing accounts would require a separate migration design and must preserve the current passphrases and encrypted snapshots. No account, email or password-reset service is introduced by this API change.

## Operational notes

- Cloud saves are disabled when the server is started with `--vault-gb 0`; otherwise the existing `NFSU2_VAULT_GB` storage budget applies.
- Each encrypted snapshot is limited to 256 KiB.
- The server retains the latest snapshot and a copy from an earlier UTC day.
- A passphrase unused for two years is removed by the existing daily sweep.
- The existing per-client rate limits, disk-free checks and global write budget still apply.
- Cloud save data is stored in the server's persistent state volume. Do not use `docker compose down -v` when you intend to preserve player data.

## WSL development

The service runs in the same WSL Docker Compose environment as the game server. The cloud endpoint is part of the Rust server image; there is no external VPS dependency. A local update should rebuild the server image from the main repository worktree and recreate only the `server` service, preserving the configured state volume.
