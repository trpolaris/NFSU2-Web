import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bell, BellDot, Hash, MessageCircle, Search, Send, Volume2, VolumeX, X } from 'lucide-react';

const QUICK = ['Selam!', 'GG!', 'Yoldayım', 'Hazırım'];
const BUS_NAME = 'trpolaris.nfsu2.chat.v1';
const timeLabel = timestamp => new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));

function App() {
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [crews, setCrews] = useState([]);
  const [channel, setChannel] = useState('room');
  const [searchOpen, setSearchOpen] = useState(true);
  const [search, setSearch] = useState('');
  const [input, setInput] = useState('');
  const [notifications, setNotifications] = useState(true);
  const [sound, setSound] = useState(true);
  const [notice, setNotice] = useState('Oyun sekmesi bekleniyor…');
  const endRef = useRef(null);
  const busRef = useRef(null);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') {
      setNotice('Bu tarayıcı ayrı sohbet penceresi bağlantısını desteklemiyor.');
      return undefined;
    }
    const bus = new BroadcastChannel(BUS_NAME);
    busRef.current = bus;
    bus.addEventListener('message', event => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'snapshot') {
        setConnected(!!data.connected);
        setMessages(Array.isArray(data.messages) ? data.messages.slice(-200) : []);
        setCrews(Array.isArray(data.channels) ? data.channels : []);
        setNotice(data.connected ? 'OYUN OTURUMUNA BAĞLI' : 'OYUN OTURUMU BEKLENİYOR');
      }
      if (data.type === 'message' && data.message && typeof data.message === 'object') {
        setMessages(previous => [...previous, data.message].slice(-200));
      }
      if (data.type === 'send-result') setNotice(data.message || (data.ok ? 'Mesaj gönderildi.' : 'Mesaj gönderilemedi.'));
    });
    bus.postMessage({ type: 'hello' });
    return () => { bus.close(); busRef.current = null; };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages]);

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('tr-TR');
    return messages.filter(item => {
      const text = [item.user, item.msg, item.channel].join(' ').toLocaleLowerCase('tr-TR');
      const matches = !query || text.includes(query);
      const channelMatches = channel === 'room' ? item.channel !== 'EKİP'
        : channel === 'crew' ? item.channel === 'EKİP' : item.channel === 'OOC';
      return matches && channelMatches;
    });
  }, [messages, search, channel]);

  const send = text => {
    const clean = String(text ?? '').trim();
    if (!clean) return;
    if (channel === 'ooc') {
      setNotice('OOC kanalı mevcut Rust sohbet protokolünde henüz desteklenmiyor.');
      return;
    }
    busRef.current?.postMessage({ type: 'send', channel, text: clean });
    setInput('');
  };

  const closeWindow = () => {
    window.close();
    window.setTimeout(() => { if (!window.closed) window.location.href = '/hub/'; }, 120);
  };

  return (
    <main className="relative flex h-dvh min-h-0 w-full items-center justify-center overflow-hidden bg-[#03060b] p-2 font-sans text-white sm:p-4">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_18%_90%,rgba(56,189,248,.09),transparent_38%),radial-gradient(ellipse_at_85%_8%,rgba(124,58,237,.10),transparent_42%),linear-gradient(135deg,#05080d_0%,#0b111b_48%,#020407_100%)]" />
      <div className="relative z-10 flex h-[min(820px,calc(100dvh-16px))] min-h-0 w-full max-w-[680px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b1019]/95 shadow-[0_22px_70px_rgba(0,0,0,.65)] backdrop-blur-2xl sm:h-[min(820px,calc(100dvh-32px))]">
        <header className="shrink-0 border-b border-white/[0.08] px-3 pb-3 pt-3 sm:px-4 sm:pt-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-300/20 bg-sky-300/10 text-sky-200"><MessageCircle size={17} /></div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-[12px] font-black tracking-[0.16em] text-white sm:text-sm">POLARIS CHAT</h1>
                  <span className={'hidden items-center gap-1 rounded-full border px-2 py-0.5 text-[8px] font-bold tracking-wider sm:inline-flex ' + (connected ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200' : 'border-amber-300/20 bg-amber-300/10 text-amber-100')}>
                    <span className={'h-1.5 w-1.5 rounded-full ' + (connected ? 'bg-emerald-300' : 'bg-amber-300')} />{connected ? 'BAĞLI' : 'OTURUM BEKLENİYOR'}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[9px] tracking-wide text-zinc-500">BAYVIEW • CANLI İLETİŞİM</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button type="button" onClick={() => setNotifications(v => !v)} aria-label="Bildirimleri değiştir" aria-pressed={notifications} className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-zinc-300 hover:bg-white/[0.08]">
                {notifications ? <BellDot size={16} /> : <Bell size={16} />}{notifications && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-sky-300" />}
              </button>
              <button type="button" onClick={() => setSearchOpen(v => !v)} aria-expanded={searchOpen} className={'flex h-9 items-center gap-2 rounded-xl border px-3 text-[10px] font-bold ' + (searchOpen ? 'border-sky-300/35 bg-sky-300/10 text-sky-100' : 'border-white/10 bg-white/[0.035] text-zinc-300')}>
                <Search size={14} /><span className="hidden sm:inline">ARA</span>
              </button>
              <button type="button" onClick={() => setSound(v => !v)} aria-label="Sesleri değiştir" aria-pressed={sound} className="hidden h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-zinc-300 hover:bg-white/[0.08] sm:flex">{sound ? <Volume2 size={15} /> : <VolumeX size={15} />}</button>
              <button type="button" onClick={closeWindow} aria-label="Sohbet penceresini kapat" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-zinc-300 hover:border-rose-300/25 hover:bg-rose-300/10 hover:text-rose-200"><X size={16} /></button>
            </div>
          </div>
          {searchOpen && <div className="mt-3 flex h-10 items-center gap-2 rounded-lg border border-white/[0.08] bg-black/20 px-3"><Search size={14} className="text-zinc-500" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Sohbette ara…" className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-zinc-600" /><button type="button" onClick={() => setSearch('')} className="text-[9px] text-zinc-600">TEMİZLE</button></div>}
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <button type="button" onClick={() => setChannel('room')} className={'rounded-lg border px-3 py-2 text-[9px] font-bold ' + (channel === 'room' ? 'border-sky-300/30 bg-sky-300/10 text-sky-100' : 'border-white/[0.08] bg-white/[0.025] text-zinc-500 hover:text-zinc-200')}>GENEL</button>
              <button type="button" disabled={!crews.length} onClick={() => setChannel('crew')} className={'rounded-lg border px-3 py-2 text-[9px] font-bold ' + (channel === 'crew' ? 'border-sky-300/30 bg-sky-300/10 text-sky-100' : crews.length ? 'border-white/[0.08] bg-white/[0.025] text-zinc-500 hover:text-zinc-200' : 'border-white/[0.04] bg-white/[0.01] text-zinc-700')}>EKİP</button>
              <button type="button" onClick={() => setChannel('ooc')} className={'rounded-lg border px-3 py-2 text-[9px] font-bold ' + (channel === 'ooc' ? 'border-sky-300/30 bg-sky-300/10 text-sky-100' : 'border-white/[0.08] bg-white/[0.025] text-zinc-500 hover:text-zinc-200')}>OOC</button>
            </div>
            <span className="shrink-0 text-[8px] text-zinc-600">{channel === 'room' ? 'GENEL KANAL' : channel === 'crew' ? 'EKİP KANALI' : 'OOC KAPALI'}</span>
          </div>
        </header>

        <section className="relative min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
          {visible.length ? <div className="flex min-h-full flex-col gap-2">
            {visible.map(item => <article key={item.id} className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2">
              <div className="mb-1 flex min-w-0 items-center gap-1.5 text-[9px]">
                <span className={'shrink-0 rounded-md border px-1.5 py-0.5 text-[8px] font-extrabold ' + (item.channel === 'EKİP' ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : item.channel === 'SİSTEM' ? 'border-violet-300/20 bg-violet-300/10 text-violet-200' : 'border-white/10 bg-white/5 text-zinc-300')}>{item.channel}</span>
                <strong className="min-w-0 truncate text-zinc-200">{item.user}</strong>
                <time className="ml-auto shrink-0 font-mono text-[8px] text-zinc-600">{item.time || timeLabel(item.timestamp)}</time>
              </div>
              <p className="break-words text-[11px] leading-relaxed text-zinc-300">{item.msg}</p>
            </article>)}
            <div ref={endRef} />
          </div> : <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-white/[0.015] px-4 text-center">
            <Search size={20} className="text-zinc-600" />
            <p className="mt-3 text-[10px] font-semibold text-zinc-400">{search ? 'Eşleşen mesaj bulunamadı' : 'Henüz mesaj bulunamadı'}</p>
            <p className="mt-1 max-w-xs text-[9px] text-zinc-600">{search ? 'Arama kelimesini değiştirebilirsin.' : connected ? 'İlk mesaj geldiğinde burada görünecek.' : 'Oyunu ana sekmede açıp çevrimiçi serbest dolaşıma gir.'}</p>
          </div>}
        </section>

        <footer className="shrink-0 border-t border-white/[0.08] bg-black/15 px-3 pb-3 pt-3 sm:px-4">
          <div className="mb-2 flex items-center justify-between gap-2"><span className="text-[9px] text-zinc-500">Hızlı mesaj</span><span className="truncate text-right text-[8px] text-zinc-600">{notice}</span></div>
          <div className="mb-2 flex flex-wrap gap-1.5">{QUICK.map(text => <button key={text} type="button" onClick={() => send(text)} className="rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-2 text-[10px] text-zinc-300 hover:border-sky-300/25 hover:bg-sky-300/10 hover:text-sky-100">{text}</button>)}</div>
          <form onSubmit={event => { event.preventDefault(); send(input); }} className="flex min-w-0 items-center gap-2 rounded-xl border border-white/15 bg-[#080d16] p-1.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-300/20 bg-sky-300/10 text-sky-200"><Hash size={14} /></span>
            <input value={input} onChange={event => setInput(event.target.value)} placeholder="Mesaj yaz veya / ile komut ara…" className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-zinc-600" />
            <button type="submit" aria-label="Mesaj gönder" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-300 to-cyan-200 text-[#07131b]"><Send size={14} /></button>
          </form>
          <div className="mt-1.5 flex items-center justify-between text-[7px] font-semibold tracking-wide text-zinc-700"><span>ENTER İLE GÖNDER</span><span className="flex items-center gap-1"><span className={'h-1.5 w-1.5 rounded-full ' + (connected ? 'bg-emerald-300' : 'bg-amber-300')} />{connected ? 'OYUN OTURUMUNA BAĞLI' : 'OYUN SEKME BAĞLANTISI BEKLENİYOR'}</span></div>
        </footer>
      </div>
    </main>
  );
}

createRoot(document.getElementById('live-chat-root')).render(<App />);
