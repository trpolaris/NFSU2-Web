//! End-to-end plate moderation through the real LAN switch route. A refused or malformed plate is stripped
//! without dropping its player's HELLO; accepted changes are rate-limited per sender and bad CRCs stay untouched.
mod harness;
use harness::*;

fn datagram(flags: u16, ext: bool, plate: Option<&[u8]>) -> Vec<u8> {
    let mut d = vec![0u8; 29];
    d[..4].copy_from_slice(b"N2FR");
    d[4] = 1;
    d[5] = 1;
    d[14..16].copy_from_slice(&flags.to_le_bytes());
    d[16] = 17;
    d[19] = 2;
    d[28] = 3;
    d.extend_from_slice(b"Ann");
    d.push(0); // the ids it hears
    if ext {
        d.push(0); // n_crews: zero crews; the next byte is the plate length when HF_PLATE is set
    }
    if let Some(text) = plate {
        d.push(text.len() as u8);
        d.extend_from_slice(text);
    }
    let n = (d.len() + 4) as u16;
    d[6..8].copy_from_slice(&n.to_le_bytes());
    let crc = crc32fast::hash(&d);
    d.extend_from_slice(&crc.to_le_bytes());
    d
}

fn hello(plate: &[u8]) -> Vec<u8> {
    if plate.is_empty() {
        datagram(0x0200, false, None)
    } else {
        datagram(0x0A00, true, Some(plate))
    }
}

fn sanitized_extended_hello() -> Vec<u8> {
    datagram(0x0200, true, None)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn malformed_and_blocked_plates_are_removed_without_dropping_players_and_changes_are_rate_limited() {
    let _guard = serial().await;
    let sw = start(opts()).await;
    let mut a = Client::connect(sw.port, "Ann").await;
    a.welcome().await;
    let mut b = Client::connect(sw.port, "Bob").await;
    b.welcome().await;

    let send = |d: &[u8]| a.udp(b.vip, 47210, 47210, d, 1, 0);
    let broken: [&[u8]; 5] = [b"123456789", b"bad", b"A B", b"A\0B", "É".as_bytes()];
    let blocked: [&[u8]; 3] = [b"N1GGER", b"N1GGER", b"1488"];

    for value in broken.iter().chain(blocked.iter()) {
        send(&hello(value));
    }
    // The first plate is accepted; the same plate is always accepted; a different plate inside ten seconds is rewritten.
    send(&hello(b"AB123456"));
    send(&hello(b"AB123456"));
    send(&hello(b"XYZ789"));
    // An ordinary HELLO without a custom plate is unchanged.
    send(&hello(b""));
    // Invalid CRC means the server does not interpret or rewrite the datagram.
    let mut bad_crc = hello(b"N1GGER");
    *bad_crc.last_mut().unwrap() ^= 1;
    send(&bad_crc);
    a.flush().await;

    let mut expected: Vec<Vec<u8>> = (0..broken.len() + blocked.len())
        .map(|_| sanitized_extended_hello())
        .collect();
    expected.extend([
        hello(b"AB123456"),
        hello(b"AB123456"),
        hello(b"AB123456"),
        hello(b""),
        bad_crc,
    ]);

    b.until_true(|g| g.frames.len() >= expected.len()).await;
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    let got: Vec<Vec<u8>> = b.got().frames.iter().map(|(frame, _)| frame[16..].to_vec()).collect();
    assert_eq!(got, expected, "the destination receives only the valid or sanitized HELLO forms");
    assert!(a.is_open() && b.is_open(), "plate moderation must not drop either player");
    assert_eq!(sw.peers().len(), 2, "both players remain in the LAN switch");

    a.close().await;
    b.close().await;
    sw.close().await;
}
