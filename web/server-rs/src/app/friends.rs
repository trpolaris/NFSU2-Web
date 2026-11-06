//! The start page's friend-list API. It uses EA Messenger's existing per-persona lists;
//! no duplicate friend database is introduced here. Live free-roam location and invitations are
//! deliberately handled by a later hub/LAN integration step.

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

    async fn query(&self, owner: Arc<str>, group: Arc<str>, ask: FriendAsk) -> FriendReply {
        self.online.friends(owner, group, ask).await.unwrap_or_default()
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
                Some("room") => {
                    let room: String = b.get("room").and_then(Value::as_str).unwrap_or("")
                        .chars().filter(|c| !c.is_control()).take(64).collect();
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
    }
}


#[cfg(test)]
mod tests {
    use serde_json::{Value, json};

    use super::super::testkit::Kit;

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
    async fn friends_http_uses_the_claimed_buddy_store_and_keeps_waiting_mail_until_get() {
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

        let asked = post(&kit, A, json!({ "op": "ask", "name": "Bianca" })).await;
        assert_eq!(asked["done"], "asked");
        assert_eq!(asked["sent"], json!(["Bianca"]));

        let waiting = kit.request("GET", "/friends", &[B], b"").await;
        assert_eq!(j(&waiting.body)["asks"], json!(["Alex"]));

        let accepted = post(&kit, B, json!({ "op": "accept", "name": "Alex" })).await;
        assert_eq!(accepted["done"], "friends");
        assert_eq!(accepted["friends"][0]["name"], "Alex");

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
        let mailbox = kit.request("GET", "/friends", &[B], b"").await;
        assert_eq!(j(&mailbox.body)["mail"][0]["from"], "Alex");
        assert_eq!(j(&mailbox.body)["mail"][0]["body"], "Meet at the garage.");

        // A later list read does not redeliver a message that was already taken.
        let after = kit.request("GET", "/friends", &[B], b"").await;
        assert_eq!(j(&after.body)["mail"], json!([]));

        let removed = post(&kit, B, json!({ "op": "remove", "name": "Alex" })).await;
        assert_eq!(removed["done"], "ok");
        let final_list = kit.request("GET", "/friends", &[A], b"").await;
        assert_eq!(j(&final_list.body)["friends"], json!([]));
    }
}
