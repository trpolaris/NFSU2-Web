#include <assert.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include "../runtime/cpu.h"

#define G_CAREER    0x0085ad40u
#define G_S5_INFO   0x0086262cu
#define C_NEVENTS   0x7afcu
#define C_EVENTS    0x7b00u
#define SI_FINAL    0x28u

uint8_t *g_mem;
uint8_t g_cbits[1u << 15];

int uniques_caleb_beaten(void);

/* The wrapper is linked from uniques.c but this test exercises only the
 * career-memory predicate. */
void sub_00515500_orig(CPU *c) { (void)c; }

static void commit(uint32_t address, uint32_t size) {
    assert(size != 0);
    uint32_t first = address >> 14;
    uint32_t last = (address + size - 1u) >> 14;
    for (uint32_t page = first; page <= last; ++page)
        g_cbits[page >> 3] |= (uint8_t)(1u << (page & 7u));
}

static void put32(uint32_t address, uint32_t value) {
    memcpy(g_mem + address, &value, sizeof value);
}

int main(void) {
    const uint32_t stage_info = 0x00870000u;
    const uint32_t final_hash = 0x6ca1beefu;
    const uint32_t event_count = G_CAREER + C_NEVENTS;
    const uint32_t record = G_CAREER + C_EVENTS;

    g_mem = calloc(1, 0x00900000u);
    assert(g_mem != NULL);

    /* Uncommitted global slots must not be dereferenced. */
    assert(!uniques_caleb_beaten());

    /* The globals are present, but the stage-info pointer is not committed. */
    commit(G_S5_INFO, 4u);
    commit(event_count, 4u);
    put32(G_S5_INFO, stage_info);
    assert(!uniques_caleb_beaten());

    /* Stage info is now committed, but an impossible event count is rejected. */
    commit(stage_info, SI_FINAL + 4u);
    put32(stage_info + SI_FINAL, final_hash);
    put32(event_count, 0x182u);
    assert(!uniques_caleb_beaten());

    /* A valid matching event is not complete until its completion byte is set. */
    put32(event_count, 1u);
    put32(record, final_hash);
    g_mem[record + 6u] = 0u;
    assert(!uniques_caleb_beaten());

    g_mem[record + 6u] = 1u;
    assert(uniques_caleb_beaten());

    /* A missing final-event hash keeps the original restriction. */
    put32(stage_info + SI_FINAL, 0u);
    assert(!uniques_caleb_beaten());

    free(g_mem);
    g_mem = NULL;
    return 0;
}
