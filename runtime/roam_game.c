/* roam_game.c -- free-roam multiplayer: the game side (v1.2 NA port).
 *
 * Friends on the same LAN, each in their own career free roam, see each
 * other's cars: right model and customization, moving smoothly, with their
 * names on the minimap arrow's racer record.  Off unless NFSU2_ROAM=1.
 * The wire format is in roam_core.h.
 *
 * Per frame, at the main-loop hook between World::DoTimestep and the camera
 * and render (roam.c's instruction hook at 0x581475), on the guest thread:
 *  - a sync clock: the sum of world dt (what the cars move by), slewed to
 *    the host clock (at most 5 %) and following it while the world stands
 *    (pause, SMS, streaming), stamps the local samples and is the render
 *    clock of the remote cars;
 *  - the local car's state goes to the session (roam_core), which sends a
 *    snapshot 20 times a second; its car look (type and part hashes) goes
 *    out when it changes;
 *  - remote players get "slots": the 3 parked free-roam opponent cars (the
 *    outrun challengers' cars; the RandomEncounterManager is held off while
 *    we use them) and up to 29 cars of our own (CreateCar), the nearest
 *    players first.  World::IndexCars' array holds 22 cars and the world has
 *    20, so the first 2 of ours are indexed as AI racers and the others stay
 *    out of it, on the World's list only, which is what the renderer walks
 *    (finish_create); those get their minimap arrows and world map markers here
 *    (arrows_update, map_update).  The game has 6 paint slots
 *    (DUMMY_SKIN1-6: the player, the 3 opponent cars, the first 2 of ours);
 *    the others composite into textures of our own (skin_textures,
 *    roam_game_texture).  A slot's car gets the player's ride (streamed
 *    in through the CarLoader, then Car::SetRideInfo), no brain and no
 *    physics, and its pose is written every frame from the core's
 *    interpolation.  Solid cars (the default) have their collision body
 *    while they are near the player's car (SOLID_M: no other can touch it
 *    this frame; two friends' cars never need to touch each other, as each
 *    is where its player put it, but the game tested every pair of them),
 *    except while they are ghosts: from the moment they appear (or jump,
 *    or the player's car does) until they are clear of the player's car,
 *    so nobody is shoved out of a car that appeared inside theirs, and
 *    while they are passable: paused, standing for a minute, near a door,
 *    either player near one of their own open events (the friend's game
 *    says so in its snapshots: RC_BIT_PASS), or the player at the new
 *    career's start (soft_update), so nobody walls off a shop, the garage
 *    or a race's start; a friend's car at that start is not shown at all
 *    (at_spawn): every new player appears on that spot.  They are
 *    drawn where the friend is now (predicted by half the round trip), so
 *    a contact is at the same spot on both screens.  Ghost cars
 *    (NFSU2_ROAM_COLLIDE=0) have no collision body and are drawn a little in
 *    the past (NFSU2_ROAM_DELAY), smoothed through the jitter buffer; the
 *    player's own car is then passable on every friend's screen too.  The
 *    page's menu switches between the two while the game runs (solid_follow).
 *  - names over friends' cars, as the game's own LAN races show them
 *    (roam_game_hud).
 *  - horns: the player's goes out with the snapshots, and which horn it is
 *    with the car's look; friends' sound from their cars (sounds_update,
 *    horn.c).
 *  - engines: the snapshots' extension carries the player's engine as the
 *    game sounds it (eng_state); a friend's car sounds with its own engine
 *    sound's recordings at that (eng_files, eng_sound, carsfx.c), and the
 *    game's AI engine on a free-roam opponent's car a friend drives is
 *    silenced (aieng_update).
 *  - hydraulics and nitrous: the snapshots' extension carries the wheel
 *    places' heights, the nitrous left, each wheel's hydraulics and the
 *    landings; a friend's car gets its wheels where the friend's are
 *    (wheels_pose: the hydraulics lift the body, the pose has that) and a
 *    shot of nitrous of its own while theirs is on, so the game draws its
 *    streaks and flames (nos_pose), and both sound from it (sounds_update,
 *    carsfx.c: the game's own samples).
 *  - outruns: two players who stay near each other can challenge each other
 *    to the game's own outrun, raced against each other's car (du_frame),
 *    away from the doors and their open events.
 *  - keep right: a new player's car driving out of the new career's start
 *    gets a line at the top asking them to keep right (kr_frame).
 *  - leaving free roam (shop, crib, race, menus) parks the cars; their
 *    rides are unloaded once the world is gone.  A peer that leaves, times
 *    out or goes into a shop or race disappears (soft-parked), and its slot
 *    is given back after a while.
 * The network itself runs on roam_bsd.c's thread; the game thread only
 * takes the session lock for a few microseconds per frame.
 *
 * The same file is the game side of the Windows companion for the original
 * PC game (win/roam_asi, NFSU2FreeRoam.asi), built with -DROAM_HOST_WIN:
 * every guest access, guest call, option, log line and clock goes through
 * the host names of roam_host.h (the port) or roam_host_win.h (Windows), and
 * every float operation is a basic IEEE operation (no libm; both builds use
 * -ffp-contract=off), so both platforms make the same writes into the game
 * for the same inputs (tests/asi_harness.c checks that).
 */
#ifdef ROAM_HOST_WIN
#include "roam_host_win.h"
#else
#include "roam_host.h"
#endif
#include "roam_core.h"
#include "roam_plat.h"
#include "carsfx.h"
#include "names.h"

/* ---- game addresses (v1.2 NA) ------------------------------------------------ */
/* multiplayer races from free roam (mp_*, mprace.c): not in the Windows plugin */
#ifdef ROAM_HOST_WIN
#define MPRACES         0
#else
#define MPRACES         1
#endif
#define G_FLOW          0x008654a4u   /* GameFlowManager state: 3 front end, 6 in the world */
#define G_GAMEMODE      0x00850078u   /* 1 career, 0x200 LAN */
#define G_WORLD         0x00890080u   /* World*: +0x10 cars, +0x14/+0x18 AI range, +0x1C cars[] */
#define G_PLAYER1       0x008900acu   /* Player*: +4 car */
#define G_RACE          0x00890118u   /* race coordinator: +0 state (4 racing), +0x24 racers, +0xC40 encounters */
#define G_CAREER_RACE   0x00863470u   /* career race being run (0 = free roam) */
#define G_TRACK         0x0089e7a0u   /* race parameters: the track (4000 free roam; 4701.. URL, 4706 the Dyno Shop) */
#define G_RACETYPE      0x0089e7b0u   /* race parameters: 0 free roam, 1 a race, 7 an outrun, 8 the Dyno Shop */
#define RACETYPE_DYNO   8u
#define G_WORLDDT       0x00865154u   /* float: this frame's world dt (s) */
#define G_PROFILE_NAME  0x0083a9e0u   /* 16 bytes */
#define G_CARTYPES      0x008a1cccu   /* CarTypeInfo[]: 0x890 bytes, +0 name, +0xD0 name hash */
#define TYPE_TRAFFIC    31            /* CarTypeInfo 0..30 are the player cars, 31..45 traffic (TAXI .. BUS, HATCHBACK02), */
#define TYPE_STOCK      46            /* ...and Unlimiter adds car types after them */
#define G_PARTOWNERS    0x008a1cb8u   /* CarPart byte +7 -> owner (car type) hash table */
#define G_CARPARTDB     0x008a2b68u
#define G_CARLOADER     0x008a3288u   /* entries on +0x58, handle at entry +0x123C */
#define G_RIDEPOOL      0x008a1d00u   /* bSlotPool* of its entries: +0x18 in use, +0x2C entries (0x43CD10: all taken) */
#define G_CARPOOL_KB    0x007fa9d4u   /* free-roam "Cars" pool size (KB), read at the track load */
#define CARPOOL_KB_GAME 11000         /* its size in the game */
#define CARPOOL_KB      48000         /* free roam's (NFSU2_ROAM_CARPOOL_KB) */
#define G_CARS_POOL     0x00828164u   /* bMemory pool 4: +0x24 size, +0x28 used */
#define G_RECORDS       0x00890160u   /* racer records, 0x940 bytes each */
#define RC_ENCOUNTERS   0xc40u
#define FN_MALLOC       0x00575620u   /* cdecl (size) */
#define FN_CAR_ACTIVATE 0x005f6d50u
#define FN_CAR_DEACTIVATE 0x005f6e20u
#define FN_CAR_SETDRIVER 0x005eba30u  /* thiscall (type) */
#define FN_CAR_SETPHYS  0x005f46a0u   /* thiscall (mode) */
#define FN_CAR_SECTION  0x005f6cd0u   /* thiscall (): track section / collider after a move */
#define FN_ROADTRACK    0x005da330u   /* thiscall (car +0x8D8, pos*): road tracker, as Car::SetPosition does */
#define FN_CAR_BODYPOS  0x005f5010u   /* thiscall (): +0x50 = +0x60 - centre-of-mass offset (and a ground snap) */
#define FN_CAR_EFFECTS  0x005f5730u   /* thiscall (distance): native tyre smoke, dirt and nitrous effects */
#define CAR_SUSP        0x380u        /* float[4]: each wheel's suspension offset (m, up), 0 at rest */
#define CAR_STEER       0x40eu        /* u16: the front wheels' steering angle (65536 a turn, left positive) */
#define CAR_SPIN        0x4e8u        /* float[4]: each wheel's spinner angle (rad); +0x10: its speed (rad/s) */
#define CAR_NOS         0x40u         /* Car: its nitrous (+0x414 a full shot, +0x41C left, +0x420 on since; nos_left) */
#define G_TICKS         0x0086518cu   /* game time, 4000 ticks a second: the nitrous's clock (0x592480) */
#define G_HYD_LEVEL     0x007e949cu   /* int: every car's hydraulics level, -1: each its own (a debug setting) */
#define CAR_PHYS        0x34u         /* Car: its physics (+CAR_HYD + 4 k: wheel k's hydraulics, 0x5ED470, in physics mode 1) */
#define CAR_HYD         0x74u
#define CAR_BUMP        0x408u        /* u8[4]: wheel k landed this frame (the hydraulics' landing, 0x47DD40) */
#define CAR_WSPIN       0x330u        /* float[4]: each wheel's turning speed (rad/s) */
#define CAR_GROUND      0x390u        /* u8[4]: wheel k is on the ground */
#define CAR_SURF        0x394u        /* u32[4]: the surface under wheel k (the table at 0x800EE0, N_SURF of them) */
#define CAR_SLIP        0x3b4u        /* float[4][2]: wheel k's slip along it and across it (m/s): smoke from 5 on a road (0x5F5730) */
#define N_SURF          29u
#define CAR_SOUND       0x968u        /* Car: its sound state: +0x30 the car, +0x20 its children (each +0x50 the next) */
#define VT_SFX_NOS      0x0078ac58u   /* CARSFX_Nitrous (vtable): its update 0x484F20 sounds a car's nitrous */
#define VT_SFX_SKIDS    0x0078ae48u   /* CARSFX_Skids (vtable, 0x473A70): the skid sound, from the wheels' slip (0x46EA50) */
#define FN_CAR_SETRIDE  0x00601110u   /* thiscall (RideInfo*) */
#define FN_BODY_DISABLE 0x005930f0u   /* DynamicCollisionBody (car +0x3C): ++[+0x17] */
#define FN_TYPE_BY_HASH 0x00610130u   /* cdecl (hash) -> CarTypeInfo* or 0 */
#define FN_GETCARPART   0x0061b980u   /* thiscall CarPartDB (type, slot, key, prev, -1) */
#define FN_RIDE_INIT    0x00610270u   /* thiscall (type, 0, b5, b6) */
#define FN_RIDE_STOCK   0x00637040u   /* thiscall (0): stock parts */
#define FN_RIDE_PARTSON 0x0061bcd0u   /* thiscall (): UpdatePartsEnabled */
#define FN_RIDE_SETPART 0x00631d20u   /* thiscall (slot, part) -> the part it had: SetPart, then UpdatePartsEnabled */
#define G_SLOTKIND      0x00802960u   /* u32[RC_PART_SLOTS]: a ride slot's parts' kind (CarPart +4; NewGetCarPart) */
#define G_SLOTNAMES     0x00802decu   /* {char *name, u32}[]: a ride slot's name ("SPOILER" for 0xC) */
#define FN_PART_ATTR    0x0061b500u   /* thiscall CarPart (attribute hash, 0) -> its value */
#define FN_PART_NAME    0x00610000u   /* thiscall CarPart () -> its name */
#define FN_HASH         0x0043db50u   /* cdecl (string) -> the game's hash of it */
#define ATTR_WHEELTYPE  0xebb03e66u   /* a wheel's type: the hash of "SPINNER" for a spinner */
#define ATTR_RIMSIZE    0xce7d8db5u   /* a wheel's size: the car type's +0xDC for one that fits (the shop's list) */
#define S_SPINNER       0x0079bde0u   /* "SPINNER" */
#define FN_RIDE_SKINS   0x0061c280u   /* thiscall (n): DUMMY_SKIN<n> / WHEEL / SPINNER */
#define FN_PERF_SET     0x005ac4b0u   /* thiscall RideInfo +0x2F0 (perf*): installed performance parts from bits */
#define FN_PHYS_UPDATE  0x005b4fc0u   /* thiscall RideInfo +0x10 (1, 1, 1): physics from tuning and parts */
#define FN_LOADER_LOAD  0x0063bc70u   /* thiscall (ride, 0, 0) -> handle */
#define FN_LOADER_SERVICE 0x0063bcd0u /* thiscall (0, 0) */
#define FN_LOADER_LOADED 0x00610910u  /* thiscall loader (entry) */
#define FN_LOADER_WAIT  0x0061ca50u   /* thiscall (handle) */
#define FN_LOADER_UNLOAD 0x0063ae00u  /* thiscall (handle) */
#define FN_LOADER_PURGE 0x0063a1b0u   /* thiscall (phase), callee pops: phase 0 unloads one unreferenced entry -> 1, none -> 0 */
#define LOADER_BUSY     0x14u         /* CarLoader +0x14 (0x8A329C): a step of a load under way (a pack, its textures; one at a time) */
#define FN_CREATECAR    0x00606480u   /* ecx grid {vec3, +0x10 u16 heading}, edx record, (driver, start) */
#define FN_INDEXCARS    0x005f0d20u   /* thiscall World */
#define FN_MM_REBUILD   0x004f92a0u   /* cdecl (): the minimap's icons made again (0x4ECC80), as Player 0x5EA980 does */
#define FN_EM_OVER      0x00500ca0u   /* thiscall G_ENCOUNTERS: the outrun is over (the manager's state 5 calls it) */
#define G_ENCOUNTERS    0x0085ef70u   /* the career's outrun bookkeeping (the manager asks it whether one is due) */
#define EM_TABLE        0x1b10u       /* manager: 3 x {+0 time, +4 state, +8 flag, +0xC car} */
#define EM_STANDDOWN_US 20000000      /* its cars out of sight (250 m) by then, or parked anyway */
#define PARK_Z          (-123456.f)   /* Car::Deactivate's parking spot (0, 0, -123456) */
#define RIDE_SZ         0x900u
#define REC_SZ          0x940u
#define NSLOT           32            /* 3 opponent cars + 29 of our own */
#define NOPP            3             /* slots 0-2: the parked free-roam opponent cars */
#define WORLD_INDEX     22            /* World::IndexCars' cars[] (World +0x1C; other fields follow) */
#define KIND_OUT        4             /* a racer record kind IndexCars skips (1 human, 2 AI racer, 3 traffic) */
#define SKIN_GAME       6             /* the game's paint slots, DUMMY_SKIN1-6 */
#ifdef ROAM_HOST_WIN
#define MAX_CARS        5             /* the Windows plugin: the game's own paint slots and car index only */
#else
#define MAX_CARS        NSLOT
#endif
#define CLEAR_M         6.f           /* a ghost becomes solid once its centre is this far from the player's car's */
#define SOLID_M         20.f          /* ...and has its body only this near it (cars touch from ~5 m; a frame at 20 fps and 160 m/s closing is 8) */
#define SPAWN_X         1695.3f       /* the new career's start, where every new player appears (the airport's car park) */
#define SPAWN_Y         (-883.6f)
#define SPAWN_Z         24.1f
#define SPAWN_M         5             /* a car this near it is not shown to others, and the player there is passable */
#define JUMP_M          5.f           /* a friend's car drawn this far from where it was last frame is a ghost again */
#define HIT_REPORT_US   50000         /* a hit's push (roam_game_contact) holds until the friend's snapshots from this long after it come */
#define NUDGE_REPORT_US 20000         /* ...a push of 1 m/s or less (cars leaning on each other) this long */
#define HIT_HOLD_US     400000        /* ...or this long at most; then it fades into where their game has the car */
#define HIT_FADE_US     100000        /* (time constant: the interpolation's own for a correction, rc_interp_eval) */
#define PUSH_Q          8             /* pushes held at once (more: merged into the newest) */
#define IDLE_MPS        1.f           /* a car slower than this stands */
#define IDLE_US         60000000      /* a car that has stood this long is passable */
#define BLOCK_M         6.f           /* the player's car that stays this near one spot */
#define BLOCK_US        20000000      /* ...this long */
#define BLOCK_HITS      4             /* ...and has had this many hits */
#define BLOCK_CARS      2             /* ...with this many friends' cars */
#define BLOCK_WIN_US    60000000      /* ...in this long, anywhere, is passable until it leaves the spot (block_hit) */
#define BLOCK_GAP_US    1000000       /* a friend's car touching it again after this long is another hit */
#define BLOCK_Q         64            /* hits kept: more than one car's in BLOCK_WIN_US (one each BLOCK_GAP_US) */
#define DOOR_M          20.f          /* a car this near a door's trigger is passable */
#define G_TRIGGERS      0x0088f298u   /* the track's triggers: +0x440 + 4t .. +0x444 + 4t those of type t (0x5D9BF0) */
#define TRIG_DOOR       14            /* the triggers of the shops, the garage and the car lot (0x5EB040 asks types 13-15) */
#define MAX_DOORS       64
#define TRIG_EVENT      13            /* the events' triggers, the whole career's: open or not by the player's career */
#define MAX_EVENTS      128
#define EV_PER_FRAME    8             /* event triggers asked a frame (events_read) */
#define EV_SWEEP_US     4000000       /* ...all of them again this often: a race won or an SMS opens new ones */
#define EV_SCR          0x00u         /* g_gmem scratch: the 5 dwords FN_MARKER_WHAT fills */
#define G_CAREER        0x0085ad40u   /* Career: the player's (+0x71C8 the races open now, 0x5007E0) */
#define G_STRPOOL       0x00838428u   /* the career tables' strings: a race's name at +[race +0] (u16) */
#define FN_MARKER_WHAT  0x00527800u   /* thiscall Career (out, trigger), callee pops: out = {the trigger or 0, race, shop, showcase, ...} */
#define FN_MARKER_OPEN  0x00532a50u   /* thiscall Career (out), callee pops -> al: Engage enters it now (as 0x5EAFB0 asks) */

/* ---- guest access ----------------------------------------------------------------- */
static int ok(uint32_t a, uint32_t n){ return a && rh_committed(a) && rh_committed(a + n); }
static uint32_t rd32(uint32_t a){ return ok(a, 3) ? MR32(a) : 0u; }
static uint32_t gcall0(CPU *c, uint32_t fn, uint32_t ecx){ return rh_call(c, fn, ecx, 0, 0, 0); }
static uint32_t gcall1(CPU *c, uint32_t fn, uint32_t ecx, uint32_t a){ return rh_call(c, fn, ecx, 0, 1, &a); }
static uint32_t player_car(void){ uint32_t p = rd32(G_PLAYER1); return p ? rd32(p + 4u) : 0; }
static uint32_t world(void){ uint32_t w = rd32(G_WORLD); return ok(w, 0x80) ? w : 0; }
static int du_racing(uint32_t race);
/* free roam: the career's world with no race but free roam's own one-racer
 * one, or an outrun with a friend (du_racing): that is still free roam.  On
 * free roam's own track: Performance Tuning / Dyno is one racer and no
 * career race too, but on tracks of its own (the Dyno Shop 4706, a circuit
 * test run on URL track 4705), whose places are not the city's -- friends
 * saw those cars stand and race in the air over them (players, 2026-10-25) */
static int roaming(void){
    uint32_t race = rd32(G_RACE);
    return rd32(G_FLOW) == 6u && rd32(G_TRACK) % 1000u == 0 && ok(race, 0xc44) && MR32(race) == 4u &&
           (MR32(race + 0x24u) == 1u || du_racing(race)) &&
           !rd32(G_CAREER_RACE) && !(rd32(G_GAMEMODE) & 0x200u) && world() && player_car();
}
static uint32_t encounter_mgr(void){ uint32_t r = rd32(G_RACE); return ok(r, 0xc44) ? r + RC_ENCOUNTERS : 0; }
/* one of the game's own opponent cars: an AI racer (kind 2) whose racer
 * record is in the game's record array -- never a car of ours, whose record
 * is a copy in our own memory (World::IndexCars sorts both kinds into the
 * same AI range, in the order of the World's list, which the game changes) */
static int game_opponent(uint32_t car){
    uint32_t rec = ok(car, 0x9e0) ? rd32(car + 0x14u) : 0;
    return rec >= G_RECORDS && rec < G_RECORDS + 22u * REC_SZ && (rec - G_RECORDS) % REC_SZ == 0 && MR32(rec + 4u) == 2u;
}
static uint32_t ai_car(uint32_t w, int i){
    int first = (int)MR32(w + 0x14u), end = (int)MR32(w + 0x18u);
    if (first < 0 || end > 22 || i < 0 || first + i >= end) return 0;
    uint32_t car = rd32(w + 0x1cu + 4u * (uint32_t)(first + i));
    return ok(car, 0x9e0) ? car : 0;
}
static int car_out(uint32_t car){ return __builtin_fabsf(MRF32(car + 0x68u) - PARK_Z) >= 0.001f; }   /* 0x5ED430 */
#define RIDE_ENTRIES    128           /* the car loader's ride entries with free-roam multiplayer on (g_pools) */
static uint32_t loader_entry(uint32_t h){
    uint32_t head = G_CARLOADER + 0x58u, e = rd32(head);
    for (int k = 0; e && e != head && k < 4 * RIDE_ENTRIES; k++, e = rd32(e)) if (rd32(e + 0x123cu) == h) return e;
    return 0;
}
/* The car loader serves its loads one after another, about half a second
 * each: a load may take 15 s, and a second more for each load ahead of it
 * (32 friends arriving at once queue 61 loads, a car of our own's and the
 * friend's ride each) */
static int loads_waiting(void);
static int64_t load_wait_us(void){ return 15000000 + 1000000 * (int64_t)loads_waiting(); }
static void cstr(uint32_t a, char *o, int n){
    int i = 0;
    if (ok(a, (uint32_t)n)) for (; i < n - 1 && MR8(a + (uint32_t)i) >= 0x20 && MR8(a + (uint32_t)i) < 0x7f; i++) o[i] = (char)MR8(a + (uint32_t)i);
    o[i] = 0;
}
static uint32_t pool_free(void){
    uint32_t p = rd32(G_CARS_POOL);
    if (!ok(p, 0x30)) return 0xffffffffu;
    uint32_t sz = MR32(p + 0x24u), used = MR32(p + 0x28u);
    return used <= sz ? sz - used : 0;
}
static void pool_log(const char *why){
    uint32_t p = rd32(G_CARS_POOL);
    if (ok(p, 0x30)) rlog("[roam] f=%ld car pool (%s): %.2f of %.2f MB used\n", rh_frame(), why,
                             MR32(p + 0x28u) / 1048576.0, MR32(p + 0x24u) / 1048576.0);
}

/* ---- options --------------------------------------------------------------------------- */
/* a player's option without a comment after it: the Mac's settings.ini only
 * knows whole-line comments, so "roam_name = Thom   ; me" would make the
 * comment part of the name; on both platforms a ';' or '#' at the start or
 * after a blank starts a comment ("Team#1" stays a name) */
static const char *opt(const char *k){
    const char *v = rh_opt(k);
    if (!v) return 0;
    static char buf[4][256]; static int nb;
    char *o = buf[nb++ & 3];
    int n = 0;
    for (int i = 0; v[i] && n < 255; i++){
        if ((v[i] == ';' || v[i] == '#') && (i == 0 || v[i - 1] == ' ' || v[i - 1] == '\t')) break;
        o[n++] = v[i];
    }
    while (n && (o[n - 1] == ' ' || o[n - 1] == '\t')) n--;
    o[n] = 0;
    return o;
}
static int env_int(const char *k, int def, int lo, int hi){
    const char *v = opt(k);
    if (!v || !*v) return def;
    long x; char *e = 0;
    if (!strcasecmp(v, "on") || !strcasecmp(v, "yes") || !strcasecmp(v, "true")) x = 1;
    else if (!strcasecmp(v, "off") || !strcasecmp(v, "no") || !strcasecmp(v, "false")) x = 0;
    else { x = strtol(v, &e, 10);       /* decimal, as settings.ini checks it: "047300" is 47300, not octal */
           if (e == v || *e){ rlog("[roam] %s=\"%s\" is not a number, using %d\n", k, v, def); return def; } }
    if (x < lo || x > hi){ rlog("[roam] %s=%ld out of range %d..%d, using %d\n", k, x, lo, hi, def); return def; }
    return (int)x;
}
static struct {
    int on, test, collide, max_cars, rate, delay_ms, extrap_ms, carpool_kb, labels, spawn_m;
    int test_owncars;                         /* NFSU2_ROAM_TEST_OWNCARS (test aid): friends only in cars of our own (slots 3 and up) */
    int test_outside;                         /* NFSU2_ROAM_TEST_OUTSIDE (test aid): every car of our own outside the car index */
    int hit_share;                            /* NFSU2_ROAM_HIT_SHARE: % of a hit with a friend's car the player's car keeps (roam_game_contact);
                                                 -1: by the two cars' weights (car_mass, their square roots), 100: the game's own (the whole hit) */
    int test_mass, test_fmass;                /* NFSU2_ROAM_TEST_MASS / _FMASS (test aid, kg): car_mass of the player's car / friends' cars */
    char name[RC_NAME_MAX + 1], room[64];
    char crew[RC_CREW_MAX][100]; int ncrew;   /* NFSU2_ROAM_CREW: the crews' names, in the player's order (crews_parse; the
                                                 page's 24 characters are up to 96 bytes of UTF-8) */
    uint32_t crew_rgb[RC_CREW_MAX];           /* ...and their colours (NFSU2_ROAM_CREW_RGB, the player's picks; else CREW_RGB) */
} O;

/* ---- state ------------------------------------------------------------------------------- */
static rc_session g_s;
static int g_inited, g_net_ok;
static long g_frame0;
/* sync clock (µs): world time pulled to the host clock */
static double g_sync; static int g_sync_paused, g_in_roam;
static uint32_t g_step;                       /* frames (world steps) counted here: roam_game_contact's passes of one step */
static double g_vscale = 1.0;                 /* world seconds per stamp second (velocities on the wire) */
static int64_t g_last_host;
/* local car */
static float g_lp[3]; static int g_lp_ok;
static float g_lv[3];                         /* its velocity (m/s of world time) */
static float g_lf[2];                         /* where it points: its forward row in x and y, of length 1 (or 0) */
static int64_t g_cfg_next;
static int g_horn;                            /* the player's horn sounds this frame */
static uint8_t g_thumps; static int g_landed;  /* the player's car's landings so far; it landed last frame */
/* guest memory for rides and records (allocated once, never freed) */
static uint32_t g_gmem;
/* slots */
/* FREE: no friend, the car (if any) has its own ride.  CREATING: a car of
 * our own is being made.  LOADING: the friend's ride is streaming in.
 * ACTIVE: the friend's car is shown (or hidden while the friend is in a shop
 * or race).  PARKED: no friend any more, but the car keeps the last friend's
 * ride, hidden, so that the same look coming back costs nothing (no new
 * load, no new composited skin) */
enum { SL_FREE, SL_CREATING, SL_LOADING, SL_ACTIVE, SL_PARKED };
typedef struct {
    int      st;
    int      peer; uint32_t peer_id;          /* session table index and id */
    char     name[RC_NAME_MAX + 1];
    uint32_t car, world;                      /* the slot's car in this world */
    int      created;                         /* one of our own cars (k >= NOPP) */
    int      unindexed;                       /* ...past World::IndexCars' 22: record kind KIND_OUT */
    uint32_t ride_new, ride_orig, rec;        /* guest buffers */
    uint32_t h_cur, h_new;                    /* CarLoader handles (on the car / loading) */
    uint32_t h_orig;                          /* a car of our own: its first ride (an opponent's copy) */
    int      have_orig, activated;
    uint32_t cfg_gen;  int pending_cfg;       /* the record the car shows / one waiting */
    uint32_t look;                            /* hash of the record the car shows (0: none) */
    int64_t  load_t0, load_wait; long load_f0;    /* load_wait: how long the load may take (loads_waiting) */
    int      hidden;
    int      paused;                          /* the friend is paused (for a second now): so says the name over the car */
    int64_t  paused_since;
    int64_t  near_since;                      /* within DU_NEAR_M of the player's car since (0: not), for an outrun */
    int      ghost;                           /* solid cars: no collision body until clear of the player's car */
    int      soft;                            /* passable now (SOFT_*): no collision body, whatever the ghost rule */
    int64_t  idle_since;                      /* the friend's car stands since (0: it moves) */
    float    drawn[3];                        /* where the car was drawn last frame (+0x60) */
    float    drawn_v[3];                      /* ...and its velocity there (+0x70) */
    /* hits with the player's car push it on this screen (push_pose) */
    struct { float v[3], v0[3]; int64_t t; } pq[PUSH_Q]; int pqn;   /* the pushes the friend's game has not reported yet, oldest first
                                                                       (v0: the friend's velocity as their game had it then; t: the hit, in their time) */
    int64_t  rt;                              /* the friend's time the car was drawn at last frame (rc_interp_eval) */
    float    net_v[3];                        /* ...and its velocity there, as their game has it */
    float    push_v[3], push_u[3];            /* their sum (m/s), and how far they have moved the car since (m) */
    float    push_r[3];                       /* a leftover offset, fading (m) */
    uint32_t hit_step;                        /* g_step of the last hit */
    float    com[3];                          /* centre-of-mass offset in the car's frame (forward, left, up) */
    float    spin[4], steer;                  /* the wheels' angles about the axle and the front wheels' steering (rad) */
    float    susp[4];                         /* the wheels' suspension offsets as wheels_pose left them (CAR_SUSP) */
    int64_t  unseen_since;                    /* the peer is not visible: release after a while */
    int64_t  release_after;
    char     carname[RC_CFG_TYPE_NAME + 1];
    char     gin[2][32];                      /* its engine sound's GIN files, pulling and letting off (eng_files; "": none) */
    float    eng_idle, eng_max;               /* ...its car type's idle and most rpm */
    /* statistics */
    uint32_t loads, remode, pose_frames, wakes;   /* wakes: the game's wake-ups refused (roam_game_inert) */
    uint32_t moded, wheelfix;                 /* other physics modes the game set (roam_game_inert); frames the wheels were put back (wheels_pose) */
    uint32_t blinks;                          /* times the game blinked the car out (unblink) */
    uint32_t hits; float hit_max;             /* hits with the player's car; the most speed the game gave the player's car in one (m/s) */
    int64_t  touch_t;                         /* when the car last touched the player's car (host time; block_hit) */
    int      crew;                            /* the friend is in our crew number crew - 1 (O.crew; 0: none) */
} Slot;
static Slot g_sl[NSLOT];
static uint32_t g_world_seen;
static uint32_t g_handles_pending[3 * NSLOT]; static int g_npending;   /* unload once the world is gone */
static int g_created_n;                       /* cars of our own in this world */
/* the outrun challengers' manager: the game's (EM_GAME), held off by us
 * (EM_HELD: state 6, its cars parked), or being stood down (EM_STANDDOWN:
 * state 6, its cars still out until they are out of sight) */
enum { EM_GAME, EM_HELD, EM_STANDDOWN };
static int g_em; static int64_t g_em_release_at, g_em_sd_t0;
static int g_em_pin;                          /* a car of ours in its window: held until the world changes */
static int g_em_racing_noted;
/* frame cost */
static uint64_t g_cost_sum, g_cost_n, g_cost_max, g_cost_win_sum, g_cost_win_n, g_cost_win_max;
static uint64_t g_cost_hud;                   /* roam_game_hud since the last frame, counted with the next one */
static int64_t g_cost_win_t0;
/* statistics */
static int g_joins, g_leaves;                 /* changed with the session lock held */
static uint32_t g_teleports, g_clock_snaps, g_acquires, g_releases, g_load_fail, g_creates, g_reuses, g_restores;
/* test aid: per-frame pose log */
static rh_file *g_poselog;
/* a script command that calls guest code waits for the main-loop hook */
#ifdef ROAM_HOST_SCRIPT
#define NJOB 4
static char g_job[NJOB][240]; static int g_njob;
static void run_job(CPU *c, const char *job);
#endif

/* ---- events from the session (network or game thread, lock held) ------------------------ */
#if MPRACES
static uint32_t g_quit_id;                    /* a player who quit (said so: not one gone out of range), for mp_frame */
#endif
void roam_game_event(int ev, int peer, const char *text){
    if (ev == RC_EV_JOIN) __atomic_fetch_add(&g_joins, 1, __ATOMIC_RELAXED);
    if (ev == RC_EV_LEAVE) __atomic_fetch_add(&g_leaves, 1, __ATOMIC_RELAXED);
#if MPRACES
    /* (the slot is cleared after the event) */
    size_t tl = strlen(text);
    if (ev == RC_EV_LEAVE && peer >= 0 && peer < RC_TABLE && ((tl > 11 && !strcmp(text + tl - 11, " left: quit")) ||
                                                              (tl > 19 && !strcmp(text + tl - 19, " left: switched off"))))
        __atomic_store_n(&g_quit_id, g_s.peer[peer].id, __ATOMIC_RELAXED);
#endif
    rlog("[roam] %s%s (peer %d)\n", ev == RC_EV_JOIN ? "JOIN: " : ev == RC_EV_LEAVE ? "LEAVE: " : "", text, peer);
}

/* ---- the local car -------------------------------------------------------------------------- */
static void rd3(uint32_t a, float *o){ o[0] = MRF32(a); o[1] = MRF32(a + 4u); o[2] = MRF32(a + 8u); }
/* The car has hydraulics: the level its HYDRAULICS part gives it (RideInfo
 * +0x581, UpdatePartsEnabled 0x61BCD0), or G_HYD_LEVEL's when that is not -1,
 * as the driver's hydraulics controls (0x4078A0) read it */
static int has_hydraulics(uint32_t car){
    uint32_t ride = car ? rd32(car + 0x10u) : 0;
    int32_t lv = ok(ride, 0x581) ? (int8_t)MR8(ride + 0x581u) : 0, ov = (int32_t)rd32(G_HYD_LEVEL);
    return (ov > -1 ? ov : lv) != 0;
}
/* The car's nitrous while it is on: what is left of a full shot, in 1/100
 * (0x5925B0: left / full; more than 1 for a car that had some over), 0 when
 * it is off.  CAR_NOS +0x420 is when it went on, +0x41C what was left then,
 * +0x414 a full shot (all in G_TICKS); 0x7FFFFFFF is no time. */
static uint8_t nos_left(uint32_t car){
    uint32_t n = car + CAR_NOS, since = MR32(n + 0x420u), full = MR32(n + 0x414u), left = MR32(n + 0x41cu);
    if (!since || since == 0x7fffffffu || !full || full == 0x7fffffffu || left == 0x7fffffffu) return 0;
    float r = ((float)(int32_t)left - (float)(int32_t)(MR32(G_TICKS) - since)) / (float)(int32_t)full;
    if (!(r > 0.f)) return 0;
    if (r >= 2.55f) return 255;
    int v = (int)(r * 100.f + 0.5f);
    return (uint8_t)(v < 1 ? 1 : v);
}
/* The player's car's engine sound (CARSFX_PlayerEngine, its update 0x474310
 * and 0x474030): an AEMS voice of the car's engine bank and two GIN voices
 * of its recordings, pulling and letting off, at the rpm of its
 * SFXCTL_Engine (+0x128, on the sound's scale: 1000 at idle, 10000 at the
 * most, with the clutch and the limiter in it), each at its volume from the
 * engine's mix (+0xC0: +0x7C the AEMS's, +0x80 the pulling's, +0x84 the
 * letting-off's) times the engine sound's own volume (its control word, at
 * [+0x58], from the game's mix maps), all 0 .. 0x7FFF */
#define VT_SFX_PENGINE  0x0078af30u   /* CARSFX_PlayerEngine (vtable) */
#define VT_SFXCTL_ENG   0x00789f70u   /* SFXCTL_Engine (vtable) */
#define VT_ENG_MIX      0x00789fe4u   /* the engine's mix (vtable) */
static uint32_t player_engine(uint32_t car){
    uint32_t st = ok(car, 0x9e0) ? rd32(car + CAR_SOUND) : 0;
    if (!ok(st, 0x100) || rd32(st + 0x30u) != car) return 0;
    for (uint32_t ch = rd32(st + 0x20u), i = 0; ok(ch, 0x110) && i < 64u; ch = rd32(ch + 0x50u), i++)
        if (rd32(ch) == VT_SFX_PENGINE) return ch;
    return 0;
}
static uint8_t eng_vol(uint32_t v, uint32_t x){                 /* v x x (an int) on 0 .. 255 */
    int32_t xi = (int32_t)x;
    uint32_t p = v * (uint32_t)(xi < 0 ? 0 : xi > 0x7fff ? 0x7fff : xi) >> 15;
    return (uint8_t)((p + 64u) >> 7 > 255u ? 255u : (p + 64u) >> 7);
}
/* for friends' games, which play it with the car's own GIN files (carsfx.c) */
static void eng_state(uint32_t car, rc_state *s){
    uint32_t pe = player_engine(car), ctl = pe ? rd32(pe + 0xb8u) : 0, mix = pe ? rd32(pe + 0xc0u) : 0, vp = pe ? rd32(pe + 0x58u) : 0;
    if (!ok(ctl, 0x130) || rd32(ctl) != VT_SFXCTL_ENG || !ok(mix, 0x88) || rd32(mix) != VT_ENG_MIX || !ok(vp, 4)) return;
    float r = MRF32(ctl + 0x128u);
    if (!__builtin_isfinite(r) || r < 1.f) return;
    uint32_t v = MR32(vp) & 0x7fffu;
    s->eng = (uint16_t)(r > 20000.f ? 20000 : (int)(r + 0.5f));
    s->eng_base = eng_vol(v, MR32(mix + 0x7cu)); s->eng_acc = eng_vol(v, MR32(mix + 0x80u)); s->eng_dcl = eng_vol(v, MR32(mix + 0x84u));
}
static int local_state(rc_state *s){
    uint32_t car = player_car();
    if (!ok(car, 0x9e0)) return 0;
    float f[3], l[3], u[3];
    memset(s, 0, sizeof *s);
    s->t_us = (uint32_t)(uint64_t)(int64_t)g_sync;
    rd3(car + 0x60u, s->p); rd3(car + 0x70u, s->v); rd3(car + 0x110u, s->w);
    rd3(car + 0x90u, f); rd3(car + 0xa0u, l); rd3(car + 0xb0u, u);
    rc_m2q(f, l, u, s->q);
    s->speed = MRF32(car + 0x42cu); s->rpm = MRF32(car + 0x440u); s->gear = (int8_t)MR32(car + 0x434u);
    uint32_t ctl = MR32(car + 0x30u);
    if (ok(ctl, 0x220)){
        s->throttle = MRF32(ctl + 0x20cu); s->brake = MRF32(ctl + 0x214u);
        s->steer = (float)(int16_t)MR16(ctl + 0x1e0u) / 32767.f;
        if (s->brake > 0.1f) s->bits |= RC_BIT_BRAKE;
        if (MRF32(ctl + 0x210u) > 0.1f) s->bits |= RC_BIT_HANDBRAKE;
    }
    if (s->speed < -0.5f) s->bits |= RC_BIT_REVERSE;
    if (g_horn) s->bits |= RC_BIT_HORN;
    /* the extension: the wheel places' heights in the car (the suspension,
     * and the hydraulics, which lift the body off its wheels) and the nitrous */
    s->ext = 1;
    for (uint32_t w = 0; w < 4; w++){
        float z = MRF32(car + 0x130u + 0x40u * w + 0x38u);
        s->wz[w] = __builtin_isfinite(z) ? z : 0.f;
    }
    s->nos = nos_left(car);
    if (s->nos) s->bits |= RC_BIT_NOS;
    /* the hydraulics, for their sound on friends' screens (carsfx.c): each
     * wheel's state (0x5ED470: the physics' own, so only in physics mode 1)
     * and the landings so far (CAR_BUMP is set for a frame as the car lands) */
    uint32_t ph = rd32(car + CAR_PHYS); int landed = 0;
    if (MR32(car + 0x28u) == 1 && ok(ph, CAR_HYD + 0x10u))
        for (uint32_t w = 0; w < 4; w++) s->hyd |= (uint8_t)((MR32(ph + CAR_HYD + 4u * w) & 3u) << (2u * w));
    for (uint32_t w = 0; w < 4; w++) landed |= MR8(car + CAR_BUMP + w) != 0;
    if (landed && !g_landed) g_thumps++;
    g_landed = landed; s->thumps = g_thumps;
    /* each wheel's slip and surface, for friends' tyre smoke, dirt and skid
     * sounds (slip_pose): the physics' own (mode 1), on the ground only */
    if (MR32(car + 0x28u) == 1)
        for (uint32_t w = 0; w < 4; w++){
            if (!MR8(car + CAR_GROUND + w)) continue;
            float a = MRF32(car + CAR_SLIP + 8u * w), b = MRF32(car + CAR_SLIP + 8u * w + 4u);
            uint32_t sf = MR32(car + CAR_SURF + 4u * w);
            s->slip[2 * w] = __builtin_isfinite(a) ? a : 0.f; s->slip[2 * w + 1] = __builtin_isfinite(b) ? b : 0.f;
            s->surf[w] = sf < N_SURF ? (uint8_t)sf : 0;
        }
    /* the engine as the game sounds it, for friends' games (eng_state) */
    eng_state(car, s);
    if (g_sync_paused > 1){ for (int i = 0; i < 3; i++){ s->v[i] = 0; s->w[i] = 0; } s->speed = 0; s->rpm = 0; for (int i = 0; i < 8; i++) s->slip[i] = 0; }
    for (int i = 0; i < 3; i++) if (!__builtin_isfinite(s->p[i]) || !__builtin_isfinite(s->v[i])) return 0;
    /* the stamp clock may run a little faster than the world (it is pulled
     * to the host clock): velocities per stamp second, so the receiver's
     * tangents and dead reckoning match the stamps */
    for (int i = 0; i < 3; i++){ s->v[i] = (float)(s->v[i] * g_vscale); s->w[i] = (float)(s->w[i] * g_vscale); }
    /* the rest comes from the car unchecked: never NaN or infinity on the wire */
    for (int i = 0; i < 3; i++) if (!__builtin_isfinite(s->w[i])) s->w[i] = 0;
    if (!__builtin_isfinite(s->speed)) s->speed = 0;
    if (!__builtin_isfinite(s->rpm)) s->rpm = 0;
    if (!__builtin_isfinite(s->throttle)) s->throttle = 0;
    if (!__builtin_isfinite(s->brake)) s->brake = 0;
    if (!__builtin_isfinite(s->steer)) s->steer = 0;
    if (__builtin_fabsf(s->p[2] - PARK_Z) < 100.f) return 0;
    return 1;
}
/* the car look: type name hash and one (slot, key, owner) per filled part
 * slot of the car's RideInfo */
static int local_cfg(uint8_t *out, int cap, char *tname){
    uint32_t car = player_car(), ride = car ? rd32(car + 0x10u) : 0, types = rd32(G_CARTYPES), owners = rd32(G_PARTOWNERS);
    if (!ok(ride, 0x8f0) || !types || !owners) return 0;
    uint32_t type = MR32(ride);
    if (type >= 256) return 0;                       /* Unlimiter adds car types after the stock ones */
    uint32_t ti = types + type * 0x890u;
    if (!ok(ti, 0x100)) return 0;
    static rc_carcfg c;
    memset(&c, 0, sizeof c);
    c.type_hash = MR32(ti + 0xd0u);
    cstr(ti, c.type_name, sizeof c.type_name);
    if (tname) snprintf(tname, RC_CFG_TYPE_NAME + 1, "%s", c.type_name);
    for (int i = 0; i < 4; i++) c.ride_b[i] = MR8(ride + 4u + (uint32_t)i);
    /* performance, as the game's LAN car description (0x5F0320) has it */
    memset(c.perf, 0, sizeof c.perf);
    for (int i = 0; i < 10; i++) if (MR32(ride + 0x318u + 4u * (uint32_t)i)) c.perf[i >> 3] |= (uint8_t)(0x80u >> (i & 7));
    for (int i = 0; i < 68; i++) if (MR8(ride + 0x340u + (uint32_t)i)) c.perf[2 + (i >> 3)] |= (uint8_t)(0x80u >> (i & 7));
    for (int i = 0; i < 41; i++) c.perf[11 + i] = MR8(ride + 0x398u + (uint32_t)i);
    c.has_perf = 1;
    /* Carry the game's own rating: remote rides have no physics block from
     * which another client could calculate this reliably. */
    { CarPerf pf;
      if (mprace_car_perf(car, &pf) && pf.rating > 0.f && pf.rating <= 5000.f){
          c.has_rating = 1; c.rating_cls = (int8_t)pf.cls; c.rating = (uint16_t)(pf.rating + 0.5f);
      }
    }
    int horn = rh_horn_mine();                       /* the horn the others hear from this car */
    if (horn >= 0){ c.has_horn = 1; c.horn = (uint8_t)horn; }
    for (uint32_t sl = 0; sl < RC_PART_SLOTS; sl++){
        uint32_t part = MR32(ride + 0x590u + 4u * sl);
        if (!part || !ok(part, 0xe)) continue;
        uint32_t key = (uint32_t)MR16(part + 2u) << 16 | MR16(part);
        uint32_t own = rd32(owners + 4u * MR8(part + 7u));
        c.part[c.n_parts].slot = (uint8_t)sl; c.part[c.n_parts].key = key; c.part[c.n_parts].owner = own; c.n_parts++;
    }
    return rc_carcfg_encode(&c, out, cap);
}

/* ---- building a remote ride ---------------------------------------------------------------- */
/* the part of car type `type` in ride slot sl with this key and owner, as
 * the CarPartDB has it (NewGetCarPart; parts of other owners may share the
 * key), or 0 */
static uint32_t find_part(CPU *c, uint32_t type, uint32_t sl, uint32_t key, uint32_t owner){
    uint32_t owners = rd32(G_PARTOWNERS), prev = 0;
    for (int tries = 0; tries < 6; tries++){
        uint32_t a[5] = { type, sl, key, prev, 0xffffffffu };
        uint32_t p = rh_call(c, FN_GETCARPART, G_CARPARTDB, 0, 5, a);
        if (!p || !ok(p, 0xe)) return 0;
        if (!owners || rd32(owners + 4u * MR8(p + 7u)) == owner) return p;
        prev = p;
    }
    return 0;
}
/* Decode a car-look record into the RideInfo at ride (0x8F0 bytes of guest
 * memory) with skin slot n: RideInfo::Init, stock parts, then each slot of
 * the record looked up by its key in the CarPartDB (NewGetCarPart, owner
 * checked) and written; slots the record does not name are left empty, as
 * on the sender; a part this game does not have keeps the stock part.
 * Returns the number of parts not found, or -1. */
static int build_ride(CPU *c, const rc_carcfg *cc, uint32_t ride, uint32_t skin, char *why, int whylen){
    uint32_t types = rd32(G_CARTYPES);
    uint32_t ti = gcall1(c, FN_TYPE_BY_HASH, 0, cc->type_hash);
    uint32_t type;
    int missing = 0;
    if (ti && types && ti >= types && (ti - types) % 0x890u == 0) type = (ti - types) / 0x890u;
    else {
        /* an add-on car this game does not have (Unlimiter): a stock car of
         * a type with the same name prefix, or the Peugeot 206 (type 0) */
        type = 0;
        for (uint32_t i = 0; i < 46 && types; i++){
            char n[20]; cstr(types + i * 0x890u, n, sizeof n);
            if (n[0] && !strncasecmp(n, cc->type_name, 4)){ type = i; break; }
        }
        snprintf(why, (size_t)whylen, "car type %s unknown here, shown as type %u", cc->type_name, type);
        missing = -1;
    }
    for (uint32_t i = 0; i < 0x8f0u; i += 4) MR32(ride + i) = 0;
    uint32_t ia[4] = { type, 0, cc->ride_b[1], cc->ride_b[2] };
    rh_call(c, FN_RIDE_INIT, ride, 0, 4, ia);
    /* performance and tuning first, the way the game's own LAN car
     * description decoder (0x5F04D0) builds a remote car: without them the
     * physics block is incomplete and CreateCar's physics pass faults */
    {
        uint8_t pf[RC_PERF_BYTES];
        if (cc->has_perf) memcpy(pf, cc->perf, sizeof pf);
        else { memset(pf, 0, sizeof pf); memset(pf + 11, 0x64, 41); }      /* stock: no parts, default tuning */
        for (int i = 0; i < 10; i++) MR32(ride + 0x318u + 4u * (uint32_t)i) = (pf[i >> 3] >> (7 - (i & 7))) & 1u;
        uint32_t perf = g_gmem + 0x40u;                                    /* scratch: {u32 0, 9 bytes of bits} */
        MR32(perf) = 0; MR8(perf + 4u) = 0;
        for (int i = 0; i < 9; i++) MR8(perf + 5u + (uint32_t)i) = pf[2 + i];
        gcall1(c, FN_PERF_SET, ride + 0x2f0u, perf);
        for (int i = 0; i < 41; i++) MR8(ride + 0x398u + (uint32_t)i) = pf[11 + i];
        /* the physics pass (0x5B4FC0) is not run: on a ride built here it
         * faults (an empty engine table, 0x5764D0); remote cars need no
         * physics, and only SetRideInfo (which does not run it) sees them */
    }
    gcall1(c, FN_RIDE_STOCK, ride, 0);
    if (missing < 0 || cc->n_parts == 0){                /* stock car */
        gcall1(c, FN_RIDE_SKINS, ride, skin);
        return missing < 0 ? 0 : 0;
    }
    uint32_t want[RC_PART_SLOTS] = {0}; uint8_t named[RC_PART_SLOTS] = {0};
    char miss[48] = {0}; int at = 0;
    for (int k = 0; k < cc->n_parts; k++){
        uint32_t sl = cc->part[k].slot, found = find_part(c, type, sl, cc->part[k].key, cc->part[k].owner);
        named[sl] = 1;
        if (found) want[sl] = found;
        else { missing++; if (at < (int)sizeof miss - 8) at += snprintf(miss + at, sizeof miss - (size_t)at, " 0x%x", sl); }
    }
    for (uint32_t sl = 0; sl < RC_PART_SLOTS; sl++){
        if (named[sl] && want[sl]) MR32(ride + 0x590u + 4u * sl) = want[sl];
        else if (!named[sl]) MR32(ride + 0x590u + 4u * sl) = 0;
        /* named but not found here: the stock part stays */
    }
    for (int i = 0; i < 4; i++) MR8(ride + 4u + (uint32_t)i) = cc->ride_b[i];
    gcall0(c, FN_RIDE_PARTSON, ride);
    gcall1(c, FN_RIDE_SKINS, ride, skin);
    if (missing > 0) snprintf(why, (size_t)whylen, "%d part(s) not in this game (slot%s), stock parts instead", missing, miss);
    return missing;
}

/* ---- paint slots past the game's six ---------------------------------------------------------- */
/* A car's paint (the composited skin: base colour, vinyls) goes into the
 * texture its ride names DUMMY_SKIN<n>, its rims into DUMMY_WHEEL<n> and its
 * spinners into DUMMY_SPINNER<n> (0x61C280).  The game's are n = 1..6
 * (GlobalMemoryFile.bin); its compositor (0x61D790) keeps a cache for those
 * six and composites into any other texture GetTextureInfo (0x4901D0)
 * finds.  The game's six are texture packs of their own in CARS/TEXTURES.BIN
 * (pixels, then the TextureInfo, then its platform record), which the car
 * loader reads in while a car uses that slot; slot 1, the player's car, is
 * always there.  Slots 7 and up get copies of a slot that is there: its
 * TextureInfo (0x7C bytes) and platform record (0x20 bytes: +0/+4 the links
 * of the game's list of D3D textures, +0x18 the texture) copied, pixels of
 * their own (zero), the D3D texture made by the game (0x5CE170), handed out
 * by the port's override of GetTextureInfo (roam.c).  Made once, when a car
 * first needs them, and kept. */
#define FN_TEXINFO      0x004901d0u   /* cdecl (hash, default, 0) -> TextureInfo* (one that is loaded) */
#define FN_TEX_CREATE   0x005ce170u   /* thiscall TextureInfo: its D3D texture from +0x70's pixels */
#define TI_SZ           0x7cu         /* TextureInfo: +0 platform record, +0x24 name hash, +0x40 bytes of mip 0, +0x4E mips,
                                       * +0x6C itself (or the texture named by +0x2C), +0x70 pixels */
#define PLAT_SZ         0x20u         /* platform record: +0x18 the D3D texture */
static struct { uint32_t hash, ti; } g_tex[3 * NSLOT]; static int g_ntex;
static uint8_t g_texbits[0x2000u / 8u];       /* hash & 0x1fff of every g_tex: the override's quick no */
static uint32_t bhash(const char *s){ uint32_t h = 0xffffffffu; for (; *s; s++) h = h * 33u + (uint8_t)*s; return h; }  /* bStringHash 0x43DB50 */
#ifndef ROAM_HOST_WIN
static int8_t g_skin_ok[NSLOT + SKIN_GAME];   /* paint slot n: 1 its textures are there, -1 they could not be made */
#endif
uint32_t roam_game_texture(uint32_t h){
    if (!(g_texbits[(h & 0x1fffu) >> 3] & (1u << (h & 7u)))) return 0;
    for (int i = 0; i < g_ntex; i++) if (g_tex[i].hash == h) return g_tex[i].ti;
    return 0;
}
static int skin_textures(CPU *c, uint32_t n){
    if (n <= SKIN_GAME) return 1;
#ifdef ROAM_HOST_WIN
    (void)c; return 0;
#else
    if (n >= sizeof g_skin_ok) return 0;
    if (g_skin_ok[n]) return g_skin_ok[n] > 0;
    static const char *const fmt[3] = { "DUMMY_SKIN%u", "DUMMY_WHEEL%u", "DUMMY_SPINNER%u" };
    int had = 0, made = 0;
    for (int i = 0; i < 3 && g_ntex < 3 * NSLOT; i++){
        char nm[24];
        uint32_t src = 0;
        for (uint32_t t = 1; t <= SKIN_GAME && !src; t++){                                /* a slot that is there now */
            snprintf(nm, sizeof nm, fmt[i], (unsigned)t);
            uint32_t a[3] = { bhash(nm), 0, 0 };
            src = rh_call(c, FN_TEXINFO, 0, 0, 3, a);
            if (!ok(src, TI_SZ) || !ok(rd32(src), PLAT_SZ)) src = 0;
        }
        if (!src) continue;                                                               /* no spinners, say */
        had++;
        /* the pixels: mip 0's bytes, each further mip a quarter of the one before */
        uint32_t px = MR32(src + 0x40u), mips = MR8(src + 0x4eu), total = 0;
        for (uint32_t m = 0, b = px; m < (mips ? mips : 1u) && b; m++, b >>= 2) total += b > 16u ? b : 16u;
        if (!px || px > (16u << 20)){ rlog("[roam] f=%ld %s: %u bytes of pixels?\n", rh_frame(), nm, px); break; }
        uint32_t sz = TI_SZ + PLAT_SZ + total + 64u, ti = rh_call(c, FN_MALLOC, 0, 0, 1, &sz), pl = ti + TI_SZ;
        if (!ti) break;
        uint32_t pix = (pl + PLAT_SZ + 63u) & ~63u;
        memcpy(GPTR(ti), GPTR(src), TI_SZ); memcpy(GPTR(pl), GPTR(rd32(src)), PLAT_SZ);
        memset(GPTR(pix), 0, total);
        MR32(pl) = 0; MR32(pl + 4u) = 0; MR32(pl + 0x18u) = 0;
        snprintf(nm, sizeof nm, fmt[i], (unsigned)n);
        MR32(ti) = pl; MR32(ti + 0x24u) = bhash(nm); MR32(ti + 0x70u) = pix;
        for (uint32_t q = 0; q < 0x18u; q++) MR8(ti + 8u + q) = q < 0x17u && q < strlen(nm) ? (uint8_t)nm[q] : 0;   /* its name */
        if (MR32(ti + 0x6cu) == src) MR32(ti + 0x6cu) = ti;
        gcall0(c, FN_TEX_CREATE, ti);
        if (!rd32(pl + 0x18u)){ rlog("[roam] f=%ld %s: the game made no texture\n", rh_frame(), nm); break; }
        uint32_t h = MR32(ti + 0x24u);
        g_tex[g_ntex].hash = h; g_tex[g_ntex].ti = ti; g_ntex++;
        g_texbits[(h & 0x1fffu) >> 3] |= (uint8_t)(1u << (h & 7u));
        made++;
    }
    g_skin_ok[n] = had && made == had ? 1 : -1;
    if (g_skin_ok[n] > 0) rlog("[roam] f=%ld paint slot %u: %d textures of our own (the paint %ux%u, format 0x%02x, %u mips)\n", rh_frame(), n,
                               made, (unsigned)MR16(g_tex[g_ntex - made].ti + 0x44u), (unsigned)MR16(g_tex[g_ntex - made].ti + 0x46u),
                               (unsigned)MR8(g_tex[g_ntex - made].ti + 0x4au), (unsigned)MR8(g_tex[g_ntex - made].ti + 0x4eu));
    else rlog("[roam] f=%ld paint slot %u: its textures could not be made (%d of %d): no car in that slot\n", rh_frame(), n, made, had);
    return g_skin_ok[n] > 0;
#endif
}

/* ---- slots ------------------------------------------------------------------------------------ */
static uint32_t skin_of(uint32_t rec){ return rec >= G_RECORDS && rec < G_RECORDS + 22u * REC_SZ ? (rec - G_RECORDS) / REC_SZ + 1u : 0; }
/* slot k's paint slot: an opponent car's own (its record's place: 2-4), ours
 * 5 and up */
static uint32_t slot_skin(int k){
    if (k >= NOPP) return 5u + (uint32_t)(k - NOPP);
    uint32_t n = skin_of(g_sl[k].car ? rd32(g_sl[k].car + 0x14u) : 0);
    return n ? n : 2u + (uint32_t)k;
}
/* g_gmem: scratch for guest-call arguments (+0x40 a performance block, +0x80
 * a grid entry, +0xA0 a file name, +0x100 the name labels' vectors and
 * strings), then the slots' rides and records */
#define GM_SCRATCH 0x200u
static void gmem_init(CPU *c){
    if (g_gmem) return;
    uint32_t sz = NSLOT * (2u * RIDE_SZ + REC_SZ) + 0x100u + GM_SCRATCH;
    g_gmem = rh_call(c, FN_MALLOC, 0, 0, 1, &sz);
    if (!g_gmem){ rlog("[roam] guest malloc failed\n"); return; }
    for (uint32_t i = 0; i < sz; i += 4) MR32(g_gmem + i) = 0;
    for (int k = 0; k < NSLOT; k++){
        uint32_t b = ((g_gmem + 0xffu) & ~0xffu) + GM_SCRATCH;
        b += (uint32_t)k * (2u * RIDE_SZ + REC_SZ);
        g_sl[k].ride_new = b; g_sl[k].ride_orig = b + RIDE_SZ; g_sl[k].rec = b + 2u * RIDE_SZ;
    }
}
static void unload_later(uint32_t h){
    if (!h) return;
    if (g_npending < 3 * NSLOT) g_handles_pending[g_npending++] = h;
    else rlog("[roam] too many rides waiting to be unloaded, one kept\n");
}
static void set_name(Slot *s){
    uint32_t rec = s->car ? rd32(s->car + 0x14u) : 0;
    if (!ok(rec, 0x920)) return;
    for (int i = 0; i < 16; i++) MR8(rec + 0x90cu + (uint32_t)i) = i < 15 ? (uint8_t)s->name[i] : 0;
    MR8(rec + 0x90cu + 15u) = 0;
}
static void make_inert(CPU *c, uint32_t car){
    if (rd32(car + 0x24u) != 0) gcall1(c, FN_CAR_SETDRIVER, car, 0);
    if (rd32(car + 0x28u) != 0) gcall1(c, FN_CAR_SETPHYS, car, 0);
}
/* the car's collision body on or off: a disable count at +0x17 (0x5930F0
 * adds one, 0 is on) */
static void body_set(CPU *c, uint32_t car, int solid){
    uint32_t body = rd32(car + 0x3cu);
    if (!ok(body, 0x20)) return;
    if (!solid && MR8(body + 0x17u) == 0) gcall0(c, FN_BODY_DISABLE, body);
    else if (solid && MR8(body + 0x17u) != 0) MR8(body + 0x17u) = 0;
}
/* a shown friend's car: solid unless it is a ghost or passable, and a ghost
 * until it is clear of the player's car.  Its body only while it is near the
 * player's car: the game's collision step (0x5FFA50 in World::DoTimestep)
 * tests every body against the others near it (0x5B5050, the box test
 * 0x595040), friends' cars against each other too, which two cars posed by
 * us never need; 32 of them crossing each other's paths took 3-4.5 ms a
 * frame (a crowd round the new career's start, roam-crowd --spread 10) */
static void body_update(CPU *c, int k){
    Slot *s = &g_sl[k];
    uint32_t me = player_car();
    int near = 0;
    if (O.collide && ok(me, 0x70)){
        float dx = MRF32(s->car + 0x60u) - MRF32(me + 0x60u), dy = MRF32(s->car + 0x64u) - MRF32(me + 0x64u),
              dz = MRF32(s->car + 0x68u) - MRF32(me + 0x68u), d2 = dx * dx + dy * dy + dz * dz;
        if (s->ghost && d2 > CLEAR_M * CLEAR_M){
            s->ghost = 0;
            if (!s->soft) rlog("[roam] f=%ld slot %d: %s's car is solid now\n", rh_frame(), k, s->name);
        }
        near = d2 < SOLID_M * SOLID_M;
    }
    body_set(c, s->car, O.collide && !s->ghost && !s->soft && near);
}
static void ghost_all(void){ for (int k = 0; k < NSLOT; k++) g_sl[k].ghost = 1; }
/* Passable cars.  A friend's car has no physics of its own here: it is
 * where the friend is, and the player's car cannot push it away.  A crowd
 * waiting at a shop's or the garage's door walled it off, and a paused
 * friend's car stood in the way for as long as its tab was in the
 * background.  So a friend's car has no collision body (as a ghost) while
 * the friend or the player is paused, or has stood for a minute, or either
 * car is near a door: a shop's, the garage's or the car lot's trigger (type
 * 14; every career has them all).  Each of those rules holds for the pair,
 * so both screens agree on whether two cars touch.  A race's start is an
 * event's trigger (type 13), which leads somewhere or not by each player's
 * career: there a player near one of their own open events lets every car
 * through theirs (events_read), and says so to the others in the snapshots
 * (RC_BIT_PASS), so the pair agrees again; the same bit makes the car of a
 * player whose friends' cars are ghosts (NFSU2_ROAM_COLLIDE=0) passable for
 * everyone.  Passable no longer, the car is a ghost until it is clear of the
 * player's car, as when it appears.  A player at the new career's start is
 * not shown to others (at_spawn), so there friends' cars are passable for
 * the player too.  A car parked across a road (an SUV at the airport's way
 * out, which the others could not shove away) was passable after a minute
 * only if its player never nudged it, so a player's car that stays near one
 * spot after hits by others (there or on its way there: hits shove it) lets
 * every car through it as well until it leaves that spot (stay_update,
 * block_hit; only its own game sees all its hits, so it says so with
 * RC_BIT_PASS).  A car of a traffic type (a bus or a fire truck across the
 * airport's way out: a profile a save editor changed makes one the player's)
 * is passable whoever sees it: its own game says so, and every other game
 * sees its type, so a game that does not say so cannot keep it solid. */
enum { SOFT_PAUSED = 1, SOFT_IDLE = 2, SOFT_DOOR = 4, SOFT_SPAWN = 8, SOFT_EVENT = 16, SOFT_SAYS = 32, SOFT_BLOCK = 64,
       SOFT_TRAFFIC = 128 };
/* an open event: its trigger's box, and what it leads to (FN_MARKER_WHAT's
 * out[kind]: 1 a race, 2 a shop, 3 a showcase (a cover shoot), 4 another
 * (the table at 0x838424: STAGE_2_SHOW_1, STAGE_3_PERF_1, ...)) */
typedef struct { float box[4]; uint32_t what; int kind; } OpenEvent;
static struct {
    int      n;
    float    box[MAX_DOORS][4];               /* min x, min y, max x, max y (the trigger's +0x20) */
    uint32_t first, end;                      /* the list was read from these */
    int64_t  paused_since, idle_since;        /* the player is paused / the player's car stands, since (0: not) */
    int      me;                              /* the player's own reasons (SOFT_*) */
    /* the spot the player's car stays near (BLOCK_M), and its last hits */
    float    stay[3];
    int64_t  stay_since;                      /* (0: none: a new one from the next frame in free roam) */
    int      blocking;                        /* in the way there (SOFT_BLOCK) */
    int      traffic;                         /* the player's car is of a traffic type (SOFT_TRAFFIC) */
    struct { uint32_t id; int64_t t; } hit[BLOCK_Q];   /* the friend (peer id) and when; a ring */
    int      hit_at, hit_n;
    /* the player's open events (events_read), and how many of the career's
     * event triggers there are */
    int      nev, evall;
    OpenEvent ev[MAX_EVENTS];
    uint32_t ev_first, ev_end, ev_at;         /* the list asked from; the next trigger to ask (0: no sweep now) */
    int      ev_nb, ev_seen;                  /* the sweep so far: open, asked */
    OpenEvent ev_new[MAX_EVENTS];
    int64_t  ev_next;                         /* the next sweep */
    uint64_t ev_ns, ev_ns_max; int ev_frames; /* this sweep's cost: in all, the dearest frame's, its frames */
    uint64_t ev_cost[3];                      /* ...the last whole sweep's (mp events) */
} g_pass;
/* the doors' boxes: the track's triggers stay while its world does; read
 * again when their place changes */
static void doors_read(void){
    uint32_t e = rd32(G_TRIGGERS + 0x440u + 4u * TRIG_DOOR), end = rd32(G_TRIGGERS + 0x444u + 4u * TRIG_DOOR);
    if (e == g_pass.first && end == g_pass.end) return;
    g_pass.first = e; g_pass.end = end; g_pass.n = 0;
    while (e < end && g_pass.n < MAX_DOORS && ok(e, 0x44)){
        int sz = (int16_t)MR16(e + 0x42u);
        float *b = g_pass.box[g_pass.n];
        for (int i = 0; i < 4; i++) b[i] = MRF32(e + 0x20u + 4u * (uint32_t)i);
        if (b[0] <= b[2] && b[1] <= b[3]) g_pass.n++;
        if (sz <= 0) break;
        e += (uint32_t)sz;
    }
    if (g_pass.n) rlog("[roam] f=%ld doors: %d shops' and garages' triggers, friends' cars near them are passable\n", rh_frame(), g_pass.n);
}
static int near_box(const float *b, float x, float y){
    return x >= b[0] - DOOR_M && x <= b[2] + DOOR_M && y >= b[1] - DOOR_M && y <= b[3] + DOOR_M;
}
static int near_door(float x, float y){ for (int i = 0; i < g_pass.n; i++) if (near_box(g_pass.box[i], x, y)) return 1; return 0; }
static int near_event(float x, float y){ for (int i = 0; i < g_pass.nev; i++) if (near_box(g_pass.ev[i].box, x, y)) return 1; return 0; }
#if MPRACES
/* in one of the player's open events' triggers: Engage there enters the game's */
static int in_event(float x, float y){
    for (int i = 0; i < g_pass.nev; i++){
        const float *b = g_pass.ev[i].box;
        if (x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]) return 1;
    }
    return 0;
}
#endif
/* The player's open events: the event triggers Engage would enter now, by
 * the game's own test (0x5EB040 finds the trigger the car is in, 0x527800
 * what it leads to, 0x5EAFB0 enters it if 0x532A50 says so: a race open in
 * the career, a cover shoot not done yet, one of the stage's other events;
 * in the prologue none).  Both are lookups in the career's tables: a few
 * triggers a frame (all 196 took 0.4 ms in 25 frames, at most 30 us a
 * frame), all of them again every EV_SWEEP_US, and from the start for a new
 * track.  Saves of stages 2 and 3 had 11 to 22 open. */
static void events_read(CPU *c, int64_t host){
    uint32_t first = rd32(G_TRIGGERS + 0x440u + 4u * TRIG_EVENT), end = rd32(G_TRIGGERS + 0x444u + 4u * TRIG_EVENT);
    if (first != g_pass.ev_first || end != g_pass.ev_end){
        g_pass.ev_first = first; g_pass.ev_end = end; g_pass.nev = g_pass.evall = 0; g_pass.ev_at = 0; g_pass.ev_next = 0;
        g_pass.ev_ns = g_pass.ev_ns_max = 0; g_pass.ev_frames = 0;
    }
    if (!g_gmem) return;
    if (!g_pass.ev_at){
        if (host < g_pass.ev_next || !first || first >= end) return;
        g_pass.ev_at = first; g_pass.ev_nb = g_pass.ev_seen = 0;
    }
    uint32_t out = g_gmem + EV_SCR;
    uint64_t t0 = rh_ns();
    for (int i = 0; i < EV_PER_FRAME && g_pass.ev_at < end && ok(g_pass.ev_at, 0x44); i++){
        uint32_t e = g_pass.ev_at, a[2] = { out, e };
        int sz = (int16_t)MR16(e + 0x42u);
        rh_call(c, FN_MARKER_WHAT, G_CAREER, 0, 2, a);
        if (MR32(out) == e && (rh_call(c, FN_MARKER_OPEN, G_CAREER, 0, 1, &out) & 0xffu) && g_pass.ev_nb < MAX_EVENTS){
            OpenEvent *v = &g_pass.ev_new[g_pass.ev_nb];
            for (int j = 0; j < 4; j++) v->box[j] = MRF32(e + 0x20u + 4u * (uint32_t)j);
            v->kind = 0; v->what = 0;
            for (int k = 1; k <= 4 && !v->kind; k++) if (MR32(out + 4u * (uint32_t)k)){ v->kind = k; v->what = MR32(out + 4u * (uint32_t)k); }
            if (v->box[0] <= v->box[2] && v->box[1] <= v->box[3]) g_pass.ev_nb++;
        }
        g_pass.ev_seen++;
        g_pass.ev_at = sz > 0 ? e + (uint32_t)sz : end;
    }
    uint64_t dt = rh_ns() - t0;
    g_pass.ev_ns += dt; g_pass.ev_frames++;
    if (dt > g_pass.ev_ns_max) g_pass.ev_ns_max = dt;
    if (g_pass.ev_at < end && ok(g_pass.ev_at, 0x44)) return;
    g_pass.ev_cost[0] = g_pass.ev_ns; g_pass.ev_cost[1] = g_pass.ev_ns_max; g_pass.ev_cost[2] = (uint64_t)g_pass.ev_frames;
    g_pass.ev_ns = g_pass.ev_ns_max = 0; g_pass.ev_frames = 0;
    if (g_pass.ev_nb != g_pass.nev || g_pass.ev_seen != g_pass.evall)
        rlog("[roam] f=%ld events: %d of the career's %d events' triggers open; with the player near one, every car is passable\n", rh_frame(),
                g_pass.ev_nb, g_pass.ev_seen);
    memcpy(g_pass.ev, g_pass.ev_new, sizeof g_pass.ev);
    g_pass.nev = g_pass.ev_nb; g_pass.evall = g_pass.ev_seen;
    g_pass.ev_at = 0; g_pass.ev_next = host + EV_SWEEP_US;
}
/* The new career's start: every new player's car appears there (all on one
 * spot, cars inside cars), stands through the prologue's first seconds, and
 * an idle tab's stays.  Players arrive and wait there all the time, so a
 * friend's car within NFSU2_ROAM_SPAWN_M (5 m; 0: none) of it is not shown,
 * as a friend's in a shop */
static int at_spawn(const float *p){
    float dx = p[0] - SPAWN_X, dy = p[1] - SPAWN_Y, dz = p[2] - SPAWN_Z, r = (float)O.spawn_m;
    return dx * dx + dy * dy + dz * dz < r * r;
}
/* the spot the player's car stays near: a new one once the car is farther
 * than BLOCK_M from it */
static void stay_update(int64_t host, const float *at){
    float dx = at[0] - g_pass.stay[0], dy = at[1] - g_pass.stay[1], dz = at[2] - g_pass.stay[2];
    if (g_pass.stay_since && dx * dx + dy * dy + dz * dz <= BLOCK_M * BLOCK_M) return;
    if (g_pass.blocking) rlog("[roam] f=%ld my car has left the spot it stood on: friends' cars touch it again\n", rh_frame());
    memcpy(g_pass.stay, at, sizeof g_pass.stay);
    g_pass.stay_since = host; g_pass.blocking = 0;
}
/* a car of a traffic type (TYPE_TRAFFIC): its type's name in name, or 0 */
static int traffic_car(uint32_t car, char *name, int len){
    uint32_t types = rd32(G_CARTYPES), ti = ok(car, 0x10) ? rd32(car + 0xcu) : 0;
    if (!types || ti < types || (ti - types) % 0x890u) return 0;
    uint32_t t = (ti - types) / 0x890u;
    if (t < TYPE_TRAFFIC || t >= TYPE_STOCK) return 0;
    if (name) cstr(ti, name, len);
    return 1;
}
/* the player's car's hits with friends' cars in the last BLOCK_WIN_US, and
 * from how many of them (*cars) */
static int block_hits(int64_t host, int *cars){
    uint32_t ids[BLOCK_Q];
    int n = 0, nc = 0;
    for (int i = 0; i < g_pass.hit_n; i++){
        if (host - g_pass.hit[i].t > BLOCK_WIN_US) continue;
        n++;
        int j = 0;
        while (j < nc && ids[j] != g_pass.hit[i].id) j++;
        if (j == nc) ids[nc++] = g_pass.hit[i].id;
    }
    *cars = nc;
    return n;
}
/* the player's own reasons, once a frame: paused (a second, as a friend's
 * pause counts), standing, near a door or one of their open events, at the
 * new career's start, standing in others' way, a traffic car; any of them,
 * or ghost cars, goes out in the snapshots (local_state: RC_BIT_PASS) */
static void soft_me(CPU *c, int64_t host, uint8_t status){
    doors_read();
    events_read(c, host);
    if (status != RC_ST_PAUSED) g_pass.paused_since = 0;
    else if (!g_pass.paused_since) g_pass.paused_since = host;
    float v = rc_sqrtf(g_lv[0] * g_lv[0] + g_lv[1] * g_lv[1] + g_lv[2] * g_lv[2]);
    if (v >= IDLE_MPS && status != RC_ST_PAUSED) g_pass.idle_since = 0;
    else if (!g_pass.idle_since) g_pass.idle_since = host;
    uint32_t me = player_car();
    float at[3] = { 0.f, 0.f, 0.f };
    if (ok(me, 0x70)){ rd3(me + 0x60u, at); stay_update(host, at); }
    else g_pass.stay_since = g_pass.blocking = 0;
    char tn[20];
    int traffic = ok(me, 0x70) && traffic_car(me, tn, sizeof tn);
    if (traffic != g_pass.traffic && ok(me, 0x70)){
        if (traffic) rlog("[roam] f=%ld my car is a traffic car (%s): every car drives through it\n", rh_frame(), tn);
        else rlog("[roam] f=%ld my car is no traffic car any more: friends' cars touch it again\n", rh_frame());
        g_pass.traffic = traffic;
    }
    if (!g_pass.blocking && g_pass.stay_since && host - g_pass.stay_since >= BLOCK_US){
        int cars = 0, n = block_hits(host, &cars);
        if (n >= BLOCK_HITS && cars >= BLOCK_CARS){
            g_pass.blocking = 1;
            rlog("[roam] f=%ld my car has stayed within %.0f m for %.0f s after %d hits from %d players' cars in %.0f s: every car drives through it\n",
                 rh_frame(), (double)BLOCK_M, (double)(host - g_pass.stay_since) / 1e6, n, cars, (double)BLOCK_WIN_US / 1e6);
        }
    }
    g_pass.me = (g_pass.paused_since && host - g_pass.paused_since >= 1000000 ? SOFT_PAUSED : 0) |
                 (g_pass.idle_since && host - g_pass.idle_since >= IDLE_US ? SOFT_IDLE : 0) |
                 (ok(me, 0x70) && near_door(at[0], at[1]) ? SOFT_DOOR : 0) |
                 (ok(me, 0x70) && near_event(at[0], at[1]) ? SOFT_EVENT : 0) |
                 (ok(me, 0x70) && at_spawn(at) ? SOFT_SPAWN : 0) |
                 (g_pass.blocking ? SOFT_BLOCK : 0) | (g_pass.traffic ? SOFT_TRAFFIC : 0);
}
/* a shown friend's car's reasons, the player's added; leaving them makes it
 * a ghost.  The friend's own (RC_BIT_PASS): near one of their open events,
 * their cars ghosts, or what we see too; and a traffic car, said or not */
static void soft_update(Slot *s, const rc_pose *pose, int64_t host){
    if (!s->paused && __builtin_fabsf(pose->speed) >= IDLE_MPS) s->idle_since = 0;
    else if (!s->idle_since) s->idle_since = host;
    int soft = g_pass.me | (s->paused ? SOFT_PAUSED : 0) | (s->idle_since && host - s->idle_since >= IDLE_US ? SOFT_IDLE : 0) |
               (near_door(pose->p[0], pose->p[1]) ? SOFT_DOOR : 0) | (pose->bits & RC_BIT_PASS ? SOFT_SAYS : 0) |
               (traffic_car(s->car, 0, 0) ? SOFT_TRAFFIC : 0);
    if (s->soft && !soft) s->ghost = 1;
    s->soft = soft;
}
/* A hidden car is out of the world: Car +0x550 clear, as Car::Deactivate
 * leaves it (its other state stays as it is; shown again, it is set).  The
 * minimap draws an AI racer's arrow (0x4CA6D0) and the world map makes its
 * marker (0x4E0440) only for a car with it set: a hidden one had its arrow at
 * the parking spot's (0, 0), or on the minimap's edge pointing there, for a
 * friend in a race, a shop or the menus, gone, or still loading. */
#define CAR_ACTIVE      0x550u
static void soft_park(CPU *c, uint32_t car){
    MR8(car + CAR_ACTIVE) = 0;
    MRF32(car + 0x60u) = 0; MRF32(car + 0x64u) = 0; MRF32(car + 0x68u) = PARK_Z;
    MRF32(car + 0x50u) = 0; MRF32(car + 0x54u) = 0; MRF32(car + 0x58u) = PARK_Z;
    for (uint32_t o = 0x70u; o < 0x7cu; o += 4) MRF32(car + o) = 0;
    for (uint32_t o = 0x110u; o < 0x11cu; o += 4) MRF32(car + o) = 0;
    MRF32(car + 0x42cu) = 0; MRF32(car + 0x430u) = 0;
    MR32(car + CAR_NOS + 0x420u) = 0;                                    /* no nitrous (nos_pose) */
    for (uint32_t w = 0; w < 4; w++) MRF32(car + CAR_SUSP + 4u * w) = 0.f;   /* the wheels at rest (wheels_pose) */
    for (uint32_t i = 0; i < 8; i++) MRF32(car + CAR_SLIP + 4u * i) = 0.f;   /* no slip: no smoke (slip_pose) */
    gcall0(c, FN_CAR_SECTION, car);
}
/* A race's end blinks its AI racers out: FinishRacer (0x606CB0) with its
 * blink, which the race's update (0x6076D0) asks for when no Player owns the
 * racer's car, sets car +0x998, the blink's start (game ticks) at +0x974 and
 * its length at +0x978.  The renderer (0x6316D0 -> 0x60D4F0) and the
 * minimap's arrow (0x4CA6D0) skip a car with +0x998 set, every other frame
 * while the blink lasts and for good after it; only Car::Activate clears it.
 * In an outrun a friend's car is the AI racer: at its end, in the winner's
 * game and the loser's alike, the friend's car went for good and only their
 * name stayed where it was (reported in play; roam_mp_outrun_view_a/b).  A
 * friend's car is shown or hidden by us alone, so the blink goes at once, as
 * the game ends one (+0x974 = 0, 0x5FBDE2). */
#define CAR_BLINKOUT    0x998u
#define CAR_BLINK_T0    0x974u
static void unblink(Slot *s){
    uint32_t car = s->car;
    if (!MR8(car + CAR_BLINKOUT)) return;
    if (s->blinks++ < 3) rlog("[roam] f=%ld slot %d: %s's car was blinked out by the game (a race's end): shown again\n",
                              rh_frame(), (int)(s - g_sl), s->name);
    MR8(car + CAR_BLINKOUT) = 0; MR32(car + CAR_BLINK_T0) = 0;
}
/* The RandomEncounterManager (race coordinator +0xC40; Update 0x42EDF0):
 * state 0 resets it (0x412F90: its three rides unloaded, World cars[first ..
 * first+2] taken as its cars), 1 asks the career whether an outrun is due,
 * 3 cruises its cars near the player and tries to engage, 4 races, 5 parks
 * its cars -- 0x40BF60, and 0x40BFB0 for every car of the AI range that is
 * out, not engaged and 250 m away, friends' cars included -- tells the
 * career (0x500CA0) and goes to 0; at 6 and above Update does nothing.  It
 * drove a friend's car it had taken as its own into a fault (0x41C100 on a
 * null brain), so it never sees one:
 *  - while any friend has (or is about to get) a car in this world it is
 *    held in 6;
 *  - from 3 or 5 it is stood down the way its own state 5 does it, but for
 *    its three cars only: each is parked once an outrun's end blinked it
 *    out (unblink) or 250 m from the player, or after 20 s anyway; then the
 *    career is told and it goes to 0, which re-reads its cars (the game's
 *    three opponent cars: ours are kept out of that window,
 *    keep_out_of_window) and then to 1, where it is held;
 *  - during an outrun (4) it is left alone (the race has two racers, so
 *    this is not free roam for roaming(): friends' cars are hidden, as in
 *    any race); its 5 afterwards is taken over as above;
 *  - a minute after the last friend left it is let go (6 -> 0). */
static void em_update(CPU *c, int want, int64_t host){
    uint32_t em = encounter_mgr();
    if (!em) return;
    uint32_t st = MR32(em);
    if (g_em == EM_HELD){ if (st != 6u) MR32(em) = 6u; return; }
    if (g_em == EM_STANDDOWN){
        MR32(em) = 6u;
        uint32_t me = player_car();
        int out = 0, parked = 0;
        for (uint32_t k = 0; k < 3; k++){
            uint32_t car = rd32(em + EM_TABLE + 0xcu + 0x10u * k);
            if (!ok(car, 0x9e0) || !car_out(car)) continue;
            float dx = me ? MRF32(car + 0x60u) - MRF32(me + 0x60u) : 1e4f, dy = me ? MRF32(car + 0x64u) - MRF32(me + 0x64u) : 0;
            if (MR8(car + CAR_BLINKOUT) || dx * dx + dy * dy > 250.f * 250.f || host - g_em_sd_t0 > EM_STANDDOWN_US){
                gcall0(c, FN_CAR_DEACTIVATE, car); MR8(em + EM_TABLE + 8u + 0x10u * k) = 0; parked++;
            } else out++;
        }
        if (parked) rlog("[roam] f=%ld outrun challengers: %d car(s) parked, %d still near you\n", rh_frame(), parked, out);
        if (!out){
            gcall0(c, FN_EM_OVER, G_ENCOUNTERS);
            MR32(em) = 0;                       /* its next Update resets it (state 0), then it is held at 1 */
            g_em = EM_GAME;
            rlog("[roam] f=%ld outrun challengers stood down after %.1f s\n", rh_frame(), (host - g_em_sd_t0) / 1e6);
        }
        return;
    }
    if (!want) return;
    if (st == 4u){                              /* an outrun is being raced: not interrupted */
        if (!g_em_racing_noted){ g_em_racing_noted = 1;
            rlog("[roam] f=%ld an outrun is on: the outrun challengers are stood down when it is over\n", rh_frame()); }
        return;
    }
    g_em_racing_noted = 0;
    if (st == 3u || st == 5u){
        MR32(em) = 6u; g_em = EM_STANDDOWN; g_em_sd_t0 = host;
        rlog("[roam] f=%ld outrun challengers off while friends are here: standing down (state %u)\n", rh_frame(), st);
        return;
    }
    MR32(em) = 6u; g_em = EM_HELD;              /* 0, 1, 2: its cars are parked */
    rlog("[roam] f=%ld outrun challengers off while friends are here (state %u)\n", rh_frame(), st);
}
/* a car of ours in the manager's window, World cars[first .. first+2] */
static int ours_in_window(uint32_t w){
    for (int i = 0; i < 3; i++){ uint32_t car = ai_car(w, i); if (car && !game_opponent(car)) return 1; }
    return 0;
}
static void em_let_go(void){
    uint32_t em = encounter_mgr(), w = world();
    if (g_em != EM_HELD || !em) return;
    if (g_em_pin || (w && ours_in_window(w))){
        static long said; if (rh_frame() - said > 7200){ said = rh_frame();
            rlog("[roam] f=%ld outrun challengers stay off: a car of ours is in their window\n", rh_frame()); }
        return;
    }
    if (MR32(em) == 6u){ MR32(em) = 0; rlog("[roam] f=%ld outrun challengers back on\n", rh_frame()); }
    g_em = EM_GAME;
}
/* a game opponent car that no slot uses (slots 0-2) */
static uint32_t free_opponent_car(uint32_t w){
    int n = (int)MR32(w + 0x18u) - (int)MR32(w + 0x14u);
    for (int i = 0; i < n && i < 22; i++){
        uint32_t car = ai_car(w, i);
        if (!car || !game_opponent(car) || car_out(car)) continue;
        int used = 0;
        for (int k = 0; k < NSLOT; k++) if (g_sl[k].car == car) used = 1;
        if (!used) return car;
    }
    return 0;
}
static int opp_slots_used(void){ int n = 0; for (int k = 0; k < NOPP; k++) if (g_sl[k].st != SL_FREE) n++; return n; }

/* the manager's state 0 takes World cars[first .. first+2] as its three
 * cars; IndexCars puts the AI racers in the order of the World's list, and
 * the game changes that order (one of ours had become
 * cars[first] after a reversal of the list).  Our cars go to the end of the
 * list, as CreateCar appends, and the cars are indexed again: then the three
 * game opponents come first.  Only IndexCars writes cars[], and the game
 * calls it only when it builds a world. */
static void keep_out_of_window(CPU *c, uint32_t w){
    if (!ours_in_window(w)) return;
    for (int k = NOPP; k < NSLOT; k++){
        uint32_t car = g_sl[k].car;
        if (!g_sl[k].created || g_sl[k].unindexed || g_sl[k].world != w || !ok(car, 0x10)) continue;
        uint32_t nx = rd32(car), pv = rd32(car + 4u);
        if (!ok(nx, 8) || !ok(pv, 8) || rd32(pv) != car || rd32(nx + 4u) != car) continue;   /* not linked as expected */
        MR32(pv) = nx; MR32(nx + 4u) = pv;                           /* unlink */
        uint32_t tail = MR32(w + 4u);
        MR32(tail) = car; MR32(w + 4u) = car; MR32(car) = w; MR32(car + 4u) = tail;   /* append */
    }
    gcall0(c, FN_INDEXCARS, w);
    int still = ours_in_window(w);
    if (still) g_em_pin = 1;
    rlog("[roam] f=%ld car(s) of our own moved after the game's opponent cars in the AI range [%u, %u)%s\n", rh_frame(),
            MR32(w + 0x14u), MR32(w + 0x18u), still ? ": STILL in the outrun manager's window, it stays off in this world" : "");
}
/* forget every slot of a world that is gone (its cars were freed with it) */
static void world_gone(void){
    for (int k = 0; k < NSLOT; k++){
        Slot *s = &g_sl[k];
        if (s->h_cur) unload_later(s->h_cur);
        if (s->h_new) unload_later(s->h_new);
        if (s->h_orig) unload_later(s->h_orig);
        uint32_t rn = s->ride_new, ro = s->ride_orig, rec = s->rec;
        memset(s, 0, sizeof *s);
        s->ride_new = rn; s->ride_orig = ro; s->rec = rec;
    }
    g_created_n = 0; g_em = EM_GAME; g_em_pin = 0; g_em_racing_noted = 0; g_em_release_at = 0;
}
static void flush_unloads(CPU *c){
    for (int i = 0; i < g_npending; i++) gcall1(c, FN_LOADER_UNLOAD, G_CARLOADER, g_handles_pending[i]);
    if (g_npending) rlog("[roam] f=%ld %d ride(s) of friends' cars unloaded\n", rh_frame(), g_npending);
    g_npending = 0;
}
/* leaving free roam with the world still there: park the cars (rides stay
 * until the world is gone) */
static void park_all(CPU *c){
    for (int k = 0; k < NSLOT; k++){
        Slot *s = &g_sl[k];
        if (s->st == SL_ACTIVE && ok(s->car, 0x9e0) && !s->hidden){ soft_park(c, s->car); s->hidden = 1; }
    }
}
/* the friend is gone (left, timed out, or away too long): the car is
 * hidden but keeps the friend's ride for a while (SL_PARKED) */
static void release(CPU *c, int k, const char *why){
    Slot *s = &g_sl[k];
    if (s->st == SL_FREE || s->st == SL_PARKED) return;
    rlog("[roam] f=%ld slot %d: %s's car removed (%s)\n", rh_frame(), k, s->name, why);
    g_releases++;
    if (s->h_new){ unload_later(s->h_new); s->h_new = 0; s->pending_cfg = 0; }
    /* not made yet: forget it.  A car made whose first look cannot load now
     * (begin_load right after finish_create: a friend's shop parts waiting
     * for part_packs) goes on below: it stays ours, parked on its first ride
     * with h_orig kept, and the next try loads onto it */
    if (s->st == SL_CREATING && !s->car){
        if (s->h_orig) unload_later(s->h_orig);
        s->h_orig = 0; s->st = SL_FREE; s->peer = -1; s->peer_id = 0;
        return;
    }
    if (ok(s->car, 0x9e0) && s->h_cur){
        if (!s->hidden){ soft_park(c, s->car); s->hidden = 1; }
        s->st = SL_PARKED;
    } else s->st = SL_FREE;                          /* nothing of the friend's on it */
    s->peer = -1; s->peer_id = 0; s->unseen_since = 0; s->name[0] = 0;
    if (s->st == SL_FREE && k < NOPP){ s->car = 0; s->world = 0; }
}
/* the car gets its own ride back (still resident: the world, or for a car
 * of our own its first load, holds it), is deactivated, and the friend's
 * ride is unloaded */
static void restore(CPU *c, int k){
    Slot *s = &g_sl[k];
    if (s->st != SL_PARKED) return;
    if (ok(s->car, 0x9e0) && s->have_orig && s->activated){
        body_set(c, s->car, 1);
        gcall1(c, FN_CAR_SETRIDE, s->car, s->ride_orig);
        gcall0(c, FN_CAR_DEACTIVATE, s->car);
        s->activated = 0;
    }
    if (s->h_cur) gcall1(c, FN_LOADER_UNLOAD, G_CARLOADER, s->h_cur);
    Slot keep = *s;
    memset(s, 0, sizeof *s);
    s->ride_new = keep.ride_new; s->ride_orig = keep.ride_orig; s->rec = keep.rec; s->peer = -1;
    if (keep.created){                              /* the car stays ours, parked, for the next friend */
        s->car = keep.car; s->created = 1; s->unindexed = keep.unindexed; s->world = keep.world; s->h_orig = keep.h_orig;
        s->have_orig = keep.have_orig;
        memcpy(s->com, keep.com, sizeof s->com);
    }
    rlog("[roam] f=%ld slot %d: car back to its own ride\n", rh_frame(), k);
}
/* Room in the Cars pool for one more ride (3.6 MB), for a friend's new look
 * and for a car of our own alike.  An earlier look's ride, once unloaded,
 * stays in the loader with no reference: its model keeps its pool memory
 * until the loader runs short, and then the loader's own purge also evicts
 * composited skins (phase 1, the black player car of research §5.4).  So the
 * pool fills after about a dozen car types in one world and every new look
 * would be refused.  The unreferenced entries go first (phase 0, one per
 * call); entries in use (the player's, traffic's, parked friends' cars) are
 * not touched.  No room: logged once per friend every 1,200 frames.
 * The purge frees an unreferenced entry whatever it is doing, and a friend
 * who leaves while their car loads leaves one in the middle of its load: its
 * step under way (a pack, its textures) ends later in a callback that writes
 * into the freed entry or pack record, or whatever took its place, and goes
 * on with it.  So it runs only with the loader idle, as the game's own purge
 * does (0x63AE70 services the loader until +0x14 is 0); busy: the next frame. */
#define POOL_NEED (3600u * 1024u)
/* Room among the loader's ride entries (RIDE_ENTRIES) too.  An unloaded
 * ride keeps its entry until a purge, and the game purges only in Load
 * (0x63AE70), once every entry is taken -- after servicing the loader until
 * it is idle, and each step's callback goes straight on to the next load,
 * so the frame waited for the load under way and all those queued behind
 * it.  With friends coming and going all the time (the hub relinks as the
 * player drives), about 128 rides in, every load was a 30-530 ms frame (a
 * crowded 2026-10-26 session: none before the 128th load since the crib,
 * 95 of the 410 after).  So the unused entries go here, with the loader
 * idle, before they run out: one a frame (rides_tidy), two before a load.
 * A purge takes ~0.5 ms (a ride's models out): never a batch (20 at once
 * were a 6-16 ms frame).  RIDES_FREE stay free for a crowd arriving at once
 * (a jump: 32 loads queued while the old rides are still held; with only
 * 16 free the rest waited for the loader one by one, all 32 cars shown
 * after 4.1 s instead of 3.0), and two at the least: this load's and one
 * for a load of the game's own (traffic).  Busy and short of those: the
 * next frame. */
#define RIDES_FREE      40
#define RIDES_STEP      2
static struct { int n; int64_t us; } g_rides_out;
static void rides_out(CPU *c, uint32_t p, int most){
    uint32_t n = MR32(p + 0x2cu);
    if (MR32(p + 0x18u) + RIDES_FREE <= n || rd32(G_CARLOADER + LOADER_BUSY)) return;
    int k = 0;
    int64_t t0 = roam_plat_now_us();
    while (MR32(p + 0x18u) + RIDES_FREE > n && k < most && (gcall1(c, FN_LOADER_PURGE, G_CARLOADER, 0) & 0xffu)) k++;
    g_rides_out.n += k; g_rides_out.us += roam_plat_now_us() - t0;
    if (g_rides_out.n >= 50){
        rlog("[roam] f=%ld car loader: %d unused rides out (%.1f ms in all), %u of %u entries in use\n", rh_frame(), g_rides_out.n,
             g_rides_out.us / 1000.0, MR32(p + 0x18u), n);
        g_rides_out.n = 0; g_rides_out.us = 0;
    }
}
static void rides_tidy(CPU *c){
    uint32_t p = rd32(G_RIDEPOOL);
    if (ok(p, 0x30)) rides_out(c, p, 1);
}
static int ride_room(CPU *c){
    uint32_t p = rd32(G_RIDEPOOL);
    if (!ok(p, 0x30)) return 1;
    uint32_t n = MR32(p + 0x2cu);
    rides_out(c, p, RIDES_STEP);
    if (MR32(p + 0x18u) + 2 <= n) return 1;
    static long said;
    if (!said || rh_frame() - said > 1200){ said = rh_frame();
        rlog("[roam] f=%ld car loader: %u of %u entries taken, the loader %s: loads wait\n", rh_frame(), MR32(p + 0x18u), n,
             rd32(G_CARLOADER + LOADER_BUSY) ? "busy" : "holding no unused ride"); }
    return 0;
}
static struct { uint32_t id; long next; } g_memnote[RC_TABLE];
static int pool_room(CPU *c, const Slot *s, const char *car /* 0: a car of our own */){
    if (!ride_room(c)) return 0;
    if (pool_free() >= POOL_NEED) return 1;
    if (rd32(G_CARLOADER + LOADER_BUSY)) return 0;
    int n = 0;
    while (pool_free() < POOL_NEED && n < 64 && (gcall1(c, FN_LOADER_PURGE, G_CARLOADER, 0) & 0xffu)) n++;
    if (n){ rlog("[roam] f=%ld car pool: %d unused model(s) unloaded\n", rh_frame(), n); pool_log("unloaded"); }
    if (pool_free() >= POOL_NEED) return 1;
    int i = s->peer >= 0 && s->peer < RC_TABLE ? s->peer : 0;
    if (g_memnote[i].id != s->peer_id || rh_frame() >= g_memnote[i].next){
        g_memnote[i].id = s->peer_id; g_memnote[i].next = rh_frame() + 1200;
        if (car) rlog("[roam] f=%ld not enough car memory for %s's %s (%u KB free): not shown (raise NFSU2_ROAM_CARPOOL_KB)\n",
                         rh_frame(), s->name, car, pool_free() / 1024u);
        else rlog("[roam] f=%ld not enough car memory for a car of our own for %s (%u KB free): not shown (raise NFSU2_ROAM_CARPOOL_KB)\n",
                  rh_frame(), s->name, pool_free() / 1024u);
        pool_log("full");
    }
    return 0;
}
/* A racer number no car of this world has and no car of ours being made
 * (a signed byte): 103 to 127, then 99 down to 66 (the player has 0, the
 * opponent cars 100 to 102, traffic from 50).  The minimap finds a car by it
 * (0x5F0E30, the first on the World's list), so each must be its own. */
static int racer_number_used(uint32_t w, int n){
    uint32_t it = rd32(w);
    for (int m = 0; it && it != w && m < 128 && ok(it, 0x9e0); m++, it = rd32(it)) if ((int16_t)MR16(it + 0xau) == n) return 1;
    for (int k = NOPP; k < NSLOT; k++) if ((g_sl[k].st == SL_CREATING || g_sl[k].created) && (int8_t)MR8(g_sl[k].rec + 1u) == n) return 1;
    return 0;
}
static int racer_number(uint32_t w){
    for (int n = 103; n <= 127; n++) if (!racer_number_used(w, n)) return n;
    for (int n = 99; n >= 66; n--) if (!racer_number_used(w, n)) return n;
    return 127;
}
/* a car of our own (slots 3 and up): a copy of the first opponent's racer
 * record (a racer number of its own, paint slot 5 and up), its ride loaded
 * through the CarLoader, then CreateCar (finish_create); the friend's ride
 * follows as for an opponent car */
static int part_packs(CPU *c);
static int begin_create(CPU *c, int k){
    Slot *s = &g_sl[k];
    uint32_t w = world(), opp = 0;
    for (int i = 0; w && i < 22 && !opp; i++){ uint32_t car = ai_car(w, i); if (car && game_opponent(car)) opp = car; }
    uint32_t orec = opp ? rd32(opp + 0x14u) : 0;
    if (!ok(orec, REC_SZ) || !g_gmem) return 0;
    part_packs(c);                                               /* (their loading starts; begin_load waits for them) */
    if (!skin_textures(c, slot_skin(k))) return 0;
    if (!pool_room(c, s, 0)) return 0;
    int rn = racer_number(w);
    memcpy(GPTR(s->rec), GPTR(orec), REC_SZ);
    MR8(s->rec + 1u) = (uint8_t)rn; MR8(s->rec + 0x900u) = 0;
    gcall1(c, FN_RIDE_SKINS, s->rec + 0x10u, slot_skin(k));
    uint32_t a3[3] = { s->rec + 0x10u, 0, 0 };
    s->load_wait = load_wait_us();
    s->h_orig = rh_call(c, FN_LOADER_LOAD, G_CARLOADER, 0, 3, a3);
    uint32_t a2[2] = { 0, 0 }; rh_call(c, FN_LOADER_SERVICE, G_CARLOADER, 0, 2, a2);
    s->load_t0 = roam_plat_now_us(); s->load_f0 = rh_frame();
    return 1;
}
static int finish_create(CPU *c, int k){
    Slot *s = &g_sl[k];
    uint32_t e = loader_entry(s->h_orig);
    uint32_t done = e ? gcall1(c, FN_LOADER_LOADED, G_CARLOADER, e) : 0;
    if (!done){
        if (roam_plat_now_us() - s->load_t0 > s->load_wait){ unload_later(s->h_orig); s->h_orig = 0; g_load_fail++; return -1; }
        return 0;
    }
    gcall1(c, FN_LOADER_WAIT, G_CARLOADER, s->h_orig);
    uint32_t w = world(), me = player_car();
    if (!w || !me) return -1;
    uint32_t grid = g_gmem + 0x80u;                          /* scratch: the grid entry {vec3, +0x10 heading} */
    for (uint32_t i = 0; i < 0x20u; i += 4) MR32(grid + i) = 0;
    MRF32(grid) = MRF32(me + 0x60u) + 6.f; MRF32(grid + 4) = MRF32(me + 0x64u); MRF32(grid + 8) = MRF32(me + 0x68u) + 0.5f;
    /* World::IndexCars writes cars[] without a bound, and the World's
     * fields follow its 22 entries: a car past them is of a kind IndexCars
     * skips, on the World's list only (the renderer walks the list; nothing
     * reads the debug arrays its index 0 writes, 0x89CCF8) */
    uint32_t n0 = MR32(w + 0x10u), a2[2] = { 0, 0 };
    int out = n0 >= WORLD_INDEX || O.test_outside;
    if (out) MR32(s->rec + 4u) = KIND_OUT;
    rh_call(c, FN_CREATECAR, grid, s->rec, 2, a2);
    if (!out) gcall0(c, FN_INDEXCARS, w);
    /* the new car is the one on the World's list with our racer record
     * (CreateCar's eax is not the car) */
    uint32_t car = 0, it = rd32(w);
    for (int n = 0; it && it != w && n < 128 && ok(it, 0x9e0); n++, it = rd32(it)) if (rd32(it + 0x14u) == s->rec) car = it;
    if (!car){ rlog("[roam] f=%ld slot %d: CreateCar made no car\n", rh_frame(), k); return -1; }
    s->car = car; s->created = 1; s->unindexed = out; s->world = w; s->activated = 1; g_created_n++; g_creates++;
    if (!out){
        keep_out_of_window(c, w);
        /* the minimap makes its icons when the HUD is built: an AI racer's
         * arrow for each car of the World's AI range then (by racer number,
         * 0x4EC950), so a car made later has none.  They are made again, now
         * with this one */
        gcall0(c, FN_MM_REBUILD, 0);
    }
    memcpy(GPTR(s->ride_orig), GPTR(s->rec + 0x10u), 0x8f0); s->have_orig = 1;
    make_inert(c, car);
    body_set(c, car, 0); s->ghost = 1;
    soft_park(c, car);
    rlog("[roam] f=%ld slot %d: car of our own created: car 0x%08x, %s, cars %u -> %u, AI range [%u, %u)\n", rh_frame(), k,
            car, out ? "outside the car index" : "indexed", n0, MR32(w + 0x10u), MR32(w + 0x14u), MR32(w + 0x18u));
    return 1;
}
/* The shops' parts that fit any car have models of their own, in packs all
 * cars share: spoilers, roof scoops, side mirrors, exhaust tips, brake
 * calipers and the trunk's audio in the game's eleven at G_PARTPACKS
 * (CARS\SPOILER\GEOMETRY.BIN, ...; a part's owner is its pack's folder,
 * bStringHash("SPOILER")), and the rim shops' rims (owner "WHEELS") in a
 * pack per brand, CARS\WHEELS\GEOMETRY_<BRAND>.BIN.  The car loader streams
 * a ride's models from those packs into the cars pool (0x63A920; the rims'
 * 0x633650), as it streams the car's own from its car's pack.  The model
 * streamer has those packs in the front end only, where the shops are:
 * going into the world, the game keeps the models the player's car uses
 * (the streamer's HIBERNATING pack, 0x48DAE0) and unloads the packs
 * (0x581A20).  So a friend's shop parts had nothing to stream from: the load
 * finished without them, the car's render info found no models for them
 * (0x634800: +0x17A8 + 0x20 x the ride slot) and the car was drawn without
 * its spoiler, roof scoop, side mirrors, exhaust tips and calipers, and with
 * shop rims without tyres and rims, its brake discs only.  The first
 * friend's car in free roam loads the packs again, for the session, as the
 * front end does (0x57F030 mode 1: each pack's header, a few KB; the pack
 * loader counts its loads, so the front end's own load and unload of them
 * stay a pair), and a ride with such parts waits until their headers are
 * in (at most PARTPACK_WAIT_US). */
#define FN_PACK_LOAD    0x004941c0u   /* cdecl (file, 0, 0, 0): a model pack for the streamer (one load more of a loaded one) */
#define FN_PACK_FIND    0x0048ce80u   /* thiscall G_STREAMER (file) -> the pack: +0x8A busy, +0xA0 its models (0: the header is not in) */
#define G_STREAMER      0x0082dbc8u
#define G_PARTPACKS     0x0086658cu   /* char *[N_PARTPACKS]: the shared part packs, CARS\<owner>\GEOMETRY.BIN (0x77D850) */
#define N_PARTPACKS     11
#define FN_PART_NEXT    0x0061b670u   /* thiscall G_CARPARTDB (car hash, slot, 0, previous part, -1) -> the next part */
#define FN_PART_NAME    0x00610000u   /* thiscall CarPart -> its name */
#define RIM_BRANDS      0xa6e1b733u   /* the rim brands: the parts of slot 0x43 of this car hash (0x57F030) */
#define OWNER_WHEELS    0x83347c07u   /* bStringHash("WHEELS"): an aftermarket rim's owner (0x633650) */
#define CRI_RIMS        0x1b48u       /* CarRenderInfo: the front rims' model (slot 0x1D's first), +0x20 the rear's (0x6174F4 draws them) */
#define CRI_MODELS      0x17a8u       /* CarRenderInfo: each ride slot's models, 0x20 bytes per slot (two of four LODs) */
#define PARTPACK_WAIT_US 10000000
static uint32_t g_pack[48]; static int g_npack = -1, g_packs_ok;   /* -1: not loaded yet */
static int64_t g_packs_t0;
static uint32_t g_packowner[N_PARTPACKS]; static int g_npackowner = -1;
static void gstr(uint32_t a, const char *s, uint32_t cap);
/* a part of one of the shared packs */
static int shared_owner(uint32_t owner){
    if (owner == OWNER_WHEELS) return 1;
    if (g_npackowner < 0){
        g_npackowner = 0;
        for (uint32_t i = 0; i < N_PARTPACKS; i++){
            char nm[64]; cstr(rd32(G_PARTPACKS + 4u * i), nm, sizeof nm);
            char *a = nm; while (*a && *a != '\\') a++;              /* CARS\<owner>\GEOMETRY.BIN */
            char *b = *a ? ++a : a; while (*b && *b != '\\') b++;
            if (!*b || b == a) continue;
            *b = 0; g_packowner[g_npackowner++] = bhash(a);
        }
    }
    for (int i = 0; i < g_npackowner; i++) if (g_packowner[i] == owner) return 1;
    return 0;
}
/* Those packs stay in from here on, and the game does not expect that: going
 * from the front end into the world (0x581A20) it moves the models the
 * player's car uses out of them into the HIBERNATING pack (0x48DAE0) and
 * unloads them, and the front end's load of them takes the models back
 * (0x48DC60, 0x57F030 mode 4).  A pack kept in by this load still lists
 * those models (not loaded) beside HIBERNATING, and the streamer loads and
 * unloads a model by name in whichever pack it finds first (0x48CED0, the
 * most recently used first): a friend's car with one of the player's parts
 * loaded a second copy into the pack, loads and unloads were counted against
 * either copy, and the front end's take-back wrote HIBERNATING's over the
 * pack's.  After a visit to the front end (a shop, the crib) the player's car
 * had no model left for its rims, spoiler or exhaust tips, in free roam and
 * in races (tests/scripts/roam_ownparts.txt: 4 of 4 drawn, then 1, then 0;
 * players' reports: a magazine cover's car without wheels).  So the models go back to their pack as the front end does,
 * whenever HIBERNATING holds some a pack of ours lists: once the pack is idle
 * (0x48D3C0's test: header in, no loads going on), and only while none of
 * them has a copy of its own in the pack (taking them back writes over the
 * pack's entry).  Then each model is in one pack again, and its loads and
 * unloads all count there. */
#define FN_PACK_WAKE    0x0048dc60u   /* cdecl (file): a pack's models back from HIBERNATING (0x57F030 mode 4) */
#define G_HIBER         0x00830c78u   /* HIBERNATING's models: +0xC how many, +0x78 the list (0x18 bytes: +0 name, +0x14 the data) */
static uint32_t g_wake_n = 0xffffffffu; static int g_wake_dup;
static uint32_t pack_model(uint32_t pk, uint32_t name){
    uint32_t tab = MR32(pk + 0xa0u), n = MR32(pk + 0xa4u), lo = 0, hi = n;
    if (!tab || n > 100000u || !ok(tab, n * 0x18u)) return 0;
    while (lo < hi){ uint32_t m = (lo + hi) / 2u; if (MR32(tab + 0x18u * m) < name) lo = m + 1u; else hi = m; }   /* sorted (0x488BC0) */
    return lo < n && MR32(tab + 0x18u * lo) == name ? tab + 0x18u * lo : 0;
}
static void packs_wake(CPU *c){
    uint32_t n = rd32(G_HIBER + 0xcu), tab = rd32(G_HIBER + 0x78u);
    if (g_npack <= 0 || n == g_wake_n) return;      /* nothing new there */
    g_wake_n = n;
    if (!n || n > 0x100u || !ok(tab, n * 0x18u)) return;
    for (int i = 0; i < g_npack; i++){
        uint32_t pk = g_pack[i];
        if (!ok(pk, 0xc0) || !MR32(pk + 0xa0u)) continue;
        int k = 0, dup = 0;
        for (uint32_t j = 0; j < n; j++){
            uint32_t e = pack_model(pk, MR32(tab + 0x18u * j));
            if (e){ k++; dup += MR32(e + 0x14u) != 0; }
        }
        if (!k) continue;
        char nm[64]; cstr(pk + 8u, nm, sizeof nm);
        if (MR8(pk + 0x8au) || !MR32(pk + 0x90u) || (int32_t)MR32(pk + 0xa8u) > 0){ g_wake_n = 0xffffffffu; continue; }  /* busy: next frame */
        if (dup){
            if (!g_wake_dup++) rlog("[roam] f=%ld %s: %d of its %d models in HIBERNATING are in it too, left there\n", rh_frame(), nm, dup, k);
            continue;
        }
        uint32_t file = pk + 8u;
        rh_call(c, FN_PACK_WAKE, 0, 0, 1, &file);
        rlog("[roam] f=%ld %s: %d model(s) back from HIBERNATING (%u left there)\n", rh_frame(), nm, k, rd32(G_HIBER + 0xcu));
        n = rd32(G_HIBER + 0xcu); tab = rd32(G_HIBER + 0x78u);
        if (!n || n > 0x100u || !ok(tab, n * 0x18u)) break;
    }
    if (g_wake_n != 0xffffffffu) g_wake_n = rd32(G_HIBER + 0xcu);
}
static void load_pack(CPU *c, uint32_t file, const char *path){
    uint32_t z[4] = { file, 0, 0, 0 };
    rh_call(c, FN_PACK_LOAD, 0, 0, 4, z);
    uint32_t pk = gcall1(c, FN_PACK_FIND, G_STREAMER, file);
    if (pk) g_pack[g_npack++] = pk;
    else rlog("[roam] f=%ld %s did not load\n", rh_frame(), path);
}
static int part_packs(CPU *c){
    if (g_packs_ok) return 1;
    if (!g_gmem) return 0;
    if (g_npack < 0){
        g_npack = 0; g_packs_t0 = roam_plat_now_us();
        const int cap = (int)(sizeof g_pack / sizeof g_pack[0]);
        char path[96];
        for (uint32_t i = 0; i < N_PARTPACKS; i++){
            uint32_t file = rd32(G_PARTPACKS + 4u * i);
            cstr(file, path, sizeof path);
            if (path[0]) load_pack(c, file, path);
        }
        int shared = g_npack;
        uint32_t fn = g_gmem + 0xa0u, part = 0;
        for (int i = 0; i < 64 && g_npack < cap; i++){
            uint32_t a[5] = { RIM_BRANDS, 0x43u, 0, part, 0xffffffffu };
            if (!(part = rh_call(c, FN_PART_NEXT, G_CARPARTDB, 0, 5, a))) break;
            char nm[40]; cstr(gcall0(c, FN_PART_NAME, part), nm, sizeof nm);
            if (!nm[0]) continue;
            snprintf(path, sizeof path, "CARS\\WHEELS\\GEOMETRY_%s.BIN", nm);
            gstr(fn, path, 0x60u);
            load_pack(c, fn, path);
        }
        rlog("[roam] f=%ld friends' shop parts: %d shared packs and %d rim brands' packs loaded\n", rh_frame(), shared, g_npack - shared);
    }
    int in = 0;
    for (int i = 0; i < g_npack; i++) in += ok(g_pack[i], 0xc0) && !MR8(g_pack[i] + 0x8au) && MR32(g_pack[i] + 0xa0u);
    if (in < g_npack && roam_plat_now_us() - g_packs_t0 < PARTPACK_WAIT_US) return 0;
    if (in < g_npack) rlog("[roam] f=%ld friends' shop parts: %d of %d packs in after %.0f s, going on without the others\n", rh_frame(), in,
                           g_npack, PARTPACK_WAIT_US / 1e6);
    else rlog("[roam] f=%ld friends' shop parts: the packs are in after %.1f s\n", rh_frame(), (roam_plat_now_us() - g_packs_t0) / 1e6);
    packs_wake(c);                                  /* the player's car's models back in them first */
    g_packs_ok = 1;
    return 1;
}
/* start loading peer's ride for slot k */
static int begin_load(CPU *c, int k, const uint8_t *cfg, int len, uint32_t gen){
    Slot *s = &g_sl[k];
    rc_carcfg cc;
    if (rc_carcfg_decode(cfg, len, &cc) != RC_OK) return 0;
    int in = part_packs(c), shop = 0;                            /* (the packs start loading with the first friend) */
    for (int i = 0; i < cc.n_parts; i++) shop |= shared_owner(cc.part[i].owner);
    if (!in && shop) return 0;
    uint32_t skin = slot_skin(k);
    if (!skin_textures(c, skin)) return 0;
    if (!pool_room(c, s, cc.type_name)) return 0;
    uint32_t ride = s->ride_new;
    char why[96] = {0};
    int miss = build_ride(c, &cc, ride, skin, why, sizeof why);
    if (miss < 0) return 0;
    if (rh_opt("NFSU2_ROAM_TEST_COPYRIDE")){
        /* test control: the player's own RideInfo byte for byte (same car
         * type only), the slot's skin number: rebuilt vs. copied looks */
        uint32_t me = player_car(), own = me ? rd32(me + 0x10u) : 0;
        if (ok(own, 0x8f0) && MR32(own) == MR32(ride)){
            memcpy(GPTR(ride), GPTR(own), 0x8f0); gcall1(c, FN_RIDE_SKINS, ride, skin);
            rlog("[roam] f=%ld slot %d: TEST: the player's own ride copied instead of the rebuilt one\n", rh_frame(), k); }
    }
    if (why[0]) rlog("[roam] f=%ld slot %d: %s's car: %s\n", rh_frame(), k, s->name, why);
    uint32_t a3[3] = { ride, 0, 0 };
    s->load_wait = load_wait_us();
    s->h_new = rh_call(c, FN_LOADER_LOAD, G_CARLOADER, 0, 3, a3);
    uint32_t a2[2] = { 0, 0 }; rh_call(c, FN_LOADER_SERVICE, G_CARLOADER, 0, 2, a2);
    s->load_t0 = roam_plat_now_us(); s->load_f0 = rh_frame(); s->pending_cfg = 1; s->cfg_gen = gen;
    s->look = rc_fnv1a_bytes(cfg, (uint32_t)len);
    snprintf(s->carname, sizeof s->carname, "%s", cc.type_name);
    s->loads++;
    rlog("[roam] f=%ld slot %d: loading %s's %s (%u parts, skin %u, handle 0x%x)\n", rh_frame(), k, s->name,
            cc.type_name, cc.n_parts, skin, s->h_new);
    return 1;
}
static void eng_files(CPU *c, Slot *s);
static int heavy_take(void);
/* the loading ride is in: put it on the slot's car */
static int finish_load(CPU *c, int k){
    Slot *s = &g_sl[k];
    uint32_t e = loader_entry(s->h_new);
    uint32_t done = e ? gcall1(c, FN_LOADER_LOADED, G_CARLOADER, e) : 0;
    if (!done){
        if (roam_plat_now_us() - s->load_t0 > s->load_wait){
            rlog("[roam] f=%ld slot %d: %s's car did not load in %.0f s\n", rh_frame(), k, s->name, s->load_wait / 1e6);
            unload_later(s->h_new); s->h_new = 0; s->pending_cfg = 0; g_load_fail++;
            return -1;
        }
        return 0;
    }
    if (!heavy_take()) return 0;                    /* in: put on its car the next frame */
    gcall1(c, FN_LOADER_WAIT, G_CARLOADER, s->h_new);
    uint32_t car = s->car;
    if (!s->have_orig){                             /* an opponent car, first time: keep its own ride */
        memcpy(GPTR(s->ride_orig), GPTR(rd32(car + 0x14u) + 0x10u), 0x8f0);
        s->have_orig = 1;
    }
    if (!s->activated){ gcall0(c, FN_CAR_ACTIVATE, car); s->activated = 1; }
    gcall1(c, FN_CAR_SETRIDE, car, s->ride_new);
    if (traffic_car(car, 0, 0)) rlog("[roam] f=%ld slot %d: %s's car is a traffic car (%s): it drives through every car\n", rh_frame(), k, s->name, s->carname);
    eng_files(c, s);
    make_inert(c, car);
    body_set(c, car, 0); s->ghost = 1;
    soft_park(c, car);
    if (s->h_cur) gcall1(c, FN_LOADER_UNLOAD, G_CARLOADER, s->h_cur);
    s->h_cur = s->h_new; s->h_new = 0;
    s->pending_cfg = 0; s->hidden = 1;
    /* the renderer draws a car at +0x50 (with the matrix copy at +0xD0),
     * the body position minus the centre-of-mass offset; the game sets it
     * in 0x5F5010 (when a car lands on loaded track, or is placed), so a
     * car moved from outside needs it every frame.  The offset is fixed in
     * the car's own frame: the player's car has +0x60 - +0x50 = R (0.30, 0,
     * 0.30) for a 206 at every heading (its physics object's world vector),
     * while for a car without physics 0x5F5010 subtracts the RidePhysicsInfo
     * vector ([+0x20]) as it is, unrotated -- so the value measured here is
     * the body-frame vector, and apply_pose rotates it with the car
     * (written unrotated, the drawn car was 0.2 to 0.6 m
     * off where the friend's own game draws it) */
    gcall0(c, FN_CAR_BODYPOS, s->car);
    for (int i = 0; i < 3; i++){ s->com[i] = MRF32(s->car + 0x60u + 4u * (uint32_t)i) - MRF32(s->car + 0x50u + 4u * (uint32_t)i);
        if (!__builtin_isfinite(s->com[i]) || __builtin_fabsf(s->com[i]) > 3.f) s->com[i] = 0; }
    soft_park(c, s->car);
    set_name(s);
    char tn[20]; cstr(rd32(s->car + 0xcu), tn, sizeof tn);
    rlog("[roam] f=%ld slot %d: %s's %s ready after %ld frames (%.0f ms); car 0x%08x is now a %s (centre of mass %.2f %.2f %.2f)\n",
            rh_frame(), k, s->name, s->carname, rh_frame() - s->load_f0, (roam_plat_now_us() - s->load_t0) / 1000.0, s->car, tn,
            (double)s->com[0], (double)s->com[1], (double)s->com[2]);
    pool_log("after load");
    return 1;
}
/* sin and cos of a in [-pi, pi] (Taylor to the x^15 / x^14 term, < 1e-5),
 * from basic operations: this file has no libm */
static void sincos_pi(float a, float *sn, float *cs){
    float x2 = a * a;
    *sn = a * (1.f - x2 / 6.f * (1.f - x2 / 20.f * (1.f - x2 / 42.f * (1.f - x2 / 72.f * (1.f - x2 / 110.f *
               (1.f - x2 / 156.f * (1.f - x2 / 210.f)))))));
    *cs = 1.f - x2 / 2.f * (1.f - x2 / 12.f * (1.f - x2 / 30.f * (1.f - x2 / 56.f * (1.f - x2 / 90.f *
               (1.f - x2 / 132.f * (1.f - x2 / 182.f))))));
}
/* The wheels.  The renderer draws each wheel with its matrix in the car,
 * +0x130 + 0x40 k for front left, front right, rear right, rear left (rows:
 * forward, left, up, then the wheel's place), and its brake with +0x230 +
 * 0x40 k (0x5F6820 hands both to the car's render, 0x620AE0).  In physics
 * mode 0 the game builds them again every frame, before our hook (the mode's
 * update 0x5EB920 -> 0x5921B0 for each wheel): no spin and no steering, and
 * the place the ride's wheel position (RidePhysicsInfo +0x10 + 0x30 k)
 * raised by the wheel's suspension offset (CAR_SUSP).  Only the physics
 * modes write that offset (0x59CB90): a friend's car that the game put into
 * physics for a moment (apply_pose puts it back to mode 0) kept whatever they
 * left there, and with a NaN every later frame's wheels were NaN, the tires
 * gone for good (reported in play, mostly after a crash; with the offsets
 * poked to NaN the wheels vanish, at 0.8 they float over the car).  So here
 * the offsets go back to ours (0, or the friend's wheel heights) and the
 * places are written every frame, and the first times that was needed are
 * logged.  Spin: the wheel's angle goes down by
 * speed / tyre radius (RidePhysicsInfo +0x20 + 0x30 k) as the car goes
 * forward.  Steering: the friend's own, the controls' +0x1e0 that goes on the
 * wire as steer.  It is the angle the game's physics turns the front wheels
 * to over a few frames, 16 bits to a full turn (steer 1 = 180 degrees, left
 * positive), speed-dependent lock included (car dumps: the caliper settles at
 * 180 degrees x steer at speed under the game's autopilot, and at 45 degrees
 * for the keys' full lock standing still); so whatever the friend steers
 * shows, counter-steer and standing still too.  Smoothed over 80 ms, at most
 * 0.8 rad.  Spinners have matrices of their own, made at the render
 * (0x5EC7F0): at the wheel's place (with CAR_SUSP), the front ones steered by
 * CAR_STEER, and each turned by its own angle (CAR_SPIN), which follows the
 * wheel with inertia (0x5ECAC0: the spinner's speed goes to the wheel's,
 * +0x330, by 0.156 of the difference a second, so it turns on for seconds
 * after the car stops).  The game runs that for a friend's car too, from the
 * wheel speeds apply_pose writes; the steering is the physics', which leaves
 * it at 0 in mode 0, so apply_pose writes it (else a front spinner pointed
 * straight on a wheel that steered). */
static void wheels_pose(Slot *s, const rc_pose *P, float dt){
    uint32_t car = s->car, ph = MR32(car + 0x20u);
    int phok = ok(ph, 0xc0);
    if (!(dt > 0.f)) dt = 0.f;
    if (dt > 0.1f) dt = 0.1f;
    float v = P->speed, want = P->steer * 3.14159265f;
    if (want > 0.8f) want = 0.8f;
    if (want < -0.8f) want = -0.8f;
    float k = dt / 0.08f;
    s->steer += (want - s->steer) * (k < 1.f ? k : 1.f);
    if (!__builtin_isfinite(s->steer)) s->steer = 0.f;
    float ss, cs; sincos_pi(s->steer, &ss, &cs);
    float susp[4]; int moved = 0;
    for (uint32_t w = 0; w < 4; w++){
        susp[w] = MRF32(car + CAR_SUSP + 4u * w);
        moved |= susp[w] != s->susp[w] && susp[w] != 0.f;            /* a NaN too; 0 is at rest (soft_park) */
        MRF32(car + CAR_SUSP + 4u * w) = s->susp[w] = 0.f;
    }
    if (moved && s->wheelfix++ < 3)
        rlog("[roam] f=%ld slot %d: %s's car had its wheels moved (suspension %g %g %g %g, put back into physics mode 0 %u times): put back\n",
                rh_frame(), (int)(s - g_sl), s->name, (double)susp[0], (double)susp[1], (double)susp[2], (double)susp[3], s->remode);
    for (uint32_t w = 0; w < 4; w++){
        float r = phok ? MRF32(ph + 0x20u + 0x30u * w) : 0.f;
        if (!(r > 0.05f && r < 2.f)) r = 0.33f;
        float d = (v + P->slip[2 * w]) / r * dt;                     /* (a spinning wheel's slip: a burnout turns it) at most 100 m/s: a few turns per frame */
        if (!__builtin_isfinite(d) || d > 32.f || d < -32.f) d = 0.f;
        float a = s->spin[w] - d;
        while (a > 3.14159265f) a -= 6.28318531f;
        while (a < -3.14159265f) a += 6.28318531f;
        s->spin[w] = a;
        float sa, ca; sincos_pi(a, &sa, &ca);
        float sy = w < 2 ? ss : 0.f, cy = w < 2 ? cs : 1.f;
        uint32_t m = car + 0x130u + 0x40u * w, b = car + 0x230u + 0x40u * w;
        MRF32(m + 0x00u) = ca * cy;  MRF32(m + 0x04u) = ca * sy;  MRF32(m + 0x08u) = sa;
        MRF32(m + 0x10u) = -sy;      MRF32(m + 0x14u) = cy;       MRF32(m + 0x18u) = 0.f;
        MRF32(m + 0x20u) = -sa * cy; MRF32(m + 0x24u) = -sa * sy; MRF32(m + 0x28u) = ca;
        if (w < 2){
            MRF32(b + 0x00u) = cy;  MRF32(b + 0x04u) = sy;
            MRF32(b + 0x10u) = -sy; MRF32(b + 0x14u) = cy;
        }
        /* the wheel's and the brake's place: at rest (0x5921B0's with offset
         * 0), or where the friend's are, when their game sends that (rc_pose
         * wz: their suspension, and their hydraulics lifting the body off the
         * wheels); that height's offset goes into CAR_SUSP too, so the game's
         * own build next frame and the render's second set of wheel places
         * (0x5EC7F0) have it as well */
        float x = phok ? MRF32(ph + 0x10u + 0x30u * w) : 0.f, y = phok ? MRF32(ph + 0x14u + 0x30u * w) : 0.f,
              z = phok ? MRF32(ph + 0x18u + 0x30u * w) : 0.f;
        if (phok && __builtin_fabsf(x) < 4.f && __builtin_fabsf(y) < 2.f && __builtin_fabsf(z) < 2.f){
            float o = P->ext && P->wz[w] > -2.f && P->wz[w] < 2.f ? P->wz[w] - z : 0.f;
            MRF32(m + 0x30u) = x; MRF32(m + 0x34u) = y; MRF32(m + 0x38u) = z + o;
            MRF32(b + 0x30u) = x; MRF32(b + 0x34u) = y; MRF32(b + 0x38u) = z + o;
            MRF32(car + CAR_SUSP + 4u * w) = s->susp[w] = o;
        }
    }
}
/* A friend's car's nitrous (a sender of core version 4 and up; an older
 * one's car has none; its wheel heights are wheels_pose's): the car gets a
 * shot of its own that stays as full as the friend's, and the game draws for
 * it what it draws for any car on nitrous: the tail-light streaks (0x61AE90)
 * and, for a car in the car index, the flames (0x5F5730, from the World's
 * update).  A car outside the index gets the flames here, as 0x5F5730 would
 * give them: FX_NOS on the throttle from 5 mph, FX_PURGE otherwise and while
 * no race runs. */
#define NOS_FULL        40000u        /* a friend's full nitrous shot: 10 s */
static void nos_pose(Slot *s, const rc_pose *P){
    uint32_t n = s->car + CAR_NOS;
    if (!P->ext || !P->nos){
        if (MR32(n + 0x420u)) MR32(n + 0x420u) = 0;
        return;
    }
    uint32_t now = MR32(G_TICKS);
    MR32(n + 0x414u) = NOS_FULL;
    MR32(n + 0x41cu) = (uint32_t)P->nos * (NOS_FULL / 100u);
    MR32(n + 0x420u) = now ? now : 1u;
}
/* A friend's wheels' slip and surfaces. The native game effect routine reads
 * both the contact flags and slip values; physics mode 0 cars need those
 * fields maintained from the received pose rather than the local physics. */
static void slip_pose(Slot *s, const rc_pose *P){
    uint32_t car = s->car;
    for (uint32_t w = 0; w < 4; w++){
        float along = P->slip[2 * w], across = P->slip[2 * w + 1];
        MRF32(car + CAR_SLIP + 8u * w) = along;
        MRF32(car + CAR_SLIP + 8u * w + 4u) = across;
        if (P->slipx && P->surf[w] < N_SURF) MR32(car + CAR_SURF + 4u * w) = P->surf[w];
        /* The sender clears airborne wheels' slip, so nonzero slip is enough
         * contact information for the native tyre-effect emitter. */
        MR8(car + CAR_GROUND + w) = along != 0.f || across != 0.f;
        if (!MR8(car + CAR_GROUND + w)) MRF32(car + 0x99cu + 4u * w) = 0.f;
    }
}
/* World::DoTimestep runs native effects only for indexed cars. Our remote
 * cars are deliberately outside that index so they can coexist with
 * outrun AI; invoke the same native routine for those cars once per frame. */
static void effects_pose(CPU *c, Slot *s){
    uint32_t car = s->car, me = player_car();
    if (!s->unindexed || !ok(me, 0x6cu) || MR8(car + 0x998u) ||
        !MR8(car + CAR_ACTIVE) || !rd32(car + 0x5ccu)) return;
    float dx = MRF32(car + 0x60u) - MRF32(me + 0x60u);
    float dy = MRF32(car + 0x64u) - MRF32(me + 0x64u);
    float dz = MRF32(car + 0x68u) - MRF32(me + 0x68u);
    float distance = rc_sqrtf(dx * dx + dy * dy + dz * dz);
    if (!__builtin_isfinite(distance) || !ok(0x007a5490u, 3u) || distance >= MRF32(0x007a5490u)) return;
    uint32_t arg;
    memcpy(&arg, &distance, sizeof arg);
    gcall1(c, FN_CAR_EFFECTS, car, arg);
}
static void apply_pose(CPU *c, Slot *s, const rc_pose *P, float dt){
    uint32_t car = s->car;
    float f[3], l[3], u[3];
    rc_q2m(P->q, f, l, u);
    for (int i = 0; i < 3; i++){
        uint32_t o = 4u * (uint32_t)i;
        MRF32(car + 0x60u + o) = P->p[i];
        MRF32(car + 0x50u + o) = P->p[i] - (s->com[0] * f[i] + s->com[1] * l[i] + s->com[2] * u[i]);
        MRF32(car + 0x70u + o) = P->v[i]; MRF32(car + 0x110u + o) = P->w[i];
        MRF32(car + 0x90u + o) = f[i]; MRF32(car + 0xa0u + o) = l[i]; MRF32(car + 0xb0u + o) = u[i];
        MRF32(car + 0xd0u + o) = f[i]; MRF32(car + 0xe0u + o) = l[i]; MRF32(car + 0xf0u + o) = u[i];
    }
    MR16(car + 0x40cu) = (uint16_t)(int)(rc_atan2f(f[1], f[0]) / (2.f * 3.14159265f) * 65536.f);
    MRF32(car + 0x42cu) = P->speed; MRF32(car + 0x430u) = P->speed; MRF32(car + 0x440u) = P->rpm;
    MR32(car + 0x434u) = (uint32_t)(int32_t)P->gear;
    uint32_t ph = MR32(car + 0x20u);
    if (ok(ph, 0xc0)) for (uint32_t w = 0; w < 4; w++){ float r = MRF32(ph + 0x20u + 0x30u * w); if (r > 0.05f) MRF32(car + CAR_WSPIN + 4u * w) = (P->speed + P->slip[2 * w]) / r; }
    uint32_t ctl = MR32(car + 0x30u);
    if (ok(ctl, 0x220)){
        MRF32(ctl + 0x20cu) = P->throttle; MRF32(ctl + 0x214u) = P->brake;
        MR16(ctl + 0x1e0u) = (uint16_t)(int16_t)(P->steer * 32767.f);
    }
    if (rd32(car + 0x28u) != 0){ gcall1(c, FN_CAR_SETPHYS, car, 0); s->remode++; }
    gcall1(c, FN_ROADTRACK, car + 0x8d8u, car + 0x60u);
    gcall0(c, FN_CAR_SECTION, car);
    wheels_pose(s, P, dt);
    MR16(car + CAR_STEER) = (uint16_t)(int16_t)(int)(s->steer * 10430.378f);      /* the spinners' steering (wheels_pose) */
    nos_pose(s, P);
    slip_pose(s, P);
    s->pose_frames++;
}
/* A hit with the player's car pushes a friend's car on this screen
 * (roam_game_contact): each push holds (the car drawn where the friend's
 * game has it, moved on by the pushes since their hits) until the friend's
 * snapshots from after its hit come, which carry the push their own game
 * gave the car, or HIT_HOLD_US at most (a friend whose snapshots stop, or
 * whose game saw no hit).  Times are the friend's: the snapshots' stamps,
 * and rt, the time the car is drawn at (rc_interp_eval: now, in the
 * friend's clock, give or take the prediction), which a hit is stamped with.
 * Then the car goes on from where it was going to be drawn, the difference
 * to where their game has it (and the pushes still held) fading as the
 * interpolation fades the jump the report makes, so the two cancel.  One
 * push at a time was not enough: a car rolling on against the other touched
 * it again and again, each touch held the whole push anew, and the friend's
 * car ran at twice their speed. */
static void push_off(Slot *s){
    s->pqn = 0;
    for (int i = 0; i < 3; i++){ s->push_v[i] = 0; s->push_u[i] = 0; s->push_r[i] = 0; }
}
/* the friend's game has reported the push: their velocity has moved by half
 * of it at least (the interpolation hands the newest snapshots' velocity on
 * unsmoothed), or a snapshot from HIT_REPORT_US after the hit has come, or
 * never will (HIT_HOLD_US).  By time alone a hit was held up to a snapshot
 * too long, the first one after it already carrying the friend's own: 0.5 m
 * off where their game had the car for 0.2 s.  A nudge, which driving could
 * hide, goes with the first snapshot after it: a car leaning on the other
 * nudges it every frame, and nudges held for HIT_REPORT_US drew the car
 * 0.5 m off for as long as the two leant on each other. */
static int push_reported(const Slot *s, int j, const rc_pose *P, int64_t newest, int64_t rt){
    float dot = 0, pp = 0;
    for (int i = 0; i < 3; i++){ dot += (P->v[i] - s->pq[j].v0[i]) * s->pq[j].v[i]; pp += s->pq[j].v[i] * s->pq[j].v[i]; }
    if (rt - s->pq[j].t >= HIT_HOLD_US) return 1;
    if (pp <= 1.f) return newest >= s->pq[j].t + NUDGE_REPORT_US;
    return dot >= 0.5f * pp || newest >= s->pq[j].t + HIT_REPORT_US;
}
static void push_pose(Slot *s, rc_pose *P, int64_t newest, int64_t rt, float dt){
    for (int i = 0; i < 3; i++) s->net_v[i] = P->v[i];
    if (!s->pqn && s->push_r[0] == 0.f && s->push_r[1] == 0.f && s->push_r[2] == 0.f) return;
    for (int i = 0; i < 3; i++) s->push_u[i] += s->push_v[i] * dt;
    int done = 0;
    while (done < s->pqn && push_reported(s, done, P, newest, rt)){
        float since = (float)(rt - s->pq[done].t) / 1e6f;
        for (int i = 0; i < 3; i++){ s->push_v[i] -= s->pq[done].v[i]; s->push_u[i] -= s->pq[done].v[i] * (since > 0.f ? since : 0.f); }
        done++;
    }
    if (done){
        for (int j = done; j < s->pqn; j++) s->pq[j - done] = s->pq[j];
        s->pqn -= done;
        if (!s->pqn) for (int i = 0; i < 3; i++){ s->push_v[i] = 0; s->push_u[i] = 0; }
        for (int i = 0; i < 3; i++) s->push_r[i] = s->drawn[i] + s->drawn_v[i] * dt - P->p[i] - s->push_u[i];
    } else {
        float k = rc_expneg(dt * 1e6f / (float)HIT_FADE_US), m = 0;
        for (int i = 0; i < 3; i++){ s->push_r[i] *= k; m += s->push_r[i] * s->push_r[i]; }
        if (m < 1e-4f) for (int i = 0; i < 3; i++) s->push_r[i] = 0;
    }
    for (int i = 0; i < 3; i++){ P->p[i] += s->push_u[i] + s->push_r[i]; P->v[i] += s->push_v[i]; }
}

/* ---- names over friends' cars --------------------------------------------------------------------- */
/* In the game's own LAN races the HUD's online part (made by 0x4F80E0 for a
 * network race only) owns the HUD package's text objects ONLINE_PLAYER_1..6,
 * and its update (0x4EBEC0, from the HUD update) puts each player's name
 * 1.7 m above their car through the player's view: hidden behind the
 * camera, off the screen and from 100 m on, scaled 25 m / distance within
 * 0.5 .. 1, and all of them while the game's player-names option is off.
 * In free roam that part does not exist and nothing uses the objects, so
 * friends' cars get them the same way, from the same point of the frame
 * (roam_game_hud, after the HUD update: this frame's camera), the nearest
 * cars first.  Past the six, copies of ONLINE_PLAYER_1 (fe_clone). */
#define G_VIEW1         0x00832e50u   /* eView 1: [+0] +0x80 view*projection, +0x40 camera (+0x40 position, +0x50 forward) */
#define G_VIEW_W        0x00870980u   /* view size in pixels (0x5BC1F0, 0x5BC200) */
#define G_VIEW_H        0x00870984u
#define G_SHOW_NAMES    0x008500c9u   /* byte: the player-names option */
#define PL_HUD          0x9a4u        /* Player: the HUD, +0x10 its package's name */
#define FN_FE_HASH      0x00505450u   /* cdecl (name) -> hash (upper case) */
#define FN_FE_FIND      0x00537a10u   /* cdecl (package name, hash) -> FE object */
#define FN_FE_PRINTF    0x00537be0u   /* cdecl (object, format, ...) */
#define FN_FE_SETSTR    0x00535fe0u   /* thiscall object (char*): its text, the string grown to fit */
#define FN_FE_COLOR     0x00517e20u   /* thiscall object (int rgba[4]*, 0) */
#define FN_FE_POS       0x00517c10u   /* thiscall object (float xyz*, 0): HUD units from the centre */
#define FN_FE_SCALE     0x00517db0u   /* thiscall object (float xyz*, 0) */
#define FN_FE_SHOW      0x0050ca50u   /* cdecl (object) */
#define FN_FE_HIDE      0x0050ca00u   /* cdecl (object) */
#define FN_VIEW_SCREEN  0x005bc4a0u   /* thiscall view (out*, in*): world -> view pixels, z > 0 in front */
#define TAG_SCR         0x100u        /* g_gmem scratch: +0 in, +0x10 out, +0x20 vectors, +0x40 "%s", +0x48 text */
#define TAG_TEXT_MAX    (RC_NAME_MAX + 24)  /* "<name> (paused)", "<name> (paused, 12.3 km)" */
#define TAG_NEAR_M      100.f         /* names from this far only for the crews, with the distance */
#define TAG_GAME        6             /* the HUD's ONLINE_PLAYER_1..6 */
#define TAG_N           NSLOT
#define TAG_DUEL        TAG_N         /* one more: the outrun's line of text (du_hud) */
#define TAG_MP0         (TAG_N + 1)   /* and four: labels over race spots and lobbies (mp_labels) */
#define TAG_MPN         4
#define TAG_ALL         (TAG_N + 1 + TAG_MPN)
#define TAG_DUEL_MAX    120
static struct { uint32_t hud, obj[TAG_ALL]; uint8_t looked[TAG_ALL], shown[TAG_ALL]; char text[TAG_ALL][TAG_DUEL_MAX]; uint32_t rgb[TAG_ALL]; } g_tag;
static void gstr(uint32_t a, const char *s, uint32_t cap){
    uint32_t i = 0;
    for (; s[i] && i + 1 < cap; i++) MR8(a + i) = (uint8_t)s[i];
    MR8(a + i) = 0;
}
static uint32_t gvec(uint32_t a, float x, float y, float z){ MRF32(a) = x; MRF32(a + 4u) = y; MRF32(a + 8u) = z; return a; }
static void tag_hide(CPU *c, int k){
    if (g_tag.shown[k] && g_tag.obj[k]) gcall1(c, FN_FE_HIDE, 0, g_tag.obj[k]);
    g_tag.shown[k] = 0;
}
/* A copy of FE object o of package pkg, named `name`: its class's Clone
 * (vtable slot 1, thiscall (1): its scripts copied too; its render object,
 * +0x58, which that leaves unset, made by the renderer as for a new object),
 * the hash the package's lookups compare (+0x10), and linked after o in the
 * list that holds it: the package's own (FEPackage +0x48 count, +0x4C first,
 * +0x50 last) or a group's (type 5: +0x60, +0x64, +0x68), each object's +4
 * next, +8 previous.  The FE renderer draws what those lists hold and the
 * package frees it with the rest.  0 when the list is not as expected. */
#define FN_FE_PACKAGE   0x0052cef0u   /* cdecl (package name) -> FEPackage* */
#define FN_FE_FINDOBJ   0x005379c0u   /* cdecl (package name, hash) -> FE object of any type */
static uint32_t fe_list_of(uint32_t first, uint32_t o, int depth){   /* the address of the list's "first" that holds o */
    int n = 0;
    for (uint32_t it = rd32(first); it && n < 4096; it = rd32(it + 4u), n++){
        if (it == o) return first;
        if (depth < 8 && rd32(it + 0x18u) == 5u){ uint32_t l = fe_list_of(it + 0x64u, o, depth + 1); if (l) return l; }
    }
    return 0;
}
static uint32_t fe_clone(CPU *c, uint32_t pkg, uint32_t o, const char *name){
    uint32_t pk = gcall1(c, FN_FE_PACKAGE, 0, pkg), l = ok(pk, 0x54) ? fe_list_of(pk + 0x4cu, o, 0) : 0;
    if (!l || !ok(rd32(o), 8)) return 0;
    uint32_t n = 0, last = 0;
    for (uint32_t it = rd32(l); it && n < 4096; it = rd32(it + 4u)){ last = it; n++; }
    if (n != rd32(l - 4u) || last != rd32(l + 4u)) return 0;          /* not the count and last we take it for */
    uint32_t one = 1, cl = rh_call(c, rd32(rd32(o) + 4u), o, 0, 1, &one);
    if (!ok(cl, 0x5c)) return 0;
    MR32(cl + 0x58u) = 0;
    /* an image's or a string's drawing data (+0x2C, +0x30 its size: colour,
     * place, turn, size, an image's texture corners; numbers only) the way
     * the original has it: Clone leaves the corners, the depth and (on the
     * world map) the colour, the turn and the size 0, and such a copy was
     * drawn as nothing -- the minimap's arrows past the HUD's eight too, and
     * the world map's lobby labels */
    uint32_t dn = rd32(o + 0x30u), d0 = rd32(o + 0x2cu), d1 = rd32(cl + 0x2cu), ty = MR32(o + 0x18u);
    if ((ty == 1u || ty == 2u) && rd32(cl + 0x30u) == dn && dn && dn <= 0x100u && ok(d0, dn) && ok(d1, dn) && d0 != d1)
        memcpy(GPTR(d1), GPTR(d0), dn);
    /* GPS's package-owned label may be cloned before free roam's optional g_gmem exists.
     * Use stack scratch in that case instead of allocating the 512 KB roam heap just for a hash. */
    uint32_t sa = g_gmem ? g_gmem + TAG_SCR + 0x48u : (c->esp - 0x40u) & ~15u;
    gstr(sa, name, 24);
    MR32(cl + 0x10u) = gcall1(c, FN_FE_HASH, 0, sa);
    uint32_t nx = rd32(o + 4u);
    MR32(cl + 4u) = nx; MR32(cl + 8u) = o; MR32(o + 4u) = cl;
    if (nx) MR32(nx + 8u) = cl; else MR32(l + 4u) = cl;
    MR32(l - 4u) += 1;
    return cl;
}

/* A package-owned HUD string for another native HUD extension. Keep list and
 * render-object ownership in the same clone path as the multiplayer labels. */
uint32_t roam_game_clone_hud_text(CPU *c, uint32_t pkg, uint32_t source, const char *name){
    if (!ok(source, 0x70) || rd32(source + 0x18u) != 2u) return 0;
    return fe_clone(c, pkg, source, name);
}

/* an image's or a string's colour: its drawing data's first four ints
 * (blue, green, red, alpha, as FN_FE_COLOR takes them) */
static int fe_colour_get(uint32_t o, int32_t col[4]){
    uint32_t d = ok(o, 0x34) ? rd32(o + 0x2cu) : 0;
    if (!ok(d, 16) || rd32(o + 0x30u) < 16u) return 0;
    for (uint32_t i = 0; i < 4; i++) col[i] = (int32_t)MR32(d + 4u * i);
    return 1;
}
static void fe_colour_set(CPU *c, uint32_t o, int32_t b, int32_t g, int32_t r, int32_t a){
    uint32_t col = g_gmem + TAG_SCR + 0x20u;
    MR32(col) = (uint32_t)b; MR32(col + 4u) = (uint32_t)g; MR32(col + 8u) = (uint32_t)r; MR32(col + 12u) = (uint32_t)a;
    uint32_t ac[2] = { col, 0 }; rh_call(c, FN_FE_COLOR, o, 0, 2, ac);
}
/* o's colour as rgb (b, g, r) has it, its alpha kept; nothing when it has it already */
static void fe_colour_to(CPU *c, uint32_t o, const int32_t rgb[3]){
    int32_t col[4];
    if (fe_colour_get(o, col) && (col[0] != rgb[0] || col[1] != rgb[1] || col[2] != rgb[2])) fe_colour_set(c, o, rgb[0], rgb[1], rgb[2], col[3]);
}
/* the label's FE object, looked up (or made) once per HUD */
static uint32_t tag_obj(CPU *c, int k, uint32_t pkg){
    if (g_tag.looked[k]) return g_tag.obj[k];
    g_tag.looked[k] = 1;
    if (k >= TAG_GAME){
        uint32_t o1 = tag_obj(c, 0, pkg);
        char nm[24]; snprintf(nm, sizeof nm, k == TAG_DUEL ? "ROAM_OUTRUN" : k >= TAG_MP0 ? "ROAM_RACE_%d" : "ROAM_PLAYER_%d",
                              k >= TAG_MP0 ? k - TAG_MP0 + 1 : k + 1);   /* past the HUD's six: copies of the first */
        g_tag.obj[k] = o1 ? fe_clone(c, pkg, o1, nm) : 0;
        if (!g_tag.obj[k] && k == TAG_DUEL) rlog("[roam] f=%ld no copy of ONLINE_PLAYER_1 for the outrun's line of text\n", rh_frame());
        else if (!g_tag.obj[k]) rlog("[roam] f=%ld no copy of ONLINE_PLAYER_1 for name %d: one name fewer over friends' cars\n", rh_frame(), k + 1);
        return g_tag.obj[k];
    }
    char nm[24]; snprintf(nm, sizeof nm, "ONLINE_PLAYER_%d", k + 1);
    uint32_t sa = g_gmem + TAG_SCR + 0x48u;
    gstr(sa, nm, 24);
    uint32_t h = gcall1(c, FN_FE_HASH, 0, sa), a[2] = { pkg, h };
    g_tag.obj[k] = rh_call(c, FN_FE_FIND, 0, 0, 2, a);
    if (!ok(g_tag.obj[k], 0x70)) g_tag.obj[k] = 0;
    if (!g_tag.obj[k]) rlog("[roam] f=%ld no %s in the HUD: one name fewer over friends' cars\n", rh_frame(), nm);
    return g_tag.obj[k];
}
static void tag_text_rgb(CPU *c, int k, uint32_t obj, const char *name, uint32_t rgb){
    if (!strcmp(g_tag.text[k], name) && g_tag.rgb[k] == rgb) return;
    snprintf(g_tag.text[k], sizeof g_tag.text[k], "%s", name);
    g_tag.rgb[k] = rgb;
    uint32_t col = g_gmem + TAG_SCR + 0x20u, fmt = g_gmem + TAG_SCR + 0x40u, txt = g_gmem + TAG_SCR + 0x48u;
    for (uint32_t i = 0; i < 4; i++) MR32(col + 4u * i) = 0xffu;               /* white, as 0x4F80E0 */
    if (rgb){ MR32(col) = rgb & 0xffu; MR32(col + 4u) = rgb >> 8 & 0xffu; MR32(col + 8u) = rgb >> 16 & 0xffu; }   /* (blue, green, red, alpha) */
    uint32_t ac[2] = { col, 0 }; rh_call(c, FN_FE_COLOR, obj, 0, 2, ac);
    MR32(obj + 0x6cu) = (MR32(obj + 0x6cu) & ~0xfu) | 5u;                     /* centred */
    MR32(obj + 0x1cu) |= 0x100u;
    gstr(fmt, "%s", 4); gstr(txt, name, TAG_DUEL_MAX);
    if (k >= TAG_DUEL){
        /* FEPrintf keeps a text within the object's string as it is (20 for
         * ONLINE_PLAYER_1's); the string's own setter, which it calls, grows it */
        gcall1(c, FN_FE_SETSTR, obj, txt);
        MR32(obj + 0x1cu) |= 2u;
        return;
    }
    uint32_t ap[3] = { obj, fmt, txt }; rh_call(c, FN_FE_PRINTF, 0, 0, 3, ap);
}
static void tag_text(CPU *c, int k, uint32_t obj, const char *name){ tag_text_rgb(c, k, obj, name, 0); }
/* the HUD's package is the top one: no screen over it (the world map, the
 * pause menu, a message), which hides the HUD's own parts but not ours */
#define G_FENG         0x008384c4u   /* +8 the package manager: +0xE4 the top package (GetTopPackage 0x50C8E0), +0xC its name */
static int hud_on_top(uint32_t pkg){
    uint32_t fe = rd32(G_FENG), mg = fe ? rd32(fe + 8u) : 0, top = mg ? rd32(mg + 0xe4u) : 0;
    char a[40], b[40];
    cstr(top ? rd32(top + 0xcu) : 0, a, sizeof a); cstr(pkg, b, sizeof b);
    return a[0] && !strcasecmp(a, b);
}
/* Quick chat (the rest after the race lobbies, say_*): players say one of the page's set phrases
 * (web/src/app/phrases.ts), a number on the wire, so each player reads it in their own language and nobody types
 * anything.  Any number goes through: the page knows which it has (a newer page's it does not show).  The page
 * shows a line over the car of each player who said something lately, where the name over it is: tags_update tells
 * it where, with every frame (roam_plat_say_marks).  Not in the Windows plugin (no page). */
#ifdef ROAM_HOST_WIN
#define SAYS            0
#else
#define SAYS            1
#endif
#define SAY_NEAR_M      250.f         /* heard from as far as a horn is (horn.c FAR_M), and from anyone in our race lobby */
#define SAY_SHOW_US     5000000       /* the line over the car: as long as the page shows it */
#define SAY_BURST       3             /* at most this many from one player in SAY_WINDOW_US (the page keeps the player's
                                         own to that): more from a friend are not shown */
#define SAY_WINDOW_US   6000000
#define SAY_AGAIN_US    2000000       /* the same phrase from one friend again within this: not shown */
#define SAY_MARKS       32
/* a friend's: the last phrases shown (when), the last shown (when, until when over the car), the last heard */
typedef struct { uint32_t id; int64_t t[SAY_BURST], at, until; uint8_t seq, phrase, heard; } SayWho;
static struct {
    SayWho   who[RC_TABLE];                               /* by session peer */
    int64_t  mine[SAY_BURST], mine_until; uint8_t seq;
    int      test_pick;                                   /* a script's "mp say N" (-1: none) */
    uint32_t said, heard, dropped;                        /* statistics */
} g_say = { .test_pick = -1 };
static int say_live(int peer, uint32_t id, int64_t now){
    return SAYS && peer >= 0 && peer < RC_TABLE && g_say.who[peer].id == id && g_say.who[peer].until > now;
}
/* a crew's name over a car past TAG_NEAR_M: the distance with it, in steps of 10 m, past 1 km in km */
static void tag_far(char *tx, int cap, const char *name, int paused, float d){
    char ds[16];
    if (d < 995.f) snprintf(ds, sizeof ds, "%d m", (int)(d / 10.f + 0.5f) * 10);
    else snprintf(ds, sizeof ds, "%.1f km", (double)d / 1000.0);
    snprintf(tx, (size_t)cap, paused ? "%s (paused, %s)" : "%s (%s)", name, ds);
}
static void tags_update(CPU *c){
    uint32_t pl = rd32(G_PLAYER1), hud = pl && ok(pl, PL_HUD + 4u) ? rd32(pl + PL_HUD) : 0;
    uint32_t pkg = hud && ok(hud, 0x14) ? rd32(hud + 0x10u) : 0;
    if (hud != g_tag.hud){                          /* another HUD: its own objects (the old ones went with it) */
        memset(&g_tag, 0, sizeof g_tag);
        g_tag.hud = hud;
    }
    if (!hud || !ok(pkg, 0x20) || !g_gmem) return;
    uint32_t cam = rd32(G_VIEW1 + 0x40u);
    int on = O.labels && g_in_roam && MR8(G_SHOW_NAMES) && ok(cam, 0x60) && hud_on_top(pkg);
    /* the cars a name shows on: in front of the camera, within 100 m (a
     * crew's at any distance) and on the screen; the nearest TAG_N of them
     * get one */
    struct { int k; float d2, hx, hy, z; } t[NSLOT];
    int n = 0;
    for (int k = 0; on && k < NSLOT; k++){
        Slot *s = &g_sl[k];
        if (s->st != SL_ACTIVE || s->hidden || !s->name[0] || !ok(s->car, 0x9e0)) continue;
        uint32_t car = s->car;
        float p[3], u[3], d[3];
        rd3(car + 0x60u, p); rd3(car + 0xb0u, u);
        for (int i = 0; i < 3; i++) d[i] = p[i] - MRF32(cam + 0x40u + 4u * (uint32_t)i);
        float ahead = d[0] * MRF32(cam + 0x50u) + d[1] * MRF32(cam + 0x54u) + d[2] * MRF32(cam + 0x58u);
        float d2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
        if (ahead < 0.f || !(d2 > 0.f) || !(s->crew || d2 < TAG_NEAR_M * TAG_NEAR_M)) continue;
        uint32_t in = gvec(g_gmem + TAG_SCR, u[0] * 1.7f + p[0], u[1] * 1.7f + p[1], u[2] * 1.7f + p[2]);
        uint32_t out = g_gmem + TAG_SCR + 0x10u, av[2] = { out, in };
        rh_call(c, FN_VIEW_SCREEN, G_VIEW1, 0, 2, av);
        float x = MRF32(out), y = MRF32(out + 4u), z = MRF32(out + 8u);
        float w = (float)(int32_t)MR32(G_VIEW_W), h = (float)(int32_t)MR32(G_VIEW_H);
        if (!(z > 0.f) || !(x >= 0.f) || !(x <= w) || !(y >= 0.f) || !(y <= h)) continue;
        int j = n++;
        for (; j > 0 && t[j - 1].d2 > d2; j--) t[j] = t[j - 1];      /* nearest first */
        t[j].k = k; t[j].d2 = d2; t[j].hx = x / w * 640.f; t[j].hy = y / h * 480.f; t[j].z = z;
    }
    for (int i = 0; i < TAG_N; i++){
        if (i >= n){ tag_hide(c, i); continue; }
        uint32_t obj = tag_obj(c, i, pkg);
        if (!obj) continue;
        const Slot *s = &g_sl[t[i].k];
        float hx = t[i].hx, hy = t[i].hy;
        rh_hud_marker(&hx, &hy);
        char tx[TAG_TEXT_MAX];
        float d = rc_sqrtf(t[i].d2);
        if (s->crew && d >= TAG_NEAR_M) tag_far(tx, sizeof tx, s->name, s->paused, d);
        else snprintf(tx, sizeof tx, s->paused ? "%s (paused)" : "%s", s->name);
        tag_text_rgb(c, i, obj, tx, s->crew ? O.crew_rgb[s->crew - 1] : 0);
        /* (a crew's in front of the other names: a crew-mate far behind a crowd still reads) */
        uint32_t ap[2] = { gvec(g_gmem + TAG_SCR + 0x20u, hx - 320.f, hy - 240.f, s->crew ? t[i].z * 0.95f : t[i].z), 0 };
        rh_call(c, FN_FE_POS, obj, 0, 2, ap);
        float sc = 25.f / rc_sqrtf(t[i].d2);
        if (sc < 0.5f) sc = 0.5f;
        if (sc > 1.f) sc = 1.f;
        uint32_t as[2] = { gvec(g_gmem + TAG_SCR + 0x30u, sc, sc, 1.f), 0 };
        rh_call(c, FN_FE_SCALE, obj, 0, 2, as);
        gcall1(c, FN_FE_SHOW, 0, obj);
        g_tag.shown[i] = 1;
    }
#if SAYS
    /* quick chat: where the names of those who said something lately are (the page's lines go over them), and the
     * player's own line over their car, which has no name: just over its roof (1.2 m up; a friend's name is at 1.7),
     * unless the camera is in or right behind the car */
    int64_t now = roam_plat_now_us();
    uint32_t mid[SAY_MARKS]; float mxy[3 * SAY_MARKS]; int nm = 0;
    for (int i = 0; i < n && i < TAG_N && nm < SAY_MARKS; i++){
        const Slot *s = &g_sl[t[i].k];
        if (!say_live(s->peer, s->peer_id, now)) continue;
        float sc = 25.f / rc_sqrtf(t[i].d2);
        mid[nm] = s->peer_id; mxy[3 * nm] = t[i].hx / 640.f; mxy[3 * nm + 1] = t[i].hy / 480.f;
        mxy[3 * nm + 2] = sc < 0.5f ? 0.5f : sc > 1.f ? 1.f : sc; nm++;
    }
    uint32_t me = player_car();
    if (on && g_say.mine_until > now && nm < SAY_MARKS && ok(me, 0xc0)){
        float p[3], u[3], d[3];
        rd3(me + 0x60u, p); rd3(me + 0xb0u, u);
        for (int i = 0; i < 3; i++) d[i] = p[i] - MRF32(cam + 0x40u + 4u * (uint32_t)i);
        float ahead = d[0] * MRF32(cam + 0x50u) + d[1] * MRF32(cam + 0x54u) + d[2] * MRF32(cam + 0x58u);
        uint32_t in = gvec(g_gmem + TAG_SCR, u[0] * 1.2f + p[0], u[1] * 1.2f + p[1], u[2] * 1.2f + p[2]);
        uint32_t out = g_gmem + TAG_SCR + 0x10u, av[2] = { out, in };
        if (ahead > 2.f) rh_call(c, FN_VIEW_SCREEN, G_VIEW1, 0, 2, av);
        float x = MRF32(out), y = MRF32(out + 4u), z = MRF32(out + 8u);
        float w = (float)(int32_t)MR32(G_VIEW_W), h = (float)(int32_t)MR32(G_VIEW_H);
        if (ahead > 2.f && z > 0.f && x >= 0.f && x <= w && y >= 0.f && y <= h){
            mid[nm] = g_s.conf.self_id; mxy[3 * nm] = x / w; mxy[3 * nm + 1] = y / h; mxy[3 * nm + 2] = 1.f; nm++; }
    }
    if (nm) roam_plat_say_marks(mid, mxy, nm);
#endif
}

/* ---- minimap arrows --------------------------------------------------------------------------------- */
/* The minimap's icons (G_MM_ICONS, made by 0x4EC950 when the HUD is built
 * and again by 0x4F92A0) give an AI racer's arrow (type 3) to each car of the
 * World's AI range.  An icon keeps the car's racer number and finds the car
 * by it every frame on the World's list (0x4CA6D0 -> 0x5F0E30), and draws
 * one of the free "visuals" of its type, which 0x4DB900 makes from the HUD's
 * AIRACERINDICATOR_0..7 at each rebuild (and frees, 0x4EC6F0); it draws it
 * only while the car is in the world (CAR_ACTIVE).  A shown friend's car
 * without an arrow gets one here: an icon by racer number (0x4EC790); when no
 * visual is free, a visual of our own from the game's pools (it frees them
 * with its own) on a copy of AIRACERINDICATOR_0 (fe_clone) that no visual
 * holds now.  Which cars have one is looked up in the icons every frame: the
 * game makes them again (0x4F92A0, from several places of the career's), and
 * the new icons object is a block of the size just freed, at the old one's
 * address as often as not, so the cars outside the car index lost their
 * arrows for good when their icons were remembered by that address. */
#define G_MM_ICONS      0x008364d4u   /* the minimap's icons: +0/+4 their list (icon +8 racer number, +0x1C its visual), +0x18 the package's name */
#define G_MM_VISUALS    0x00836560u   /* the free visuals: nodes {+0 next, +4 previous, +8 visual {+0 FE object, +4 type}} */
#define G_MM_VISPOOL    0x008364b4u   /* the visuals' pool */
#define FN_MM_ADDICON   0x004ec790u   /* thiscall icons (type, racer number), callee pops: an icon with a free visual of that type */
#define FN_POOL_ALLOC   0x0043f8f0u   /* cdecl (pool) */
#define FN_NODE_ALLOC   0x00440ec0u   /* cdecl (): a list node, +8 its data */
#define MM_AIRACER      3u
#define MM_POOL         256u          /* the minimap's visual and icon pools with free roam on (g_pools) */
static struct { uint32_t hud, copy[NSLOT], hash[NSLOT]; int ncopy; int said, stop;
                int32_t col[NSLOT][3];                                  /* each copy's own colour (b, g, r) */
                uint32_t orig; int vis; } g_mm;                         /* AIRACERINDICATOR_0; its copies are 0 unknown, 1 hidden, 2 shown */
/* the arrows crew_arrows has in a crew's colour, and the colour each had before */
#define MMC_MAX         (NSLOT + 8)
static struct { uint32_t hud; int n; uint32_t obj[MMC_MAX]; int32_t orig[MMC_MAX][3]; } g_mmc;
/* an arrow's own colour (b, g, r): the one it had before a crew's, else the one it has */
static int mm_own_colour(uint32_t o, int32_t rgb[3]){
    int32_t col[4];
    if (!fe_colour_get(o, col)) return 0;
    for (int i = 0; i < 3; i++) rgb[i] = col[i];
    for (int j = 0; g_mmc.hud == g_mm.hud && j < g_mmc.n; j++) if (g_mmc.obj[j] == o) for (int i = 0; i < 3; i++) rgb[i] = g_mmc.orig[j][i];
    return 1;
}
/* a visual (a free one, or one for a copy of AIRACERINDICATOR_0) in the free list */
static int mm_visual_held(uint32_t icons, uint32_t fo){
    for (uint32_t n = rd32(G_MM_VISUALS), m = 0; n && n != G_MM_VISUALS && m < 256; n = rd32(n), m++) if (rd32(rd32(n + 8u)) == fo) return 1;
    for (uint32_t n = rd32(icons), m = 0; n && n != icons && m < 256; n = rd32(n), m++) if (rd32(rd32(n + 0x1cu)) == fo) return 1;
    return 0;
}
/* a copy is the HUD package's object: a HUD made again (after a shop the
 * new one can have the old one's address, and g_mm.hud is the same) has
 * none of ours, they were freed with the old package.  So a copy is taken
 * again only while the package still holds it under its name (a freed one
 * drawn by the minimap faulted in the arrow's rotation, 0x517C80) */
static int mm_copy_live(CPU *c, uint32_t icons, int i){
    uint32_t pk = gcall1(c, FN_FE_PACKAGE, 0, rd32(icons + 0x18u));
    return ok(pk, 0x54) && fe_list_of(pk + 0x4cu, g_mm.copy[i], 0) && rd32(g_mm.copy[i] + 0x10u) == g_mm.hash[i];
}
static int mm_visual(CPU *c, uint32_t icons){
    for (uint32_t n = rd32(G_MM_VISUALS), m = 0; n && n != G_MM_VISUALS && m < 256; n = rd32(n), m++){
        uint32_t v = rd32(n + 8u);
        if (ok(v, 8) && MR32(v + 4u) == MM_AIRACER) return 1;
    }
    int i = 0;
    while (i < g_mm.ncopy && mm_visual_held(icons, g_mm.copy[i])) i++;
    uint32_t fo = i < g_mm.ncopy ? g_mm.copy[i] : 0;
    if (fo && !mm_copy_live(c, icons, i)){
        rlog("[roam] f=%ld minimap: a new HUD at the old one's address: its %d copies of AIRACERINDICATOR_0 forgotten\n", rh_frame(), g_mm.ncopy);
        g_mm.ncopy = 0; g_mm.orig = 0; fo = 0;
    }
    if (!fo){
        if (g_mm.ncopy >= NSLOT) return 0;
        uint32_t pkg = rd32(icons + 0x18u), sa = g_gmem + TAG_SCR + 0x48u;
        gstr(sa, "AIRACERINDICATOR_0", 24);
        uint32_t a[2] = { pkg, gcall1(c, FN_FE_HASH, 0, sa) }, o0 = ok(pkg, 0x10) ? rh_call(c, FN_FE_FINDOBJ, 0, 0, 2, a) : 0;
        char nm[24]; snprintf(nm, sizeof nm, "ROAM_AIRACER_%d", g_mm.ncopy);
        fo = ok(o0, 0x5c) ? fe_clone(c, pkg, o0, nm) : 0;
        if (!fo) return 0;
        i = g_mm.ncopy;
        if (!mm_own_colour(o0, g_mm.col[i])) mm_own_colour(fo, g_mm.col[i]);
        g_mm.hash[i] = MR32(fo + 0x10u); g_mm.copy[g_mm.ncopy++] = fo;
        g_mm.orig = o0; g_mm.vis = 0;                                     /* shown or hidden as the original, next frame */
    }
    /* a copy in its own colour: fe_clone gave it the original's, a crew's
     * while the original is on a crew-mate's arrow (and every car the copy
     * went to was marked as a crew-mate's); and crew_arrows forgets a copy
     * no visual holds, in a crew's colour or not */
    fe_colour_to(c, fo, g_mm.col[i]);
    uint32_t pool = rd32(G_MM_VISPOOL), v = pool ? rh_call(c, FN_POOL_ALLOC, 0, 0, 1, &pool) : 0, n = v ? rh_call(c, FN_NODE_ALLOC, 0, 0, 0, 0) : 0;
    if (!ok(v, 8) || !ok(n, 12)) return 0;
    MR32(v) = fo; MR32(v + 4u) = MM_AIRACER;
    uint32_t tail = rd32(G_MM_VISUALS + 4u);                              /* at the end, as 0x4DB900 adds them */
    MR32(n + 8u) = v; MR32(tail) = n; MR32(G_MM_VISUALS + 4u) = n; MR32(n + 4u) = tail; MR32(n) = G_MM_VISUALS;
    return 1;
}
static void arrows_update(CPU *c, uint32_t w){
    uint32_t pl = rd32(G_PLAYER1), hud = pl && ok(pl, PL_HUD + 4u) ? rd32(pl + PL_HUD) : 0, icons = rd32(G_MM_ICONS);
    if (hud != g_mm.hud){ memset(&g_mm, 0, sizeof g_mm); g_mm.hud = hud; }      /* our copies went with the old HUD */
    if (!hud || !ok(icons, 0x1c) || !g_gmem) return;
    /* the copies are shown and hidden with the original: the HUD hides its
     * own arrows (the prologue's start, under the world map or the pause
     * menu) and shows them again, but not ours; a copy made while the
     * original was hidden stayed hidden for good.  Only copies the HUD's
     * package still holds are touched (mm_copy_live) */
    if (g_mm.ncopy && ok(g_mm.orig, 0x20)){
        int vis = (MR32(g_mm.orig + 0x1cu) & 1u) ? 1 : 2;
        if (vis != g_mm.vis){
            if (!mm_copy_live(c, icons, 0)){
                rlog("[roam] f=%ld minimap: a new HUD at the old one's address: its %d copies of AIRACERINDICATOR_0 forgotten\n", rh_frame(), g_mm.ncopy);
                g_mm.ncopy = 0; g_mm.orig = 0; g_mm.vis = 0;
            } else {
                for (int i = 0; i < g_mm.ncopy; i++) gcall1(c, vis == 2 ? FN_FE_SHOW : FN_FE_HIDE, 0, g_mm.copy[i]);
                g_mm.vis = vis;
            }
        }
    }
    if (g_mm.stop) return;
    uint8_t has[256] = {0};                                     /* by racer number (a signed byte): an AI racer's arrow */
    uint32_t m = 0;
    for (uint32_t n = rd32(icons); n && n != icons && m < 256 && ok(n, 0x20); n = rd32(n), m++){
        uint32_t v = rd32(n + 0x1cu);
        if (ok(v, 8) && MR32(v + 4u) == MM_AIRACER) has[(uint8_t)MR32(n + 8u)] = 1;
    }
    for (int k = 0; k < NSLOT; k++){
        Slot *s = &g_sl[k];
        if (s->st != SL_ACTIVE || s->hidden || s->world != w || !ok(s->car, 0x9e0)) continue;
        int16_t rn = (int16_t)MR16(s->car + 0xau);
        if (has[(uint8_t)rn]) continue;
        /* far below the icons' pool (MM_POOL; an icon it cannot give is
         * linked in as a null pointer) */
        if (m >= MM_POOL - 16u || !mm_visual(c, icons)){
            if (!g_mm.said++) rlog("[roam] f=%ld no minimap arrow for a friend's car (no AIRACERINDICATOR to copy, or the minimap's pools are full)\n", rh_frame());
            return;
        }
        uint32_t a[2] = { MM_AIRACER, (uint32_t)(int32_t)rn };
        rh_call(c, FN_MM_ADDICON, icons, 0, 2, a);
        m++; has[(uint8_t)rn] = 1;
        /* the icon is the list's last: with no visual of its type it would
         * be added again every frame */
        uint32_t last = rd32(icons + 4u), v = ok(last, 0x20) ? rd32(last + 0x1cu) : 0;
        if (!ok(v, 8) || MR32(v + 4u) != MM_AIRACER || (int16_t)MR32(last + 8u) != rn){
            g_mm.stop = 1;
            rlog("[roam] f=%ld minimap: an arrow made for a friend's car has no visual: no more until the next HUD\n", rh_frame());
            return;
        }
    }
}

/* the crew (1..) of the friend's car shown with this racer number, 0: none */
static int racer_crew(uint32_t w, int16_t rn){
    for (int k = 0; k < NSLOT; k++){
        const Slot *sl = &g_sl[k];
        if (sl->st == SL_ACTIVE && sl->crew && !sl->hidden && sl->world == w && ok(sl->car, 0x9e0) && (int16_t)MR16(sl->car + 0xau) == rn) return sl->crew;
    }
    return 0;
}
/* A crew's arrows in the crew's colour: the arrow's object (its visual's)
 * gets the colour each frame its icon belongs to a crew's car, and its own
 * colour back once it no longer does (the visuals go from car to car, and
 * to the AI racers); the alpha is left as it is.  Only objects the HUD
 * still holds are touched: a visual on an icon or in the free list
 * (G_MM_VISUALS); the others went with an old HUD and are forgotten (a
 * copy of ours that no visual holds for a while too: mm_visual gives it
 * its own colour back when it takes it again) */
static void crew_arrows(CPU *c, uint32_t w){
    uint32_t pl = rd32(G_PLAYER1), hud = pl && ok(pl, PL_HUD + 4u) ? rd32(pl + PL_HUD) : 0, icons = rd32(G_MM_ICONS);
    if (hud != g_mmc.hud){ memset(&g_mmc, 0, sizeof g_mmc); g_mmc.hud = hud; }
    if (!hud || !ok(icons, 0x1c) || !g_gmem) return;
    uint8_t used[MMC_MAX] = {0}, live[MMC_MAX] = {0};
    for (uint32_t n = rd32(icons), m = 0; n && n != icons && m < 256 && ok(n, 0x20); n = rd32(n), m++){
        uint32_t v = rd32(n + 0x1cu), o = ok(v, 8) && MR32(v + 4u) == MM_AIRACER ? MR32(v) : 0;
        if (!ok(o, 0x34)) continue;
        int crew = racer_crew(w, (int16_t)MR32(n + 8u)), j = -1;
        for (int i = 0; i < g_mmc.n; i++) if (g_mmc.obj[i] == o) j = i;
        if (j >= 0) live[j] = 1;
        if (!crew) continue;
        int32_t col[4];
        if (!fe_colour_get(o, col)) continue;
        if (j < 0){
            if (g_mmc.n >= MMC_MAX) continue;
            j = g_mmc.n++; g_mmc.obj[j] = o; live[j] = 1;
            for (int i = 0; i < 3; i++) g_mmc.orig[j][i] = col[i];
        }
        used[j] = 1;
        uint32_t rgb = O.crew_rgb[crew - 1];
        int32_t b = (int32_t)(rgb & 0xffu), g = (int32_t)(rgb >> 8 & 0xffu), r = (int32_t)(rgb >> 16 & 0xffu);
        if (col[0] != b || col[1] != g || col[2] != r) fe_colour_set(c, o, b, g, r, col[3]);
    }
    for (uint32_t n = rd32(G_MM_VISUALS), m = 0; n && n != G_MM_VISUALS && m < 256; n = rd32(n), m++){
        uint32_t v = rd32(n + 8u), o = ok(v, 8) ? MR32(v) : 0;
        for (int i = 0; o && i < g_mmc.n; i++) if (g_mmc.obj[i] == o) live[i] = 1;
    }
    for (int j = g_mmc.n - 1; j >= 0; j--){
        if (used[j]) continue;
        int32_t col[4];
        if (live[j] && fe_colour_get(g_mmc.obj[j], col)) fe_colour_set(c, g_mmc.obj[j], g_mmc.orig[j][0], g_mmc.orig[j][1], g_mmc.orig[j][2], col[3]);
        g_mmc.n--;                                                     /* (the last one in its place) */
        g_mmc.obj[j] = g_mmc.obj[g_mmc.n]; memcpy(g_mmc.orig[j], g_mmc.orig[g_mmc.n], sizeof g_mmc.orig[j]);
        used[j] = used[g_mmc.n]; live[j] = live[g_mmc.n];
    }
}

/* ---- the world map ---------------------------------------------------------------------------------- */
/* The world map (M, or the pause menu's Map: InGameWorldMapScreen, 0x4EE320,
 * for UI_InGame_WorldMap.fng) is made when it opens.  Its WorldMap (screen
 * +0x4C, 0x4E0440) makes a marker for each car of the World's AI range that
 * is in the world (0x4B0740: type 0xE, the package's AIRACERINDICATOR_<n> by
 * a running count, and the car's position and heading then) and places every
 * marker on the map (0x4B09E0, again at each zoom).  Friends' cars in the AI
 * range get theirs that way; the ones outside it get theirs here, the first
 * frame the map is open: the same marker, in the same list.  The package has
 * AIRACERINDICATOR_0..2 only (the outrun challengers' three cars), so every
 * car marker past them, the game's own for a friend's car in the AI range or
 * one of ours, has no object; each gets a copy of the first (fe_clone), and
 * the map is placed again.  As the game's own, a marker stays where the car
 * was when the map opened.
 *
 * The players in free roam we have no car for (the hub links us to the 32
 * nearest at most) get the same marker too: the map asks the hub for them
 * as it opens (rc_ask_map: the RC_MAP_MAX nearest past our peers, where they
 * were in the last half second), and each one's marker is made from a
 * stand-in for a car when the answer comes (0x4B0740 reads only the car's
 * +0x60/+0x64 and its heading +0x40C), a frame or a few later.
 *
 * Each marker is one more object of the package, and FEng draws a package's
 * objects through two arrays of a fixed size: the renderer's list of the
 * objects to draw (0x51A970 adds each one whose colour has any alpha, hidden
 * or not: renderer +0x110 the count, +0x114 1024 entries; the radix sort
 * 0x5114F0 takes the 0x2000 bytes after them as its other half, so more
 * would garble both) and the level sorter's nodes (0x51B850, one for each
 * object drawn: 512 in the game, RH_FE_NODES here; an object past them is
 * not drawn).  The map has 235 objects of its own (173 drawn at the new
 * career's start), so 512 markers more took the nodes from its shop and
 * event icons and the player's own arrow.
 * The markers stay within both (wm_room): the package's objects are counted
 * first, all of them (the zoom shows and hides markers), and the farthest
 * players are left out. */
#define WM_PACKAGE      "UI_InGame_WorldMap.fng"
#define VT_WM_SCREEN    0x00797f20u   /* InGameWorldMapScreen's vtable; +4 its package's name */
#define WM_MAP          0x4cu         /* the screen's WorldMap: +4/+8 its markers' list (+0 next, +4 previous) */
#define WM_MARK_SZ      0x2cu         /* a marker: +8 type, +0xC its FE object, +0x10/+0x14 where, +0x18 heading */
#define WM_CAR          0xeu          /* a car's marker (the player's is 0x10) */
#define FN_WM_CARMARK   0x004b0740u   /* thiscall marker (package name, car), callee pops */
#define FN_WM_PLACE     0x004b09e0u   /* thiscall WorldMap () */
#define G_WM_COUNT      0x00835f70u   /* the car markers' running count: AIRACERINDICATOR_<n> */
#define PKG_SCREEN      0x40u         /* FEPackage: +0x40 an object whose +0x14 is the package's screen */
#define WM_ASK_US       1500000       /* no answer from the hub in this time: asked again, WM_ASKS times at most */
#define WM_LIVE_US      250000        /* keep the map moving with incremental answers */
#define WM_ASKS         3
#define FE_LIST_MAX     1024          /* the FE renderer's list of a package's objects to draw */
#define WM_SPARE        16            /* objects left to the package itself */
static struct { int done, said, copies, asks, others; uint32_t map, gen, fake; int64_t asked;
                int col_ok; int32_t col[3]; } g_wm;                   /* AIRACERINDICATOR_0's colour as the map opened (b, g, r) */
static rc_mapent g_wm_e[RC_MAP_MAX];
static uint32_t g_wm_markers[RC_MAPD_GONE];
static uint8_t g_wm_seen[RC_MAPD_GONE];
static int16_t g_wm_filter[RC_MAPD_GONE];
static int g_wm_n;
/* the open map's screen, 0 while it is not made (or not this screen) */
static uint32_t wm_screen(uint32_t pk){
    uint32_t h = rd32(pk + PKG_SCREEN), s = ok(h, 0x18) ? rd32(h + 0x14u) : 0;
    return ok(s, WM_MAP + 4u) && MR32(s) == VT_WM_SCREEN ? s : 0;
}
static uint32_t wm_find(CPU *c, uint32_t pkg, const char *name){
    uint32_t sa = g_gmem + TAG_SCR + 0x48u;
    gstr(sa, name, 24);
    uint32_t a[2] = { pkg, gcall1(c, FN_FE_HASH, 0, sa) }, o = rh_call(c, FN_FE_FINDOBJ, 0, 0, 2, a);
    return ok(o, 0x5c) ? o : 0;
}
/* a car marker at the end of the map's list (as 0x4E0440 adds them) for this car */
static int wm_mark(CPU *c, uint32_t map, uint32_t pkg, uint32_t car){
    uint32_t sz = WM_MARK_SZ, m = rh_call(c, FN_MALLOC, 0, 0, 1, &sz);
    if (!ok(m, WM_MARK_SZ)) return 0;
    uint32_t a[2] = { pkg, car };
    rh_call(c, FN_WM_CARMARK, m, 0, 2, a);
    uint32_t head = map + 4u, tail = rd32(head + 4u);
    MR32(tail) = m; MR32(head + 4u) = m; MR32(m + 4u) = tail; MR32(m) = head;
    return 1;
}
/* the objects of a package FEng could draw: every one in its list and its
 * groups' (type 5: +0x64 the first), groups themselves aside */
static int fe_objects(uint32_t first, int depth){
    int n = 0, k = 0;
    for (uint32_t o = rd32(first); ok(o, 0x5c) && k < 4096; o = rd32(o + 4u), k++)
        n += rd32(o + 0x18u) != 5u ? 1 : depth < 8 ? fe_objects(o + 0x64u, depth + 1) : 0;
    return n;
}
/* a package's string objects in the log (mp map strings): their hashes and texts */
static void fe_strings(uint32_t first, int depth){
    int k = 0;
    for (uint32_t o = rd32(first); ok(o, 0x5c) && k < 4096; o = rd32(o + 4u), k++){
        uint32_t t = rd32(o + 0x18u);
        if (t == 5u && depth < 8){ fe_strings(o + 0x64u, depth + 1); continue; }
        if (t != 2u) continue;
        char tx[48]; uint32_t w = rd32(o + 0x64u), n = 0;
        for (; ok(w, 2) && n + 1 < sizeof tx && MR16(w + 2u * n); n++) tx[n] = (char)MR16(w + 2u * n);
        tx[n] = 0;
        uint32_t d = rd32(o + 0x2cu);
        rlog("[roam]   string 0x%08x hash %08x flags %08x depth %d at %.1f %.1f %.1f colour %08x %08x %08x %08x: %s\n", o, rd32(o + 0x10u), rd32(o + 0x1cu), depth,
             ok(d, 0x40) ? (double)MRF32(d + 0x1cu) : 0., ok(d, 0x40) ? (double)MRF32(d + 0x20u) : 0., ok(d, 0x40) ? (double)MRF32(d + 0x24u) : 0.,
             ok(d, 0x40) ? MR32(d) : 0u, ok(d, 0x40) ? MR32(d + 4u) : 0u, ok(d, 0x40) ? MR32(d + 8u) : 0u, ok(d, 0x40) ? MR32(d + 12u) : 0u, tx);
    }
}
/* how many objects more the map's package can take */
static int wm_room(uint32_t pk){
    int room = (RH_FE_NODES < FE_LIST_MAX ? RH_FE_NODES : FE_LIST_MAX) - WM_SPARE - fe_objects(pk + 0x4cu, 0);
    return room > 0 ? room : 0;
}
/* a copy of AIRACERINDICATOR_0 for each car marker without an object, at most max */
static int wm_dress(CPU *c, uint32_t map, uint32_t pkg, int max){
    uint32_t o0 = 0; int copies = 0;
    for (uint32_t e = rd32(map + 4u), i = 0; e && e != map + 4u && i < 4096 && copies < max && ok(e, WM_MARK_SZ); e = rd32(e), i++){
        if (MR32(e + 8u) != WM_CAR || MR32(e + 0xcu)) continue;
        char nm[24]; snprintf(nm, sizeof nm, "ROAM_MAPCAR_%d", g_wm.copies);
        if (!o0) o0 = wm_find(c, pkg, "AIRACERINDICATOR_0");
        uint32_t cl = o0 ? fe_clone(c, pkg, o0, nm) : 0;
        if (!cl){
            if (!g_wm.said++) rlog("[roam] f=%ld world map: no copy of AIRACERINDICATOR_0: some players not marked\n", rh_frame());
            break;
        }
        /* in the marker's own colour: the hub's players are marked after
         * crew_map_open, and AIRACERINDICATOR_0 can be a crew-mate's marker
         * by then, in the crew's colour (every one of them was) */
        if (g_wm.col_ok) fe_colour_to(c, cl, g_wm.col);
        MR32(e + 0xcu) = cl; copies++; g_wm.copies++;
    }
    return copies;
}
static uint32_t meet_icon(CPU *c, uint32_t pkg);
/* The map's filter: two rows of our own in its legend (the list on its left,
 * a row for each kind of place on the map: Up and Down pick one, Enter
 * crosses its tick and the map hides that kind), "Players" for the other
 * players' cars (a crew-mate's stays) and "Players' races" for the race
 * lobbies' icons and labels (the one the player is in stays).  The legend
 * (the screen's +0x54, made with the map by 0x4EE320) is a list of rows of
 * 0x2C bytes, the last made first (Down walks back along it): +8 the tick,
 * +0xC the icon, +0x10 a second icon, +0x14 the text (the package's
 * DATA_A_<n>, DATA_B_<n>, DATA_D_<n>, DATA_C_<n>, n the row from 1), +0x18
 * and +0x1C the tick's colours, +0x20 the kind of place, +0x24 1 crossed,
 * +0x28 the package's name.  The package has 14 rows; a career takes one a
 * kind it has (12 at stage 3, all 14 once it has every kind), ours the ones
 * after them, and past the package's 14 copies of its row 13 (wmf_copy_parts),
 * every row then nearer the others and smaller by as much, so that all of them
 * fit where its 14 are (wmf_fit).
 * Their kinds are past the game's 14, which its show flags take no notice of
 * (0x4964D0 counts them hidden, 0x496390 sets nothing): Enter only crosses
 * the tick (0x4B0EF0) and a pick never jumps to a marker of the kind
 * (0x4B0E70).  The ticks are read every frame.  A marker hidden is moved off the map: the map's placing
 * (0x4B09E0) hides a marker out of its view, and it shows a car's whatever
 * its filter says.  The choices are kept in the game's registry. */
#define WMF_ROWS        14            /* the legend's rows in the package */
#define WMF_ROW_SZ      0x2cu
#define WMF_SCR_ROWS    0x54u         /* the screen: its legend (+0 the first row, +4 the last) */
#define WMF_SCR_BUTTONS 0x50u         /* the screen: its buttons' list (+4 first, +8 last; 0x14 bytes: +8 1 a row's, +0xC ICON_BACKING_<n>, +0x10 the row) */
#define WMF_KIND0       0x20u         /* our rows' kinds: Players, Players' races (the game's are 0 .. 13) */
#define FN_WM_ROWLOOK   0x00496920u   /* thiscall row (crossed): the tick or the cross, the icon and the text dimmed or not */
#define FN_FE_TEX       0x0050c980u   /* cdecl (image) -> its texture's hash */
#define FN_FE_SETTEX    0x0050c990u   /* cdecl (image, texture hash) */
#define WMF_RACES_RGB   0xffc832u     /* Players' races' icon: the lobbies' labels' gold (MP_RGB_LOBBY) */
#define MEET_RGB        0x78ff50u     /* car meets' labels, icons and legend row (meet_*) */
#define WMF_AWAY        1.0e5f        /* a hidden marker's place: off every map */
#define WMF_MAX         (NSLOT + RC_MAP_MAX + 32)
#define WMF_PLAYERS     0
#define WMF_RACES       1
#define WMF_MEETS       2             /* car meets (meet_*) */
#if MPRACES
#define WMF_N           3
#else
#define WMF_N           1
#endif
#ifndef ROAM_HOST_WIN
int  win32_reg_get_dword(const char *nm, uint32_t *out);
void win32_reg_put_dword(const char *nm, uint32_t v);
static const char *const wmf_reg[3] = { "MapPlayers", "MapRaces", "MapMeets" };   /* (the Windows plugin keeps them a session) */
#endif
#define WMF_TEST0       3             /* rows of no kind for a test (NFSU2_ROAM_TEST_LEGEND_ROWS): a fuller legend */
#define WMF_TEST_MAX    4
static const char *const wmf_text[WMF_TEST0 + WMF_TEST_MAX] = { "Players", "Players' races", "Car meets", "Test row 1", "Test row 2", "Test row 3",
                                                                "Test row 4" };
static int g_wmf_on[WMF_TEST0 + WMF_TEST_MAX] = { 1, 1, 1, 1, 1, 1, 1 }, g_wmf_loaded;
static struct { uint32_t map, row[3]; int n; uint32_t m[WMF_MAX]; float x[WMF_MAX], y[WMF_MAX]; uint8_t what[WMF_MAX]; } g_wmf;
static void wmf_load(void){
    if (g_wmf_loaded) return;
    g_wmf_loaded = 1;
#ifndef ROAM_HOST_WIN
    for (int i = 0; i < WMF_N; i++){ uint32_t v; if (win32_reg_get_dword(wmf_reg[i], &v)) g_wmf_on[i] = v != 0; }
#endif
}
/* marker m of the open map is a player's (what WMF_PLAYERS), a lobby's
 * (WMF_RACES) or a meet's (WMF_MEETS): off the map while its row is crossed
 * (placed again by the caller); its entry, -1 when it has none */
static int wmf_track(uint32_t map, uint32_t m, int what){
    if (g_wmf.map != map || g_wmf.n >= WMF_MAX || !ok(m, WM_MARK_SZ)) return -1;
    int i = g_wmf.n++;
    g_wmf.m[i] = m; g_wmf.x[i] = MRF32(m + 0x10u); g_wmf.y[i] = MRF32(m + 0x14u); g_wmf.what[i] = (uint8_t)what;
    if (!g_wmf_on[what]){ MRF32(m + 0x10u) = WMF_AWAY; MRF32(m + 0x14u) = WMF_AWAY; }
    return i;
}
/* marker m (its entry i, -1: none) to x, y (WMF_AWAY: off the map, whatever
 * the row), heading h (a car's, 65536 a turn); placed again by the caller */
static void wmf_move(uint32_t m, int i, float x, float y, uint16_t h){
    if (i >= 0 && i < g_wmf.n && g_wmf.m[i] == m){
        g_wmf.x[i] = x; g_wmf.y[i] = y;
        if (!g_wmf_on[g_wmf.what[i]]) x = y = WMF_AWAY;
    }
    MRF32(m + 0x10u) = x; MRF32(m + 0x14u) = y; MRF32(m + 0x18u) = (float)h * MRF32(G_WM_HEADING_K);
}
/* our row of the legend (as 0x4B0D50 makes the game's, from its row like):
 * its parts o (tick, icon, second icon, text), its backing bk; in front of
 * the list (after the game's rows and ours before: Down reaches it last) */
static uint32_t wmf_row(CPU *c, uint32_t scr, uint32_t pkg, const uint32_t o[4], uint32_t bk, int what, uint32_t like, uint32_t tex, uint32_t rgb){
    uint32_t sz = WMF_ROW_SZ, r = rh_call(c, FN_MALLOC, 0, 0, 1, &sz);
    if (!ok(r, WMF_ROW_SZ)) return 0;
    for (uint32_t i = 0; i < WMF_ROW_SZ; i += 4) MR32(r + i) = 0;
    for (int i = 0; i < 4; i++) MR32(r + 8u + 4u * (uint32_t)i) = o[i];
    MR32(r + 0x18u) = MR32(like + 0x18u); MR32(r + 0x1cu) = MR32(like + 0x1cu);
    MR32(r + 0x20u) = WMF_KIND0 + (uint32_t)what; MR32(r + 0x28u) = pkg;
    uint32_t a[2] = { o[1], tex };
    if (tex) rh_call(c, FN_FE_SETTEX, 0, 0, 2, a);
    fe_colour_set(c, o[1], (int32_t)(rgb & 0xffu), (int32_t)(rgb >> 8 & 0xffu), (int32_t)(rgb >> 16 & 0xffu), 0xff);
    uint32_t txt = g_gmem + TAG_SCR + 0x48u;
    gstr(txt, wmf_text[what], 24);
    gcall1(c, FN_FE_SETSTR, o[3], txt);
    MR32(o[3] + 0x1cu) |= 2u;
    gcall1(c, FN_FE_SHOW, 0, o[0]); gcall1(c, FN_FE_SHOW, 0, o[1]); gcall1(c, FN_FE_SHOW, 0, o[3]); gcall1(c, FN_FE_HIDE, 0, o[2]);
    uint32_t head = scr + WMF_SCR_ROWS, first = rd32(head);
    MR32(r) = first; MR32(r + 4u) = head; MR32(head) = r; MR32(first + 4u) = r;
    uint32_t crossed = !g_wmf_on[what];
    rh_call(c, FN_WM_ROWLOOK, r, 0, 1, &crossed);
    /* its button (the backing a pointer picks the row by), at the end of the screen's */
    uint32_t l = rd32(scr + WMF_SCR_BUTTONS), bsz = 0x14u, b = bk && ok(l, 0xc) ? rh_call(c, FN_MALLOC, 0, 0, 1, &bsz) : 0;
    if (ok(b, 0x14)){
        uint32_t tail = rd32(l + 8u);
        MR32(b) = l + 4u; MR32(b + 4u) = tail; MR32(b + 8u) = 1; MR32(b + 0xcu) = bk; MR32(b + 0x10u) = r;
        MR32(tail) = b; MR32(l + 8u) = b;
    }
    return r;
}
/* the parts of the package's row n (DATA_A_<n> ...), its backing in *bk; 0 when one is missing */
static int wmf_parts(CPU *c, uint32_t pkg, int n, uint32_t o[4], uint32_t *bk){
    static const char *const part[5] = { "DATA_A_%d", "DATA_B_%d", "DATA_D_%d", "DATA_C_%d", "ICON_BACKING_%d" };
    for (int i = 0; i < 5; i++){
        char nm[24]; snprintf(nm, sizeof nm, part[i], n);
        uint32_t x = wm_find(c, pkg, nm);
        if (!x && i < 4) return 0;
        if (i < 4) o[i] = x; else *bk = x;
    }
    return 1;
}
/* A row past the package's: copies of its row 13's parts and backing (row 14's backing is another, the legend's
 * foot's), where row 13 is (wmf_fit moves it to its line); 0 when one is missing.  A row's parts light up together
 * by messages to each other's ids (+0xC): its text answers BUTTON_HIGHLIGHT with its own script and the message on to
 * its backing's and its icon's ids, the backing with its own script (each object's responses, +0x34: +0x3C the
 * first, each +4 the next, +0xC its message, +0x10 its commands, +0x14 them, 12 bytes: 1 a message, the message, the
 * id).  Copies keep the ids, and a copy's messages lit row 13, so each copy gets an id of its own and the copies'
 * commands name the copies (fe_retarget) */
static uint32_t g_fe_id = 0x7f000000u;   /* copies' own ids: the package's are far below */
static int fe_ids(uint32_t a, uint32_t b, uint32_t *from, uint32_t *to, int n, int max, int depth){
    if (n < max && ok(a, 0x6c) && ok(b, 0x6c)){ from[n] = MR32(a + 0xcu); to[n] = g_fe_id; MR32(b + 0xcu) = g_fe_id++; n++; }
    if (depth < 4 && ok(a, 0x6c) && ok(b, 0x6c) && MR32(a + 0x18u) == 5u)
        for (uint32_t x = rd32(a + 0x64u), y = rd32(b + 0x64u), k = 0; x && y && x != y && k < 64; x = rd32(x + 4u), y = rd32(y + 4u), k++)
            n = fe_ids(x, y, from, to, n, max, depth + 1);
    return n;
}
/* copy b's commands (of original a's responses) that name an id of from[]: to[]'s instead, commands the original
 * has too copied first; how many */
static int fe_retarget(CPU *c, uint32_t a, uint32_t b, const uint32_t *from, const uint32_t *to, int n, int depth){
    int done = 0, k = 0;
    if (!ok(a, 0x6c) || !ok(b, 0x6c)) return 0;
    for (uint32_t rs = rd32(b + 0x3cu), ro = rd32(a + 0x3cu); rs && rs != ro && k < 16 && ok(rs, 0x18); rs = rd32(rs + 4u), ro = ok(ro, 0x18) ? rd32(ro + 4u) : 0, k++){
        uint32_t nc = rd32(rs + 0x10u), cm = rd32(rs + 0x14u);
        if (!nc || nc > 16u || !ok(cm, nc * 12u)) continue;
        if (ok(ro, 0x18) && rd32(ro + 0x14u) == cm){
            uint32_t sz = nc * 12u, nw = rh_call(c, FN_MALLOC, 0, 0, 1, &sz);
            if (!ok(nw, sz)) continue;
            memcpy(GPTR(nw), GPTR(cm), sz); MR32(rs + 0x14u) = nw; cm = nw;
        }
        for (uint32_t j = 0; j < nc; j++){
            uint32_t t = MR32(cm + 12u * j + 8u);
            for (int q = 0; q < n && t; q++) if (t == from[q]){ MR32(cm + 12u * j + 8u) = to[q]; done++; break; }
        }
    }
    if (depth < 4 && MR32(a + 0x18u) == 5u)
        for (uint32_t x = rd32(a + 0x64u), y = rd32(b + 0x64u), j = 0; x && y && x != y && j < 64; x = rd32(x + 4u), y = rd32(y + 4u), j++)
            done += fe_retarget(c, x, y, from, to, n, depth + 1);
    return done;
}
static int wmf_copy_parts(CPU *c, uint32_t pkg, int k, uint32_t o[4], uint32_t *bk){
    uint32_t r[4], rb = 0, src[5], cp[5] = { 0 };
    if (!wmf_parts(c, pkg, WMF_ROWS - 1, r, &rb)) return 0;
    for (int i = 0; i < 5; i++){
        char nm[32]; snprintf(nm, sizeof nm, "ROAM_LEGEND_%d_%d", k, i);
        src[i] = i < 4 ? r[i] : rb;
        cp[i] = src[i] ? fe_clone(c, pkg, src[i], nm) : 0;
        if (!cp[i] && i < 4) return 0;
        if (i < 4) o[i] = cp[i]; else *bk = cp[i];
    }
    uint32_t from[32], to[32]; int n = 0, done = 0;
    for (int i = 0; i < 5; i++) if (cp[i]) n = fe_ids(src[i], cp[i], from, to, n, 32, 0);
    for (int i = 0; i < 5; i++) if (cp[i]) done += fe_retarget(c, src[i], cp[i], from, to, n, 0);
    rlog("[roam] f=%ld world map: our legend row %d a copy of row %d (%d objects, %d of their commands to the copies)\n", rh_frame(), k + 1, WMF_ROWS - 1, n, done);
    return 1;
}
/* the row's backing (its button's in the screen's list, 0x14 bytes from +4: +8 1 a row's, +0xC the backing, +0x10
 * the row) */
static uint32_t wmf_backing(uint32_t scr, uint32_t row){
    uint32_t l = rd32(scr + WMF_SCR_BUTTONS);
    if (!ok(l, 0xc)) return 0;
    int n = 0;
    for (uint32_t b = rd32(l + 4u); b && b != l + 4u && n < 256 && ok(b, 0x14); b = rd32(b), n++)
        if (MR32(b + 8u) == 1u && MR32(b + 0x10u) == row) return MR32(b + 0xcu);
    return 0;
}
/* an FE object moved down dy and its size times kx, ky (the game's setters: an animation of it goes along) */
static void fe_shift(CPU *c, uint32_t o, float dy, float kx, float ky){
    uint32_t d = ok(o, 0x34) ? rd32(o + 0x2cu) : 0;
    if (!ok(d, 0x40)) return;
    uint32_t ap[2] = { gvec(g_gmem + TAG_SCR + 0x20u, MRF32(d + 0x1cu), MRF32(d + 0x20u) + dy, MRF32(d + 0x24u)), 0 };
    rh_call(c, FN_FE_POS, o, 0, 2, ap);
    uint32_t as[2] = { gvec(g_gmem + TAG_SCR + 0x30u, MRF32(d + 0x38u) * kx, MRF32(d + 0x3cu) * ky, 1.f), 0 };
    if (kx != 1.f || ky != 1.f) rh_call(c, FN_FE_SCALE, o, 0, 2, as);
}
/* More rows than the package's (line[]: the legend's rows top to bottom): each in its line within the span of the
 * package's rows 1 to WMF_ROWS, nearer each other, and its parts smaller by as much (its backing, the bar a picked row
 * lights, only less tall), down to WMF_FIT_MIN of their size; their order, and Up and Down, as before.  Its size */
#define WMF_FIT_MIN     0.6f
static float wmf_fit(CPU *c, uint32_t scr, uint32_t pkg, const uint32_t *line, int n){
    uint32_t r1[4], rn[4], bk;
    if (n <= WMF_ROWS || !wmf_parts(c, pkg, 1, r1, &bk) || !wmf_parts(c, pkg, WMF_ROWS, rn, &bk)) return 1.f;
    uint32_t d1 = rd32(r1[0] + 0x2cu), dn = rd32(rn[0] + 0x2cu);
    if (!ok(d1, 0x40) || !ok(dn, 0x40)) return 1.f;
    float y1 = MRF32(d1 + 0x20u), span = MRF32(dn + 0x20u) - y1, pitch = span / (float)(n - 1), k = pitch / (span / (float)(WMF_ROWS - 1));
    if (k < WMF_FIT_MIN){ k = WMF_FIT_MIN; pitch = k * span / (float)(WMF_ROWS - 1); }
    for (int i = 0; i < n; i++){
        uint32_t r = line[i], t = ok(r, WMF_ROW_SZ) ? MR32(r + 8u) : 0, dt = ok(t, 0x34) ? rd32(t + 0x2cu) : 0;
        if (!ok(dt, 0x40)) continue;
        float dy = y1 + pitch * (float)i - MRF32(dt + 0x20u);
        for (uint32_t p = 0; p < 4; p++) fe_shift(c, MR32(r + 8u + 4u * p), dy, k, k);
        fe_shift(c, wmf_backing(scr, r), dy, 1.f, k);
    }
    return k;
}
/* as the map opens: our rows after the game's, and the players' markers it has */
static void wmf_begin(uint32_t map){
    wmf_load();
    memset(&g_wmf, 0, sizeof g_wmf); g_wmf.map = map;
}
static void wmf_open(CPU *c, uint32_t scr, uint32_t map, uint32_t pkg, uint32_t w){
    int rows = 0; uint32_t like = 0, line[64 + WMF_TEST0 + WMF_TEST_MAX]; float yl[64];
    /* the game's rows, top to bottom (by their ticks' places) */
    for (uint32_t r = rd32(scr + WMF_SCR_ROWS); r && r != scr + WMF_SCR_ROWS && rows < 64 && ok(r, WMF_ROW_SZ); r = rd32(r)){
        uint32_t t = MR32(r + 8u), d = ok(t, 0x34) ? rd32(t + 0x2cu) : 0;
        float y = ok(d, 0x40) ? MRF32(d + 0x20u) : 0.f;
        int j = rows++;
        for (; j > 0 && yl[j - 1] > y; j--){ yl[j] = yl[j - 1]; line[j] = line[j - 1]; }
        yl[j] = y; line[j] = r; like = r;
    }
    /* ours after them, in the package's rows past theirs and in copies past the package's; with more rows than the
     * package's, all of them nearer each other.  NFSU2_ROAM_TEST_LEGEND_ROWS=n: n rows more, of no kind (as a fuller
     * legend) */
    int test = env_int("NFSU2_ROAM_TEST_LEGEND_ROWS", 0, 0, WMF_TEST_MAX), nl = rows;
    float k = 1.f;
    if (like){
        uint32_t car = wm_find(c, pkg, "AIRACERINDICATOR_0"), ring = wm_find(c, pkg, "SPRINTEVENTINDICATOR_0");
        uint32_t rgb = g_wm.col_ok ? (uint32_t)(g_wm.col[2] & 0xff) << 16 | (uint32_t)(g_wm.col[1] & 0xff) << 8 | (uint32_t)(g_wm.col[0] & 0xff) : 0xffffffu;
        uint32_t tex[3] = { car ? gcall1(c, FN_FE_TEX, 0, car) : 0, ring ? gcall1(c, FN_FE_TEX, 0, ring) : 0, 0 }, col[3] = { rgb, WMF_RACES_RGB, MEET_RGB };
#if MPRACES
        uint32_t mi = meet_icon(c, pkg);
        tex[2] = mi ? gcall1(c, FN_FE_TEX, 0, mi) : tex[0];
#endif
        for (int i = 0; i < WMF_N + test; i++){
            int what = i < WMF_N ? i : WMF_TEST0 + i - WMF_N, slot = rows + 1 + i;
            uint32_t o[4], bk = 0;
            int got = slot <= WMF_ROWS ? wmf_parts(c, pkg, slot, o, &bk) : wmf_copy_parts(c, pkg, i, o, &bk);
            uint32_t r = got ? wmf_row(c, scr, pkg, o, bk, what, like, what < 3 ? tex[what] : tex[0], what < 3 ? col[what] : 0xffffffu) : 0;
            if (i < WMF_N) g_wmf.row[i] = r;
            if (r) line[nl++] = r;
        }
        k = wmf_fit(c, scr, pkg, line, nl);
    }
}

/* every frame the map is open: a row ticked or crossed since, its markers on or off the map */
static void wmf_frame(CPU *c, uint32_t map){
    if (g_wmf.map != map) return;
    int moved = 0;
    for (int i = 0; i < WMF_N; i++){
        uint32_t r = g_wmf.row[i];
        if (!r) continue;
        int on = !MR8(r + 0x24u);
        if (on == g_wmf_on[i]) continue;
        g_wmf_on[i] = on; moved = 1;
#ifndef ROAM_HOST_WIN
        win32_reg_put_dword(wmf_reg[i], (uint32_t)on);
#endif
        rlog("[roam] f=%ld world map: %s %s\n", rh_frame(), wmf_text[i], on ? "shown" : "hidden");
    }
    if (!moved) return;
    for (int i = 0; i < g_wmf.n; i++){
        uint32_t m = g_wmf.m[i];
        int on = g_wmf_on[g_wmf.what[i]];
        MRF32(m + 0x10u) = on ? g_wmf.x[i] : WMF_AWAY; MRF32(m + 0x14u) = on ? g_wmf.y[i] : WMF_AWAY;
    }
    gcall0(c, FN_WM_PLACE, map);
}

#if MPRACES
static int mp_map_icons(CPU *c, uint32_t map, uint32_t pkg, uint32_t room, int hub);   /* lobbies on the map */
static void mp_map_labels(CPU *c, uint32_t map);
#endif
/* A crew's car markers on the world map in the crew's colour, the name
 * beside each (a copy of the legend's string, as the race lobbies' labels).
 * A marker is the car's by its place: made from the car as the map opened
 * (0x4B0740: +0x10/+0x14 the car's +0x60/+0x64), and the world stands while
 * the map is open.  Each frame the names follow their markers, hidden with
 * them (crew_map_labels) */
#define WMC_MAX         8
#define WMC_TEXT        "OPPONENT_CAR"   /* the legend's string ("Opponent Car") */
static struct { uint32_t map; int n; uint32_t m[WMC_MAX], lbl[WMC_MAX]; } g_wmc;
static void crew_map_open(CPU *c, uint32_t map, uint32_t pkg, uint32_t pk, uint32_t w){
    memset(&g_wmc, 0, sizeof g_wmc); g_wmc.map = map;
    int any = 0;
    for (int k = 0; k < NSLOT; k++) any |= g_sl[k].st == SL_ACTIVE && g_sl[k].crew;
    if (!any || !g_gmem) return;
    uint32_t base = wm_find(c, pkg, WMC_TEXT);
    for (uint32_t e = rd32(map + 4u), i = 0; e && e != map + 4u && i < 4096 && ok(e, WM_MARK_SZ); e = rd32(e), i++){
        uint32_t o = MR32(e + 0xcu);
        if (MR32(e + 8u) != WM_CAR || !ok(o, 0x34)) continue;
        float x = MRF32(e + 0x10u), y = MRF32(e + 0x14u);
        const Slot *sl = 0;
        for (int k = 0; k < NSLOT && !sl; k++){
            const Slot *q = &g_sl[k];
            if (q->st != SL_ACTIVE || !q->crew || q->hidden || q->world != w || !ok(q->car, 0x9e0)) continue;
            float dx = MRF32(q->car + 0x60u) - x, dy = MRF32(q->car + 0x64u) - y;
            if (dx * dx + dy * dy < 1.f) sl = q;
        }
        if (!sl) continue;
        uint32_t rgb = O.crew_rgb[sl->crew - 1];
        int32_t col[4];
        if (fe_colour_get(o, col)) fe_colour_set(c, o, (int32_t)(rgb & 0xffu), (int32_t)(rgb >> 8 & 0xffu), (int32_t)(rgb >> 16 & 0xffu), col[3]);
        if (g_wmc.n >= WMC_MAX) continue;
        char ln[24]; snprintf(ln, sizeof ln, "ROAM_CREWTXT_%d", g_wmc.n);
        uint32_t lbl = base && wm_room(pk) > 0 ? fe_clone(c, pkg, base, ln) : 0;
        if (lbl){
            uint32_t txt = g_gmem + TAG_SCR + 0x48u;
            gstr(txt, sl->name, TAG_DUEL_MAX);
            gcall1(c, FN_FE_SETSTR, lbl, txt);
            MR32(lbl + 0x1cu) |= 2u;
            fe_colour_set(c, lbl, (int32_t)(rgb & 0xffu), (int32_t)(rgb >> 8 & 0xffu), (int32_t)(rgb >> 16 & 0xffu), 0xff);
            gcall1(c, FN_FE_HIDE, 0, lbl);
        } else rlog("[roam] f=%ld world map: no name for %s's marker (%s 0x%08x)\n", rh_frame(), sl->name, WMC_TEXT, base);
        g_wmc.m[g_wmc.n] = e; g_wmc.lbl[g_wmc.n] = lbl; g_wmc.n++;
    }
    if (g_wmc.n) rlog("[roam] f=%ld world map: %d crew marker(s) in their colours\n", rh_frame(), g_wmc.n);
}
static void crew_map_labels(CPU *c, uint32_t map){
    if (g_wmc.map != map) return;
    float px[WMC_MAX], py[WMC_MAX]; int placed = 0;
    for (int i = 0; i < g_wmc.n; i++){
        uint32_t e = g_wmc.m[i], lbl = g_wmc.lbl[i], o = ok(e, WM_MARK_SZ) ? rd32(e + 0xcu) : 0;
        if (!lbl || !ok(o, 0x20)) continue;
        if (MR32(o + 0x1cu) & 1u){ gcall1(c, FN_FE_HIDE, 0, lbl); continue; }
        /* crew-mates near each other: their names one under another, not over each other */
        float x = MRF32(e + 0x1cu) + 10.f, y = MRF32(e + 0x20u);
        for (int again = 1, k = 0; again && k < WMC_MAX; k++){
            again = 0;
            for (int j = 0; j < placed; j++) if (__builtin_fabsf(px[j] - x) < 70.f && __builtin_fabsf(py[j] - y) < 13.f){ y = py[j] + 13.f; again = 1; }
        }
        px[placed] = x; py[placed] = y; placed++;
        uint32_t ap[2] = { gvec(g_gmem + TAG_SCR + 0x20u, x, y, 7.f), 0 };
        rh_call(c, FN_FE_POS, lbl, 0, 2, ap);
        gcall1(c, FN_FE_SHOW, 0, lbl);
    }
}
/* A parked car meet: a dense group of players who have stood still long enough. */
#define MEET_MAX        8
#define MEET_MIN        24
#define MEET_R          50.f
#define MEET_SLOW_MPS   4.f
#define MEET_EVERY_US   1000000
#define MEET_ARRIVE_M   40.f
#define MEET_PTS        (NSLOT + 1 + RC_MAP_MAX)
#define MEET_NB         1024
#define MEET_ICON       "SHOWCASEINDICATOR_"
#define WM_ITEMS        0xcu
#define WM_ITEM_SZ      0x24u
#define WM_SEL          0x14u
#define WM_CURSOR       0x24u
#define WMS_PICKED      0x5cu
#define FN_FE_PLACE     0x0051d4d0u
#define FN_FE_SCRIPT    0x0051cf70u
#define G_WM_CURSOR_SCR 0x0078f6bcu
#define G_GPS           0x00838590u
#define G_ROUTE         0x0081cbc0u
#define FN_ROUTE_CLEAR  0x004131f0u
#define MT_SZ           0x40u
#define MEET_STAY_M     25.f
#define MEET_PARKED_US  60000000
#define MEET_SPAWN_M    5.f
static uint32_t g_meet_t[MEET_MAX];
static struct { int on; float x, y; } g_meet_gps;
static struct { uint32_t map; int n, made, said, hub, sel, picked; int64_t at;
                uint32_t m[MEET_MAX], lbl[MEET_MAX], item[MEET_MAX]; int w[MEET_MAX], cars[MEET_MAX];
                uint8_t on[MEET_MAX], star[MEET_MAX], len[MEET_MAX]; float x[MEET_MAX], y[MEET_MAX]; } g_meet;
static struct { float x[MEET_PTS], y[MEET_PTS], z[MEET_PTS]; int16_t cx[MEET_PTS], cy[MEET_PTS], next[MEET_PTS], cnt[MEET_PTS];
                uint8_t used[MEET_PTS]; int16_t head[MEET_NB]; } g_mpt;
static struct { uint32_t id; float x, y; int64_t since; } g_stay[NSLOT + 1];
static int meet_shown(const Slot *q, uint32_t w){
    return q->st == SL_ACTIVE && !q->hidden && q->world == w && ok(q->car, 0x9e0) && MR8(q->car + CAR_ACTIVE);
}

/* ---- car meets on the world map ------------------------------------------------------------------- */
/* Players park together at car meets (the airport where new careers start,
 * car parks, the highway's loop), and others ask where one is.  The world
 * map marks a spot where MEET_MIN players or more are parked (meet_parked:
 * each has stayed at one spot for a minute, and goes slower than
 * MEET_SLOW_MPS) within MEET_R of it: a cover shoot's star in MEET_RGB with
 * "Meet: <n> cars" beside it, the legend's Car meets row (WMF_MEETS) hiding
 * them.  Every MEET_EVERY_US while the map is open, from what it knows: the
 * player's car, the friends' cars and the hub's other players (where their
 * markers are, wm_where; parked as the hub says, RC_MAPD_PARKED).  The densest
 * parked player first: the meet's spot is the middle of those within
 * MEET_R of it, its cars those within MEET_R of that spot, and they count
 * for no other meet; a meet found again keeps its marker (the nearest within
 * MEET_R of where one was).  A meet's marker is a car marker of ours (WM_CAR:
 * the map's filter leaves it alone; a kind of place's icon would go with
 * that kind's row).
 *
 * The GPS takes the player there.  The map's items (WorldMap +0xC: the
 * places the keys pick, each with its marker and its GPS target, made with
 * the map by 0x4E0440 from the career's places) get one for each meet, its
 * target a stand-in for a place's trigger (meet_trigger: where, as 0x529480
 * reads it).  Left and Right pick among the items of the picked legend row's
 * kind (0x4B0850), which the game's filter refuses for our rows' kinds, so
 * the Car meets row picks the nearest meet as it is picked, and the next one
 * each time Left or Right has picked nothing (meet_select); C asks to start
 * the GPS to the picked item (0x4B10C0, 0x529480) as for any place.  The
 * game stops the GPS when the player engages a place's event (0x541120); at a
 * meet nothing would, so meet_gps stops it within MEET_ARRIVE_M of the spot.
 * Not in the Windows plugin (as the lobbies). */
#define MEET_MIN        24            /* players standing near one spot: a meet (fewer: a busy spot) */
#define MEET_R          50.f          /* ...within this of it (m) */
#define MEET_SLOW_MPS   4.f           /* (14 km/h) standing, for a meet */
#define MEET_EVERY_US   1000000       /* the meets found again this often while the map is open */
#define MEET_ARRIVE_M   40.f          /* the GPS to a meet stops this near its spot */
#define MEET_PTS        (NSLOT + 1 + RC_MAP_MAX)
#define MEET_NB         1024          /* the grid's buckets (squares of MEET_R) */
#define MEET_ICON       "SHOWCASEINDICATOR_"   /* a cover shoot's star (the map's icons, 0x7F4348: <name><n>) */
#define WM_ITEMS        0xcu          /* WorldMap: the places the keys pick (+0 first, +4 last; 0x24 bytes: +8 the marker, +0xC its GPS target, 6 words) */
#define WM_ITEM_SZ      0x24u
#define WM_SEL          0x14u         /* WorldMap: the picked item (0x4B0850, 0x4B07F0) */
#define WM_CURSOR       0x24u         /* WorldMap: the cursor over it */
#define WMS_PICKED      0x5cu         /* the map's screen: its legend's picked row */
#define FN_FE_PLACE     0x0051d4d0u   /* cdecl (object, x, y): to there (the cursor, 0x4B07F0) */
#define FN_FE_SCRIPT    0x0051cf70u   /* cdecl (object, script's name, 1): plays it */
#define G_WM_CURSOR_SCR 0x0078f6bcu   /* the cursor's script's name (0x4B07F0) */
#define G_GPS           0x00838590u   /* the GPS: +0 its target's key, +0x10 where (x y z), +0x28, +0x29 on (0x529480, 0x541120) */
#define G_ROUTE         0x0081cbc0u   /* the road route the GPS shows */
#define FN_ROUTE_CLEAR  0x004131f0u   /* thiscall route () */
#define MT_SZ           0x40u         /* a place's trigger as the map and the GPS read it: +4 +8 its middle (x y), +0x20 its box
                                         (x0 y0 x1 y1, 0x4B0670), +0x34 where the GPS goes (x y z, whole metres, 0x529480:
                                         the career's a point of the road by the place) */
static uint32_t g_meet_t[MEET_MAX];   /* the meets' stand-in triggers (made once and kept: the GPS reads one as it starts) */
static struct { int on; float x, y; } g_meet_gps;   /* the GPS goes to a meet's spot */
static struct { uint32_t map; int n, made, said, hub, sel, picked; int64_t at;
                uint32_t m[MEET_MAX], lbl[MEET_MAX], item[MEET_MAX]; int w[MEET_MAX], cars[MEET_MAX];
                uint8_t on[MEET_MAX], star[MEET_MAX], len[MEET_MAX]; float x[MEET_MAX], y[MEET_MAX]; } g_meet;
static struct { float x[MEET_PTS], y[MEET_PTS], z[MEET_PTS]; int16_t cx[MEET_PTS], cy[MEET_PTS], next[MEET_PTS], cnt[MEET_PTS];
                uint8_t used[MEET_PTS]; int16_t head[MEET_NB]; } g_mpt;
static int meet_cell(float v){ return (int)__builtin_floorf(v / MEET_R); }
static unsigned meet_bucket(int cx, int cy){ return ((unsigned)cx * 73856093u ^ (unsigned)cy * 19349663u) & (MEET_NB - 1u); }
/* the points not counted yet within MEET_R of x, y: how many, their middle (mx, my); each counted now for meet take
 * (from 1) */
static int meet_near(float x, float y, float *mx, float *my, int take){
    int k = 0, cx = meet_cell(x), cy = meet_cell(y); float ax = 0.f, ay = 0.f;
    for (int dx = -1; dx <= 1; dx++) for (int dy = -1; dy <= 1; dy++)
        for (int i = g_mpt.head[meet_bucket(cx + dx, cy + dy)]; i >= 0; i = g_mpt.next[i]){
            if (g_mpt.used[i] || g_mpt.cx[i] != cx + dx || g_mpt.cy[i] != cy + dy) continue;   /* (another square in the bucket) */
            float ex = g_mpt.x[i] - x, ey = g_mpt.y[i] - y;
            if (ex * ex + ey * ey > MEET_R * MEET_R) continue;
            if (take) g_mpt.used[i] = (uint8_t)take;
            ax += g_mpt.x[i]; ay += g_mpt.y[i]; k++;
        }
    if (mx && k){ *mx = ax / (float)k; *my = ay / (float)k; }
    return k;
}
/* a player standing at x, y, z (NaN: not known, a hub's answer without RC_HF_MAPZ) */
static void meet_add(int *n, float x, float y, float z, float vx, float vy){
    if (*n >= MEET_PTS || vx * vx + vy * vy >= MEET_SLOW_MPS * MEET_SLOW_MPS || !(x == x) || !(y == y)) return;
    int i = (*n)++;
    g_mpt.x[i] = x; g_mpt.y[i] = y; g_mpt.z[i] = z; g_mpt.cx[i] = (int16_t)meet_cell(x); g_mpt.cy[i] = (int16_t)meet_cell(y);
}
/* Parked: a car that has stayed within MEET_STAY_M of one spot for MEET_PARKED_US (as the hub's PARKED_MS tells of its
 * players, RC_MAPD_PARKED): only those count for a meet, so players passing a busy spot, or just come there, do not;
 * nor a car at the new career's start (MEET_SPAWN_M), where every new player appears.  The player's car and the
 * friends' cars are watched here, every frame in the world (meet_stay, by slot; NSLOT the player's). */
#define MEET_STAY_M     25.f
#define MEET_PARKED_US  60000000
#define MEET_SPAWN_M    5.f
static struct { uint32_t id; float x, y; int64_t since; } g_stay[NSLOT + 1];
static void meet_stay(uint32_t w, int64_t host){
    for (int k = 0; k <= NSLOT; k++){
        const Slot *q = k < NSLOT ? &g_sl[k] : 0;
        uint32_t car = q ? (meet_shown(q, w) ? q->car : 0) : player_car(), id = q ? q->peer_id | 1u : 1u;
        if (!ok(car, 0x70)){ g_stay[k].id = 0; continue; }
        float x = MRF32(car + 0x60u), y = MRF32(car + 0x64u), dx = x - g_stay[k].x, dy = y - g_stay[k].y;
        if (g_stay[k].id != id || dx * dx + dy * dy > MEET_STAY_M * MEET_STAY_M){ g_stay[k].id = id; g_stay[k].x = x; g_stay[k].y = y; g_stay[k].since = host; }
    }
}
static int meet_parked(int k, int64_t host){ return g_stay[k].id && host - g_stay[k].since >= MEET_PARKED_US; }
static int meet_spawn(float x, float y){ float dx = x - SPAWN_X, dy = y - SPAWN_Y; return dx * dx + dy * dy < MEET_SPAWN_M * MEET_SPAWN_M; }
/* the meets now, out[] (x, y, z, cars; z its cars' middle, where the GPS looks for the road: else the player's): how
 * many */
static int meet_find(uint32_t w, int64_t host, float (*out)[4]){
    int n = 0;
    uint32_t me = player_car();
    float nz = __builtin_nanf(""), mz = ok(me, 0x80) ? MRF32(me + 0x68u) : 0.f;
    if (ok(me, 0x80) && meet_parked(NSLOT, host) && !meet_spawn(MRF32(me + 0x60u), MRF32(me + 0x64u)))
        meet_add(&n, MRF32(me + 0x60u), MRF32(me + 0x64u), mz, MRF32(me + 0x70u), MRF32(me + 0x74u));
    for (int k = 0; k < NSLOT; k++){
        const Slot *q = &g_sl[k];
        if (wm_shown(q, w) && meet_parked(k, host) && !meet_spawn(MRF32(q->car + 0x60u), MRF32(q->car + 0x64u)))
            meet_add(&n, MRF32(q->car + 0x60u), MRF32(q->car + 0x64u), MRF32(q->car + 0x68u), q->drawn_v[0], q->drawn_v[1]);
    }
    for (int i = 0; i < g_wm_n; i++){
        if (!g_wm_e[i].parked) continue;
        double dt = (double)(host - g_wm_e[i].at_us) / 1000000.0;
        if (dt < 0.0 || dt > 2.0) dt = 0.0;
        float x = (float)g_wm_e[i].x + (float)g_wm_e[i].vx * (float)dt;
        float y = (float)g_wm_e[i].y + (float)g_wm_e[i].vy * (float)dt;
        if (!meet_spawn(x, y)) meet_add(&n, x, y, g_wm_e[i].z != RC_MAP_NO_Z ? (float)g_wm_e[i].z : nz, (float)g_wm_e[i].vx, (float)g_wm_e[i].vy);
    }
    for (int b = 0; b < MEET_NB; b++) g_mpt.head[b] = -1;
    for (int i = 0; i < n; i++){
        unsigned b = meet_bucket(g_mpt.cx[i], g_mpt.cy[i]);
        g_mpt.next[i] = g_mpt.head[b]; g_mpt.head[b] = (int16_t)i; g_mpt.used[i] = 0;
    }
    for (int i = 0; i < n; i++){ int k = meet_near(g_mpt.x[i], g_mpt.y[i], 0, 0, 0); g_mpt.cnt[i] = (int16_t)(k < 32767 ? k : 32767); }
    int nm = 0;
    while (nm < MEET_MAX){
        int best = -1;
        for (int i = 0; i < n; i++) if (!g_mpt.used[i] && g_mpt.cnt[i] >= MEET_MIN && (best < 0 || g_mpt.cnt[i] > g_mpt.cnt[best])) best = i;
        if (best < 0) break;
        float mx = g_mpt.x[best], my = g_mpt.y[best];
        meet_near(mx, my, &mx, &my, 0);
        if (meet_near(mx, my, 0, 0, 0) < MEET_MIN){ g_mpt.cnt[best] = 0; continue; }   /* (fewer round its middle: the next) */
        float cx = mx, cy = my, az = 0.f;
        int k = meet_near(mx, my, &cx, &cy, nm + 1), kz = 0;
        for (int i = 0; i < n; i++) if (g_mpt.used[i] == nm + 1 && g_mpt.z[i] == g_mpt.z[i]){ az += g_mpt.z[i]; kz++; }
        out[nm][0] = cx; out[nm][1] = cy; out[nm][2] = kz ? az / (float)kz : mz; out[nm][3] = (float)k; nm++;
    }
    return nm;
}
/* the star a meet shows: the package's object, 0 for none */
static uint32_t meet_icon(CPU *c, uint32_t pkg){
    char nm[32]; uint32_t o = 0;
    for (int i = 0; i < 3 && !o; i++){ snprintf(nm, sizeof nm, "%s%d", MEET_ICON, i); o = wm_find(c, pkg, nm); }
    return o;
}
/* meet k's trigger to its spot (its GPS target: whole metres, as the game's) */
static void meet_trigger(int k, float x, float y, float z){
    uint32_t t = g_meet_t[k];
    if (!t) return;
    MRF32(t + 4u) = x; MRF32(t + 8u) = y;
    MRF32(t + 0x20u) = x - 1.f; MRF32(t + 0x24u) = y - 1.f; MRF32(t + 0x28u) = x + 1.f; MRF32(t + 0x2cu) = y + 1.f;
    MR32(t + 0x34u) = (uint32_t)(int32_t)(x < 0.f ? x - 0.5f : x + 0.5f);
    MR32(t + 0x38u) = (uint32_t)(int32_t)(y < 0.f ? y - 0.5f : y + 0.5f);
    MR32(t + 0x3cu) = (uint32_t)(int32_t)(z < 0.f ? z - 0.5f : z + 0.5f);}
/* the next meet's marker, label and item (with room for them): 0 when not made */
static int meet_make(CPU *c, uint32_t map, uint32_t pkg, uint32_t pk){
    int k = g_meet.made;
    if (k >= MEET_MAX || wm_room(pk) < 2) return 0;
    uint32_t icon = meet_icon(c, pkg), obj = 0;
    int star = 0;
    char nm[24]; snprintf(nm, sizeof nm, "ROAM_MEET_%d", k);
    if (icon && (obj = fe_clone(c, pkg, icon, nm)) && (star = 1)) fe_colour_to(c, obj, (const int32_t[3]){ MEET_RGB & 0xff, MEET_RGB >> 8 & 0xff, MEET_RGB >> 16 & 0xff });
    else {
        /* no star: a copy of a car's arrow that draws nothing (FEng draws no object without alpha), to place the label by */
        uint32_t o0 = wm_find(c, pkg, "AIRACERINDICATOR_0");
        if (!o0 || !(obj = fe_clone(c, pkg, o0, nm))) return 0;
        fe_colour_set(c, obj, 0, 0, 0, 0);
    }
    uint32_t sz = WM_ICON_SZ, m = rh_call(c, FN_MALLOC, 0, 0, 1, &sz);
    if (!ok(m, WM_ICON_SZ)) return 0;
    for (uint32_t i = 0; i < WM_ICON_SZ; i += 4) MR32(m + i) = 0;
    MR32(m + 8u) = WM_CAR; MR32(m + 0xcu) = obj; MRF32(m + 0x10u) = WMF_AWAY; MRF32(m + 0x14u) = WMF_AWAY;
    uint32_t head = map + 4u, tail = rd32(head + 4u);
    MR32(tail) = m; MR32(head + 4u) = m; MR32(m + 4u) = tail; MR32(m) = head;
    /* (a legend with no room for the Car meets row: they go with Players) */
    g_meet.m[k] = m; g_meet.w[k] = wmf_track(map, m, g_wmf.row[WMF_MEETS] ? WMF_MEETS : WMF_PLAYERS);
    g_meet.star[k] = (uint8_t)star; g_meet.lbl[k] = 0; g_meet.item[k] = 0; g_meet.cars[k] = -1;
    uint32_t base = wm_find(c, pkg, WM_TEXT_BASE);
    snprintf(nm, sizeof nm, "ROAM_MEETTXT_%d", k);
    uint32_t lbl = base ? fe_clone(c, pkg, base, nm) : 0;
    if (lbl){
        fe_colour_set(c, lbl, MEET_RGB & 0xff, MEET_RGB >> 8 & 0xff, MEET_RGB >> 16 & 0xff, 0xff);
        gcall1(c, FN_FE_HIDE, 0, lbl);
        g_meet.lbl[k] = lbl;
        uint32_t d0 = rd32(base + 0x2cu);
        if (ok(d0, 0x40) && MRF32(d0 + 0x38u) > 0.f && MRF32(d0 + 0x38u) < 4.f) g_wml_s0 = MRF32(d0 + 0x38u);
    }
    /* its item for the keys and the GPS, after the career's (the map frees it with them, 0x4E0850); its trigger kept */
    if (!g_meet_t[k]){
        uint32_t tsz = MT_SZ, t = rh_call(c, FN_MALLOC, 0, 0, 1, &tsz);
        if (ok(t, MT_SZ)){ for (uint32_t i = 0; i < MT_SZ; i += 4) MR32(t + i) = 0; g_meet_t[k] = t; }
    }
    uint32_t isz = WM_ITEM_SZ, it = g_meet_t[k] ? rh_call(c, FN_MALLOC, 0, 0, 1, &isz) : 0;
    if (ok(it, WM_ITEM_SZ)){
        for (uint32_t i = 0; i < WM_ITEM_SZ; i += 4) MR32(it + i) = 0;
        MR32(it + 8u) = m; MR32(it + 0xcu) = g_meet_t[k];
        uint32_t ih = map + WM_ITEMS, il = rd32(ih + 4u);
        MR32(il) = it; MR32(ih + 4u) = it; MR32(it + 4u) = il; MR32(it) = ih;
        g_meet.item[k] = it;
    }
    g_meet.made++;
    return 1;
}
/* while the map is open: the meets found again each MEET_EVERY_US, their markers moved there (the rest off the map),
 * their labels' counts and their triggers; 1 when the map is to be placed again */
static int meet_update(CPU *c, uint32_t map, uint32_t pkg, uint32_t pk, uint32_t w, int64_t host){
    if (g_meet.map != map){
        memset(&g_meet, 0, sizeof g_meet); g_meet.map = map; g_meet.sel = -1;
        g_meet.at = host - MEET_EVERY_US + 500000;                    /* (the first: once the hub has answered, or half a second on) */
    }
    if (host - g_meet.at < MEET_EVERY_US && !(g_wm.got && !g_meet.hub)) return 0;
    g_meet.at = host; g_meet.hub |= g_wm.got != 0;
    float f[MEET_MAX][4];
    int nf = meet_find(w, host, f), was = g_meet.n, slot[MEET_MAX];
    uint8_t keep[MEET_MAX] = { 0 };
    for (int i = 0; i < nf; i++) slot[i] = -1;
    /* a meet found again keeps its marker (and the item picked): the nearest within MEET_R of where one was */
    for (int k = 0; k < g_meet.made; k++){
        if (!g_meet.on[k]) continue;
        int best = -1; float bd = MEET_R * MEET_R;
        for (int i = 0; i < nf; i++){
            if (slot[i] >= 0) continue;
            float dx = f[i][0] - g_meet.x[k], dy = f[i][1] - g_meet.y[k];
            if (dx * dx + dy * dy < bd){ bd = dx * dx + dy * dy; best = i; }
        }
        if (best >= 0){ slot[best] = k; keep[k] = 1; }
    }
    for (int i = 0; i < nf; i++){
        if (slot[i] >= 0) continue;
        int k = 0;
        while (k < g_meet.made && keep[k]) k++;
        if (k == g_meet.made && !meet_make(c, map, pkg, pk)) continue;
        slot[i] = k; keep[k] = 1;
    }
    g_meet.n = 0;
    for (int i = 0; i < nf; i++){
        int k = slot[i], cars = (int)f[i][3];
        if (k < 0) continue;
        wmf_move(g_meet.m[k], g_meet.w[k], f[i][0], f[i][1], 0);
        g_meet.x[k] = f[i][0]; g_meet.y[k] = f[i][1];
        meet_trigger(k, f[i][0], f[i][1], f[i][2]);
        if (cars != g_meet.cars[k] && g_meet.lbl[k]){
            char t[40]; snprintf(t, sizeof t, "Meet: %d cars", cars);
            uint32_t txt = g_gmem + TAG_SCR + 0x48u;
            gstr(txt, t, sizeof t);
            gcall1(c, FN_FE_SETSTR, g_meet.lbl[k], txt);
            MR32(g_meet.lbl[k] + 0x1cu) |= 2u;
            g_meet.len[k] = (uint8_t)strlen(t);
        }
        g_meet.cars[k] = cars; g_meet.n++;
    }
    for (int k = 0; k < g_meet.made; k++){
        g_meet.on[k] = keep[k];
        if (!keep[k]){ wmf_move(g_meet.m[k], g_meet.w[k], WMF_AWAY, WMF_AWAY, 0); g_meet.cars[k] = -1; }
    }
    if (!g_meet.said || g_meet.n != was){
        char t[200]; int at = 0;
        t[0] = 0;
        for (int k = 0; k < g_meet.made && at < (int)sizeof t - 40; k++) if (g_meet.on[k])
            at += snprintf(t + at, sizeof t - (size_t)at, "%s%d cars at %.0f %.0f", at ? ", " : ": ", g_meet.cars[k], (double)g_meet.x[k], (double)g_meet.y[k]);
        rlog("[roam] f=%ld world map: %d car meet(s)%s (%d players known, %s)\n", rh_frame(), g_meet.n, t, g_wm_n + 1,
             g_wmf_on[g_wmf.row[WMF_MEETS] ? WMF_MEETS : WMF_PLAYERS] ? "shown" : "hidden");
    }
    g_meet.said = 1;
    return g_meet.made > 0;
}
/* the cursor (the map's, as 0x4B07F0 puts it on a place) on meet k: shown and moved there; its script played (start) */
static void meet_cursor(CPU *c, uint32_t map, int k, int start){
    uint32_t cur = rd32(map + WM_CURSOR), m = g_meet.m[k];
    if (!ok(cur, 0x20) || !ok(m, WM_ICON_SZ)) return;
    if (start) gcall1(c, FN_FE_SHOW, 0, cur);
    uint32_t a[3] = { cur, MR32(m + 0x1cu), MR32(m + 0x20u) };
    rh_call(c, FN_FE_PLACE, 0, 0, 3, a);
    if (start){ uint32_t s[3] = { cur, G_WM_CURSOR_SCR, 1 }; rh_call(c, FN_FE_SCRIPT, 0, 0, 3, s); }
}
/* every frame the map is open, after its placing: the Car meets row picked, the nearest meet is picked as it is, the
 * next whenever Left or Right has picked nothing (0x4B0850 finds no item of our rows' kinds), and the cursor stays on
 * the meet picked as it moves; another row picked, a meet's item no longer (our other rows pick nothing, 0x4B0E70) */
static void meet_select(CPU *c, uint32_t scr, uint32_t map){
    if (g_meet.map != map) return;
    uint32_t row = g_wmf.row[WMF_MEETS], sel = rd32(map + WM_SEL);
    int on_row = row && rd32(scr + WMS_PICKED) == row && g_wmf_on[WMF_MEETS], ours = -1;
    for (int k = 0; k < g_meet.made; k++) if (sel && sel == g_meet.item[k]) ours = k;
    if (!on_row){
        if (ours >= 0){ MR32(map + WM_SEL) = 0; uint32_t cur = rd32(map + WM_CURSOR); if (ok(cur, 0x20)) gcall1(c, FN_FE_HIDE, 0, cur); }
        g_meet.picked = 0;
        return;
    }
    int entered = !g_meet.picked;
    g_meet.picked = 1;
    if (!entered && ours >= 0 && g_meet.on[ours]){ meet_cursor(c, map, ours, 0); return; }
    if (!entered && sel && ours < 0) return;                         /* (a place picked otherwise: left as it is) */
    /* the meets by their distance from the player's car */
    int ord[MEET_MAX], n = 0; float d[MEET_MAX];
    uint32_t me = player_car();
    float px = ok(me, 0x70) ? MRF32(me + 0x60u) : 0.f, py = ok(me, 0x70) ? MRF32(me + 0x64u) : 0.f;
    for (int k = 0; k < g_meet.made; k++){
        if (!g_meet.on[k] || !g_meet.item[k]) continue;
        float dx = g_meet.x[k] - px, dy = g_meet.y[k] - py, dk = dx * dx + dy * dy;
        int j = n++;
        for (; j > 0 && d[j - 1] > dk; j--){ ord[j] = ord[j - 1]; d[j] = d[j - 1]; }
        ord[j] = k; d[j] = dk;
    }
    if (!n){                                                         /* (no meet: none picked) */
        if (entered && sel){ MR32(map + WM_SEL) = 0; uint32_t cur = rd32(map + WM_CURSOR); if (ok(cur, 0x20)) gcall1(c, FN_FE_HIDE, 0, cur); }
        g_meet.sel = -1; return;
    }
    int pick = 0;
    if (!entered) for (int j = 0; j < n; j++) if (ord[j] == g_meet.sel){ pick = (j + 1) % n; break; }
    int k = ord[pick];
    MR32(map + WM_SEL) = g_meet.item[k];
    meet_cursor(c, map, k, 1);
    g_meet.sel = k;
}
/* every frame in the world: the GPS to a meet noted as it starts (on, the target's key 0, at one of the meets'
 * triggers), and stopped within MEET_ARRIVE_M of the spot as 0x541120 stops it at an event (the route, then the
 * GPS's own fields) */
static void meet_gps(CPU *c){
    if (!MR8(G_GPS + 0x29u)){ g_meet_gps.on = 0; return; }
    float gx = MRF32(G_GPS + 0x10u), gy = MRF32(G_GPS + 0x14u);
    if (!g_meet_gps.on || gx != g_meet_gps.x || gy != g_meet_gps.y){
        g_meet_gps.on = 0;
        if (MR32(G_GPS)) return;
        for (int k = 0; k < MEET_MAX && !g_meet_gps.on; k++){
            uint32_t t = g_meet_t[k];
            if (!t) continue;
            float tx = (float)(int32_t)MR32(t + 0x34u), ty = (float)(int32_t)MR32(t + 0x38u);
            if ((tx - gx) * (tx - gx) + (ty - gy) * (ty - gy) < MEET_R * MEET_R){
                g_meet_gps.on = 1; g_meet_gps.x = gx; g_meet_gps.y = gy;
                rlog("[roam] f=%ld GPS: to the car meet at %.0f %.0f\n", rh_frame(), (double)gx, (double)gy);
            }
        }
        if (!g_meet_gps.on) return;
    }
    uint32_t me = player_car();
    if (!ok(me, 0x70)) return;
    float dx = MRF32(me + 0x60u) - gx, dy = MRF32(me + 0x64u) - gy;
    if (dx * dx + dy * dy > MEET_ARRIVE_M * MEET_ARRIVE_M) return;
    gcall0(c, FN_ROUTE_CLEAR, G_ROUTE);
    MR8(G_GPS + 0x29u) = 0; MR32(G_GPS + 0x10u) = 0; MR32(G_GPS + 0x14u) = 0; MR8(G_GPS + 0x28u) = 0; MR32(G_GPS) = 0;
    g_meet_gps.on = 0;
    rlog("[roam] f=%ld GPS: at the car meet (%.0f %.0f), stopped\n", rh_frame(), (double)gx, (double)gy);
}

/* Labels follow the marker's screen-space position; stack nearby labels to keep names readable. */
static void meet_map_labels(CPU *c, uint32_t map){
    if (g_meet.map != map) return;
    float px[MEET_MAX], py[MEET_MAX]; int placed = 0;
    for (int k = 0; k < g_meet.made; k++){
        uint32_t marker = g_meet.m[k], label = g_meet.lbl[k];
        uint32_t icon = ok(marker, WM_ICON_SZ) ? rd32(marker + 0xcu) : 0;
        if (!label) continue;
        if (!g_meet.on[k] || !ok(icon, 0x20) || (MR32(icon + 0x1cu) & 1u)){ gcall1(c, FN_FE_HIDE, 0, label); continue; }
        float x = MRF32(marker + 0x1cu) + 10.f, y = MRF32(marker + 0x20u);
        for (int again = 1, z = 0; again && z < MEET_MAX; z++){
            again = 0;
            for (int j = 0; j < placed; j++) if (__builtin_fabsf(px[j] - x) < 70.f && __builtin_fabsf(py[j] - y) < 13.f){
                y = py[j] + 13.f; again = 1;
            }
        }
        px[placed] = x; py[placed] = y; placed++;
        uint32_t ap[2] = { gvec(g_gmem + TAG_SCR + 0x20u, x, y, 7.f), 0 };
        rh_call(c, FN_FE_POS, label, 0, 2, ap);
        gcall1(c, FN_FE_SHOW, 0, label);
    }
}
