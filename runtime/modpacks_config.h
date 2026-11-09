#ifndef NFSU2_MODPACKS_CONFIG_H
#define NFSU2_MODPACKS_CONFIG_H

#include <strings.h>

/* Match the settings.ini boolean spellings used by the runtime. Empty and
 * explicit false values keep a community rim pack out of the shop. */
static inline int modpacks_switch_enabled(const char *value){
    return value && *value && *value != '0' &&
           strcasecmp(value, "off") && strcasecmp(value, "no") && strcasecmp(value, "false");
}

#endif
