/* cc -Wall -Wextra -Werror tests/opentunnel_unit.c -o out/opentunnel_unit
 * Run each mode in a fresh process: unset, off, invalid, on, incomplete, empty. */
#include <assert.h>
#include <unistd.h>
#include "../runtime/opentunnel.h"

static unsigned probes;
static int missing, empty;
static char created[3][128];

int fileio_resolve_game(const char *name, char *out, size_t cap) {
    ++probes;
    if (missing && strstr(name, "PathsFreeRoam")) return 0;
    char temp[] = "/tmp/nfsu2-opentunnel-XXXXXX";
    int fd = mkstemp(temp);
    if (fd < 0) return 0;
    if (!(empty && probes == 2)) (void)write(fd, "x", 1);
    close(fd);
    snprintf(created[probes - 1], sizeof created[0], "%s", temp);
    snprintf(out, cap, "%s", temp);
    return 1;
}

int main(int argc, char **argv) {
    assert(argc == 2);
    unsetenv("NFSU2_OPEN_TUNNEL");
    int on = !strcmp(argv[1], "on");
    missing = !strcmp(argv[1], "incomplete");
    empty = !strcmp(argv[1], "empty");
    if (on || missing || empty) setenv("NFSU2_OPEN_TUNNEL", "1", 1);
    else if (strcmp(argv[1], "unset")) setenv("NFSU2_OPEN_TUNNEL", !strcmp(argv[1], "off") ? "0" : "garbage", 1);
    char out[1024];
    const char *paths[] = {"tracks/l4ra.bun", "TRACKS/STREAML4RA.BUN", "TRACKS/ROUTESL4RA/PathsFreeRoam.bin"};
    for (unsigned i = 0; i < 3; ++i) {
        assert(opentunnel_resolve(paths[i], out, sizeof out) == on);
        if (on) assert(strstr(out, "/MODPACKS/open-tunnel/TRACKS/") != NULL);
    }
    assert(!opentunnel_resolve("TRACKS/L4RD.BUN", out, sizeof out));
    assert(!opentunnel_resolve("GLOBAL/GlobalB.lzc", out, sizeof out));
    assert(!opentunnel_resolve(paths[0], out, 2));
    assert(probes == (on || missing ? 3u : empty ? 2u : 0u));
    for (unsigned i = 0; i < 3; ++i) if (created[i][0]) unlink(created[i]);
    puts("PASS tunnel selection");
}
