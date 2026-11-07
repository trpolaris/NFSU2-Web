#define _POSIX_C_SOURCE 200809L
#include <assert.h>
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../runtime/gpsdistance.c"

uint8_t *g_mem;
static uint32_t object = 0x4000;
static uint32_t string_buffer = 0x5000;
static unsigned gps_state;
static unsigned clones, writes;
static int visible;

uint32_t roam_game_clone_hud_text(CPU *c, uint32_t pkg, uint32_t source, const char *name){
    (void)c;
    assert(pkg == 0x2000);
    assert(source == 0x3000);
    assert(strcmp(name, "GPS_DISTANCE") == 0);
    ++clones;
    MR32(object + 0x64u) = string_buffer;
    return object;
}
void dispatch_indirect(CPU *c, uint32_t fn){
    uint32_t arg = MR32(c->esp + 4u);
    switch(fn){
    case 0x505450u:
        c->eax = strcmp((char *)g_mem + arg, "GPS_DISTANCE") == 0 ? 1u : 2u;
        break;
    case 0x537a10u:
        c->eax = MR32(c->esp + 8u) == 1u ? (clones ? object : 0u) : 0x3000u;
        break;
    case 0x501100u: c->eax = gps_state; break;
    case 0x50ca00u: visible = 0; break;
    case 0x50ca50u: visible = 1; break;
    case 0x535fe0u: {
        ++writes;
        uint32_t dst = MR32(c->ecx + 0x64u);
        for (unsigned i = 0;; ++i){
            MR16(dst + i * 2u) = MR8(arg + i);
            if (!MR8(arg + i)) break;
            assert(i < 31);
        }
        break;
    }
    case 0x517e20u: case 0x517c10u: case 0x517db0u: break;
    default: assert(!"unexpected native call");
    }
}
static void update(void){
    CPU c = {0};
    c.esp = 0x100000u;
    c.esi = 0x10000u;
    CPU before = c;
    gpsdistance_hud(&c);
    assert(memcmp(&before, &c, sizeof c) == 0);
}
static void expect_text(const char *expected){
    for (unsigned i = 0;; ++i){
        assert(MR16(string_buffer + i * 2u) == (unsigned char)expected[i]);
        if (!expected[i]) break;
    }
}
int main(int argc, char **argv){
    unsetenv("NFSU2_GPS_DISTANCE");
    if (argc > 1){
        if (strcmp(argv[1], "unset") != 0) setenv("NFSU2_GPS_DISTANCE", argv[1], 1);
        CPU c = {0};
        gpsdistance_hud(&c);
        assert(!clones && !writes && !visible);
        puts("PASS GPS HUD disabled");
        return 0;
    }

    assert(setenv("NFSU2_GPS_DISTANCE", "1", 1) == 0);
    g_mem = calloc(1, 0x1000000u);
    assert(g_mem);

    const uint32_t player = 0x10000u, hud = 0x11000u, car = 0x12000u, part = 0x13000u;
    MR32(0x008900acu) = player;       /* PlayersByNumber[0] */
    MR32(player + 0x9a4u) = hud;
    MR32(player + 4u) = car;
    MR32(hud + 0x10u) = 0x2000u;
    MR32(hud + 0x5cu) = part;
    MR32(part + 0x10u) = MR32(part + 0x18u) = 1u;
    MR8(0x8385b9u) = 1u;              /* GPS marker visible */
    MR8(0x83aa1au) = 1u;              /* metric */
    MRF32(0x8385a0u) = 300.f;
    MRF32(0x8385a4u) = 400.f;
    MRF32(car + 0x50u) = 0.f;
    MRF32(car + 0x54u) = 0.f;
    MR32(0x89e7b0u) = 0u;             /* not racing */

    update();
    assert(clones == 1 && writes == 1 && visible);
    expect_text("500 m");
    update();
    assert(writes == 1);             /* unchanged labels do not allocate/write */

    MR8(0x83aa1au) = 0u;              /* imperial */
    update();
    expect_text("1640 ft");

    MR32(part + 0x18u) = 0u;           /* no active GPS arrow */
    update();
    assert(!visible);
    MR32(part + 0x18u) = 1u;
    update();
    assert(visible);

    for (gps_state = 1; gps_state <= 4; ++gps_state){
        update();
        assert(visible == (gps_state == 3));
    }
    gps_state = 0;
    MR32(0x89e7b0u) = 1u;             /* race: hide */
    update();
    assert(!visible);
    MR32(0x89e7b0u) = 0u;
    MR8(0x8385b9u) = 0u;              /* GPS toggle off: hide */
    update();
    assert(!visible);

    /* A Player update from another object must not touch Player 1's HUD. */
    CPU foreign = {0};
    foreign.esp = 0x100000u;
    foreign.esi = 0x14000u;
    unsigned before = clones;
    gpsdistance_hud(&foreign);
    assert(clones == before);

    MRF32(car + 0x50u) = NAN;
    MR8(0x8385b9u) = 1u;
    update();
    assert(!visible);

    free(g_mem);
    g_mem = NULL;
    puts("PASS GPS HUD: native arrow, units, route state, race and CPU preservation");
    return 0;
}
