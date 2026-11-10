//! Server-side moderation of optional license-plate tails in free-roam HELLO datagrams.

use parking_lot::Mutex;

const FRAME_HDR: usize = 16;
const HF_CREW: u16 = 0x0200;
const HF_PLATE: u16 = 0x0800;
const MAX_PEERS: usize = 32;
const MAX_CREWS: usize = 4;
const MAX_PLATE: usize = 8;
const CHANGE_MS: i64 = 10_000;

#[derive(Debug, PartialEq)]
pub(crate) enum Found<'a> {
    Plate { at: usize, bytes: &'a [u8] },
    Broken { at: usize },
}

pub(crate) fn hello_plate(frame: &[u8]) -> Option<Found<'_>> {
    let d = frame.get(FRAME_HDR..)?;
    if frame.first().copied()? != crate::KIND_UDP
        || d.len() < 33
        || &d[..4] != b"N2FR"
        || d[4] != 1
        || d[5] != 1
        || u16::from_le_bytes([d[6], d[7]]) as usize != d.len()
        || u32::from_le_bytes(d[d.len() - 4..].try_into().ok()?) != crc32fast::hash(&d[..d.len() - 4])
    {
        return None;
    }

    let flags = u16::from_le_bytes([d[14], d[15]]);
    if flags & HF_PLATE == 0 || flags & HF_CREW == 0 {
        return None;
    }

    let name_len = *d.get(28)? as usize;
    if name_len > 24 {
        return None;
    }
    let mut at = 29usize.checked_add(name_len)?;
    d.get(29..at)?;

    let seen = *d.get(at)? as usize;
    if seen > MAX_PEERS {
        return None;
    }
    at = at.checked_add(1 + 4 * seen)?;

    let crews = *d.get(at)? as usize;
    if crews > MAX_CREWS {
        return None;
    }
    at = at.checked_add(1 + 4 * crews)?;

    let n = *d.get(at)? as usize;
    let bytes = d.get(at + 1..at.checked_add(1 + n)?)?;
    if n == 0 || n > MAX_PLATE || !bytes.iter().all(|b| b.is_ascii_uppercase() || b.is_ascii_digit()) {
        return Some(Found::Broken { at });
    }
    Some(Found::Plate { at, bytes })
}

pub(crate) fn rewrite(frame: &[u8], at: usize, replacement: Option<&[u8]>) -> Option<bytes::Bytes> {
    hello_plate(frame)?;
    let d = &frame[FRAME_HDR..];
    let old_len = *d.get(at)? as usize;
    let end = at.checked_add(1 + old_len)?;
    if end > d.len() - 4 {
        return None;
    }

    let mut out = frame[..FRAME_HDR].to_vec();
    out.extend_from_slice(&d[..at]);
    if let Some(p) = replacement {
        if p.is_empty() || p.len() > MAX_PLATE || !p.iter().all(|b| b.is_ascii_uppercase() || b.is_ascii_digit()) {
            return None;
        }
        out.push(p.len() as u8);
        out.extend_from_slice(p);
    }
    out.extend_from_slice(&d[end..d.len() - 4]);

    let flags_at = FRAME_HDR + 14;
    let mut flags = u16::from_le_bytes([out[flags_at], out[flags_at + 1]]);
    if replacement.is_none() {
        flags &= !HF_PLATE;
    }
    out[flags_at..flags_at + 2].copy_from_slice(&flags.to_le_bytes());

    let len = (out.len() - FRAME_HDR + 4) as u16;
    out[FRAME_HDR + 6..FRAME_HDR + 8].copy_from_slice(&len.to_le_bytes());
    let crc = crc32fast::hash(&out[FRAME_HDR..]);
    out.extend_from_slice(&crc.to_le_bytes());
    Some(bytes::Bytes::from(out))
}

#[derive(Default)]
pub(crate) struct Seen {
    last: Option<(Box<[u8]>, i64)>,
}

#[derive(Debug, PartialEq)]
pub(crate) enum Verdict {
    Go,
    New,
    Last(Box<[u8]>),
    Block,
}

pub(crate) fn judge(seen: &Mutex<Seen>, plate: &[u8], now: i64) -> Verdict {
    if nfsu2_names::blocked_plate(std::str::from_utf8(plate).unwrap_or("")) {
        return Verdict::Block;
    }
    let mut seen = seen.lock();
    match &seen.last {
        Some((last, _)) if **last == *plate => Verdict::Go,
        Some((last, at)) if now.saturating_sub(*at) < CHANGE_MS => Verdict::Last(last.clone()),
        _ => {
            seen.last = Some((plate.into(), now));
            Verdict::New
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn frame(plate: &[u8]) -> Vec<u8> {
        let mut out = vec![0u8; FRAME_HDR];
        out[0] = crate::KIND_UDP;
        let mut d = vec![0u8; 29];
        d[..4].copy_from_slice(b"N2FR");
        d[4] = 1;
        d[5] = 1;
        d[14..16].copy_from_slice(&(HF_CREW | HF_PLATE).to_le_bytes());
        d[16] = 9;
        d[28] = 3;
        d.extend_from_slice(b"Ann");
        d.push(0); // seen ids
        d.push(0); // crews
        d.push(plate.len() as u8);
        d.extend_from_slice(plate);
        let n = (d.len() + 4) as u16;
        d[6..8].copy_from_slice(&n.to_le_bytes());
        let crc = crc32fast::hash(&d);
        d.extend_from_slice(&crc.to_le_bytes());
        out.extend_from_slice(&d);
        out
    }

    #[test]
    fn plate_tail_can_be_removed_without_dropping_player() {
        let f = frame(b"AB123");
        let Some(Found::Plate { at, bytes }) = hello_plate(&f) else {
            panic!("valid plate");
        };
        assert_eq!(bytes, b"AB123");
        let stripped = rewrite(&f, at, None).unwrap();
        assert!(hello_plate(&stripped).is_none());
        assert_eq!(stripped[0], crate::KIND_UDP);
    }

    #[test]
    fn malformed_plate_is_removed_and_bad_words_are_blocked() {
        let f = frame(b"ABC-12");
        let Some(Found::Broken { at }) = hello_plate(&f) else {
            panic!("broken");
        };
        assert!(rewrite(&f, at, None).is_some());
        assert_eq!(judge(&Mutex::new(Seen::default()), b"BIGFAG", 0), Verdict::Block);
    }

    #[test]
    fn changes_are_limited_to_once_per_ten_seconds() {
        let seen = Mutex::new(Seen::default());
        assert_eq!(judge(&seen, b"AB123", 100), Verdict::New);
        assert_eq!(judge(&seen, b"AB123", 200), Verdict::Go);
        assert_eq!(judge(&seen, b"XY987", 10_099), Verdict::Last(b"AB123"[..].into()));
        assert_eq!(judge(&seen, b"XY987", 10_100), Verdict::New);
    }
}
