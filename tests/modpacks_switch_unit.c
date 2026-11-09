#include <assert.h>
#include "modpacks_config.h"

int main(void){
    assert(!modpacks_switch_enabled(0));
    assert(!modpacks_switch_enabled(""));
    assert(!modpacks_switch_enabled("0"));
    assert(!modpacks_switch_enabled("off"));
    assert(!modpacks_switch_enabled("OFF"));
    assert(!modpacks_switch_enabled("no"));
    assert(!modpacks_switch_enabled("false"));
    assert(modpacks_switch_enabled("1"));
    assert(modpacks_switch_enabled("on"));
    assert(modpacks_switch_enabled("yes"));
    assert(modpacks_switch_enabled("true"));
    return 0;
}
