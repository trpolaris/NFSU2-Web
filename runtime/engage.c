/* engage.c -- recover a career free-roam Engage state the game left stuck.
 *
 * The game can leave Career +0x7138 (engaging) or the showcase preview's
 * 0x85EF6C byte set after its marker transition fails. The HUD still shows
 * the marker prompt, but Enter cannot open the shop/race/cover-shoot screen.
 *
 * Only while the career is in settled free roam, the HUD is visible and the
 * game's engage manager is idle, clear either byte if it stays set for two
 * seconds. This does not change normal transitions or multiplayer packets.
 */
#include "cpu.h"
#include <stdio.h>
#include <string.h>

long autotest_frame(void);
const char *autotest_top_fng(void);

#define G_FLOW          0x008654a4u
#define G_RACE          0x00890118u
#define G_CAREER_RACE   0x00863470u
#define G_ENGAGE_MGR    0x008900d8u
#define CAREER          0x0085ad40u
#define C_ENGAGING      0x7138u
#define G_PREVIEW       0x0085ef6cu
#define ENGAGE_FREE     4u
#define STUCK_FRAMES    120

static int committed_range(uint32_t address, uint32_t last) {
    return address && mem_is_committed(address) && mem_is_committed(address + last);
}

void engage_frame(CPU *c) {
    (void)c;
    static long engaging_since = -1;
    static long preview_since = -1;

    const long frame = autotest_frame();
    const char *top = autotest_top_fng();
    const uint32_t race = MR32(G_RACE);
    const uint32_t manager = MR32(G_ENGAGE_MGR);

    /* Match the game's own settled free-roam state, not a loading screen,
     * race, menu, or active engage transition. */
    const int free_roam =
        MR32(G_FLOW) == 6u &&
        committed_range(race, 0x0c00u) &&
        MR32(race) == 4u &&
        MR32(race + 0x24u) == 1u &&
        MR32(G_CAREER_RACE) == 0u &&
        top && strcmp(top, "HUD_SingleRace.fng") == 0;

    const int manager_idle = free_roam &&
        committed_range(manager, 3u) &&
        MR32(manager) == ENGAGE_FREE;

    if (manager_idle && MR8(CAREER + C_ENGAGING)) {
        if (engaging_since < 0) engaging_since = frame;
        else if (frame - engaging_since >= STUCK_FRAMES) {
            MR8(CAREER + C_ENGAGING) = 0;
            engaging_since = -1;
            fprintf(stderr,
                "[engage] f=%ld cleared a stale career-engaging flag; marker Enter is available again\n",
                frame);
        }
    } else {
        engaging_since = -1;
    }

    if (manager_idle && MR8(G_PREVIEW)) {
        if (preview_since < 0) preview_since = frame;
        else if (frame - preview_since >= STUCK_FRAMES) {
            MR8(G_PREVIEW) = 0;
            preview_since = -1;
            fprintf(stderr,
                "[engage] f=%ld cleared a stale showcase-preview flag; marker Enter is available again\n",
                frame);
        }
    } else {
        preview_since = -1;
    }
}
