#ifndef NFSU2_PHOTO_ROLL_H
#define NFSU2_PHOTO_ROLL_H

#include <math.h>

/* A camera roll has no stop. Keep it in one equivalent revolution so it
 * never grows without bound; crossing +180/-180 is the same orientation. */
#define PHOTO_ROLL_HALF 180.0f
#define PHOTO_ROLL_FULL 360.0f

static inline float photo_wrap_roll(float value) {
    value = fmodf(value + PHOTO_ROLL_HALF, PHOTO_ROLL_FULL);
    if (value < 0.0f) value += PHOTO_ROLL_FULL;
    return value - PHOTO_ROLL_HALF;
}

#endif
