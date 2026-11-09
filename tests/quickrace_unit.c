#include "cpu.h"

#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

uint8_t *g_mem;

#include "../runtime/quickrace.c"

#define TEST_MEM_SIZE 0x00a00000u

static void put8(uint32_t address, uint8_t value){ memcpy(g_mem + address, &value, sizeof value); }
static void put16(uint32_t address, uint16_t value){ memcpy(g_mem + address, &value, sizeof value); }
static void put32(uint32_t address, uint32_t value){ memcpy(g_mem + address, &value, sizeof value); }
static uint8_t get8(uint32_t address){ uint8_t value; memcpy(&value, g_mem + address, sizeof value); return value; }
static uint16_t get16(uint32_t address){ uint16_t value; memcpy(&value, g_mem + address, sizeof value); return value; }

static void reset_game(uint32_t game_mode, uint32_t quick_mode){
    memset(g_mem, 0, TEST_MEM_SIZE);
    put32(QR_GAME_MODE, game_mode);
    put32(QR, quick_mode);
}

static void test_lap_wrap(void){
    CPU c = {0};
    reset_game(T_QUICKRACE, 0);
    put16(qr_track_at(0) + 2u, 1u);
    c.ebx = MSG_LEFT;
    assert(quickrace_hook(&c, HOOK_SITE(0x004b3d9f)) == 1);
    assert(c.edi == LAPS_MAX);

    put16(qr_track_at(0) + 2u, LAPS_MAX);
    c.ebx = MSG_RIGHT;
    c.edi = 0;
    assert(quickrace_hook(&c, HOOK_SITE(0x004b3d9f)) == 1);
    assert(c.edi == LAPS_MIN);
}

static void test_opponent_bounds(void){
    CPU c = {0};
    reset_game(T_QUICKRACE, 0);
    c.ecx = 3;
    assert(quickrace_hook(&c, HOOK_SITE(0x004b3835)) == 1);
    assert(c.ecx == OPP_MAX);

    reset_game(T_QUICKRACE, M_DRAG);
    c.ecx = 3;
    assert(quickrace_hook(&c, HOOK_SITE(0x004b3835)) == 1);
    assert(c.ecx == 3);
}

static void test_lap_ko_and_drag_limit(void){
    CPU c = {0};
    reset_game(T_QUICKRACE, 0);
    put8(qr_humans_at(0), 1);
    put16(qr_track_at(0) + 2u, 3u);
    put8(qr_opp_at(0), 3u);
    c.ecx = 0x101u;
    c.edi = MSG_RIGHT;
    assert(quickrace_hook(&c, HOOK_SITE(0x004b4066)) == 1);
    assert(get16(qr_track_at(0) + 2u) == KO_N);
    assert(get8(qr_opp_at(0)) == KO_N);
    assert(c.ecx == 0x100u);

    reset_game(T_QUICKRACE, M_DRAG);
    put8(qr_humans_at(M_DRAG), 1);
    put16(qr_track_at(M_DRAG), 0x1132u);
    put8(qr_opp_at(M_DRAG), 3u);
    c.ecx = 1u;
    c.edi = MSG_LEFT;
    assert(quickrace_hook(&c, HOOK_SITE(0x004b4066)) == 1);
    assert(get8(qr_opp_at(M_DRAG)) == 2u);
}

static void test_quickrace_only_and_refresh(void){
    CPU c = {0};
    reset_game(1u, 0);                    /* Career must keep its own option values. */
    c.ecx = 0x201u;
    assert(quickrace_hook(&c, HOOK_SITE(0x004b3e0f)) == 1);
    assert(c.ecx == 0x201u);

    reset_game(T_QUICKRACE, 0);
    c.ecx = 0x201u;
    assert(quickrace_hook(&c, HOOK_SITE(0x004b38fe)) == 1);
    assert(c.ecx == 0x200u);
}

static void test_one_lap_progress(void){
    CPU c = {0};
    reset_game(1u, 0);                    /* One-lap lap-counter fix is mode independent. */
    put32(RACE_LAPS, 1u);
    put32(QR_RACE_PARAMS, 0x1234u);
    assert(quickrace_hook(&c, HOOK_SITE(0x004aa283)) == 1);
    assert(c.eax == 1u);
}

int main(void){
    g_mem = calloc(1, TEST_MEM_SIZE);
    assert(g_mem);
    test_lap_wrap();
    test_opponent_bounds();
    test_lap_ko_and_drag_limit();
    test_quickrace_only_and_refresh();
    test_one_lap_progress();
    free(g_mem);
    g_mem = 0;
    puts("quickrace unit tests: all passed");
    return 0;
}
