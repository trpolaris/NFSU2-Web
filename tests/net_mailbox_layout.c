#include "../runtime/web/net_proto.h"

_Static_assert(sizeof(net_mailbox) == NET_HDR_BYTES, "mailbox remains 512 bytes");
_Static_assert(offsetof(net_mailbox, room_gen) == 436, "room generation offset");
_Static_assert(offsetof(net_mailbox, room_name) == 440, "room name offset");
_Static_assert(offsetof(net_mailbox, pad) == 504, "remaining header pad offset");

int main(void) {
    return 0;
}
