/* carspot.c -- keep the career's saved car position on the map.
 *
 * The game stores the player's last free-roam position in Career (+0x8750),
 * then writes it to the profile and restores it on the next load without
 * checking the coordinates. A NaN or out-of-world position therefore
 * survives restarts and can leave the game world blank. Sanitize the saved
 * position every frame, even when the kept flag is currently clear: the
 * crib's Return to Explore Mode can set that flag and load the world in the
 * same frame.
 */
#include "cpu.h"
#include "game.h"
#include <stdio.h>

#define G_CAREER        0x0085ad40u
#define C_SPOT          0x8750u
#define C_SPOT_HEADING  0x8760u
#define PLACE_MAX       100000.f
static const float START[3] = { 1695.25f, -883.64f, 24.11f };
#define START_HEADING   0xf840u

long autotest_frame(void);

void carspot_frame(void){
    float p[3];
    int bad = 0;
    for (uint32_t i = 0; i < 3u; i++){
        p[i] = MRF32(G_CAREER + C_SPOT + 4u * i);
        if (!__builtin_isfinite(p[i]) || __builtin_fabsf(p[i]) > PLACE_MAX) bad = 1;
    }
    if (!bad) return;

    for (uint32_t i = 0; i < 3u; i++) MRF32(G_CAREER + C_SPOT + 4u * i) = START[i];
    MR16(G_CAREER + C_SPOT_HEADING) = START_HEADING;
    fprintf(stderr, "[carspot] f=%ld the career's kept spot is no place (%.1f %.1f %.1f, %s): the new career's start instead\n",
            autotest_frame(), (double)p[0], (double)p[1], (double)p[2],
            MR8(G_CAREER + 0x8744u) ? "kept" : "not kept now");
}
