//! Multilingual typed-chat profanity filter, sourced from the supplied Chat Filter.zip.
//!
//! The original locale files are embedded as a ZIP split into Base64 chunks. They are decoded once;
//! each line is normalized into a sequence of words, then matched on word boundaries so e.g. "ass"
//! does not censor "classic". A matched word or phrase is replaced with exactly seven asterisks.

use std::collections::HashSet;
use std::io::Read;
use std::sync::OnceLock;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use flate2::read::DeflateDecoder;
use unicode_normalization::{UnicodeNormalization, char::is_combining_mark};

const ARCHIVE_BASE64: &str = concat!(
    include_str!("../assets/chat-filter.zip.b64"),
    include_str!("../assets/chat-filter.part02.b64"),
    include_str!("../assets/chat-filter.part03.b64"),
    include_str!("../assets/chat-filter.part04.b64"),
    include_str!("../assets/chat-filter.part05.b64"),
    include_str!("../assets/chat-filter.part06.b64"),
    include_str!("../assets/chat-filter.part07.b64"),
    include_str!("../assets/chat-filter.part08.b64"),
    include_str!("../assets/chat-filter.part09.b64"),
    include_str!("../assets/chat-filter.part10.b64"),
    include_str!("../assets/chat-filter.part11.b64"),
);

const MASK: &str = "*******";

#[derive(Debug)]
struct Filter {
    terms: HashSet<String>,
    max_words: usize,
    locale_files: usize,
}

static FILTER: OnceLock<Filter> = OnceLock::new();

#[derive(Debug)]
struct Token {
    start: usize,
    end: usize,
    normalized: String,
}

fn read_u16(data: &[u8], at: usize) -> Result<u16, String> {
    let bytes = data.get(at..at + 2).ok_or_else(|| "short ZIP u16".to_string())?;
    Ok(u16::from_le_bytes([bytes[0], bytes[1]]))
}

fn read_u32(data: &[u8], at: usize) -> Result<u32, String> {
    let bytes = data.get(at..at + 4).ok_or_else(|| "short ZIP u32".to_string())?;
    Ok(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}

/// Unicode decomposition, case folding, Latin diacritic removal and Turkish dotless-i handling.
/// Combining marks in non-Latin scripts (Arabic, Devanagari, Thai, etc.) are retained.
fn normalize(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut previous_base_is_latin = false;
    for ch in input.nfkd() {
        if is_combining_mark(ch) {
            if !previous_base_is_latin {
                out.push(ch);
            }
            continue;
        }
        previous_base_is_latin = ch.is_ascii_alphabetic();
        for lower in ch.to_lowercase() {
            match lower {
                'ı' => out.push('i'),
                'ß' => out.push_str("ss"),
                _ => out.push(lower),
            }
        }
    }
    out
}

/// Scripts whose ordinary text is commonly written without spaces between words.
/// Their letters are emitted as individual matchable units so profanity is found inside a sentence.
fn is_unspaced_script(ch: char) -> bool {
    matches!(ch as u32,
        0x0E00..=0x0E7F | // Thai
        0x0E80..=0x0EFF | // Lao
        0x0F00..=0x0FFF | // Tibetan
        0x1000..=0x109F | // Myanmar
        0x1780..=0x17FF | // Khmer
        0x3040..=0x30FF | // Hiragana and Katakana
        0x3400..=0x4DBF |
        0x4E00..=0x9FFF | // CJK ideographs
        0xAC00..=0xD7AF | // Hangul syllables
        0xF900..=0xFAFF |
        0x20000..=0x3134F
    )
}

fn push_token(input: &str, start: usize, end: usize, out: &mut Vec<Token>) {
    let normalized = normalize(&input[start..end]);
    if !normalized.is_empty() {
        out.push(Token { start, end, normalized });
    }
}

fn tokens(input: &str) -> Vec<Token> {
    let mut out: Vec<Token> = Vec::new();
    let mut start: Option<usize> = None;
    for (at, ch) in input.char_indices().chain(std::iter::once((input.len(), '\0'))) {
        let end = at + ch.len_utf8();
        if is_combining_mark(ch) {
            if start.is_none() {
                if let Some(previous) = out.last_mut() {
                    if previous.end == at {
                        previous.end = end;
                        previous.normalized = normalize(&input[previous.start..end]);
                    }
                }
            }
            continue;
        }
        if ch.is_alphanumeric() && is_unspaced_script(ch) {
            if let Some(from) = start.take() {
                push_token(input, from, at, &mut out);
            }
            push_token(input, at, end, &mut out);
        } else if ch.is_alphanumeric() {
            if start.is_none() {
                start = Some(at);
            }
        } else if let Some(from) = start.take() {
            push_token(input, from, at, &mut out);
        }
    }
    out
}

/// Reads the local-file section of this ZIP. The supplied archive uses stored/deflate members and
/// has no encrypted files or data descriptors.
fn unzip_local_files(data: &[u8]) -> Result<Vec<(String, Vec<u8>)>, String> {
    let mut out = Vec::new();
    let mut at = 0usize;
    while data.get(at..at + 4).is_some_and(|signature| signature == &b"PK\x03\x04"[..]) {
        if at + 30 > data.len() {
            return Err("truncated ZIP local header".into());
        }
        let flags = read_u16(data, at + 6)?;
        if flags & 0x0001 != 0 || flags & 0x0008 != 0 {
            return Err("unsupported encrypted/data-descriptor ZIP member".into());
        }
        let method = read_u16(data, at + 8)?;
        let compressed = read_u32(data, at + 18)? as usize;
        let uncompressed = read_u32(data, at + 22)? as usize;
        let name_len = read_u16(data, at + 26)? as usize;
        let extra_len = read_u16(data, at + 28)? as usize;
        let name_start = at + 30;
        let data_start = name_start.checked_add(name_len).and_then(|v| v.checked_add(extra_len))
            .ok_or_else(|| "ZIP offset overflow".to_string())?;
        let data_end = data_start.checked_add(compressed).ok_or_else(|| "ZIP size overflow".to_string())?;
        if data_end > data.len() || name_start + name_len > data.len() {
            return Err("truncated ZIP member".into());
        }
        let name = String::from_utf8_lossy(&data[name_start..name_start + name_len]).into_owned();
        let packed = &data[data_start..data_end];
        if !name.ends_with('/') {
            let content = match method {
                0 => packed.to_vec(),
                8 => {
                    let mut decoder = DeflateDecoder::new(packed);
                    let mut decoded = Vec::with_capacity(uncompressed);
                    decoder.read_to_end(&mut decoded).map_err(|e| format!("ZIP deflate: {e}"))?;
                    decoded
                }
                other => return Err(format!("unsupported ZIP compression method {other}")),
            };
            if content.len() != uncompressed {
                return Err(format!("ZIP size mismatch for {name}"));
            }
            out.push((name, content));
        }
        at = data_end;
    }
    if out.is_empty() {
        return Err("chat filter ZIP contains no locale files".into());
    }
    Ok(out)
}

fn build_filter() -> Result<Filter, String> {
    let archive = STANDARD.decode(ARCHIVE_BASE64.trim()).map_err(|e| format!("chat filter Base64: {e}"))?;
    let files = unzip_local_files(&archive)?;
    let mut terms = HashSet::new();
    let mut max_words = 1usize;
    for (name, content) in &files {
        if !name.starts_with("Chat Filter/") {
            continue;
        }
        let text = String::from_utf8_lossy(content);
        for line in text.lines() {
            let line = line.trim().trim_start_matches('\u{feff}');
            if line.is_empty() {
                continue;
            }
            let parts = tokens(line);
            if parts.is_empty() {
                continue;
            }
            let normalized = parts.iter().map(|part| part.normalized.as_str()).collect::<Vec<_>>().join(" ");
            // "am" is a Turkish obscenity in the source list but also the English auxiliary verb.
            // Excluding this one standalone entry avoids censoring ordinary sentences such as "I am ready".
            if normalized == "am" {
                continue;
            }
            max_words = max_words.max(parts.len());
            terms.insert(normalized);
        }
    }
    if terms.is_empty() {
        return Err("chat filter word list is empty".into());
    }
    Ok(Filter { terms, max_words, locale_files: files.len() })
}

fn filter() -> &'static Filter {
    FILTER.get_or_init(|| build_filter().expect("embedded multilingual chat filter must be valid"))
}

/// Replace each matched profanity/insult term or phrase with exactly seven asterisks.
/// Punctuation and all non-matched text are preserved.
pub(super) fn censor(input: &str) -> String {
    let active = filter();
    let parts = tokens(input);
    if parts.is_empty() {
        return input.to_string();
    }

    let mut output = String::with_capacity(input.len());
    let mut cursor = 0usize;
    let mut index = 0usize;
    while index < parts.len() {
        let mut phrase = String::new();
        let mut matched_end = None;
        let end_limit = (index + active.max_words).min(parts.len());
        for end in index..end_limit {
            if end > index {
                phrase.push(' ');
            }
            phrase.push_str(&parts[end].normalized);
            if active.terms.contains(&phrase) {
                matched_end = Some(end + 1); // longest match wins
            }
        }
        let Some(end) = matched_end else {
            index += 1;
            continue;
        };
        output.push_str(&input[cursor..parts[index].start]);
        output.push_str(MASK);
        cursor = parts[end - 1].end;
        index = end;
    }
    output.push_str(&input[cursor..]);

    // Keep the existing server-side anti-slur matcher as a fallback for obfuscated forms
    // not present in the supplied locale files, but mask them instead of dropping the whole line.
    while let Some(offensive) = nfsu2_names::chat_slur(&output).map(str::to_owned) {
        let Some(start) = output.find(&offensive) else { break; };
        let end = start + offensive.len();
        output.replace_range(start..end, MASK);
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedded_archive_loads_all_28_locale_files_and_a_large_wordlist() {
        let loaded = filter();
        assert_eq!(loaded.locale_files, 28);
        assert!(loaded.terms.len() > 1_000, "loaded {} terms", loaded.terms.len());
    }

    #[test]
    fn masks_turkish_and_english_terms_but_preserves_punctuation() {
        assert_eq!(censor("Merhaba AMCIK!"), "Merhaba *******!");
        assert_eq!(censor("This is SHIT."), "This is *******.");
    }

    #[test]
    fn masks_multi_word_phrases_as_one_seven_star_token() {
        assert_eq!(censor("That is a piece of shit!"), "That is a *******!");
    }

    #[test]
    fn matches_word_boundaries_instead_of_censoring_substrings() {
        assert_eq!(censor("The classic racing game is ready."), "The classic racing game is ready.");
        assert_eq!(censor("I am ready to race."), "I am ready to race.");
    }

    #[test]
    fn preserves_unmatched_text_and_masks_multiple_terms() {
        assert_eq!(censor("SHIT, this is AMCIK."), "*******, this is *******.");
    }

    #[test]
    fn masks_obfuscated_hate_speech_caught_by_the_existing_server_matcher() {
        assert_eq!(censor("n i g g a"), "*******");
    }

    #[test]
    fn matches_cjk_terms_inside_text_without_word_spaces() {
        assert_eq!(censor("你好你妈的"), "你好*******");
    }
}
