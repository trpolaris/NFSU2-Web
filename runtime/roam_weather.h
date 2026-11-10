/* Pure Free Roam weather-sync gate: keep the UTC rain phase out of races,
 * non-city tracks, front-end screens and the Dyno/LAN mode. */
#ifndef NFSU2_ROAM_WEATHER_H
#define NFSU2_ROAM_WEATHER_H
#include <stdint.h>
static inline int roam_weather_should_share(int roam_enabled, uint32_t game_flow,
                                            uint32_t track, uint32_t career_race,
                                            uint32_t game_mode) {
    return roam_enabled && game_flow == 6u && track % 1000u == 0u &&
           !career_race && !(game_mode & 0x200u);
}
#endif
