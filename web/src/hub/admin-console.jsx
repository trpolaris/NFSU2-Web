import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity, AlertTriangle, ArrowRight, Bell, CarFront, CheckCircle2,
  ChevronRight, CircleHelp, Clock3, Gauge, LayoutDashboard, LifeBuoy,
  MapPinned, Menu, RadioTower, RefreshCw, Search, Settings, ShieldAlert,
  ShieldCheck, Ticket, Users, Wallet, X,
} from 'lucide-react';

const NAV = [
  { group: 'GENEL', items: [
    { id: 'overview', label: 'Genel bakış', Icon: LayoutDashboard },
    { id: 'players', label: 'Oyuncular', Icon: Users },
    { id: 'map', label: 'Canlı harita', Icon: MapPinned },
  ]},
  { group: 'YÖNETİM', items: [
    { id: 'vehicles', label: 'Araç yönetimi', Icon: CarFront },
    { id: 'moderation', label: 'Moderasyon', Icon: ShieldAlert },
    { id: 'tickets', label: 'Destek talepleri', Icon: Ticket },
  ]},
  { group: 'SİSTEM', items: [
    { id: 'analytics', label: 'Analitik', Icon: Activity },
    { id: 'settings', label: 'Ayarlar', Icon: Settings },
  ]},
];

const TITLES = {
  overview: ['KOMUTA MERKEZİ', 'Genel bakış', 'Sunucu durumunu ve bağlı oyuncuları tek ekrandan görüntüle.'],
  players: ['TOPLULUK', 'Oyuncular', 'Rust sunucusuna bağlı gerçek oyuncu oturumları.'],
  map: ['KONUM & RADAR', 'Canlı harita', 'Konum telemetrisi sunucu API’sine henüz bağlanmadı.'],
  vehicles: ['GARAJ OPERASYONLARI', 'Araç yönetimi', 'Araç envanteri ve oyun içi telemetri entegrasyonu bekleniyor.'],
  moderation: ['GÜVENLİ TOPLULUK', 'Moderasyon', 'Yetkili moderasyon endpoint’i bulunmadığından işlemler salt okunur.'],
  tickets: ['OYUNCU DESTEĞİ', 'Destek talepleri', 'Destek kuyruğu API bağlantısı bekleniyor.'],
  analytics: ['PERFORMANS', 'Analitik', 'Ekonomi ve performans telemetrisi henüz sağlanmıyor.'],
  settings: ['YAPILANDIRMA', 'Ayarlar', 'Yönetim API’si ve rol sistemi bağlandığında etkinleştirilecek.'],
};

function duration(seconds = 0) {
  const value = Math.max(0, Number(seconds) || 0);
  if (value < 60) return Math.floor(value) + ' sn';
  if (value < 3600) return Math.floor(value / 60) + ' dk';
  return Math.floor(value / 3600) + ' sa ' + Math.floor((value % 3600) / 60) + ' dk';
}

function initials(name = 'TP') {
  return String(name).trim().split(/\\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'TP';
}

function Metric({ label, value, detail, Icon, live = false }) {
  return (
    <motion.article whileHover={{ y: -2 }} className="rounded-xl border border-white/[0.08] bg-[#11151d]/90 p-4 shadow-[0_8px_28px_rgba(0,0,0,.16)]">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[10px] font-semibold text-zinc-500">{label}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-200/15 bg-amber-200/[0.07] text-amber-100"><Icon size={17} /></span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <strong className="text-2xl font-black tracking-tight text-white sm:text-[28px]">{value}</strong>
        {live && <span className="mb-1 text-[8px] font-black tracking-wider text-emerald-300">CANLI</span>}
      </div>
      <p className="mt-1 text-[9px] text-zinc-600">{detail}</p>
    </motion.article>
  );
}

function StatePill({ activity }) {
  const label = activity === 'free-roam' ? 'Serbest dolaşım'
    : activity === 'online' ? 'Online'
    : activity === 'lan' ? 'LAN'
    : activity === 'menus' ? 'Menüde'
    : 'Bağlı';
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-2 py-1 text-[8px] font-bold text-emerald-200"><i className="h-1.5 w-1.5 rounded-full bg-emerald-300" />{label}</span>;
}

function EmptyModule({ Icon, title, text }) {
  return (
    <section className="flex min-h-[330px] flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#11151d]/75 p-7 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200/15 bg-amber-100/[0.06] text-amber-100"><Icon size={25} /></span>
      <h2 className="text-sm font-black text-white">{title}</h2>
      <p className="mt-2 max-w-md text-[10px] leading-relaxed text-zinc-500">{text}</p>
      <span className="mt-5 rounded-md border border-amber-200/15 bg-amber-100/[0.04] px-3 py-1.5 text-[8px] font-black tracking-wider text-amber-100">API BAĞLANTISI BEKLENİYOR</span>
    </section>
  );
}

export default function AdminConsole({ players = [], counts = null, loading = false, onRefresh = () => {} }) {
  const [section, setSection] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const online = Number(counts?.players ?? players.length);
  const apiConnected = counts !== null;
  const title = TITLES[section] || TITLES.overview;
  const filtered = useMemo(() => players.filter((player) =>
    String(player.name || '').toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR'))
  ), [players, search]);
  const showInfo = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  };
  const choose = (id) => { setSection(id); setMobileOpen(false); };

  return (
    <main className="relative flex min-h-screen w-full overflow-hidden bg-[#080a0f] text-zinc-200">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_5%_0%,rgba(197,158,88,.10),transparent_32%),radial-gradient(ellipse_at_100%_80%,rgba(59,130,246,.06),transparent_36%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.10] [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:44px_44px]" />

      <aside className={'relative z-30 flex w-[246px] shrink-0 flex-col border-r border-white/[0.07] bg-[#0a0d13]/95 backdrop-blur-2xl max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:transition-transform ' + (mobileOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full')}>
        <div className="flex h-[76px] items-center gap-3 border-b border-white/[0.07] px-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200/20 bg-amber-200/[0.08] text-amber-100"><ShieldCheck size={20} /></span>
          <div><div className="text-[12px] font-black tracking-[0.17em] text-white">TRPOLARIS</div><div className="mt-1 text-[8px] font-bold tracking-[0.18em] text-zinc-600">ADMIN CONSOLE</div></div>
        </div>
        <div className="mx-4 mt-4 rounded-xl border border-amber-200/15 bg-amber-100/[0.045] p-3">
          <div className="flex items-center gap-2 text-[8px] font-black tracking-[0.14em] text-amber-100"><span className="h-1.5 w-1.5 rounded-full bg-amber-200" /> CANLI VERİ / SALT OKUNUR</div>
          <p className="mt-1.5 text-[9px] leading-relaxed text-zinc-500">Oyuncu listesi Rust sunucusundan alınır. Yönetim komutları için yetki API’si henüz bağlı değil.</p>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
          {NAV.map((group) => <div key={group.group}>
            <div className="mb-2 px-3 text-[8px] font-black tracking-[0.18em] text-zinc-700">{group.group}</div>
            <div className="space-y-1">{group.items.map(({ id, label, Icon }) => (
              <button key={id} type="button" onClick={() => choose(id)} className={'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-[10px] font-semibold transition ' + (section === id ? 'border-amber-200/15 bg-amber-100/[0.07] text-amber-100 shadow-[inset_2px_0_0_rgba(226,190,119,.9)]' : 'border-transparent text-zinc-500 hover:bg-white/[0.035] hover:text-zinc-200')}>
                <Icon size={15} />{label}{section === id && <ChevronRight size={13} className="ml-auto" />}
              </button>
            ))}</div>
          </div>)}
        </nav>
        <div className="border-t border-white/[0.07] p-4">
          <div className="flex items-center gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-amber-700 text-[9px] font-black text-[#14100a]">TP</div><div className="min-w-0 flex-1"><div className="truncate text-[10px] font-bold text-white">TRPOLARIS</div><div className="mt-0.5 text-[8px] text-zinc-600">Kontrol merkezi</div></div><button type="button" onClick={() => showInfo('Yönetici rol ve denetim API’si henüz bağlanmadı.')} aria-label="Yetki bilgisi"><CircleHelp size={15} className="text-zinc-600" /></button></div>
        </div>
      </aside>

      <section className="relative z-10 flex min-w-0 flex-1 flex-col lg:ml-0">
        <header className="flex h-[66px] shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] bg-[#0a0d13]/70 px-3 backdrop-blur-xl sm:px-5 lg:h-[76px] lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setMobileOpen((v) => !v)} aria-label="Menüyü aç" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-zinc-300 lg:hidden"><Menu size={17} /></button>
            <div className="min-w-0"><div className="hidden text-[8px] font-bold tracking-[0.17em] text-zinc-600 sm:block">TRPOLARIS / ADMIN</div><h1 className="truncate text-[13px] font-black text-white sm:mt-1 sm:text-base">{title[1]}</h1></div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <label className="hidden h-9 w-[min(230px,25vw)] items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 md:flex"><Search size={14} className="text-zinc-600" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Panelde ara..." className="min-w-0 flex-1 bg-transparent text-[9px] outline-none placeholder:text-zinc-600" /><span className="text-[8px] text-zinc-700">⌘ K</span></label>
            <button type="button" onClick={() => showInfo('Bildirim servisi henüz bağlanmadı.')} className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-zinc-400"><Bell size={15} /><i className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-amber-200" /></button>
            <a href="/hub/#/overview" className="flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3"><span className="flex h-6 w-6 items-center justify-center rounded-full border border-amber-200/20 bg-amber-100/[0.06] text-[8px] font-black text-amber-100">TP</span><span className="hidden text-[8px] font-bold text-zinc-400 sm:inline">TRPOLARIS</span></a>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5 lg:p-7">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div><div className="text-[8px] font-black tracking-[0.18em] text-amber-200">{title[0]}</div><h2 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">{title[1]}</h2><p className="mt-1 text-[10px] text-zinc-500">{title[2]}</p></div>
            {section === 'overview' || section === 'players' ? <button type="button" onClick={onRefresh} className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-200/20 bg-amber-100/[0.04] px-3 text-[9px] font-bold text-amber-100 transition hover:bg-amber-100/[0.08]"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Yenile</button> : null}
          </div>

          {section === 'overview' && <>
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
              <Metric Icon={Users} label="Çevrimiçi oyuncu" value={String(online)} detail="Rust canlı oyuncu servisi" live />
              <Metric Icon={Gauge} label="Sunucu tick rate" value="—" detail="Tick telemetrisi API’de yok" />
              <Metric Icon={Wallet} label="Ekonomi hacmi" value="—" detail="Oyun ekonomi verisi bağlı değil" />
              <Metric Icon={LifeBuoy} label="Açık destek" value="—" detail="Destek kuyruğu servisi bağlı değil" />
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-[1.45fr_.95fr]">
              <section className="rounded-2xl border border-white/[0.08] bg-[#11151d]/80 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3"><div><h3 className="text-[11px] font-black text-white">Canlı oturumlar</h3><p className="mt-1 text-[8px] text-zinc-600">Bağlı oyuncuların gerçek oturum süreleri</p></div><span className="text-[8px] font-bold text-zinc-600">{players.length} OTURUM</span></div>
                {players.length ? <div className="mt-5 flex h-[125px] items-end gap-2 overflow-hidden border-b border-white/[0.06] px-1">
                  {players.slice(0, 24).map((player, index) => {
                    const seconds = Math.max(1, Number(player.connectedSeconds) || 1);
                    const height = Math.max(12, Math.min(100, 18 + Math.log2(seconds + 1) * 10));
                    return <div key={player.id ?? index} title={(player.name || 'Oyuncu') + ' · ' + duration(seconds)} className="group flex min-w-[10px] flex-1 flex-col items-center justify-end gap-2"><div className="w-full max-w-8 rounded-t-sm bg-gradient-to-t from-amber-800/80 to-amber-200/90 transition group-hover:brightness-125" style={{ height: height + '%' }} /><span className="max-w-full truncate text-[7px] text-zinc-700">{index + 1}</span></div>;
                  })}
                </div> : <div className="mt-5 flex h-[125px] items-center justify-center rounded-xl border border-dashed border-white/[0.08] text-[9px] text-zinc-600">{loading ? 'Canlı oturumlar alınıyor…' : 'Grafik için bağlı oyuncu bekleniyor.'}</div>}
                <div className="mt-3 flex items-center justify-between text-[8px] text-zinc-600"><span>OTURUM SÜRESİ</span><span>Kaynak: /api/v1/live/players</span></div>
              </section>

              <section className="rounded-2xl border border-white/[0.08] bg-[#11151d]/80 p-4 sm:p-5">
                <div className="flex items-center justify-between"><div><h3 className="text-[11px] font-black text-white">Sistem sağlığı</h3><p className="mt-1 text-[8px] text-zinc-600">Mevcut servis bağlantı durumu</p></div><span className={'rounded-full border px-2 py-1 text-[7px] font-black ' + (apiConnected ? 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200' : 'border-amber-200/20 bg-amber-100/[0.05] text-amber-100')}>{apiConnected ? 'API BAĞLI' : 'BEKLENİYOR'}</span></div>
                <div className="mt-5 space-y-4">
                  {[['Rust oyuncu API', apiConnected ? 'Bağlı' : 'Bekleniyor', apiConnected], ['Canlı oyuncu listesi', loading ? 'Güncelleniyor' : players.length + ' kayıt', apiConnected], ['CPU telemetrisi', 'Sağlanmıyor', false], ['Bellek telemetrisi', 'Sağlanmıyor', false]].map(([label, value, ok]) => <div key={label}><div className="mb-2 flex items-center justify-between text-[8px]"><span className="text-zinc-400">{label}</span><span className={ok ? 'text-emerald-200' : 'text-zinc-600'}>{value}</span></div><div className="h-1 rounded-full bg-white/[0.06]"><div className={'h-full rounded-full ' + (ok ? 'w-full bg-gradient-to-r from-amber-700 to-amber-200' : 'w-0')} /></div></div>)}
                </div>
                <div className="mt-4 border-t border-white/[0.06] pt-3 text-[8px] text-zinc-600"><RadioTower size={12} className="mr-2 inline text-amber-200" /> Yönetim ve audit API bağlantısı bekleniyor</div>
              </section>
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-[1.45fr_1fr]">
              <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#11151d]/80">
                <div className="flex items-center justify-between border-b border-white/[0.07] p-4"><div><h3 className="text-[11px] font-black text-white">Son bağlanan oyuncular</h3><p className="mt-1 text-[8px] text-zinc-600">Rust sunucusundan alınan canlı liste</p></div><button type="button" onClick={() => choose('players')} className="text-[9px] font-bold text-amber-200 hover:text-amber-100">TÜMÜNÜ GÖR <ArrowRight size={12} className="ml-1 inline" /></button></div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[440px] text-left"><thead className="bg-black/15 text-[7px] font-bold tracking-wider text-zinc-600"><tr><th className="px-4 py-3">OYUNCU</th><th className="px-4 py-3">DURUM</th><th className="px-4 py-3">AKTİVİTE</th><th className="px-4 py-3">BAĞLANTI</th></tr></thead>
                    <tbody>{players.slice(0, 6).map((player, index) => <tr key={player.id ?? index} className="border-t border-white/[0.045] text-[8px]"><td className="px-4 py-3 font-bold text-zinc-200">{player.name || 'Oyuncu'}<div className="mt-0.5 text-[7px] font-normal text-zinc-600">Canlı oturum</div></td><td className="px-4 py-3"><StatePill activity={player.activity} /></td><td className="px-4 py-3 text-zinc-400">{player.activity || 'Bağlı'}</td><td className="px-4 py-3 font-mono text-zinc-400">{duration(player.connectedSeconds)}</td></tr>)}</tbody>
                  </table>
                  {!players.length && <div className="p-7 text-center text-[9px] text-zinc-600">{loading ? 'Oyuncular alınıyor…' : 'Şu anda bağlı oyuncu yok.'}</div>}
                </div>
                <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3 text-[8px] text-zinc-600"><span><i className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-300" /> 8 saniyede yenilenir</span><span>{players.length} oyuncu</span></div>
              </section>

              <section className="rounded-2xl border border-white/[0.08] bg-[#11151d]/80 p-4">
                <div className="flex items-center justify-between"><div><h3 className="text-[11px] font-black text-white">Yönetim aktivitesi</h3><p className="mt-1 text-[8px] text-zinc-600">Denetim kaydı akışı</p></div><span className="text-[7px] font-bold text-zinc-700">AUDIT LOG</span></div>
                <div className="mt-5 flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.07] px-4 text-center"><ShieldCheck size={20} className="text-zinc-700" /><strong className="mt-3 text-[9px] text-zinc-400">Henüz denetim kaydı yok</strong><p className="mt-1 max-w-[230px] text-[8px] leading-relaxed text-zinc-600">Yönetici işlemleri ve audit log endpoint’i bağlandığında gerçek kayıtlar burada görüntülenecek.</p></div>
              </section>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {[['Oyuncu listesi', Users, 'players'], ['Araçlar', CarFront, 'vehicles'], ['Destek kuyruğu', LifeBuoy, 'tickets'], ['Moderasyon', ShieldAlert, 'moderation']].map(([label, Icon, id]) => <button key={id} type="button" onClick={() => choose(id)} className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-[#11151d]/65 px-3 py-3 text-left text-[9px] font-semibold text-zinc-400 transition hover:border-amber-200/20 hover:text-amber-100"><span><Icon size={13} className="mr-2 inline text-amber-200" />{label}</span><ChevronRight size={12} /></button>)}
            </div>
          </>}

          {section === 'players' && <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#11151d]/80">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] p-4"><div><h3 className="text-[11px] font-black text-white">Oyuncu dizini</h3><p className="mt-1 text-[8px] text-zinc-600">{filtered.length} canlı kayıt</p></div><label className="flex h-9 w-full max-w-[250px] items-center gap-2 rounded-lg border border-white/[0.08] bg-black/20 px-3"><Search size={13} className="text-zinc-600" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Oyuncu ara..." className="min-w-0 flex-1 bg-transparent text-[9px] outline-none" /></label></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left"><thead className="bg-black/15 text-[8px] font-bold tracking-wider text-zinc-600"><tr><th className="px-4 py-3">OYUNCU</th><th className="px-4 py-3">DURUM</th><th className="px-4 py-3">AKTİVİTE</th><th className="px-4 py-3">BAĞLANTI SÜRESİ</th></tr></thead><tbody>{filtered.map((player,index) => <tr key={player.id ?? index} className="border-t border-white/[0.045] text-[9px]"><td className="px-4 py-3 font-bold text-zinc-200">{player.name || 'Oyuncu'}</td><td className="px-4 py-3"><StatePill activity={player.activity} /></td><td className="px-4 py-3 text-zinc-400">{player.activity || 'Bağlı'}</td><td className="px-4 py-3 font-mono text-zinc-400">{duration(player.connectedSeconds)}</td></tr>)}</tbody></table>{!filtered.length && <div className="p-8 text-center text-[9px] text-zinc-600">Eşleşen oyuncu bulunamadı.</div>}</div>
          </section>}

          {section === 'map' && <EmptyModule Icon={MapPinned} title="Canlı harita bağlantısı bekleniyor" text="Rust sunucusu oyuncu koordinatlarını ve araç konumlarını henüz bu arayüze yayınlamıyor. Konum telemetrisi bağlanana kadar harita verisi gösterilmez." />}
          {section === 'vehicles' && <EmptyModule Icon={CarFront} title="Araç API bağlantısı bekleniyor" text="Araç sahipliği, envanter, bakım ve oyun içi araç komutları için doğrulanmış sunucu endpoint’i bulunmuyor." />}
          {section === 'moderation' && <EmptyModule Icon={ShieldAlert} title="Moderasyon işlemleri kapalı" text="Kick, ban, unban ve susturma işlemleri rol doğrulamalı Rust admin endpoint’i olmadan etkinleştirilmeyecek." />}
          {section === 'tickets' && <EmptyModule Icon={LifeBuoy} title="Destek kuyruğu bağlı değil" text="Destek talepleri için kalıcı veri kaynağı ve yetkili işlem API’si henüz yapılandırılmadı." />}
          {section === 'analytics' && <EmptyModule Icon={Activity} title="Analitik telemetrisi bekleniyor" text="Ekonomi, tick rate, CPU, bellek ve performans geçmişi için veri kaynağı bulunmadığından sahte grafik üretilmez." />}
          {section === 'settings' && <EmptyModule Icon={Settings} title="Yönetim güvenliği" text="Panel görünümü hazır. Rol yönetimi, oturum politikaları, CSRF korumalı komutlar ve denetim kayıtları backend entegrasyonu bekliyor." />}

          <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] pt-4 text-[7px] font-bold tracking-[0.16em] text-zinc-700"><span>TRPOLARIS CONTROL CENTER · UI BUILD 2.0</span><span>RUST API · SAME ORIGIN · SAFE MODE</span></footer>
        </div>
      </section>

      {mobileOpen && <button type="button" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-20 bg-black/60 lg:hidden" aria-label="Menüyü kapat" />}
      {toast && <div role="status" className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border border-amber-200/20 bg-[#15120d] px-4 py-3 text-[10px] text-amber-100 shadow-2xl">{toast}<button type="button" onClick={() => setToast('')} className="ml-3 text-zinc-500" aria-label="Bildirimi kapat"><X size={13} className="inline" /></button></div>}
    </main>
  );
}
