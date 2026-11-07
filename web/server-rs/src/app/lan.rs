//! /lan: the WebSocket upgrade to the virtual LAN switch, every check in its order, and every refusal the same raw
//! answer with this server's headers.  A malformed Sec-WebSocket-Protocol is our 400 too (the Node server's ws library
//! refused it with an answer of its own, which had none of the security headers and named the library).

use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll};
use std::time::Duration;

use tokio::io::{AsyncRead, AsyncWrite, AsyncWriteExt, ReadBuf};

use nfsu2_headers::Cache;
use nfsu2_http::{Hold, Request, Response, Upgraded};
use nfsu2_lan::AttachOpts;
use nfsu2_util::{js, log, vip_str};

use super::{App, Res, Share, finish, send, url};

/// One half of a /lan connection, holding the client's share of the /lan budget and the connection's own shares (the
/// per-client connection budget, the listener's count: nfsu2_http::Hold): given back once both halves are gone (the
/// connection closed).
pub struct Held<T> {
    inner: T,
    _share: Arc<(Share, Hold)>,
}

impl<T: AsyncRead + Unpin> AsyncRead for Held<T> {
    fn poll_read(self: Pin<&mut Self>, cx: &mut Context<'_>, buf: &mut ReadBuf<'_>) -> Poll<std::io::Result<()>> {
        Pin::new(&mut self.get_mut().inner).poll_read(cx, buf)
    }
}

impl<T: AsyncWrite + Unpin> AsyncWrite for Held<T> {
    fn poll_write(self: Pin<&mut Self>, cx: &mut Context<'_>, buf: &[u8]) -> Poll<std::io::Result<usize>> {
        Pin::new(&mut self.get_mut().inner).poll_write(cx, buf)
    }
    fn poll_write_vectored(self: Pin<&mut Self>, cx: &mut Context<'_>, bufs: &[std::io::IoSlice<'_>]) -> Poll<std::io::Result<usize>> {
        Pin::new(&mut self.get_mut().inner).poll_write_vectored(cx, bufs)
    }
    fn is_write_vectored(&self) -> bool {
        self.inner.is_write_vectored()
    }
    fn poll_flush(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<std::io::Result<()>> {
        Pin::new(&mut self.get_mut().inner).poll_flush(cx)
    }
    fn poll_shutdown(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<std::io::Result<()>> {
        Pin::new(&mut self.get_mut().inner).poll_shutdown(cx)
    }
}

/// how long the 101 may take to go out: the time any answer has to move (the progress rule's 20 s)
const HANDSHAKE_MOVES: Duration = Duration::from_secs(20);

/// The 101 written, within `within`.  The connection is neither the engine's (its timers stopped at the upgrade) nor
/// the switch's yet (its rules for a client that does not read start once it is attached), so a client that takes
/// nothing (its connection's buffers full of answers it never read) held its /lan share, its connection and the
/// socket here for good.  Node's ws queued the 101 without waiting, and the switch's keepalive cut such a client.
async fn handshake<S: AsyncWrite + Unpin>(stream: &mut S, answer: &[u8], within: Duration) -> bool {
    let write = async {
        stream.write_all(answer).await?;
        stream.flush().await
    };
    matches!(tokio::time::timeout(within, write).await, Ok(Ok(())))
}

/// `/^[+/0-9A-Za-z]{22}==$/`
fn ws_key(k: &str) -> bool {
    let b = k.as_bytes();
    b.len() == 24 && b[..22].iter().all(|&c| c.is_ascii_alphanumeric() || c == b'+' || c == b'/') && &b[22..] == b"=="
}

impl App {
    /// GET /lan without a WebSocket upgrade: reports which upgrade check would reject this client,
    /// without consuming a connection share or a rate-limit token.
    pub(crate) async fn send_lan_check(&self, q: &Request, s: &mut Response) -> Res {
        let (_, key, site) = self.client(q);
        let status = if !self.own_page(q) {
            "page"
        } else if !self.lan_conns.room(&key, &site) {
            "busy"
        } else if !self.lan_opens.check(&key, &site) {
            "fast"
        } else {
            "ok"
        };
        let body = format!(r#"{{"lan":"{status}"}}"#);
        let mut h = self.headers(q, Cache::Store, true);
        h.set("content-type", "application/json");
        h.set("content-length", body.len().to_string());
        s.head(200, h.0);
        if q.method != "HEAD" {
            send(s, body.as_bytes()).await?;
        }
        finish(s).await
    }

    /// the raw answer for code, then the connection goes (nfsu2_http::raw_refusal)
    async fn refuse(&self, up: Upgraded, code: u16) {
        nfsu2_http::raw_refusal(up.stream, self.raw_response(code)).await;
    }

    /// An upgrade: the target, the Host, the path, the handshake, the Origin, the client's /lan connections and how
    /// fast it opens them, the subprotocols, in that order; then the 101, and the connection to the switch.
    pub async fn on_upgrade(&self, q: Request, up: Upgraded) {
        let Some(u) = url::parse_target(&q.url) else { return self.refuse(up, 400).await };
        if !self.own_host(&q) {
            return self.refuse(up, 421).await;
        }
        if u.pathname != "/lan" {
            return self.refuse(up, 404).await;
        }
        // a WebSocket handshake, checked here so that every refusal looks the same
        let key = q.headers.get("sec-websocket-key").unwrap_or("");
        let upgrade = q.headers.get("upgrade").is_some_and(|v| v.to_lowercase() == "websocket");
        if q.method != "GET" || !upgrade || q.headers.get("sec-websocket-version") != Some("13") || !ws_key(key) {
            return self.refuse(up, 400).await;
        }
        // only this server's own pages (a page of another site must not join the LAN through a player's browser);
        // clients without an Origin header (tools) may
        if !self.own_page(&q) {
            return self.refuse(up, 403).await;
        }
        // the console names players by their virtual address and nickname, never by their real address (a VPS's
        // journal keeps it); --access-log is the one opt-in that records addresses
        let (_, key_, site) = self.client(&q);
        let Some(share) = Share::take(&self.lan_conns, &key_, &site) else {
            let line = format!("[lan] refused a connection: {} already open from that address", self.lan_conns.held(&key_));
            log::limited("lan", "refused connections", &key_, &line, 2);
            return self.refuse(up, 429).await;
        };
        if !self.lan_opens.take(&key_, &site) {
            log::limited("lan", "refused connections", &key_, "[lan] refused a connection: that address opens them too fast", 2);
            self.refuse(up, 429).await;
            drop(share);
            return;
        }
        // the subprotocols (a malformed list: 400), last, where the Node server's ws library checked them
        let Ok(protocol) = nfsu2_ws::pick_protocol(q.headers.get("sec-websocket-protocol")) else {
            self.refuse(up, 400).await;
            drop(share);
            return;
        };
        let answer = nfsu2_ws::handshake_response(key, protocol.as_deref());
        let Upgraded { mut stream, pre, hold } = up;
        if !handshake(&mut stream, &answer, HANDSHAKE_MOVES).await {
            return;
        }
        if self.lan_sndbuf > 0 {
            let _ = stream.set_send_buffer(self.lan_sndbuf);
        }
        let (r, w) = stream.split();
        let share = Arc::new((share, hold));
        // the operator's bans (control.rs): by the address's keyed hash now, by its page's id at its hello
        let ident = (!key_.is_empty()).then(|| self.bans.addr(&key_));
        let refuse = ident.as_ref().and_then(|a| self.bans.by_addr(a, nfsu2_util::now_ms())).map(|b| {
            log::limited(
                "ban",
                "turned away",
                &key_,
                &format!("[ban] turned away a client of ban #{} \"{}\" (its address)", b.id, b.name),
                2,
            );
            bytes::Bytes::from(b.message())
        });
        let (bans, a, k0) = (self.bans.clone(), ident.clone(), key_.clone());
        let on_hello: nfsu2_lan::OnHello = Box::new(move |id| {
            let b = bans.by_page(id, a.as_deref(), nfsu2_util::now_ms())?;
            log::limited("ban", "turned away", &k0, &format!("[ban] turned away a client of ban #{} \"{}\" (its page)", b.id, b.name), 2);
            Some(bytes::Bytes::from(b.message()))
        });
        // a reconnecting page says ?resume and sends its old address with the token in its first message (nfsu2-lan);
        // the group and site ids stand for the client's address without naming it (the shared limits)
        let (k1, k2) = (key_.clone(), key_.clone());
        let opts = AttachOpts {
            resume: u.has_param("resume"),
            // a page that can wait in line when every place is taken (nfsu2-lan queue.rs)
            queue: u.has_param("queue"),
            group: Some(self.group_id(&key_)),
            site: (!site.is_empty()).then(|| self.group_id(&format!("site {site}"))),
            on_join: Some(Box::new(move |vip, resumed, n| {
                let line = format!("[lan] {} {} ({n} on the switch)", vip_str(vip), if resumed { "is back" } else { "joined" });
                log::limited("lan", "joins and leaves", &k1, &line, 20);
            })),
            on_leave: Some(Box::new(move |vip, name, n| {
                let line = format!("[lan] {} \"{}\" left ({n} on the switch)", vip_str(vip), js::printable(name, 32));
                log::limited("lan", "joins and leaves", &k2, &line, 20);
            })),
            ident,
            refuse,
            on_hello: Some(on_hello),
            // the keyphrase the page plays with, for the claimed names (names.rs): its owner, never the token
            on_claim: self.names.as_ref().map(|_| Box::new(nfsu2_claims::owner_of_token) as nfsu2_lan::OnClaim),
        };
        self.lan.attach(Held { inner: r, _share: share.clone() }, Held { inner: w, _share: share }, pre, opts);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Open a WebSocket as a client behind the test server's trusted local proxy.
    async fn upgrade(kit: &super::super::testkit::Kit, ip: &str) -> (tokio::net::TcpStream, u16) {
        use tokio::io::AsyncReadExt;
        let mut stream = tokio::net::TcpStream::connect(kit.addr).await.unwrap();
        let request = format!(
            "GET /lan HTTP/1.1\\r\\nHost: localhost\\r\\nUpgrade: websocket\\r\\nConnection: Upgrade\\r\\nX-Forwarded-For: {ip}\\r\\n\\
             Sec-WebSocket-Version: 13\\r\\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\\r\\n\\r\\n"
        );
        stream.write_all(request.as_bytes()).await.unwrap();
        let mut bytes = [0u8; 64];
        let n = stream.read(&mut bytes).await.unwrap();
        let status = std::str::from_utf8(&bytes[9..12.min(n)]).unwrap_or("0").parse().unwrap_or(0);
        (stream, status)
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn lan_preflight_reports_the_existing_upgrade_checks_without_taking_capacity() {
        let kit = super::super::testkit::Kit::start(&["--trusted-proxies", "127.0.0.1"], |_| {}).await;
        let ask = async |ip: &str, origin: Option<&str>| {
            let mut headers = vec![("X-Forwarded-For", ip)];
            headers.extend(origin.map(|value| ("Origin", value)));
            let response = kit.get("/lan?check", &headers).await;
            assert_eq!((response.status, response.header("content-type")), (200, Some("application/json")));
            assert!(response.header("cache-control").is_some_and(|value| value.contains("no-store")));
            String::from_utf8(response.body).unwrap()
        };
        let (a, b) = ("203.0.113.7", "203.0.113.8");
        assert_eq!(ask(a, None).await, r#"{"lan":"ok"}"#);
        let mut held = Vec::new();
        for _ in 0..super::super::limits::WS_PER_ADDRESS {
            let (stream, status) = upgrade(&kit, a).await;
            assert_eq!(status, 101);
            held.push(stream);
        }
        assert_eq!(upgrade(&kit, a).await.1, 429);
        assert_eq!(ask(a, None).await, r#"{"lan":"busy"}"#);
        assert_eq!(ask(b, None).await, r#"{"lan":"ok"}"#);
        assert_eq!(kit.app.lan_conns.count(), held.len(), "preflight must take no connection share");
        drop(held.pop());
        super::super::testkit::eventually("a share back", || kit.app.lan_conns.count() == held.len()).await;
        assert_eq!(ask(a, Some("http://localhost")).await, r#"{"lan":"ok"}"#);
        assert_eq!(ask(a, Some("https://elsewhere.example")).await, r#"{"lan":"page"}"#);

        let c = "203.0.113.9";
        for _ in 0..super::super::limits::LAN_OPEN_BURST as usize {
            let (stream, status) = upgrade(&kit, c).await;
            assert_eq!(status, 101);
            drop(stream);
            super::super::testkit::eventually("its share back", || kit.app.lan_conns.held(c) == 0).await;
        }
        assert_eq!(ask(c, None).await, r#"{"lan":"fast"}"#);
        assert_eq!(upgrade(&kit, c).await.1, 429, "the next upgrade meets the same rate limit");
    }

    // A client whose connection takes nothing more (its buffers full of answers it never read) when its 101 is due:
    // let go once the time is up, not waited on for good.  One that reads gets it at once.
    #[tokio::test]
    async fn a_handshake_nobody_takes_is_given_up() {
        let l = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let client = tokio::net::TcpSocket::new_v4().unwrap();
        client.set_recv_buffer_size(4096).unwrap();
        let client = client.connect(l.local_addr().unwrap()).await.unwrap();
        let (mut server, _) = l.accept().await.unwrap();
        // the send buffer filled while the client reads nothing
        let chunk = vec![0u8; 64 << 10];
        loop {
            match server.try_write(&chunk) {
                Ok(_) => {}
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    // (once more after a moment: the kernel moves what it can into the client's window)
                    tokio::time::sleep(Duration::from_millis(50)).await;
                    if server.try_write(&chunk).is_err() {
                        break;
                    }
                }
                Err(e) => panic!("{e}"),
            }
        }
        let t0 = std::time::Instant::now();
        assert!(!handshake(&mut server, b"HTTP/1.1 101 Switching Protocols\r\n\r\n", Duration::from_millis(300)).await);
        assert!(t0.elapsed() < Duration::from_secs(2));
        drop(client);
        // and one that reads
        let client = tokio::net::TcpStream::connect(l.local_addr().unwrap()).await.unwrap();
        let (mut server, _) = l.accept().await.unwrap();
        assert!(handshake(&mut server, b"HTTP/1.1 101 Switching Protocols\r\n\r\n", Duration::from_millis(300)).await);
        drop(client);
    }

    #[test]
    fn websocket_keys() {
        assert!(ws_key("dGhlIHNhbXBsZSBub25jZQ=="));
        assert!(ws_key("+/+/+/+/+/+/+/+/+/+/+/=="));
        assert!(!ws_key("nope"));
        assert!(!ws_key("dGhlIHNhbXBsZSBub25jZQ="));
        assert!(!ws_key("dGhlIHNhbXBsZSBub25jZQ==x"));
        assert!(!ws_key("dGhlIHNhbXBsZSBub25jZ-=="));
    }
}
