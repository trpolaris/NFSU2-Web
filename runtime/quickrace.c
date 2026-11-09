/* quickrace.c -- more choices in Quick Race, and a one-lap race's progress in
 * percent. Adapted to the TRPOLARIS runtime: game globals are defined locally
 * because this fork does not carry upstream's runtime/game.h.
 *
 * Quick Race only:
 *  - Laps 1..127 with wraparound.
 *  - Up to five opponents (Drag keeps its game limits).
 *  - Lap KO no longer freezes lap/opponent settings; enabling it chooses five
 *    laps and as many opponents as the mode/track supports.
 *  - A one-lap race that counts laps displays COMPLETED/progress percent.
 *
 * HOOK_SITE addresses are discovered automatically by tools/genstamp.sh and
 * inserted into the lifter hook table by gen.sh.
 */
#include "cpu.h"
#include "widescreen.h"           /* HOOK_SITE */
#include <stdio.h>

#define T_QUICKRACE      2u
#define QR_GAME_MODE     0x00850078u
#define QR                0x0083aab4u
#define QR_RACE_PARAMS   0x0089e7a0u
#define RACE_LAPS        0x0089e7bcu
#define MSG_LEFT         0x9120409eu
#define MSG_RIGHT        0xb5971bf1u
#define LAPS_MIN         1
#define LAPS_MAX         127
#define OPP_MAX          5
#define M_DRAG           2u
#define KO_N             5

static int quick_race(void){ return MR32(QR_GAME_MODE) == T_QUICKRACE; }
static uint32_t qr_mode(void){ return MR32(QR); }
static int qr_mode_supported(uint32_t m){
    return m == 0u || m == 1u || m == M_DRAG || m == 4u || m == 9u || m == 0xcu;
}
static uint32_t qr_humans_at(uint32_t m){ return m == 0xcu ? QR + 0x100u : QR + 0x10u + m * 20u; }
static uint32_t qr_opp_at(uint32_t m){ return m == 0xcu ? QR + 0x101u : QR + 0x11u + m * 20u; }
static uint32_t qr_track_at(uint32_t m){ return m == 0xcu ? QR + 0x11cu : QR + 0x18u + m * 20u; }

/* The maximum number of AI opponents the selected mode and track can hold. */
static uint32_t opp_top(uint32_t m){
    uint32_t top = m == M_DRAG ? 3u : OPP_MAX;
    if (m == M_DRAG && MR16(qr_track_at(m)) == 0x1132u) top = 2u;
    uint32_t humans = MR8(qr_humans_at(m));
    return top + 1u > humans ? top + 1u - humans : 0u;
}

int quickrace_hook(CPU *c, uint32_t ip){
    switch (ip){
    case HOOK_SITE(0x004aa283): {            /* LapCounter::Update: test eax, eax */
        if (!c->eax && MR32(RACE_LAPS) == 1u){
            static uint32_t said;
            uint32_t track = MR32(QR_RACE_PARAMS);
            if (said != track){
                said = track;
                fprintf(stderr, "[qr] track %u: one lap, the HUD shows COMPLETED %%\n", track);
            }
            c->eax = 1u;
        }
        return 1;
    }
    case HOOK_SITE(0x004b3d9f): {            /* TONumLaps::Act: ebx=message, edi=new count */
        uint32_t mode = qr_mode();
        if (!quick_race() || !qr_mode_supported(mode) || (c->ebx != MSG_LEFT && c->ebx != MSG_RIGHT))
            return 1;
        int laps = (int)MR16(qr_track_at(mode) + 2u);
        if (c->ebx == MSG_LEFT) laps = laps - 1 < LAPS_MIN ? LAPS_MAX : laps - 1;
        else                    laps = laps + 1 > LAPS_MAX ? LAPS_MIN : laps + 1;
        c->edi = (uint32_t)laps;
        return 1;
    }
    case HOOK_SITE(0x004b3835): {            /* opponents' Act: ecx=maximum */
        uint32_t mode = qr_mode();
        if (quick_race() && qr_mode_supported(mode) && mode != M_DRAG) c->ecx = OPP_MAX;
        return 1;
    }
    case HOOK_SITE(0x004b386b): {            /* opponents' Act: eax=minimum */
        uint32_t mode = qr_mode();
        if (quick_race() && qr_mode_supported(mode) && MR8(qr_track_at(mode) + 8u) && !c->eax)
            c->eax = 1u;
        return 1;
    }
    case HOOK_SITE(0x004b3e0f):              /* laps refresh: cl=Lap KO (on: frozen) */
    case HOOK_SITE(0x004b38fe):              /* opponents refresh */
        if (quick_race()) c->ecx &= ~0xffu;
        return 1;
    case HOOK_SITE(0x004b4066): {            /* TOLapKO::Act: cl=Lap KO, edi=message */
        if (!quick_race()) return 1;
        uint32_t mode = qr_mode();
        if (qr_mode_supported(mode) && (c->ecx & 0xffu) && (c->edi == MSG_LEFT || c->edi == MSG_RIGHT)){
            uint32_t top = opp_top(mode);
            uint32_t opponents = KO_N < top ? KO_N : top;
            MR16(qr_track_at(mode) + 2u) = KO_N;
            MR8(qr_opp_at(mode)) = (uint8_t)opponents;
            fprintf(stderr, "[qr] Lap KO on: %u laps, %u opponents\n", KO_N, opponents);
        }
        c->ecx &= ~0xffu;                   /* do not restore the game's fixed 3 and 3 */
        return 1;
    }
    }
    return 0;
}
