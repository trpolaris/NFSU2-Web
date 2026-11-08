#include "mpcredit_store.h"

#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#define TEST_MAGIC 0x574d324eu
#define TEST_VERSION 1u

static void raw_write(const char *path, const void *data, size_t length){
    FILE *f = fopen(path, "wb");
    assert(f);
    assert(fwrite(data, 1, length, f) == length);
    assert(fclose(f) == 0);
}

static void expect_invalid(const char *path, const void *data, size_t length){
    MpCreditStoreEntry out[2] = { { 0xaaaaaaaau, 8.f }, { 0xbbbbbbbbu, 9.f } };
    size_t count = 99;
    raw_write(path, data, length);
    assert(mpcredit_store_read(path, out, 2, &count) == MPCREDIT_STORE_INVALID);
    assert(count == 0);
    assert(out[0].race_hash == 0xaaaaaaaau && out[0].margin == 8.f);
}

int main(void){
    char dir[] = "/tmp/nfsu2-mpcredit-store-XXXXXX";
    assert(mkdtemp(dir));
    char path[512];
    assert(snprintf(path, sizeof path, "%s/MPWINS.DAT", dir) > 0);

    MpCreditStoreEntry entries[2] = {
        { 0x12345678u, 12.5f },
        { 0x87654321u, -1.f }
    };
    MpCreditStoreEntry out[2] = { { 0, 0.f }, { 0, 0.f } };
    size_t count = 0;
    assert(mpcredit_store_read(path, out, 2, &count) == MPCREDIT_STORE_MISSING);
    assert(count == 0);

    assert(mpcredit_store_write(path, entries, 2));
    assert(mpcredit_store_read(path, out, 2, &count) == MPCREDIT_STORE_OK);
    assert(count == 2);
    for (size_t i = 0; i < 2; i++){
        assert(out[i].race_hash == entries[i].race_hash);
        assert(out[i].margin == entries[i].margin);
    }
    assert(mpcredit_store_read(path, out, 1, &count) == MPCREDIT_STORE_INVALID);
    assert(count == 0);

    MpCreditStoreEntry too_many[MPCREDIT_STORE_MAX_ENTRIES + 1u];
    memset(too_many, 0, sizeof too_many);
    assert(!mpcredit_store_write(path, too_many, MPCREDIT_STORE_MAX_ENTRIES + 1u));
    assert(mpcredit_store_read(path, out, 2, &count) == MPCREDIT_STORE_OK && count == 2);

    uint32_t header[3] = { TEST_MAGIC, TEST_VERSION, 1u };
    uint32_t row[2] = { 0x12345678u, 0 };
    memcpy(&row[1], &entries[0].margin, sizeof row[1]);
    unsigned char bytes[sizeof header + sizeof row + 1u];
    memcpy(bytes, header, sizeof header);
    memcpy(bytes + sizeof header, row, sizeof row);
    bytes[sizeof header + sizeof row] = 0x5au;
    expect_invalid(path, bytes, sizeof header - 4u);             /* truncated header */
    header[0] ^= 1u;
    expect_invalid(path, header, sizeof header);                 /* bad magic */
    header[0] = TEST_MAGIC; header[1] = TEST_VERSION + 1u;
    expect_invalid(path, header, sizeof header);                 /* unknown version */
    header[1] = TEST_VERSION; header[2] = MPCREDIT_STORE_MAX_ENTRIES + 1u;
    expect_invalid(path, header, sizeof header);                 /* unreasonable count */
    header[2] = 1u;
    memcpy(bytes, header, sizeof header);
    memcpy(bytes + sizeof header, row, sizeof row);
    expect_invalid(path, bytes, sizeof header + sizeof row - 2u); /* truncated entry */
    expect_invalid(path, bytes, sizeof header + sizeof row + 1u); /* trailing bytes */

    uint32_t nan_row[2] = { 0x12345678u, 0x7fc00000u };
    memcpy(bytes, header, sizeof header);
    memcpy(bytes + sizeof header, nan_row, sizeof nan_row);
    expect_invalid(path, bytes, sizeof header + sizeof nan_row);   /* non-finite margin */

    /* A rejected replacement must leave the last complete file intact. */
    uint32_t nan_bits = 0x7fc00000u;
    float nan_margin;
    memcpy(&nan_margin, &nan_bits, sizeof nan_margin);
    MpCreditStoreEntry bad = { 0x12345678u, nan_margin };
    assert(!mpcredit_store_write(path, &bad, 1));
    assert(mpcredit_store_write(path, entries, 2));
    assert(mpcredit_store_read(path, out, 2, &count) == MPCREDIT_STORE_OK && count == 2);
    assert(mpcredit_store_write(path, 0, 0));
    assert(mpcredit_store_read(path, out, 2, &count) == MPCREDIT_STORE_MISSING);
    assert(count == 0);

    assert(rmdir(dir) == 0);
    puts("mpcredit store tests: all passed");
    return 0;
}
