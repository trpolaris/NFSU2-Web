//! The start page's friend-list API. It uses EA Messenger's existing per-persona lists;
//! no duplicate friend database is introduced here. Friend crew invites are validated against the
//! mutual EA Messenger list and live RoamHub whereabouts, then delivered over the recipient's LAN pages.

use std::sync::Arc;

use bytes::Bytes;
use nfsu2_claims::{Claims, owner_of_token};
use nfsu2_lan::LanSwitch;
use nfsu2_roam::RoamHub;
use nfsu2_headers::Cache;
use nfsu2_http::{Request, Response};
use nfsu2_online::{FriendAsk, FriendReply, OnlineHost};
use nfsu2_util::Rate;
use serde_json::{Value, json};

use super::{App, Fail, Res, finish, send};

const READ_BURST: f64 = 120.0;
const READ_RATE: f64 = 2.0;
const MAX_BODY: usize = 4096;
const MAX_NAME: usize = 64;
const CREW_LEN: usize = 24;
const ROOM_BYTES: usize = 63;

/// A limited bridge from same-origin pages to EA Messenger's lists.
pub struct FriendsRoute {
    online: Arc<OnlineHost>,
    claims: Arc<Claims>,
    lan: Arc<LanSwitch>,
    roam: Option<Arc<RoamHub>>,
    reads: Rate,
    asks: Rate,
    messages: Rate,
    contacts: Rate,
    invites: Rate,
}

impl FriendsRoute {
    pub fn new(online: Arc<OnlineHost>, claims: Arc<Claims>, lan: Arc<LanSwitch>, roam: Option<Arc<RoamHub>>) -> FriendsRoute {
        // If a friend is not in EA Messenger, deliver its page message to every open game page for that keyphrase.
        let (mail_lan, mail_claims) = (lan.clone(), claims.clone());
        online.page_mail(Box::new(move |to, message| {
            let Some(owner) = mail_claims.holder(to, nfsu2_util::now_ms() as i64) else { return false };
            let value = json!({ "t": "friend", "op": "mail", "from": message.from, "body": message.body, "at": message.t });
            let data = Bytes::from(nfsu2_util::json::stringify(&value));
            mail_lan.vips_of_owner(&owner).into_iter()
                .fold(false, |sent, vip| mail_lan.send_text(vip, data.clone()) || sent)
        }));
        FriendsRoute {
            online,
            claims,
            lan,
            roam,
            reads: Rate::new(READ_BURST, READ_RATE),
            asks: Rate::new(5.0, 1.0 / 30.0),
            messages: Rate::new(3.0, 1.0),
            contacts: Rate::new(4.0, 1.0 / 10.0),
            invites: Rate::new(6.0, 1.0 / 5.0),
        }
    }

    fn token(q: &Request) -> Option<&str> {
        let t = q.headers.get("authorization")?.strip_prefix("Bearer ")?;
        (t.len() == 43 && t.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_')).then_some(t)
    }

    fn update_hub(&self, owner: &Arc<str>, reply: &FriendReply) {
        let Some(me) = reply.me.as_ref() else { return };
        let now = nfsu2_util::now_ms() as i64;
        let owners: Vec<Arc<str>> = reply.friends.iter()
            .filter(|f| f.mutual)
            .filter_map(|f| self.claims.holder(&f.name, now))
            .collect();
        if let Some(roam) = &self.roam {
            for vip in self.lan.vips_of_owner(owner) {
                roam.friends(vip, owner.clone(), owners.clone());
            }
        }
        let _ = me;
    }

    async fn page_json(&self, r: FriendReply) -> Value {
        let names: Vec<Option<Arc<str>>> = r.friends.iter().map(|f| {
            if f.mutual { self.claims.holder(&f.name, nfsu2_util::now_ms() as i64) } else { None }
        }).collect();
        let found: Vec<Arc<str>> = names.iter().flatten().cloned().collect();
        let mut places = match &self.roam {
            Some(roam) => roam.whereabouts(found).await.ok().unwrap_or_default().into_iter(),
            None => Vec::new().into_iter(),
        };
        let friends: Vec<Value> = r.friends.into_iter().zip(names).map(|(f, owner)| {
            let where_ = owner.and_then(|_| places.next().flatten());
            let mut row = serde_json::Map::new();
            row.insert("name".into(), f.name.into());
            row.insert("where".into(), if where_.is_some() { "roam" } else if f.mutual && f.online { "online" } else { "" }.into());
            if let Some(place) = where_ {
                if place.room == 0 {
                    row.insert("room".into(), "".into());
                } else if let Some(name) = place.room_name {
                    row.insert("room".into(), name.into());
                }
            }
            if f.mutual {
                if let Some(contact) = f.contact { row.insert("contact".into(), contact.into()); }
            }
            Value::Object(row)
        }).collect();
        let asks = r.asks;
        let sent = r.sent;
        let mail: Vec<Value> = r.mail.into_iter()
            .map(|m| json!({ "from": m.from, "body": m.body, "at": m.t }))
            .collect();
        json!({
            "me": r.me,
            "done": r.done,
            "friends": friends,
            "asks": asks,
            "sent": sent,
            "mail": mail,
            "contact": r.contact,
        })
    }

    /// Invite a mutual friend who is currently in Free Roam to the sender's crew and room.
    /// The crew name is never persisted or written to the server log.
    async fn crew_invite(&self, owner: Arc<str>, group: Arc<str>, name: &str, crew: &str, room: &str) -> (FriendReply, &'static str) {
        let reply = self.query(owner.clone(), group, FriendAsk::List).await;
        let Some(me) = reply.me.clone() else { return (reply, "claim") };
        let (crew, room) = (tidy_invite_name(crew), tidy_invite_name(room));
        let blocked = |value: &str| nfsu2_names::blocked_name(value);
        if crew.is_empty()
            || crew.chars().count() > CREW_LEN
            || room.len() > ROOM_BYTES
            || blocked(&crew)
            || (!room.is_empty() && blocked(&room))
        {
            return (reply, "name");
        }
        let Some(friend) = reply.friends.iter()
            .find(|f| f.mutual && f.name.eq_ignore_ascii_case(name))
            .map(|f| f.name.clone())
        else { return (reply, "none") };
        let Some(theirs) = self.claims.holder(&friend, nfsu2_util::now_ms() as i64) else {
            return (reply, "away");
        };
        let at = match &self.roam {
            Some(roam) => roam.whereabouts(vec![theirs.clone()]).await.unwrap_or_default(),
            None => return (reply, "away"),
        };
        if !matches!(at.first(), Some(Some(_))) {
            return (reply, "away");
        }
        let notice = json!({ "t": "friend", "op": "crew", "name": me, "crew": crew, "room": room });
        let data = Bytes::from(nfsu2_util::json::stringify(&notice));
        let delivered = self.lan.vips_of_owner(&theirs).into_iter()
            .fold(false, |any, vip| self.lan.send_text(vip, data.clone()) || any);
        (reply, if delivered { "sent" } else { "away" })
    }

    async fn query(&self, owner: Arc<str>, group: Arc<str>, ask: FriendAsk) -> FriendReply {
        self.online.friends(owner, group, ask).await.unwrap_or_default()
    }

    /// Classify a claimed player using this keyphrase's existing EA Messenger records.
    /// This read-only preflight deliberately does not disclose another player's live whereabouts.
    async fn can(&self, owner: Arc<str>, group: Arc<str>, name: &str) -> (String, &'static str) {
        let now = nfsu2_util::now_ms() as i64;
        let Some(peer_owner) = self.claims.holder(name, now) else {
            return (name.to_string(), "theirs");
        };
        let Some(peer_name) = self.claims.mine(&peer_owner, now).map(|m| m.name).filter(|n| {
            nfsu2_claims::canonical(n).is_some_and(|n| Some(n) == nfsu2_claims::canonical(name))
        }) else {
            return (name.to_string(), "theirs");
        };
        if peer_owner.as_ref() == owner.as_ref() {
            return (peer_name, "theirs");
        }
        let reply = self.query(owner.clone(), group, FriendAsk::List).await;
        let same = |other: &String| other.eq_ignore_ascii_case(&peer_name);
        let state = friend_state(
            reply.me.is_some(),
            reply.friends.iter().any(|f| f.mutual && same(&f.name)),
            reply.asks.iter().any(same),
            reply.sent.iter().any(same),
        );
        self.update_hub(&owner, &reply);
        (peer_name, state)
    }

    async fn json(app: &App, q: &Request, s: &mut Response, code: u16, value: &Value) -> Res {
        let body = nfsu2_util::json::stringify(value);
        let mut h = app.headers(q, Cache::Store, true);
        h.set("content-type", "application/json; charset=utf-8");
        h.set("content-length", body.len().to_string());
        s.head(code, h.0);
        if q.method != "HEAD" {
            send(s, body.as_bytes()).await?;
        }
        finish(s).await
    }

    pub async fn handle(&self, app: &App, q: &mut Request, s: &mut Response) -> Res {
        // Only this server's own page may read or change the lists.
        let site_ok = q.headers.get("sec-fetch-site").is_none_or(|x| x == "same-origin");
        if !app.own_page(q) || !site_ok {
            return app.plain(q, s, 403, "Forbidden", &[], Cache::Store, true).await;
        }
        if q.method != "GET" && q.method != "HEAD" && q.method != "POST" {
            return app.plain(q, s, 405, "Method not allowed", &[("allow", "GET, HEAD, POST"), ("connection", "close")], Cache::Store, true).await;
        }
        let (_, key, site) = app.client(q);
        if !self.reads.take(&key, &site) {
            return app.plain(q, s, 429, "Too many requests", &[("retry-after", "60")], Cache::Store, true).await;
        }
        let Some(owner) = Self::token(q).and_then(owner_of_token) else {
            return Self::json(app, q, s, 401, &json!({ "error": "keyphrase" })).await;
        };
        let group: Arc<str> = Arc::from(app.group_id(&key));
        let ask = if q.method == "GET" {
            FriendAsk::ListMail
        } else if q.method == "HEAD" {
            // HEAD must not consume the queued messages that GET delivers to the page.
            FriendAsk::List
        } else {
            let body = match q.read_body(MAX_BODY).await {
                Ok(b) => b,
                Err(nfsu2_http::BodyError::TooLarge) => return Self::json(app, q, s, 413, &json!({ "error": "large" })).await,
                Err(nfsu2_http::BodyError::Broken) => {
                    s.destroy();
                    return Err(Fail::Gone);
                }
            };
            let Ok(Value::Object(b)) = serde_json::from_slice::<Value>(&body) else {
                return Self::json(app, q, s, 400, &json!({ "error": "invalid" })).await;
            };
            let name: String = b.get("name").and_then(Value::as_str).unwrap_or("").chars().take(MAX_NAME).collect();
            match b.get("op").and_then(Value::as_str) {
                Some("can") => {
                    let (peer, state) = self.can(owner.clone(), group.clone(), &name).await;
                    return Self::json(app, q, s, 200, &json!({ "name": peer, "done": state })).await;
                }
                Some("ask") => {
                    if !self.asks.take(&owner, "") {
                        return Self::json(app, q, s, 200, &json!({ "done": "rate" })).await;
                    }
                    // Resolve a typed name to the exact spelling of its active claim when possible.
                    let now = nfsu2_util::now_ms() as i64;
                    let claimed = self.claims.holder(&name, now)
                        .and_then(|o| self.claims.mine(&o, now))
                        .map(|m| m.name);
                    FriendAsk::AskByName(claimed.unwrap_or(name))
                }
                Some("accept") => FriendAsk::Answer(name, true),
                Some("decline") => FriendAsk::Answer(name, false),
                Some("remove") => FriendAsk::Remove(name),
                Some("block") => FriendAsk::Block(name),
                Some("msg") => {
                    if !self.messages.take(&owner, "") {
                        return Self::json(app, q, s, 200, &json!({ "done": "rate" })).await;
                    }
                    let body: String = b.get("body").and_then(Value::as_str).unwrap_or("").chars()
                        .take(nfsu2_online::PAGE_MSG_LEN).collect();
                    FriendAsk::Send(name, body)
                }
                Some("discord") => {
                    if !self.contacts.take(&owner, "") {
                        return Self::json(app, q, s, 200, &json!({ "done": "rate" })).await;
                    }
                    FriendAsk::Discord(name)
                }
                Some("crew") => {
                    if !self.invites.take(&owner, "") {
                        return Self::json(app, q, s, 200, &json!({ "done": "rate" })).await;
                    }
                    let crew = b.get("crew").and_then(Value::as_str).unwrap_or("").chars().take(64).collect::<String>();
                    let room = b.get("room").and_then(Value::as_str).unwrap_or("").chars().take(64).collect::<String>();
                    let (reply, done) = self.crew_invite(owner, group, &name, &crew, &room).await;
                    let mut value = self.page_json(reply).await;
                    value["done"] = done.into();
                    return Self::json(app, q, s, 200, &value).await;
                }
                Some("room") => {
                    let typed = b.get("room").and_then(Value::as_str).unwrap_or("");
                    let room = if typed.trim().is_empty() { String::new() } else { nfsu2_lan::clean_name(typed) };
                    if let Some(roam) = &self.roam {
                        for vip in self.lan.vips_of_owner(&owner) {
                            roam.room_name(vip, room.clone());
                        }
                    }
                    FriendAsk::ListMail
                }
                _ => return Self::json(app, q, s, 400, &json!({ "error": "invalid" })).await,
            }
        };
        let result = self.query(owner.clone(), group, ask).await;
        self.update_hub(&owner, &result);
        let value = self.page_json(result).await;
        Self::json(app, q, s, 200, &value).await
    }

    pub fn prune(&self) {
        self.reads.prune();
        self.asks.prune();
        self.messages.prune();
        self.contacts.prune();
        self.invites.prune();
    }
}

fn friend_state(has_claim: bool, mutual: bool, asks: bool, sent: bool) -> &'static str {
    if !has_claim { "claim" }
    else if mutual { "friends" }
    else if asks { "asks" }
    else if sent { "asked" }
    else { "new" }
}

/// Clean crew and room names without applying the LAN room's display-name fallback:
/// an empty room must remain the shared/default room, not become "player".
fn tidy_invite_name(input: &str) -> String {
    let is_format = |ch: char| matches!(ch,
        '\u{00ad}' | '\u{0600}'..='\u{0605}' | '\u{061c}' | '\u{06dd}' | '\u{070f}' |
        '\u{180e}' | '\u{200b}'..='\u{200f}' | '\u{202a}'..='\u{202e}' |
        '\u{2060}'..='\u{2064}' | '\u{2066}'..='\u{206f}' | '\u{feff}' |
        '\u{fff9}'..='\u{fffb}'
    );
    let mut clean = String::with_capacity(input.len());
    for ch in input.chars() {
        if ch.is_whitespace() {
            if !clean.is_empty() && !clean.ends_with(' ') { clean.push(' '); }
        } else if !ch.is_control() && !is_format(ch) {
            clean.push(ch);
        }
    }
    clean.trim_end().to_string()
}


#[cfg(test)]
mod tests {
    use serde_json::{Value, json};

    use super::super::testkit::Kit;
    use super::tidy_invite_name;

    const A: (&str, &str) = ("Authorization", "Bearer AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    const B: (&str, &str) = ("Authorization", "Bearer BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");

    fn j(body: &[u8]) -> Value {
        serde_json::from_slice(body).unwrap()
    }

    async fn claim(kit: &Kit, who: (&str, &str), name: &str) {
        assert_eq!(
            kit.request("PUT", "/vault", &[who, ("If-None-Match", "*")], b"saves").await.status,
            201
        );
        let body = json!({ "name": name }).to_string();
        let answer = kit.request("POST", "/names", &[who, ("content-type", "application/json")], body.as_bytes()).await;
        assert_eq!(answer.status, 200, "claim {name}: {}", String::from_utf8_lossy(&answer.body));
        assert_eq!(j(&answer.body)["mine"]["name"], name);
    }

    async fn post(kit: &Kit, who: (&str, &str), value: Value) -> Value {
        let body = value.to_string();
        let answer = kit.request("POST", "/friends", &[who, ("content-type", "application/json")], body.as_bytes()).await;
        assert_eq!(answer.status, 200, "POST /friends: {}", String::from_utf8_lossy(&answer.body));
        j(&answer.body)
    }

    #[tokio::test]
    async fn friends_http_uses_the_claimed_buddy_store_and_delivers_waiting_mail_once_on_room_sync() {
        let kit = Kit::start(&["--online", "on"], |_| {}).await;

        assert_eq!(kit.request("GET", "/friends", &[], b"").await.status, 401);
        assert_eq!(
            kit.request("GET", "/friends", &[A, ("Origin", "https://evil.example")], b"").await.status,
            403
        );

        claim(&kit, A, "Alex").await;
        claim(&kit, B, "Bianca").await;

        let mine = kit.request("GET", "/friends", &[A], b"").await;
        assert_eq!(mine.status, 200);
        assert_eq!(j(&mine.body)["me"], "Alex");
        assert_eq!(j(&mine.body)["friends"], json!([]));
        assert_eq!(post(&kit, A, json!({ "op": "can", "name": "Ghost" })).await["done"], "theirs");
        assert_eq!(post(&kit, A, json!({ "op": "can", "name": "Bianca" })).await["done"], "new");

        let asked = post(&kit, A, json!({ "op": "ask", "name": "Bianca" })).await;
        assert_eq!(asked["done"], "asked");
        assert_eq!(asked["sent"], json!(["Bianca"]));

        let waiting = kit.request("GET", "/friends", &[B], b"").await;
        assert_eq!(j(&waiting.body)["asks"], json!(["Alex"]));
        assert_eq!(post(&kit, B, json!({ "op": "can", "name": "Alex" })).await["done"], "asks");
        assert_eq!(post(&kit, A, json!({ "op": "can", "name": "Bianca" })).await["done"], "asked");

        let accepted = post(&kit, B, json!({ "op": "accept", "name": "Alex" })).await;
        assert_eq!(accepted["done"], "friends");
        assert_eq!(accepted["friends"][0]["name"], "Alex");
        assert_eq!(post(&kit, A, json!({ "op": "can", "name": "Bianca" })).await["done"], "friends");

        let discord = post(&kit, B, json!({ "op": "discord", "name": "Speedy.Player" })).await;
        assert_eq!(discord["done"], "ok");
        let alex_list = kit.request("GET", "/friends", &[A], b"").await;
        assert_eq!(j(&alex_list.body)["friends"][0]["name"], "Bianca");
        assert_eq!(j(&alex_list.body)["friends"][0]["contact"], "speedy.player");

        // With both players mutually listed, an offline recipient's message is kept in the shared Buddy store.
        let message = post(&kit, A, json!({ "op": "msg", "name": "Bianca", "body": "Meet at the garage." })).await;
        assert_eq!(message["done"], "kept");

        // HEAD is metadata-only and must not take the queued message away.
        assert_eq!(kit.request("HEAD", "/friends", &[B], b"").await.status, 200);
        // The room-name sync also reads the page's mailbox, so it must deliver the message in this POST response.
        let mailbox = post(&kit, B, json!({ "op": "room", "room": "Downtown" })).await;
        assert_eq!(mailbox["mail"][0]["from"], "Alex");
        assert_eq!(mailbox["mail"][0]["body"], "Meet at the garage.");

        // A later list read does not redeliver a message that was already taken.
        let after = kit.request("GET", "/friends", &[B], b"").await;
        assert_eq!(j(&after.body)["mail"], json!([]));

        let removed = post(&kit, B, json!({ "op": "remove", "name": "Alex" })).await;
        assert_eq!(removed["done"], "ok");
        let final_list = kit.request("GET", "/friends", &[A], b"").await;
        assert_eq!(j(&final_list.body)["friends"], json!([]));
    }

    #[tokio::test]
    async fn crew_invites_require_a_mutual_friend_and_valid_crew_and_room_names() {
        let kit = Kit::start(&["--online", "on"], |_| {}).await;
        claim(&kit, A, "Alex").await;
        claim(&kit, B, "Bianca").await;

        let not_friends = post(&kit, A, json!({
            "op": "crew", "name": "Bianca", "crew": "Night Owls", "room": "Blue Room"
        })).await;
        assert_eq!(not_friends["done"], "none");

        post(&kit, A, json!({ "op": "ask", "name": "Bianca" })).await;
        post(&kit, B, json!({ "op": "accept", "name": "Alex" })).await;

        let blocked_crew = post(&kit, A, json!({
            "op": "crew", "name": "Bianca", "crew": "x_fag_x", "room": ""
        })).await;
        assert_eq!(blocked_crew["done"], "name");

        let long_crew = post(&kit, A, json!({
            "op": "crew", "name": "Bianca", "crew": "x".repeat(25), "room": ""
        })).await;
        assert_eq!(long_crew["done"], "name");

        let long_room = post(&kit, A, json!({
            "op": "crew", "name": "Bianca", "crew": "Night Owls", "room": "x".repeat(64)
        })).await;
        assert_eq!(long_room["done"], "name");

        // A valid mutual invite without an active Free Roam page must not be delivered.
        let away = post(&kit, A, json!({
            "op": "crew", "name": "Bianca", "crew": "  Night   Owls ", "room": "Blue  Room"
        })).await;
        assert_eq!(away["done"], "away");
    }

    #[test]
    fn friend_state_prioritizes_claim_and_mutual_relationships() {
        assert_eq!(super::friend_state(false, true, true, true), "claim");
        assert_eq!(super::friend_state(true, true, true, true), "friends");
        assert_eq!(super::friend_state(true, false, true, true), "asks");
        assert_eq!(super::friend_state(true, false, false, true), "asked");
        assert_eq!(super::friend_state(true, false, false, false), "new");
    }

    #[test]
    fn crew_invite_names_strip_format_controls_and_preserve_the_empty_default_room() {
        assert_eq!(tidy_invite_name("  Night\u{200b}   Owls "), "Night Owls");
        assert_eq!(tidy_invite_name("Blue\nRoom"), "Blue Room");
        assert_eq!(tidy_invite_name("   "), "");
    }

}
