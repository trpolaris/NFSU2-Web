#include "web/compat/env_bool.h"

#include <stdio.h>
#include <stdlib.h>

#define TEST_ENV "NFSU2_TEST_ENV_BOOL"

struct test_case {
    const char *value;
    int fallback;
    int expected;
    const char *label;
};

int main(void) {
    const struct test_case cases[] = {
        { "1",        0, 1, "numeric true" },
        { "true",     0, 1, "true" },
        { "YES",      0, 1, "case-insensitive yes" },
        { "on",       0, 1, "on" },
        { "enabled",  0, 1, "enabled" },
        { "0",        1, 0, "numeric false" },
        { "false",    1, 0, "false" },
        { "NO",       1, 0, "case-insensitive no" },
        { "off",      1, 0, "off" },
        { "disabled", 1, 0, "disabled" },
        { "unknown",  1, 1, "unknown uses true fallback" },
        { "unknown",  0, 0, "unknown uses false fallback" },
        { "",         1, 1, "empty uses fallback" }
    };

    for (size_t i = 0; i < sizeof cases / sizeof cases[0]; ++i) {
        if (setenv(TEST_ENV, cases[i].value, 1) != 0) {
            perror("setenv");
            return 2;
        }
        int actual = nfsu2_env_bool(TEST_ENV, cases[i].fallback);
        if (actual != cases[i].expected) {
            fprintf(stderr, "FAIL: %s (value='%s', fallback=%d): got %d, expected %d\n",
                    cases[i].label, cases[i].value, cases[i].fallback,
                    actual, cases[i].expected);
            return 1;
        }
    }

    if (unsetenv(TEST_ENV) != 0) {
        perror("unsetenv");
        return 2;
    }
    if (nfsu2_env_bool(TEST_ENV, 1) != 1 ||
        nfsu2_env_bool(TEST_ENV, 0) != 0) {
        fputs("FAIL: missing environment variable did not use fallback\n", stderr);
        return 1;
    }

    puts("FSAA environment boolean regression cases passed.");
    return 0;
}
