#ifndef TESTS_STUBS_MACH_TIME_H
#define TESTS_STUBS_MACH_TIME_H
#include <stdint.h>
typedef struct { uint32_t numer, denom; } mach_timebase_info_data_t;
typedef mach_timebase_info_data_t *mach_timebase_info_t;
int mach_timebase_info(mach_timebase_info_data_t *info);
uint64_t mach_absolute_time(void);
#endif
