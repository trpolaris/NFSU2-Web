//! Optional Discord notifications for server-side automatic race bans.
use nfsu2_roam::CarBan;
use nfsu2_util::log;
use serde_json::json;
use std::sync::OnceLock;
use std::time::Duration;

use super::turnstile::post_json;

static WEBHOOK: OnceLock<Option<String>> = OnceLock::new();
fn webhook() -> Option<&'static str> {
    WEBHOOK
        .get_or_init(|| {
            let v = std::env::var("NFSU2_BAN_WEBHOOK").unwrap_or_default().trim().to_string();
            if v.is_empty() {
                return None;
            }
            if !(v.starts_with("https://") || v.starts_with("http://")) {
                log::error("NFSU2_BAN_WEBHOOK: not an http(s) address; race bans will not be posted");
                return None;
            }
            Some(format!("{}{}wait=true&with_components=true", v, if v.contains('?') { '&' } else { '?' }))
        })
        .as_deref()
}

/// Notify the configured Discord channel after the ban has been stored. The webhook URL is never logged.
pub async fn post_race_ban(id: impl std::fmt::Display, race: &CarBan, name: &str) {
    let Some(url) = webhook() else {
        return;
    };
    let id = id.to_string();
    let car = format!("{} (type {})", race.car, race.car_type);
    let details = format!("{:.0} kW, rated {:.0}, {:.0} kg, {:.0} km/h", race.kw, race.rating, race.kg, race.kmh);
    let title = format!("### Race ban #{id} · {name}\nRaced a car past the server's configured thresholds: **{car}**, **{details}**");
    let laps = if race.laps > 1 { format!(" · {} laps", race.laps) } else { String::new() };
    let foot = format!("-# Automatic · lobby {}{} · {} · 2 weeks", race.kind, laps, race.place);
    let body = json!({
        "flags": 32768,
        "allowed_mentions": { "parse": [] },
        "components": [{
            "type": 17,
            "accent_color": 0xE5484D,
            "components": [
                { "type": 10, "content": title },
                { "type": 14 },
                { "type": 10, "content": foot }
            ]
        }]
    })
    .to_string();
    match tokio::time::timeout(Duration::from_secs(10), post_json(url, &body)).await {
        Ok(Ok(_)) => log::line(&format!("[ban] race ban #{id} posted to Discord")),
        Ok(Err(e)) => log::error(&format!("[ban] race ban #{id}: Discord webhook failed: {e}")),
        Err(_) => log::error(&format!("[ban] race ban #{id}: Discord webhook did not answer in 10 s")),
    }
}
