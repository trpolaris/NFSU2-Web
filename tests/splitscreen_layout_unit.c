#include "splitscreen_layout.h"
#include <stdio.h>
#define CHECK(condition, label) do { if (!(condition)) { fprintf(stderr, "FAIL: %s\n", label); return 1; } } while (0)
static int overlaps(SplitCell a, SplitCell b) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
int main(void) {
    const int expected_ids[SPLIT_MAX_PLAYERS] = { 1, 2, 5, 6, 7, 8 };
    const int width = 801, height = 601;
    SplitCell cells[SPLIT_MAX_PLAYERS];
    for (int seat = 0; seat < SPLIT_MAX_PLAYERS; ++seat)
        CHECK(split_view_id(seat) == expected_ids[seat], "stable game view id");
    CHECK(split_view_id(-1) == -1 && split_view_id(SPLIT_MAX_PLAYERS) == -1, "out-of-range view id");
    for (int count = 1; count <= SPLIT_MAX_PLAYERS; ++count) {
        for (int seat = 0; seat < count; ++seat) {
            cells[seat] = split_layout_cell(count, seat, width, height, 0);
            CHECK(cells[seat].w > 0 && cells[seat].h > 0, "non-empty viewport");
            CHECK(cells[seat].x >= 0 && cells[seat].y >= 0 &&
                  cells[seat].x + cells[seat].w <= width &&
                  cells[seat].y + cells[seat].h <= height, "viewport stays inside target");
            for (int other = 0; other < seat; ++other)
                CHECK(!overlaps(cells[seat], cells[other]), "player viewports do not overlap");
        }
    }
    SplitCell left = split_layout_cell(2, 0, width, height, 1);
    SplitCell right = split_layout_cell(2, 1, width, height, 1);
    CHECK(left.x == 0 && right.x == width / 2 && left.y == 0 && right.y == 0, "two-player vertical layout");
    SplitCell top = split_layout_cell(2, 0, width, height, 0);
    SplitCell bottom = split_layout_cell(2, 1, width, height, 0);
    CHECK(top.y == 0 && bottom.y == height / 2 && top.x == 0 && bottom.x == 0, "two-player horizontal layout");
    SplitCell third = split_layout_cell(3, 2, width, height, 0);
    CHECK(third.x == width / 4 && third.y == height / 2, "third player centered");
    SplitCell fifth = split_layout_cell(5, 3, width, height, 0);
    CHECK(fifth.x == width / 6 && fifth.y == height / 2, "five-player lower row centered");
    SplitCell full = split_layout_cell(1, 0, width, height, 0);
    CHECK(full.x == 0 && full.y == 0 && full.w == width && full.h == height, "single-player layout remains full-screen");
    SplitCell invalid = split_layout_cell(7, 0, width, height, 0);
    CHECK(invalid.x == 0 && invalid.y == 0 && invalid.w == 0 && invalid.h == 0, "invalid player count returns empty viewport");
    invalid = split_layout_cell(2, 2, width, height, 0);
    CHECK(invalid.w == 0 && invalid.h == 0, "invalid seat returns empty viewport");
    invalid = split_layout_cell(2, 0, 0, height, 0);
    CHECK(invalid.w == 0 && invalid.h == 0, "invalid target size returns empty viewport");
    puts("splitscreen_layout_unit: passed");
    return 0;
}
