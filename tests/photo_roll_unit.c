#include "photo_roll.h"
#include <math.h>
#include <stdio.h>

static int failures;

static void expect_near(const char *name, float got, float want) {
    if (fabsf(got - want) > 0.001f) {
        fprintf(stderr, "FAIL %-24s got %.4f, expected %.4f\n", name, got, want);
        failures++;
    }
}

int main(void) {
    expect_near("zero", photo_wrap_roll(0.0f), 0.0f);
    expect_near("positive tilt", photo_wrap_roll(45.0f), 45.0f);
    expect_near("negative tilt", photo_wrap_roll(-45.0f), -45.0f);
    expect_near("positive half turn", photo_wrap_roll(180.0f), -180.0f);
    expect_near("negative half turn", photo_wrap_roll(-180.0f), -180.0f);
    expect_near("full turn", photo_wrap_roll(360.0f), 0.0f);
    expect_near("one and a quarter", photo_wrap_roll(450.0f), 90.0f);
    expect_near("negative one and a quarter", photo_wrap_roll(-450.0f), -90.0f);
    expect_near("multiple turns", photo_wrap_roll(1260.0f), -180.0f);
    expect_near("negative multiple turns", photo_wrap_roll(-1260.0f), -180.0f);

    for (int angle = -7200; angle <= 7200; angle += 37) {
        float wrapped = photo_wrap_roll((float)angle);
        if (!(wrapped >= -180.0f && wrapped < 180.0f)) {
            fprintf(stderr, "FAIL range at %d degrees: %.4f\n", angle, wrapped);
            failures++;
            break;
        }
        expect_near("periodicity", photo_wrap_roll((float)angle + 360.0f), wrapped);
    }

    if (failures) {
        fprintf(stderr, "Photo roll: %d failure(s)\n", failures);
        return 1;
    }
    puts("Photo roll: all checks passed");
    return 0;
}
