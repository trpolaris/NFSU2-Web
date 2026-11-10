#include <assert.h>
#include <stdint.h>

int uniques_should_unlock(int setting, int original_result, uint32_t filter,
                          uint8_t part_level_byte, int caleb_beaten);

int main(void){
    const uint8_t unique_level = (uint8_t)(4u << 5);
    const uint8_t stage_three = (uint8_t)(3u << 5);

    assert(!uniques_should_unlock(0, 0, 4u, unique_level, 1)); /* default off */
    assert(!uniques_should_unlock(1, 1, 4u, unique_level, 1)); /* never override an original allow */
    assert(!uniques_should_unlock(1, 0, 0u, unique_level, 1)); /* not a stage unlock check */
    assert(!uniques_should_unlock(1, 0, 4u, stage_three, 1)); /* not a unique visual part */
    assert(!uniques_should_unlock(1, 0, 4u, unique_level, 0)); /* Caleb not beaten */
    assert(uniques_should_unlock(1, 0, 4u, unique_level, 1));
    assert(uniques_should_unlock(1, 0, 0x14u, unique_level, 1)); /* stage bit may accompany other filters */
    return 0;
}
