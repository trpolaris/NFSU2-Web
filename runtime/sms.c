/* sms.c -- a text message of ours on the game's own phone: the SMS of career
 * free roam (an envelope on the HUD, the message in the mailbox).  The page
 * asks for one (input event IEV_SMS: web/src/app/playtime.ts, after two hours
 * of play), or NFSU2_SMS=<id> does at the start (tests).  It goes into the
 * inbox once the player drives in career free roam, not before (the front
 * end, Online and LAN races have no phone), and the status "sms" then names
 * it, so the page asks no more.
 *
 * The inbox is the Career's (0x860A60): 256 messages of 20 bytes {entry,
 * flags +4..+7, body hash +8, %s hash +0xC, subject hash +0x10}, how many at
 * +0x1400.  An entry is one of the game's SMS table ([0x838454] x [0x838450],
 * 20 bytes: its name at [0x838428] + u16 +0, the kind of message, +4 = 1 "the
 * game opens it": its inbox update 0x529750 shows such a message by itself,
 * once the player is free in career free roam, 0x529700; +0x10 the sender's
 * name, by hash).  0x529670 (thiscall
 * inbox: entry, body, subject, %s) adds a message with texts other than its
 * entry's: the "unique parts" and magazine messages take one of several that
 * way (0x5338C0).  Ours has texts of our own (language.c) and a copy of
 * SMS_INSTRUCTION's entry (Rachel's first message: text only, nothing to do)
 * that the game opens and that is from us, not Rachel: the game lets an entry
 * in only while it is not in the inbox (0x514CB0, by address), and
 * SMS_INSTRUCTION always is.  A profile keeps a message by its entry's name
 * and its texts (0x514E80 loads them): ours comes back as SMS_INSTRUCTION's,
 * with our texts, which are in the language table by then, and gets our entry
 * back (opened already: the message's own flag +5 says so).  A message whose
 * body is ours is not added again (the profile has it from an earlier game). */
#include "cpu.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <time.h>

void dispatch_indirect(CPU *c, uint32_t addr);
uint32_t language_add_text(const char *name, const char *text);
uint32_t language_text(uint32_t hash);
void language_game_letters(const char *utf8, char *out, size_t n);
const char *language_name(void);
const char *autotest_top_fng(void);
int mprace_owns_input(void);

#define G_INBOX       0x00860a60u
#define IN_COUNT      0x1400u
#define G_SMS_TAB     0x00838454u   /* the game's SMS entries, 20 bytes each */
#define G_SMS_N       0x00838450u
#define G_POOL        0x00838428u   /* the career data's names */
#define FN_SMS_ADD    0x00529670u   /* thiscall inbox (entry, body, subject, %s) -> the message, 0: full */
#define FN_NEW        0x00575620u   /* cdecl (size): operator new */
#define G_FLOW        0x008654a4u   /* 6: in the world */
#define G_GAMEMODE    0x00850078u   /* 1: career */
#define G_CAREER_RACE 0x00863470u   /* the career race being run, 0: free roam */
#define G_ENGAGE      0x008900d8u   /* the engage manager: [it] 4 = free to engage (what 0x529750 waits for too) */
#define FREE_S        3             /* this long in free roam first */
#define FROM          "TRPOLARIS"
#define RETRY_S       60            /* a full inbox: again after this long */

/* Localized career-phone message. Keep the gameplay tip and route feedback to this project's repository. */
typedef struct { const char *lang, *subject, *body; } Text;
static const Text HELLO[] = {
    { "english", "Enjoying the game?",
      "Thanks for playing the TRPOLARIS edition. If you enjoy it, share it with friends! You can also start a crew in the F9 menu, which makes crew-mates easier to find in free roam.^^Feedback, bug reports and ideas: github.com/trpolaris/Need-for-Speed-Underground-2-WEB" },
    { "french", "Le jeu vous plaît ?",
      "J'espère que le jeu fonctionne bien. S'il vous plaît, partagez-le avec vos amis ! Vous pouvez aussi créer une équipe dans le menu F9 pour retrouver plus facilement ses membres en mode Exploration.^^Commentaires, bugs et idées : github.com/trpolaris/Need-for-Speed-Underground-2-WEB" },
    { "german", "Gefällt dir das Spiel?",
      "Ich hoffe, das Spiel läuft gut. Wenn es dir gefällt, teile es mit Freunden! Über das F9-Menü kannst du eine Crew gründen, damit du ihre Mitglieder im Freie-Fahrt-Modus leichter findest.^^Feedback, Fehlerberichte und Ideen: github.com/trpolaris/Need-for-Speed-Underground-2-WEB" },
    { "italian", "Ti piace il gioco?",
      "Spero che il gioco funzioni bene. Se ti piace, condividilo con i tuoi amici! Puoi anche creare una crew nel menu F9 per trovare più facilmente i membri durante l'esplorazione libera.^^Feedback, segnalazioni di bug e idee: github.com/trpolaris/Need-for-Speed-Underground-2-WEB" },
    { "spanish", "¿Te gusta el juego?",
      "Espero que el juego funcione bien. Si te gusta, compártelo con tus amigos. También puedes crear un equipo en el menú F9 para encontrar más fácilmente a sus miembros en circulación libre.^^Comentarios, errores e ideas: github.com/trpolaris/Need-for-Speed-Underground-2-WEB" },
    { "dutch", "Vind je het spel leuk?",
      "Ik hoop dat het spel goed werkt. Vind je het leuk, deel het dan met vrienden! Je kunt ook een crew beginnen in het F9-menu, zodat je crewleden makkelijker vindt tijdens vrij rondrijden.^^Feedback, foutmeldingen en ideeën: github.com/trpolaris/Need-for-Speed-Underground-2-WEB" },
    { "swedish", "Gillar du spelet?",
      "Jag hoppas att spelet fungerar bra. Dela det gärna med dina vänner! Du kan också starta ett crew i F9-menyn för att lättare hitta dina crewmedlemmar i fritt körande.^^Feedback, felrapporter och idéer: github.com/trpolaris/Need-for-Speed-Underground-2-WEB" },
    { "danish", "Kan du lide spillet?",
      "Jeg håber, spillet fungerer godt. Del det gerne med dine venner! Du kan også starte et crew i F9-menuen, så dine crew-medlemmer er lettere at finde i fri kørsel.^^Feedback, fejlrapporter og ideer: github.com/trpolaris/Need-for-Speed-Underground-2-WEB" },
    { "portuguese", "Curtindo o jogo?",
      "Espero que o jogo esteja funcionando bem. Se você gosta dele, compartilhe com seus amigos! Você também pode criar uma equipe no menu F9 para encontrar os membros mais facilmente no modo livre.^^Comentários, erros e ideias: github.com/trpolaris/Need-for-Speed-Underground-2-WEB" },
    { "polish", "Podoba ci się gra?",
      "Mam nadzieję, że gra działa dobrze. Jeśli ci się podoba, poleć ją znajomym! Możesz też założyć ekipę w menu F9, aby łatwiej znajdować jej członków podczas swobodnej jazdy.^^Opinie, błędy i pomysły: github.com/trpolaris/Need-for-Speed-Underground-2-WEB" },
    { "turkish", "Oyunu beğendin mi?",
      "Umarım oyun sende sorunsuz çalışıyordur. Beğendiysen arkadaşlarınla paylaş! F9 menüsünden bir ekip kurabilir, serbest sürüşte ekip arkadaşlarını daha kolay bulabilirsin.^^Geri bildirim, hata bildirimi ve fikirler: github.com/trpolaris/Need-for-Speed-Underground-2-WEB" },
};
#define MSG_N 1                     /* the messages, by id 1.. */
static const struct { const char *name; const Text *t; unsigned n; } MSGS[MSG_N] = {
    { "SMS_PORT_HELLO", HELLO, sizeof HELLO / sizeof HELLO[0] },
};

static int g_init;
static int g_ask;                   /* the message asked for (1..MSG_N), 0: none; set by the input thread */
static int g_sent;                  /* the message this game put in the inbox or found there */
static uint32_t g_subject[MSG_N], g_body[MSG_N], g_from;
static uint32_t g_entry;            /* our copy of SMS_INSTRUCTION's entry */
static double g_free_since = -1, g_next, g_scan;

/* the page asks (input_web.c, the input thread) */
void sms_request(int id){
    if (id < 1 || id > MSG_N) return;
    __atomic_store_n(&g_ask, id, __ATOMIC_RELAXED);
    fprintf(stderr, "[sms] message %d asked for\n", id);
}
/* the message the game has from us this game (status_web.c "sms"), 0: none */
int sms_delivered(void){ return __atomic_load_n(&g_sent, __ATOMIC_RELAXED); }

static double now_s(void){
    struct timespec ts; clock_gettime(CLOCK_MONOTONIC, &ts);
    return (double)ts.tv_sec + ts.tv_nsec * 1e-9;
}
/* a guest function with ecx and stack arguments, from the main-loop hook */
static uint32_t gcall(CPU *c, uint32_t fn, uint32_t ecx, int n, const uint32_t *arg){
    CPU save = *c;
    c->esp = (c->esp - 256u) & ~15u;
    for (int i = n - 1; i >= 0; i--) PUSH32(arg[i]);
    c->ecx = ecx;
    PUSH32(0x00581475u);                        /* the hook's return address: the callee's ret pops it */
    dispatch_indirect(c, fn);
    uint32_t r = c->eax;
    *c = save;
    return r;
}

/* our texts into the game's language table, in its language's letters */
static void init(void){
    g_init = 1;
    const char *l = language_name();
    for (int m = 0; m < MSG_N; m++){
        const Text *t = &MSGS[m].t[0];
        for (unsigned i = 0; i < MSGS[m].n; i++) if (!strcmp(MSGS[m].t[i].lang, l)) t = &MSGS[m].t[i];
        char name[64], s[1024];
        language_game_letters(t->subject, s, sizeof s);
        snprintf(name, sizeof name, "%s_SUBJECT", MSGS[m].name); g_subject[m] = language_add_text(name, s);
        language_game_letters(t->body, s, sizeof s);
        snprintf(name, sizeof name, "%s_BODY", MSGS[m].name); g_body[m] = language_add_text(name, s);
    }
    g_from = language_add_text("SMS_PORT_FROM", FROM);
    const char *e = getenv("NFSU2_SMS");
    if (e && *e) sms_request(atoi(e));
}

/* the player drives in career free roam, free to engage, the HUD on top */
static int free_roam(void){
    if (MR32(G_FLOW) != 6u || MR32(G_GAMEMODE) != 1u || MR32(G_CAREER_RACE) || mprace_owns_input()) return 0;
    uint32_t e = MR32(G_ENGAGE);
    if (!e || !mem_is_committed(e) || MR32(e) != 4u) return 0;
    const char *top = autotest_top_fng();
    return top && !strcasecmp(top, "HUD_SingleRace.fng");
}

/* SMS_INSTRUCTION's entry, copied, for the game to open, from us */
static uint32_t entry(CPU *c){
    if (g_entry) return g_entry;
    uint32_t tab = MR32(G_SMS_TAB), n = MR32(G_SMS_N), pool = MR32(G_POOL);
    if (!tab || !pool || n > 1024u || !mem_is_committed(tab) || !mem_is_committed(tab + 20u*n - 1u)) return 0;
    for (uint32_t i = 0; i < n; i++){
        uint32_t nm = pool + MR16(tab + 20u*i);
        if (!mem_is_committed(nm) || !mem_is_committed(nm + 15u) || memcmp(g_mem + nm, "SMS_INSTRUCTION", 16)) continue;
        uint32_t size = 20u, e = gcall(c, FN_NEW, 0, 1, &size);
        if (!e) return 0;
        memcpy(g_mem + e, g_mem + tab + 20u*i, 20);
        MR8(e + 4u) = 1;
        MR32(e + 0x10u) = g_from;
        return g_entry = e;
    }
    fprintf(stderr, "[sms] the game's SMS table has no SMS_INSTRUCTION: no message of ours\n");
    return 0;
}

/* our messages that a profile brought back (as SMS_INSTRUCTION's) get our entry again */
static void ours_back(CPU *c){
    uint32_t n = MR32(G_INBOX + IN_COUNT);
    for (uint32_t i = 0; i < n && i < 256u; i++){
        uint32_t m = G_INBOX + 20u*i, body = MR32(m + 8u);
        for (int k = 0; k < MSG_N; k++){
            if (body != g_body[k] || MR32(m) == g_entry) continue;
            uint32_t e = entry(c);
            if (!e) return;
            MR32(m) = e;
            fprintf(stderr, "[sms] message %d from the profile: ours again\n", k + 1);
        }
    }
}

void sms_frame(CPU *c){
    if (!g_init) init();
    double t = now_s();
    if (t >= g_scan){ g_scan = t + 1.0; ours_back(c); }
    int ask = __atomic_load_n(&g_ask, __ATOMIC_RELAXED);
    if (!ask || ask == g_sent) return;
    if (!free_roam()){ g_free_since = -1; return; }
    if (g_free_since < 0) g_free_since = t;
    if (t - g_free_since < FREE_S || t < g_next) return;
    int m = ask - 1;
    if (!language_text(g_body[m]) || !language_text(g_subject[m])) return;   /* the table again next frame */
    uint32_t n = MR32(G_INBOX + IN_COUNT);
    if (n > 256u) return;
    for (uint32_t i = 0; i < n; i++)
        if (MR32(G_INBOX + 20u*i + 8u) == g_body[m]){
            fprintf(stderr, "[sms] message %d is in the inbox already (an earlier game)\n", ask);
            __atomic_store_n(&g_sent, ask, __ATOMIC_RELAXED);
            return;
        }
    uint32_t e = entry(c);
    if (!e){ g_next = t + RETRY_S; return; }
    uint32_t a[4] = { e, g_body[m], g_subject[m], 0 };
    uint32_t msg = gcall(c, FN_SMS_ADD, G_INBOX, 4, a);
    if (!msg){
        fprintf(stderr, "[sms] message %d: the inbox is full (%u), again in %d s\n", ask, n, RETRY_S);
        g_next = t + RETRY_S;
        return;
    }
    fprintf(stderr, "[sms] message %d in the inbox (%u messages): the game shows it\n", ask, MR32(G_INBOX + IN_COUNT));
    __atomic_store_n(&g_sent, ask, __ATOMIC_RELAXED);
}
