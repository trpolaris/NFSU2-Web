/* The free-roam license plate renderer (runtime/plate_image.c).
 * Run by ./run.sh test after link.sh builds out/plates_unit.
 */
#include "plate_image.h"
#include <stdio.h>
#include <string.h>

static int pass, fail;
#define CHECK(ok, label) do { \
    if (ok) { pass++; printf("  PASS  %s\n", label); } \
    else { fail++; printf("  FAIL  %s\n", label); } \
} while (0)

int main(void) {
    uint8_t image[PLATE_BYTES], other[PLATE_BYTES], dxt[8], decoded[4 * 4 * 4];

    memset(image, 0xa5, sizeof image);
    CHECK(!plate_image("", 0, 0, image), "empty plate is rejected");
    CHECK(!plate_image("ABCDEFGHI", 9, 0, image), "more than eight characters is rejected");
    CHECK(!plate_image("abc123", 6, 0, image), "lowercase is rejected by the renderer");
    CHECK(!plate_image("AB-123", 6, 0, image), "punctuation is rejected by the renderer");
    CHECK(!plate_image(0, 6, 0, image), "null text is rejected");
    {
        int untouched = 1;
        for (size_t i = 0; i < sizeof image; i++) if (image[i] != 0xa5) { untouched = 0; break; }
        CHECK(untouched, "rejected text leaves the destination untouched");
    }

    CHECK(plate_image("ABC123", 6, 0, image), "valid plate renders without a stock texture");
    CHECK(plate_image("XYZ987", 6, 0, other), "a second valid plate renders");
    CHECK(memcmp(image, other, sizeof image) != 0, "different plate text produces different pixels");
    CHECK(image[0] == 66 && image[1] == 66 && image[2] == 66 && image[3] == 255,
          "fallback plate has a dark opaque outer rim");

    int alpha_ok = 1;
    for (size_t i = 3; i < sizeof image; i += 4) if (image[i] != 255) { alpha_ok = 0; break; }
    CHECK(alpha_ok, "all base and mip texels are opaque");

    /* DXT1's four-colour mode: all index-0 pixels select endpoint c0 (white). */
    memset(dxt, 0, sizeof dxt);
    dxt[0] = 0xff; dxt[1] = 0xff; /* c0 = 0xffff */
    plate_dxt1(dxt, 4, 4, decoded);
    CHECK(decoded[0] == 255 && decoded[1] == 255 && decoded[2] == 255 && decoded[3] == 255,
          "DXT1 index zero decodes as opaque BGRA");

    /* c0 <= c1 and index 3 is the transparent entry in DXT1. */
    memset(dxt, 0xff, sizeof dxt);
    dxt[0] = dxt[1] = 0;
    dxt[2] = dxt[3] = 0xff;
    plate_dxt1(dxt, 4, 4, decoded);
    CHECK(decoded[0] == 0 && decoded[1] == 0 && decoded[2] == 0 && decoded[3] == 0,
          "DXT1 transparent index keeps zero alpha");

    printf("plates_unit: %d passed, %d failed\n", pass, fail);
    return fail ? 1 : 0;
}
