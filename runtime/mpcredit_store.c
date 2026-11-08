#include "mpcredit_store.h"

#include <errno.h>
#include <fcntl.h>
#include <float.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

#define MPCREDIT_STORE_MAGIC 0x574d324eu /* "N2MW" */
#define MPCREDIT_STORE_VERSION 1u
#define MPCREDIT_STORE_TEMP_PATH 1400u

_Static_assert(sizeof(float) == sizeof(uint32_t), "MPWINS.DAT requires 32-bit floats");

static int finite_margin(float value){
    return value == value && value <= FLT_MAX && value >= -FLT_MAX;
}

static int write_all(int fd, const void *data, size_t length){
    const unsigned char *p = (const unsigned char *)data;
    while (length){
        ssize_t n = write(fd, p, length);
        if (n < 0 && errno == EINTR) continue;
        if (n <= 0) return 0;
        p += (size_t)n;
        length -= (size_t)n;
    }
    return 1;
}

static int open_temp(const char *path, char *temp, size_t temp_size){
    static uint32_t sequence;
    for (unsigned attempt = 0; attempt < 128u; attempt++){
        uint32_t id = ++sequence;
        int n = snprintf(temp, temp_size, "%s.tmp.%ld.%08x",
                         path, (long)getpid(), id);
        if (n < 0 || (size_t)n >= temp_size){ errno = ENAMETOOLONG; return -1; }
        int fd = open(temp, O_WRONLY | O_CREAT | O_EXCL, 0600);
        if (fd >= 0) return fd;
        if (errno != EEXIST) return -1;
    }
    errno = EEXIST;
    return -1;
}

int mpcredit_store_write(const char *path, const MpCreditStoreEntry *entries,
                         size_t count){
    if (!path || !path[0] || count > MPCREDIT_STORE_MAX_ENTRIES ||
        (count && !entries)) return 0;
    for (size_t i = 0; i < count; i++)
        if (!finite_margin(entries[i].margin)) return 0;

    if (!count) return unlink(path) == 0 || errno == ENOENT;

    char temp[MPCREDIT_STORE_TEMP_PATH];
    int fd = open_temp(path, temp, sizeof temp);
    if (fd < 0) return 0;

    uint32_t header[3] = { MPCREDIT_STORE_MAGIC, MPCREDIT_STORE_VERSION, (uint32_t)count };
    int ok = write_all(fd, header, sizeof header);
    for (size_t i = 0; ok && i < count; i++){
        uint32_t row[2] = { entries[i].race_hash, 0 };
        memcpy(&row[1], &entries[i].margin, sizeof row[1]);
        ok = write_all(fd, row, sizeof row);
    }
    if (close(fd) != 0) ok = 0;
    if (ok && rename(temp, path) == 0) return 1;

    int saved_errno = errno;
    unlink(temp);
    errno = saved_errno;
    return 0;
}

int mpcredit_store_read(const char *path, MpCreditStoreEntry *entries,
                        size_t capacity, size_t *out_count){
    if (out_count) *out_count = 0;
    if (!path || !path[0] || !out_count) return MPCREDIT_STORE_INVALID;

    FILE *in = fopen(path, "rb");
    if (!in) return errno == ENOENT ? MPCREDIT_STORE_MISSING : MPCREDIT_STORE_IO_ERROR;

    int status = MPCREDIT_STORE_INVALID;
    uint32_t header[3] = { 0, 0, 0 };
    MpCreditStoreEntry parsed[MPCREDIT_STORE_MAX_ENTRIES];
    if (fread(header, 1, sizeof header, in) != sizeof header){
        status = ferror(in) ? MPCREDIT_STORE_IO_ERROR : MPCREDIT_STORE_INVALID;
        goto done;
    }
    if (header[0] != MPCREDIT_STORE_MAGIC || header[1] != MPCREDIT_STORE_VERSION ||
        header[2] > MPCREDIT_STORE_MAX_ENTRIES || header[2] > capacity ||
        (header[2] && !entries)) goto done;

    for (uint32_t i = 0; i < header[2]; i++){
        uint32_t row[2];
        if (fread(row, 1, sizeof row, in) != sizeof row){
            status = ferror(in) ? MPCREDIT_STORE_IO_ERROR : MPCREDIT_STORE_INVALID;
            goto done;
        }
        float margin;
        memcpy(&margin, &row[1], sizeof margin);
        if (!finite_margin(margin)) goto done;
        parsed[i].race_hash = row[0];
        parsed[i].margin = margin;
    }

    if (fgetc(in) != EOF) goto done;
    if (ferror(in)){ status = MPCREDIT_STORE_IO_ERROR; goto done; }
    status = MPCREDIT_STORE_OK;

done:
    if (fclose(in) != 0 && status == MPCREDIT_STORE_OK) status = MPCREDIT_STORE_IO_ERROR;
    if (status == MPCREDIT_STORE_OK){
        if (header[2]) memcpy(entries, parsed, (size_t)header[2] * sizeof parsed[0]);
        *out_count = header[2];
    }
    return status;
}
