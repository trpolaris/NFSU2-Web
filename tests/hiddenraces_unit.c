#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#define HIDDENRACES_UNIT
#include "../runtime/hiddenraces.c"

int main(void){
    uint8_t races[3 * 0x88] = {0};
    uint8_t stages[2 * 0x50];
    for (unsigned i = 0; i < sizeof stages; ++i) stages[i] = 0xff;
    races[0x7f] = 1;
    races[0x88 + 0x7f] = 1;
    stages[0x30] = 1;
    stages[0x31] = 4;
    stages[0x32] = 8;
    stages[0x33] = 0xff;
    stages[0x50 + 0x30] = 3;
    stages[0x41] = 1;
    stages[0x50 + 0x41] = 0xff;
    assert(hiddenraces_apply_tables(races, 3, stages, 2) == 5);
    assert(races[0x7f] == 0 && races[0x88 + 0x7f] == 0);
    assert(stages[0x30] == 8 && stages[0x31] == 8);
    assert(stages[0x32] == 8 && stages[0x33] == 0xff);
    assert(stages[0x50 + 0x30] == 8);
    assert(stages[0x41] == 1 && stages[0x50 + 0x41] == 0xff);
    assert(hiddenraces_apply_tables(races, 3, stages, 2) == 0);
    assert(hiddenraces_apply_tables(races, 1025, stages, 2) == 0);
    assert(hiddenraces_apply_tables(races, 3, stages, 17) == 0);
    assert(hiddenraces_apply_tables(NULL, 3, stages, 2) == 0);
    puts("hidden races unit tests: all passed");
    return 0;
}
