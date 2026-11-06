//! The start page's friend-list API. It uses EA Messenger's existing per-persona lists;
//! no duplicate friend database is introduced here. Live free-roam location and invitations are
//! deliberately handled by a later hub/LAN integration step.

use std::sync::Arc;

use nfsu2_claims::{Claims, owner_of_token};
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
    reads: Rate,
    asks: Rate,
    messages: Rate,
    contacts: Rate,
}

impl FriendsRoute {
    pub fn new(online: Arc<OnlineHost>, claims: Arc<Claims>) -> FriendsRoute {
        FriendsRoute {
            online,
            claims,
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

    fn page_json(r: FriendReply) -> Value {
        let friends: Vec<Value> = r.friends.into_iter().map(|f| {
            let mut row = serde_json::Map::new();
            row.insert("name".into(), f.name.into());
            row.insert("where".into(), if f.mutual && f.online { "online" } else { "" }.into());
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
                _ => return Self::json(app, q, s, 400, &json!({ "error": "invalid" })).await,
            }
        };
        let result = self.query(owner, group, ask).await;
        let value = Self::page_json(result);
        Self::json(app, q, s, 200, &value).await
    }

    pub fn prune(&self) {
        self.reads.prune();
        self.asks.prune();
        self.messages.prune();
        self.contacts.prune();
    }
}
