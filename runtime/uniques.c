/* uniques.c -- optionally make the career's unique visual rewards available to every car after Caleb.
 *
 * Stock behaviour stays in place by default: the outrun star rewards a unique visual part to the car driven
 * to that star. With uniques = on, once the final stage-5 event is won, the career shops may sell those
 * unique visual parts for every car. Buying one still records it on that car; turning the option off later
 * does not remove parts already bought.
 *
 * Addresses/layout are for the supported SPEED2.EXE v1.2 NA build. The override changes only the career
 * unlock predicate (0x515500); it does not alter career tables or save files.
 */
#include <stdint.h>

#define C_NEVENTS      0x7afcu
#define C_EVENTS       0x7b00u
#define C_MAXEVENTS    0x181u
#define G_CAREER       0x0085ad40u
#define G_S5_INFO      0x0086262cu
#define SI_FINAL       0x28u
#define P_LEVEL        5u
#define LEVEL_UNIQUE   4u
#define F_STAGE        4u

/* Pure predicate, shared by the runtime wrapper and unit tests. */
int uniques_should_unlock(int setting, int original_result, uint32_t filter,
                          uint8_t part_level_byte, int caleb_beaten){
    return setting && !original_result && (filter & F_STAGE) &&
           ((part_level_byte >> 5) == LEVEL_UNIQUE) && caleb_beaten;
}

#ifndef UNIQUES_UNIT
#include "cpu.h"
#include <stdio.h>
#include <stdlib.h>
#include <strings.h>

static int committed(uint32_t address, uint32_t bytes){
    if (!address || !bytes || bytes - 1u > UINT32_MAX - address) return 0;
    return mem_is_committed(address) && mem_is_committed(address + bytes - 1u);
}

/* The final event recorded in the stage-5 career info is Caleb's race. */
int uniques_caleb_beaten(void){
    /* Do not dereference even the fixed global slots until their guest pages
     * are known to be committed. A malformed or partially loaded career must
     * leave the original shop restriction in place, not fault the game. */
    if (!committed(G_S5_INFO, 4u) ||
        !committed(G_CAREER + C_NEVENTS, 4u)) return 0;

    uint32_t stage_info = MR32(G_S5_INFO);
    if (!committed(stage_info, SI_FINAL + 4u)) return 0;
    uint32_t final_hash = MR32(stage_info + SI_FINAL);
    uint32_t event_count = MR32(G_CAREER + C_NEVENTS);
    if (!final_hash || event_count > C_MAXEVENTS) return 0;

    for (uint32_t i = 0; i < event_count; ++i){
        uint32_t record = G_CAREER + C_EVENTS + 8u * i;
        if (!committed(record, 7u)) return 0;
        if (MR32(record) == final_hash) return MR8(record + 6u) == 1u;
    }
    return 0;
}

static int g_setting = -1;
static int uniques_on(void){
    if (g_setting < 0){
        const char *value = getenv("NFSU2_UNIQUES");
        g_setting = value && (*value == '1' || !strcasecmp(value, "on") ||
                              !strcasecmp(value, "yes") || !strcasecmp(value, "true"));
    }
    return g_setting;
}

static int g_said;
void sub_00515500_orig(CPU *c);
void sub_00515500(CPU *c){
    uint32_t filter = MR32(c->esp + 4u);
    uint32_t slot = MR32(c->esp + 8u);
    uint32_t part = MR32(c->esp + 12u);
    sub_00515500_orig(c);

    if (!uniques_on() || (c->eax & 0xffu) || !(filter & F_STAGE) ||
        !committed(part, P_LEVEL + 1u)) return;
    if (!uniques_should_unlock(1, 0, filter, MR8(part + P_LEVEL), uniques_caleb_beaten())) return;

    c->eax = (c->eax & ~0xffu) | 1u;
    if (!g_said){
        g_said = 1;
        fprintf(stderr, "[career] Caleb beaten: unique visual parts are available in every car's shops (first slot %u)\n", slot);
    }
}
#endif
