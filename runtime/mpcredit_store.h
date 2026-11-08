#ifndef MPCREDIT_STORE_H
#define MPCREDIT_STORE_H

#include <stddef.h>
#include <stdint.h>

#define MPCREDIT_STORE_MAX_ENTRIES 64u

typedef struct {
    uint32_t race_hash;
    float margin;
} MpCreditStoreEntry;

enum {
    MPCREDIT_STORE_IO_ERROR = -2,
    MPCREDIT_STORE_INVALID = -1,
    MPCREDIT_STORE_MISSING = 0,
    MPCREDIT_STORE_OK = 1
};

/* Read the complete versioned MPWINS.DAT file. Invalid or truncated files
 * never expose a partial list; out_count is zero unless the read succeeds. */
int mpcredit_store_read(const char *path, MpCreditStoreEntry *entries,
                        size_t capacity, size_t *out_count);

/* Replace the sidecar atomically through a unique sibling temporary file.
 * An empty list removes the sidecar. Returns 1 only after the operation lands. */
int mpcredit_store_write(const char *path, const MpCreditStoreEntry *entries,
                         size_t count);

#endif
