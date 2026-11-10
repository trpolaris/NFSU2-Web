/* hiddenraces.c -- optionally reveal the career races hidden by the stock game.
 *
 * This is an in-memory career-table change only. It does not write profile
 * or save files. The setting is opt-in and defaults to the original game.
 * Addresses/layout are for SPEED2.EXE v1.2 NA.
 */
#include <stdint.h>

#define G_RACES       0x008383e0u
#define G_NRACES      0x008383e4u
#define G_STAGES      0x0083841cu
#define G_NSTAGES     0x00838418u
#define RACE_SIZE     0x88u
#define STAGE_SIZE    0x50u
#define RACE_HIDDEN   0x7fu
#define STAGE_CAPS    0x30u
#define STAGE_CAP     8

/* Pure table mutation: shared by the game runtime and the native unit test. */
unsigned hiddenraces_apply_tables(volatile uint8_t *races, uint32_t race_count,
                                  volatile uint8_t *stages, uint32_t stage_count){
    unsigned changed = 0;
    if (!races || !stages || race_count > 1024u || stage_count > 16u) return 0;
    for (uint32_t i = 0; i < race_count; ++i){
        volatile uint8_t *hidden = races + i * RACE_SIZE + RACE_HIDDEN;
        if (*hidden){ *hidden = 0; ++changed; }
    }
    for (uint32_t i = 0; i < stage_count; ++i){
        for (uint32_t k = 0; k < 5u; ++k){
            volatile uint8_t *cap = stages + i * STAGE_SIZE + STAGE_CAPS + k;
            int8_t value = (int8_t)*cap;       /* -1 means no cap; keep it */
            if (value >= 0 && value < STAGE_CAP){
                *cap = STAGE_CAP;
                ++changed;
            }
        }
    }
    return changed;
}

#ifndef HIDDENRACES_UNIT
#include "cpu.h"
#include "game.h"
#include "setting.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>

static int g_enabled = -1;
static uint32_t g_done;                  /* the race table that was changed */

static int setting_enabled(void){
    if (g_enabled < 0){
        const char *v = getenv("NFSU2_SHOW_HIDDEN_RACES");
        g_enabled = v && (!strcmp(v, "1") || !strcasecmp(v, "on") ||
                          !strcasecmp(v, "true") || !strcasecmp(v, "yes"));
    }
    return g_enabled;
}

static int committed_span(uint32_t address, uint32_t bytes){
    if (!address || !bytes || bytes - 1u > UINT32_MAX - address) return 0;
    return mem_is_committed(address) && mem_is_committed(address + bytes - 1u);
}

/* Called from roam.c's main-loop hook (0x00581475), every frame, until the
 * game's GlobalB career tables have been loaded. The race table remains at
 * the same address for that career, so each loaded career is changed once. */
void hiddenraces_frame(void){
    if (!setting_enabled()) return;
    uint32_t races = MR32(G_RACES), race_count = MR32(G_NRACES);
    uint32_t stages = MR32(G_STAGES), stage_count = MR32(G_NSTAGES);
    if (!races || race_count > 1024u || stage_count > 16u ||
        races == g_done ||
        !committed_span(races, race_count * RACE_SIZE) ||
        !committed_span(stages, stage_count * STAGE_SIZE)) return;
    unsigned changed = hiddenraces_apply_tables(
        (volatile uint8_t *)(uintptr_t)races, race_count,
        (volatile uint8_t *)(uintptr_t)stages, stage_count);
    g_done = races;
    fprintf(stderr, "[career] show hidden races: %u table entries updated (in-memory only)\n", changed);
}
#endif
