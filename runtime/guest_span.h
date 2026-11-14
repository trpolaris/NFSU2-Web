/* guest_span.h -- bounds checks for guest addresses in wasm.
 *
 * This build currently uses one guest allocation span, [0, GUEST_END).
 * A second guest-heap window above the runtime was planned for 2 GB memories,
 * but is not enabled: heap.c's VA manager and runtime/web/sbrk.c do not yet
 * reserve that second span together. mem.c therefore exports zero bounds,
 * and guest_span() accepts only addresses in the original guest span. */
#ifndef NFSU2_GUEST_SPAN_H
#define NFSU2_GUEST_SPAN_H
#include <stdint.h>

#ifdef __wasm__
extern uint32_t g_gwin_lo, g_gwin_hi;  /* the window, [lo, hi), or 0, 0 (mem.c) */
/* [a, a + n) inside the guest's memory: [lo, 0x28000000) (cpu.h GUEST_END) or the window */
static inline int guest_span(uint32_t lo, uint32_t a, uint32_t n){
    uint64_t e = (uint64_t)a + n;
    if (a >= lo && e <= 0x28000000u) return 1;
    return g_gwin_hi && a >= g_gwin_lo && e <= g_gwin_hi;
}
#endif
#endif
