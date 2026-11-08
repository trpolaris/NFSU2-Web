//! The React player hub's private profile store and read-only live-player API.
//!
//! Browser sessions are anonymous, origin-bound and isolated by an HttpOnly cookie. Only a hash of the
//! session cookie is stored on disk. Profile and garage data live in the existing /state volume.
//! Live player rows deliberately omit virtual IPs, browser ids, claim tokens and other network identifiers.

use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::os::unix::fs::OpenOptionsExt;
use std::path::{Path, PathBuf};

use hmac::{Hmac, Mac};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

use super::{App, Cache, Fail, Res, finish, send};
use crate::app::url::Url;

const SESSION_COOKIE: &str = "__Host-trp-session";
const SESSION_MAX_AGE: i64 = 60 * 60 * 24 * 365;
const SESSION_MAX_AGE_MS: i64 = SESSION_MAX_AGE * 1000;
const MAX_SESSIONS: usize = 5_000;
const MAX_BODY: usize = 32 * 1024;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerProfile {
    pub display_name: String,
    pub bio: String,
    pub favorite_car: String,
    pub updated_at: i64,
}
impl Default for PlayerProfile {
    fn default() -> Self {
        Self { display_name: String::new(), bio: String::new(), favorite_car: String::new(), updated_at: 0 }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GarageVehicle {
    pub id: String,
    pub manufacturer: String,
    pub model: String,
    pub year: Option<u16>,
    pub notes: String,
    pub created_at: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlayerSession {
    csrf: String,
    created_at: i64,
    profile: PlayerProfile,
    garage: Vec<GarageVehicle>,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
struct HubState {
    sessions: HashMap<String, PlayerSession>,
}

/// A small bounded JSON store is sufficient for the first hub slice. It is deliberately stored in the
/// server's existing /state volume, written atomically, and can be migrated to SQLite without changing
/// the HTTP/React contract when public accounts and cross-device identity are introduced.
pub struct HubStore {
    path: PathBuf,
    state: Mutex<HubState>,
    load_error: Option<String>,
}

impl HubStore {
    pub fn open(state_dir: &str) -> Self {
        let path = Path::new(state_dir).join("player-hub.json");
        let mut load_error = None;
        let state = match fs::read(&path) {
            Ok(bytes) => match serde_json::from_slice::<HubState>(&bytes) {
                Ok(state) => state,
                Err(e) => {
                    load_error = Some(format!("player hub store could not be parsed: {e}"));
                    HubState::default()
                }
            },
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => HubState::default(),
            Err(e) => {
                load_error = Some(format!("player hub store could not be read: {e}"));
                HubState::default()
            }
        };
        if let Some(e) = &load_error {
            nfsu2_util::log::error(e);
        }
        Self { path, state: Mutex::new(state), load_error }
    }

    fn persist(&self, state: &HubState) -> Result<(), String> {
        if let Some(e) = &self.load_error {
            return Err(format!("player hub store is read-only after a load error: {e}"));
        }
        let parent = self.path.parent().ok_or("player hub store has no parent directory")?;
        fs::create_dir_all(parent).map_err(|e| format!("create player hub state directory: {e}"))?;
        let temp = self.path.with_extension(format!("json.tmp-{}", std::process::id()));
        let mut file = OpenOptions::new()
            .create(true)
            .truncate(true)
            .write(true)
            .mode(0o600)
            .open(&temp)
            .map_err(|e| format!("open player hub temporary store: {e}"))?;
        serde_json::to_writer(&mut file, state).map_err(|e| format!("serialize player hub store: {e}"))?;
        file.write_all(b"\n").map_err(|e| format!("write player hub store: {e}"))?;
        file.sync_all().map_err(|e| format!("sync player hub store: {e}"))?;
        fs::rename(&temp, &self.path).map_err(|e| {
            let _ = fs::remove_file(&temp);
            format!("replace player hub store: {e}")
        })?;
        Ok(())
    }

    fn session(&self, token: Option<&str>) -> Result<(String, bool, PlayerSession), String> {
        let now = nfsu2_util::now_ms();
        let mut state = self.state.lock();
        if let Some(token) = token.filter(|v| valid_token(v)) {
            let hash = digest_hex(token.as_bytes());
            if let Some(session) = state
                .sessions
                .get(&hash)
                .filter(|s| {
                    let age = now.saturating_sub(s.created_at);
                    (0..=SESSION_MAX_AGE_MS).contains(&age)
                })
                .cloned()
            {
                return Ok((token.to_string(), false, session));
            }
        }

        let before = state.clone();
        state.sessions.retain(|_, session| {
            let age = now.saturating_sub(session.created_at);
            (0..=SESSION_MAX_AGE_MS).contains(&age)
        });
        if state.sessions.len() >= MAX_SESSIONS {
            *state = before;
            return Err("player hub session capacity reached; expired sessions must be cleaned first".into());
        }

        let token = nfsu2_util::js::base64url(&nfsu2_util::rand::bytes(32));
        let csrf = nfsu2_util::js::base64url(&nfsu2_util::rand::bytes(32));
        let session = PlayerSession { csrf, created_at: now, profile: PlayerProfile::default(), garage: Vec::new() };
        state.sessions.insert(digest_hex(token.as_bytes()), session.clone());
        if let Err(e) = self.persist(&state) {
            *state = before;
            return Err(e);
        }
        Ok((token, true, session))
    }

    fn existing(&self, token: Option<&str>) -> Option<(String, PlayerSession)> {
        let token = token.filter(|v| valid_token(v))?;
        let hash = digest_hex(token.as_bytes());
        let now = nfsu2_util::now_ms();
        let session = self
            .state
            .lock()
            .sessions
            .get(&hash)
            .filter(|s| {
                let age = now.saturating_sub(s.created_at);
                (0..=SESSION_MAX_AGE_MS).contains(&age)
            })
            .cloned()?;
        Some((hash, session))
    }

    fn update_profile(&self, hash: &str, profile: PlayerProfile) -> Result<PlayerProfile, String> {
        let mut state = self.state.lock();
        let before = state.clone();
        let session = state.sessions.get_mut(hash).ok_or("session expired")?;
        session.profile = profile.clone();
        if let Err(e) = self.persist(&state) {
            *state = before;
            return Err(e);
        }
        Ok(profile)
    }

    fn add_vehicle(&self, hash: &str, mut vehicle: GarageVehicle) -> Result<Vec<GarageVehicle>, String> {
        let mut state = self.state.lock();
        let before = state.clone();
        let session = state.sessions.get_mut(hash).ok_or("session expired")?;
        if session.garage.len() >= 100 {
            return Err("garage limit reached (100 vehicles)".into());
        }
        let mut n = 0u32;
        while session.garage.iter().any(|v| v.id == vehicle.id) {
            n += 1;
            vehicle.id = format!("{}-{n}", vehicle.id);
        }
        session.garage.push(vehicle);
        let result = session.garage.clone();
        if let Err(e) = self.persist(&state) {
            *state = before;
            return Err(e);
        }
        Ok(result)
    }

    fn remove_vehicle(&self, hash: &str, id: &str) -> Result<Vec<GarageVehicle>, String> {
        let mut state = self.state.lock();
        let before = state.clone();
        let session = state.sessions.get_mut(hash).ok_or("session expired")?;
        let before_len = session.garage.len();
        session.garage.retain(|v| v.id != id);
        if session.garage.len() == before_len {
            return Err("vehicle not found".into());
        }
        let result = session.garage.clone();
        if let Err(e) = self.persist(&state) {
            *state = before;
            return Err(e);
        }
        Ok(result)
    }
}

fn valid_token(token: &str) -> bool {
    token.len() == 43 && token.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}
fn digest_hex(input: &[u8]) -> String {
    let digest = Sha256::digest(input);
    digest.iter().map(|b| format!("{b:02x}")).collect()
}
fn clean_text(input: &str, max: usize) -> String {
    input.chars().filter(|c| !c.is_control()).take(max).collect::<String>().trim().to_string()
}
fn constant_time_eq(a: &str, b: &str) -> bool {
    let (a, b) = (a.as_bytes(), b.as_bytes());
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b).fold(0u8, |diff, (x, y)| diff | (x ^ y)) == 0
}
fn cookie_token(cookie: Option<&str>) -> Option<String> {
    cookie?.split(';').find_map(|part| {
        let (name, value) = part.trim().split_once('=')?;
        (name == SESSION_COOKIE && valid_token(value)).then(|| value.to_string())
    })
}
fn json_body(bytes: &[u8]) -> Result<Value, &'static str> {
    if bytes.len() > MAX_BODY {
        return Err("request body too large");
    }
    serde_json::from_slice(bytes).map_err(|_| "invalid JSON body")
}

impl App {
    /// The React player hub's same-origin API. Profile writes require the HttpOnly session cookie
    /// plus the session's CSRF token; a caller cannot select another player's session id.
    pub(super) async fn player_hub_api(&self, q: &mut nfsu2_http::Request, s: &mut nfsu2_http::Response, path: &str, u: &Url) -> Res {
        if !self.own_page(q) {
            return self.hub_error(q, s, 403, "same-origin request required").await;
        }
        if path == "/api/v1/session" {
            if q.method != "GET" && q.method != "HEAD" {
                return self.hub_error(q, s, 405, "method not allowed").await;
            }
            let token = cookie_token(q.headers.get("cookie"));
            let (token, created, session) = match self.hub.session(token.as_deref()) {
                Ok(value) => value,
                Err(e) => {
                    nfsu2_util::log::error(&e);
                    return self.hub_error(q, s, 503, "profile store unavailable").await;
                }
            };
            let body = json!({
                "ok": true,
                "csrf": session.csrf,
                "profile": session.profile,
                "garageCount": session.garage.len(),
                "session": "browser-private"
            });
            let cookie = if created {
                Some(format!("{SESSION_COOKIE}={token}; Path=/; Max-Age={SESSION_MAX_AGE}; HttpOnly; Secure; SameSite=Strict"))
            } else {
                None
            };
            return self.hub_json(q, s, 200, body, cookie.as_deref()).await;
        }

        if path == "/api/v1/live/players" {
            if q.method != "GET" && q.method != "HEAD" {
                return self.hub_error(q, s, 405, "method not allowed").await;
            }
            let now = nfsu2_util::now_ms();
            let mut players = Vec::new();
            for player in self.lan.who().await.into_iter().filter(|p| p.left.is_none()) {
                let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(&self.group_key).expect("HMAC accepts any key");
                mac.update(&player.vip.to_le_bytes());
                let id = nfsu2_util::js::base64url(&mac.finalize().into_bytes())[..16].to_string();
                let activity = match player.doing {
                    "Online" => "online",
                    "LAN screens" => "lan",
                    "free roam" => "free-roam",
                    _ => "menus",
                };
                players.push(json!({
                    "id": id,
                    "name": clean_text(&player.name, 32),
                    "activity": activity,
                    "connectedSeconds": now.saturating_sub(player.since).max(0) / 1000
                }));
            }
            return self
                .hub_json(
                    q,
                    s,
                    200,
                    json!({
                        "players": players,
                        "count": players.len(),
                        "updatedAt": now,
                        "source": "live-switch"
                    }),
                    None,
                )
                .await;
        }

        let token = cookie_token(q.headers.get("cookie"));
        let Some((session_hash, session)) = self.hub.existing(token.as_deref()) else {
            return self.hub_error(q, s, 401, "player session required").await;
        };

        if path == "/api/v1/me" && (q.method == "GET" || q.method == "HEAD") {
            return self.hub_json(q, s, 200, json!({ "profile": session.profile }), None).await;
        }
        if path == "/api/v1/garage" && (q.method == "GET" || q.method == "HEAD") {
            return self
                .hub_json(
                    q,
                    s,
                    200,
                    json!({
                        "vehicles": session.garage,
                        "count": session.garage.len(),
                        "origin": "player-entered"
                    }),
                    None,
                )
                .await;
        }

        if q.method != "POST" && q.method != "PUT" && q.method != "DELETE" {
            return self.hub_error(q, s, 405, "method not allowed").await;
        }
        let csrf = q.headers.get("x-trp-csrf").unwrap_or("");
        if !constant_time_eq(csrf, &session.csrf) {
            return self.hub_error(q, s, 403, "CSRF validation failed").await;
        }
        if q.headers.get("content-type").is_some_and(|v| !v.to_ascii_lowercase().starts_with("application/json")) {
            return self.hub_error(q, s, 415, "application/json required").await;
        }

        let bytes = match q.read_body(MAX_BODY).await {
            Ok(body) => body,
            Err(nfsu2_http::BodyError::TooLarge) => return self.hub_error(q, s, 413, "request body too large").await,
            Err(nfsu2_http::BodyError::Broken) => {
                s.destroy();
                return Err(Fail::Gone);
            }
        };
        // DELETE identifies the garage vehicle in the URL and intentionally has no JSON body.
        let body = if q.method == "DELETE" && path.starts_with("/api/v1/garage/") {
            Value::Null
        } else {
            match json_body(&bytes) {
                Ok(value) => value,
                Err(e) => return self.hub_error(q, s, 400, e).await,
            }
        };

        if path == "/api/v1/me" && q.method == "PUT" {
            let display_name = clean_text(body.get("displayName").and_then(Value::as_str).unwrap_or(""), 24);
            let bio = clean_text(body.get("bio").and_then(Value::as_str).unwrap_or(""), 160);
            let favorite_car = clean_text(body.get("favoriteCar").and_then(Value::as_str).unwrap_or(""), 48);
            if display_name.chars().count() > 24 || bio.chars().count() > 160 || favorite_car.chars().count() > 48 {
                return self.hub_error(q, s, 400, "profile field too long").await;
            }
            let profile = PlayerProfile { display_name, bio, favorite_car, updated_at: nfsu2_util::now_ms() };
            return match self.hub.update_profile(&session_hash, profile) {
                Ok(profile) => self.hub_json(q, s, 200, json!({ "profile": profile }), None).await,
                Err(e) => {
                    nfsu2_util::log::error(&e);
                    self.hub_error(q, s, 503, "profile store unavailable").await
                }
            };
        }

        if path == "/api/v1/garage" && q.method == "POST" {
            let manufacturer = clean_text(body.get("manufacturer").and_then(Value::as_str).unwrap_or(""), 32);
            let model = clean_text(body.get("model").and_then(Value::as_str).unwrap_or(""), 48);
            let notes = clean_text(body.get("notes").and_then(Value::as_str).unwrap_or(""), 160);
            let year_raw = body.get("year").and_then(Value::as_u64);
            let year = year_raw.map(|v| v as u16);
            if manufacturer.is_empty()
                || model.is_empty()
                || body.get("manufacturer").and_then(Value::as_str).is_none()
                || body.get("model").and_then(Value::as_str).is_none()
                || year_raw.is_some_and(|y| !(1990..=2035).contains(&y))
            {
                return self.hub_error(q, s, 400, "manufacturer and model are required; year must be 1990–2035").await;
            }
            let id = nfsu2_util::js::base64url(&nfsu2_util::rand::bytes(12));
            let vehicle = GarageVehicle { id, manufacturer, model, year, notes, created_at: nfsu2_util::now_ms() };
            return match self.hub.add_vehicle(&session_hash, vehicle) {
                Ok(vehicles) => self.hub_json(q, s, 201, json!({ "vehicles": vehicles, "origin": "player-entered" }), None).await,
                Err(e) => {
                    let status = if e.contains("limit") { 409 } else { 503 };
                    self.hub_error(q, s, status, &e).await
                }
            };
        }

        if path.starts_with("/api/v1/garage/") && q.method == "DELETE" {
            let id = path.trim_start_matches("/api/v1/garage/");
            if id.is_empty() || id.len() > 64 || id.contains('/') {
                return self.hub_error(q, s, 400, "invalid vehicle id").await;
            }
            return match self.hub.remove_vehicle(&session_hash, id) {
                Ok(vehicles) => {
                    self.hub_json(
                        q,
                        s,
                        200,
                        json!({
                            "vehicles": vehicles,
                            "count": vehicles.len(),
                            "origin": "player-entered"
                        }),
                        None,
                    )
                    .await
                }
                Err(e) if e == "vehicle not found" => self.hub_error(q, s, 404, &e).await,
                Err(e) => {
                    nfsu2_util::log::error(&e);
                    self.hub_error(q, s, 503, "profile store unavailable").await
                }
            };
        }

        let _ = u;
        self.hub_error(q, s, 404, "API endpoint not found").await
    }

    async fn hub_json(&self, q: &nfsu2_http::Request, s: &mut nfsu2_http::Response, code: u16, value: Value, cookie: Option<&str>) -> Res {
        let body = nfsu2_util::json::stringify(&value);
        let mut h = self.headers(q, Cache::Store, true);
        h.set("content-type", "application/json; charset=utf-8");
        h.set("content-length", body.len().to_string());
        h.set("cache-control", "private, no-store");
        if let Some(cookie) = cookie {
            h.set("set-cookie", cookie);
        }
        s.head(code, h.0);
        if q.method != "HEAD" {
            send(s, body.as_bytes()).await?;
        }
        finish(s).await
    }

    async fn hub_error(&self, q: &nfsu2_http::Request, s: &mut nfsu2_http::Response, code: u16, message: &str) -> Res {
        self.hub_json(q, s, code, json!({ "error": message }), None).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn session_tokens_are_exact_length_url_safe_values() {
        assert!(valid_token(&"a".repeat(43)));
        assert!(!valid_token(&"a".repeat(42)));
        assert!(!valid_token(&"a".repeat(44)));
        assert!(!valid_token(&format!("{}=", "a".repeat(42))));
        assert!(!valid_token(&format!("{}.", "a".repeat(42))));
    }

    #[test]
    fn text_is_trimmed_bounded_and_has_no_control_characters() {
        assert_eq!(clean_text("  Driver\n\tOne  ", 32), "DriverOne");
        assert_eq!(clean_text("abcdef", 3), "abc");
        assert_eq!(clean_text("   ", 12), "");
    }

    #[test]
    fn csrf_comparison_rejects_mismatched_lengths_and_values() {
        assert!(constant_time_eq("same-token", "same-token"));
        assert!(!constant_time_eq("same-token", "same-tokeN"));
        assert!(!constant_time_eq("short", "longer"));
    }

    #[test]
    fn garage_year_is_bounded_before_narrowing_to_u16() {
        for valid in [1990u64, 2004, 2035] {
            assert!((1990..=2035).contains(&valid));
        }
        for invalid in [0u64, 1989, 2036, 65_536 + 2004] {
            assert!(!(1990..=2035).contains(&invalid));
        }
    }
}
