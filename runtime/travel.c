/* travel.c -- career Free Roam Tracks and Join a friend.
 *
 * A race-track map is loaded by the game's own free-roam SwitchTrack event (10).
 * The setup writes the requested start immediately before the game's setup and
 * replaces the city's 4000 track ID immediately afterwards. The flow-step
 * wrapper forces a full reload when two spots share a region/track map.
 */
#include "cpu.h"
#include "widescreen.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>

void dispatch_indirect(CPU *c, uint32_t addr);
long autotest_frame(void);
const char *autotest_top_fng(void);
int mprace_car_ok(void);
int roam_game_alone(void);
int roam_game_friend_at(uint32_t name, float p[3], uint16_t *heading);
void roam_game_jumped(void);

__attribute__((weak)) int host_status_slot(const char *name){ (void)name; return -1; }
__attribute__((weak)) void host_status_set_n(const int *slot, const double *value, int n){ (void)slot; (void)value; (void)n; }

#define G_FLOW          0x008654a4u
#define G_GAMEMODE      0x00850078u
#define G_PLAYER1       0x008900acu
#define G_RACE          0x00890118u
#define G_RACEPARAMS    0x0089e7a0u
#define G_RACETYPE      0x0089e7b0u
#define G_RACESTATUS    0x008900d8u
#define G_TRACKINFO     0x00883dacu
#define G_TRACKINFOS    0x00883da0u
#define G_HUMANS        0x0089e7c0u
#define G_CAREER        0x0085ad40u
#define G_CAREER_RACE   0x00863470u
#define G_START_KEEP    0x00863484u
#define G_START_POS     0x00863490u
#define G_START_HEAD    0x008634a0u
#define G_ROAD_TABLE    0x0088a334u
#define PL_MARKER       0x9acu
#define C_TIMED         0xc08u
#define CITY            4000u
#define MAINLOOP_RET    0x00581475u
#define FN_POSTEVENT    0x00601020u
#define GOING_FRAMES    600
#define ROAD_NEAR_M     100.f
#define FRIEND_NEAR_M   60.f
#define FRIEND_BACK_M   12.f
#define FRIEND_WAIT     900
#define TRAVEL_HAS      65536.0

static const struct {
    uint16_t track, key;
    const char *name;
    float x, y, z;
    uint16_t heading;
} SPOTS[] = {
    { 4700, 4711, "URL: Airport Circuit",      2454.3f,  -272.7f, -10.0f, 0xbf04 },
    { 4700, 4701, "URL: Bayview Speedway",    -1987.4f, -2040.1f,  35.6f, 0x6b33 },
    { 4300, 4311, "Drift: Stadium",           -1174.5f,  -617.1f,   7.6f, 0x81a7 },
    { 4300, 4301, "Drift: Parkade",              877.6f,  -425.4f,  23.1f, 0x57c0 },
    { 4200, 4201, "Drag: Bayview Bridge",        994.6f,    36.4f,   3.2f, 0x6630 },
    { 4200, 4211, "Drag: Central Station",      1440.5f, -1388.1f,   1.5f, 0x9010 },
    { 4200, 4221, "Drag: South Runway",         2454.6f, -1498.5f, -10.0f, 0x4000 },
    { 4600, 4601, "Street X: Industrial Park",  -356.3f,  -244.4f,   1.1f, 0xfeb3 },
    { 4600, 4605, "Street X: Parkade",         -1556.1f, -2006.7f,  33.2f, 0xa1f4 },
};
#define NSPOTS ((int)(sizeof SPOTS / sizeof SPOTS[0]))

enum { WHY_OK, WHY_NOT_HERE, WHY_NO_CAR, WHY_BUSY, WHY_TIMED, WHY_MARKER, WHY_GOING, WHY_COOP };
static const char *const WHY[] = {
    "it can go", "not driving in career free roam", "no car of its own yet",
    "an outrun, a race lobby or another race's trip", "a timed career task",
    "on an event or shop marker", "a trip is already on its way", "player 2 is in"
};
enum { SAID_THERE = 1, SAID_LOCKED, SAID_NOT_FOUND, SAID_NOT_NOW };

static struct {
    int spot;
    int going;
    int loaded, full;
    long going_at;
    int place;
    float pp[3]; uint16_t ph;
    float city[3]; uint16_t city_h;
    int city_ok;
    int slot; double shown;
} T = { .slot = -2, .shown = -1.0 };
static int g_ask;
static uint32_t g_ask_name;
static int g_ask_spot;
#define ASK_FRIEND (NSPOTS + 2)
static struct { uint32_t name; int spot; long since; int went; } F;
static struct { int n, what, why, slot; double shown; } S = { .slot = -2, .shown = -1.0 };

static int guest_ok(uint32_t a, uint32_t n){
    return a && mem_is_committed(a) && mem_is_committed(a + n);
}
static uint32_t rd32(uint32_t a){ return guest_ok(a, 3) ? MR32(a) : 0u; }
static uint32_t player_car(void){
    uint32_t p = rd32(G_PLAYER1);
    return p ? rd32(p + 4u) : 0u;
}
static uint32_t gcall_main(CPU *c, uint32_t fn, uint32_t ecx, unsigned n, const uint32_t *args){
    CPU save = *c;
    c->esp = (c->esp - 512u) & ~15u;
    for (int i = (int)n - 1; i >= 0; i--) PUSH32(args[i]);
    c->ecx = ecx;
    PUSH32(MAINLOOP_RET);
    dispatch_indirect(c, fn);
    uint32_t result = c->eax;
    *c = save;
    return result;
}
static int spot_at(int k){ return k >= 1 && k <= NSPOTS; }
static int track_map(uint32_t track){
    for (int i = 0; i < NSPOTS; i++) if (SPOTS[i].track == track) return 1;
    return 0;
}
static int spot_on(uint32_t track, uint32_t car){
    int best = 0;
    float bd = 1e30f;
    for (int i = 0; i < NSPOTS; i++){
        if (SPOTS[i].track != track) continue;
        float dx = MRF32(car + 0x60u) - SPOTS[i].x;
        float dy = MRF32(car + 0x64u) - SPOTS[i].y;
        float d = dx * dx + dy * dy;
        if (d < bd){ bd = d; best = i + 1; }
    }
    return best;
}
static int on_track(void){
    return MR32(G_GAMEMODE) == 1u && MR32(G_FLOW) != 3u && track_map(MR32(G_RACEPARAMS));
}

void travel_ask(int where){
    if (where >= 0 && where <= NSPOTS) __atomic_store_n(&g_ask, where + 1, __ATOMIC_RELEASE);
}
void travel_ask_friend(uint32_t name, int spot){
    if (!name || spot < 0 || spot > NSPOTS) return;
    __atomic_store_n(&g_ask_name, name, __ATOMIC_RELAXED);
    __atomic_store_n(&g_ask_spot, spot, __ATOMIC_RELAXED);
    __atomic_store_n(&g_ask, ASK_FRIEND, __ATOMIC_RELEASE);
}
uint32_t travel_room(void){ return spot_at(T.spot) ? SPOTS[T.spot - 1].key : 0u; }

static int why_not(int k){
    if (T.going) return WHY_GOING;
    uint32_t race = rd32(G_RACE), player = rd32(G_PLAYER1), car = player_car(), track = rd32(G_RACEPARAMS);
    if (rd32(G_FLOW) != 6u || rd32(G_GAMEMODE) != 1u || rd32(G_RACETYPE) ||
        rd32(G_CAREER_RACE) || !player || !car || !guest_ok(race, 0x28u) || MR32(race) != 4u ||
        MR32(race + 0x24u) != 1u || (track != CITY && !track_map(track))) return WHY_NOT_HERE;
    const char *top = autotest_top_fng();
    if (!top || strcasecmp(top, "HUD_SingleRace.fng")) return WHY_NOT_HERE;
    if (!roam_game_alone()) return WHY_BUSY;
    if (!mprace_car_ok()) return WHY_NO_CAR;
    if (MR32(G_HUMANS) > 1u && k) return WHY_COOP;
    if (rd32(G_CAREER + C_TIMED)) return WHY_TIMED;
    if (rd32(player + PL_MARKER)) return WHY_MARKER;
    return WHY_OK;
}
static void keep_city(void){
    for (uint32_t i = 0; i < 3; i++) MRF32(G_START_POS + 4u * i) = T.city[i];
    MR16(G_START_HEAD) = T.city_h;
}
static void go(CPU *c, int k, long f){
    const char *to = k ? SPOTS[k - 1].name : "the city";
    int why = why_not(k);
    if (why){
        fprintf(stderr, "[travel] f=%ld trip to %s rejected: %s\n", f, to, WHY[why]);
        return;
    }
    if (k == T.spot) return;
    uint32_t car = player_car(), track = MR32(G_RACEPARAMS);
    if (!T.city_ok && track == CITY){
        for (uint32_t i = 0; i < 3; i++) T.city[i] = MRF32(car + 0x60u + 4u * i);
        T.city_h = MR16(car + 0x40cu);
        T.city_ok = 1;
    }
    if (!T.city_ok){
        fprintf(stderr, "[travel] f=%ld no saved city position; trip to %s not started\n", f, to);
        return;
    }
    T.going = k + 1; T.going_at = f; T.loaded = 0; T.place = 0;
    T.full = k && SPOTS[k - 1].track == track;
    uint32_t args[2] = { 10u, 0u };
    gcall_main(c, FN_POSTEVENT, rd32(G_RACESTATUS), 2, args);
    fprintf(stderr, "[travel] f=%ld SwitchTrack to %s (track %u)%s\n", f, to,
            k ? SPOTS[k - 1].track : CITY, T.full ? " with a full reload" : "");
}
void travel_presetup(void){
    if (T.going){
        int k = T.going - 1;
        float p[3]; uint16_t heading;
        if (T.place){ memcpy(p, T.pp, sizeof p); heading = T.ph; }
        else if (k){
            p[0] = SPOTS[k - 1].x; p[1] = SPOTS[k - 1].y; p[2] = SPOTS[k - 1].z;
            heading = SPOTS[k - 1].heading;
        } else {
            memcpy(p, T.city, sizeof p); p[2] += 0.5f; heading = T.city_h;
        }
        for (uint32_t i = 0; i < 3; i++) MRF32(G_START_POS + 4u * i) = p[i];
        MR16(G_START_HEAD) = heading;
        MR8(G_START_KEEP) = 1;
        fprintf(stderr, "[travel] f=%ld start %.1f %.1f %.1f heading %04x\n",
                autotest_frame(), (double)p[0], (double)p[1], (double)p[2], heading);
        return;
    }
    if (!T.city_ok || !on_track()) return;
    keep_city();
    MR8(G_START_KEEP) = 1;
}
void travel_setup(void){
    if (!T.going) return;
    T.loaded = 1;
    MR32(G_RACEPARAMS) = T.going == 1 ? CITY : SPOTS[T.going - 2].track;
}
int travel_full(void){
    if (!T.going || !T.full) return 0;
    T.full = 0;
    return 1;
}

static int road_near(const float at[3], float out[3]){
    float bd = ROAD_NEAR_M * ROAD_NEAR_M;
    int found = 0, level = 0;
    for (uint32_t i = 0; i < 2048; i++){
        uint32_t road = rd32(G_ROAD_TABLE + 4u * i);
        if (!guest_ok(road, 0x8cu) || (int16_t)MR16(road + 0xau) != (int)i) continue;
        int n = (int16_t)MR16(road + 0x34u);
        for (int j = 0; j < n && j < 4096 && guest_ok(road + 0x8cu + 0x38u * (uint32_t)j, 0x38u); j++){
            uint32_t node = road + 0x8cu + 0x38u * (uint32_t)j;
            float dx = MRF32(node) - at[0], dy = MRF32(node + 4u) - at[1];
            float d = dx * dx + dy * dy, z = (float)(int16_t)MR16(node + 0x12u) / 8.f;
            int lv = fabsf(z - at[2]) < 6.f;
            if (lv < level || (lv == level && d >= bd)) continue;
            bd = d; level = lv; found = 1;
            out[0] = MRF32(node); out[1] = MRF32(node + 4u); out[2] = z;
        }
    }
    return found;
}
static void said(int what, int why, long f){
    static const char *const W[] = { "", "there", "locked", "not found", "not now" };
    S.n++; S.what = what; S.why = why;
    fprintf(stderr, "[travel] f=%ld join friend: %s%s%s\n", f, W[what], why ? ", " : "", why ? WHY[why] : "");
    double v = (double)S.n * 256.0 + why * 16.0 + what;
    if (S.slot == -2) S.slot = host_status_slot("travel_said");
    if (S.slot >= 0) host_status_set_n(&S.slot, &v, 1);
}
static void go_place(CPU *c, const float p[3], uint16_t heading, long f){
    T.going = T.spot + 1; T.going_at = f; T.loaded = 0; T.full = 1;
    T.place = 1; memcpy(T.pp, p, sizeof T.pp); T.pp[2] += 1.f; T.ph = heading;
    uint32_t args[2] = { 10u, 0u };
    gcall_main(c, FN_POSTEVENT, rd32(G_RACESTATUS), 2, args);
}
static void friend_step(CPU *c, uint32_t car, long f){
    if (T.spot != F.spot){
        if (F.went){ said(SAID_NOT_FOUND, 0, f); F.name = 0; return; }
        int why = why_not(F.spot);
        if (why){ said(SAID_NOT_NOW, why, f); F.name = 0; return; }
        go(c, F.spot, f); F.went = 1; F.since = 0;
        return;
    }
    if (!F.since) F.since = f;
    float p[3]; uint16_t heading;
    if (!roam_game_friend_at(F.name, p, &heading)){
        if (f - F.since > FRIEND_WAIT){ said(SAID_NOT_FOUND, 0, f); F.name = 0; }
        return;
    }
    float dx = MRF32(car + 0x60u) - p[0], dy = MRF32(car + 0x64u) - p[1];
    if (dx * dx + dy * dy < FRIEND_NEAR_M * FRIEND_NEAR_M){ said(SAID_THERE, 0, f); F.name = 0; return; }
    if (F.went == 2){ said(SAID_THERE, 0, f); F.name = 0; return; }
    if (!T.spot){
        /* The fork has no career-walls analyser yet: never teleport into a locked part of the city. */
        said(SAID_LOCKED, 0, f); F.name = 0; return;
    }
    float a = (float)heading * (6.28318530718f / 65536.f);
    float back[3] = { p[0] - FRIEND_BACK_M * cosf(a), p[1] - FRIEND_BACK_M * sinf(a), p[2] };
    float out[3];
    if (!road_near(back, out)){ said(SAID_NOT_FOUND, 0, f); F.name = 0; return; }
    int why = why_not(1);
    if (why){ said(SAID_NOT_NOW, why, f); F.name = 0; return; }
    go_place(c, out, heading, f);
    F.went = 2;
}
static void publish(int why){
    double v = why < 0 ? 0.0 : TRAVEL_HAS + why * 256.0 + T.spot;
    if (v == T.shown) return;
    if (T.slot == -2) T.slot = host_status_slot("travel");
    if (T.slot >= 0){ host_status_set_n(&T.slot, &v, 1); T.shown = v; }
}

void travel_frame(CPU *c){
    long f = autotest_frame();
    uint32_t flow = rd32(G_FLOW), track = rd32(G_RACEPARAMS), car = player_car();
    int career = rd32(G_GAMEMODE) == 1u;
    int world = flow == 6u && career && !rd32(G_RACETYPE) && car;
    if (flow == 3u && (T.spot || T.going || T.city_ok)){
        if (T.city_ok && (T.spot || T.going || track_map(track))) keep_city();
        T.spot = T.going = T.loaded = T.full = 0;
        T.city_ok = 0; T.place = 0; F.name = 0;
    }
    if (T.going && !world) T.going_at = f;
    if (world && T.going && T.loaded){
        uint32_t want = T.going == 1 ? CITY : SPOTS[T.going - 2].track;
        if (track == want){
            T.spot = T.going - 1; T.going = 0; T.place = 0;
            roam_game_jumped();
            fprintf(stderr, "[travel] f=%ld arrived at %s (track %u)\n",
                    f, T.spot ? SPOTS[T.spot - 1].name : "the city", track);
        }
    }
    if (T.going && world && f - T.going_at > GOING_FRAMES){
        fprintf(stderr, "[travel] f=%ld trip to %s timed out before loading\n",
                f, T.going > 1 ? SPOTS[T.going - 2].name : "the city");
        T.going = T.loaded = T.full = T.place = 0;
    }
    if (world && !T.going){
        int k = track_map(track) ? spot_on(track, car) : 0;
        if (T.spot != k && !(k && T.spot && SPOTS[T.spot - 1].track == track)) T.spot = k;
    }
    if (world && on_track() && T.city_ok && !T.going) keep_city();
    if (F.name && world && !T.going) friend_step(c, car, f);

    int ask = __atomic_exchange_n(&g_ask, 0, __ATOMIC_ACQUIRE);
    if (ask == ASK_FRIEND){
        F.name = __atomic_load_n(&g_ask_name, __ATOMIC_RELAXED);
        F.spot = __atomic_load_n(&g_ask_spot, __ATOMIC_RELAXED);
        F.since = 0; F.went = 0;
        fprintf(stderr, "[travel] f=%ld join friend %08x at %s\n",
                f, F.name, F.spot ? SPOTS[F.spot - 1].name : "the city");
        int why = why_not(1);
        if (why && why != WHY_COOP){ said(SAID_NOT_NOW, why, f); F.name = 0; }
    } else if (ask) {
        go(c, ask - 1, f);
    }
    publish(career && (flow == 6u || T.going) ? why_not(1) : -1);
}

int travel_hook(CPU *c, uint32_t ip){
    switch (ip){
    case HOOK_SITE(0x00602eef):
        if (on_track()) c->eax &= ~0xffu;
        return 1;
    }
    return 0;
}

/* The outrun challenger manager remains in the city; its tuner cars have no
 * corresponding placements on the separate race-track free-roam maps. */
void sub_0041ace0_orig(CPU *c);
void sub_0041ace0(CPU *c){
    if (on_track()){ c->eax &= ~0xffu; POP32(c->eip); return; }
    sub_0041ace0_orig(c);
}
