#include "roam_weather.h"
#include <stdio.h>
#define CHECK(condition, label) do { if (!(condition)) { fprintf(stderr, "FAIL: %s\n", label); return 1; } } while (0)
int main(void) {
    CHECK(!roam_weather_should_share(0, 6, 1000, 0, 0), "roam disabled");
    CHECK(!roam_weather_should_share(1, 3, 1000, 0, 0), "front end");
    CHECK(!roam_weather_should_share(1, 5, 1000, 0, 0), "not in world");
    CHECK(!roam_weather_should_share(1, 6, 4701, 0, 0), "non-city track");
    CHECK(!roam_weather_should_share(1, 6, 1000, 1, 0), "career race");
    CHECK(!roam_weather_should_share(1, 6, 1000, 0, 0x200), "Dyno/LAN mode");
    CHECK(roam_weather_should_share(1, 6, 1000, 0, 0), "city free roam");
    CHECK(roam_weather_should_share(1, 6, 2000, 0, 1), "other game-mode bits do not disable it");
    puts("roam_weather_unit: passed");
    return 0;
}
