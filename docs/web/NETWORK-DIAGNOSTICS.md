# In-game network diagnostics

The detailed frame-rate overlay also shows the active virtual-LAN link while free roam, LAN play or Online mode is using the server connection.

## Open it

While a game is running, press **F8** to cycle through:

1. Off
2. Frame rate only
3. Detailed performance and network metrics

Press F8 again to return to Off. On the detailed view, the network rows appear only after the network subsystem attaches to a game session.

## Metrics

| Metric | Meaning |
|---|---|
| `lan link state` | Current switch-link state: online, queued, connecting, waiting, offline, idle, away or closed. |
| `lan quality` | A rough label derived from the latest WebSocket round-trip time: excellent (up to 50 ms), good (up to 100 ms), fair (up to 180 ms), or poor (over 180 ms). Unknown means no usable RTT sample yet or the link is not online. |
| `lan rtt ms` | Latest round-trip time for the page's ping to the virtual-LAN switch. |
| `lan rtt avg ms` | Mean switch RTT since this network link attached. |
| `lan rtt max ms` | Highest switch RTT recorded by this link. |
| `lan friends` | Other browser players currently visible on the switch. |
| `lan reconnects` | Number of automatic reconnect attempts made by this page. |
| `lan frames in / out` | Cumulative network frames received from / sent to the switch. |
| `lan rx drops` | Frames discarded because the receive ring was full or a frame was too large. |
| `lan tx wait avg / max ms` | Average and maximum time queued outbound frames waited before being sent. |

## Interpret the numbers carefully

- The ping measures this browser's WebSocket round trip to the server's virtual-LAN switch. It is not a direct ping to another player and does not measure the game's frame time.
- The quality label is a latency hint only. It is not a packet-loss score, ISP assessment, or guarantee that every game packet arrived.
- Receive-drop and transmit-wait counters are cumulative for the current link. A non-zero value is a signal to inspect logs and the server path, not proof that the remote internet dropped packets.
- The average and maximum RTT reset when the page creates a new network link for a game session.
- The detailed overlay also contains graphics and runtime counters. Network rows are absent when the game has networking disabled or has not opened a network feature.
