#ifndef NFSU2_WEB_ENV_BOOL_H
#define NFSU2_WEB_ENV_BOOL_H

#include <stdlib.h>
#include <strings.h>

/* Keep browser-runtime environment parsing consistent with the settings UI
 * and native bundle parser. Unknown values preserve the caller's fallback. */
static inline int nfsu2_env_bool(const char *name, int fallback) {
    const char *value = name ? getenv(name) : NULL;
    if (!value || !*value) return fallback;

    if (!strcasecmp(value, "1") || !strcasecmp(value, "true") ||
        !strcasecmp(value, "yes") || !strcasecmp(value, "on") ||
        !strcasecmp(value, "enabled")) return 1;

    if (!strcasecmp(value, "0") || !strcasecmp(value, "false") ||
        !strcasecmp(value, "no") || !strcasecmp(value, "off") ||
        !strcasecmp(value, "disabled")) return 0;

    return fallback;
}

#endif
