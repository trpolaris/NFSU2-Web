import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity, ArrowRight, ArrowUpRight, CarFront, Check, ChevronRight,
  CircleHelp, Gauge, Gamepad2, LayoutDashboard, LoaderCircle, Menu,
  Plus, RefreshCw, ShieldCheck, Sparkles, Trophy, UserRound, Users,
  Zap, X,
} from 'lucide-react';
import './hub.css';

const NAV = [
  { id: 'overview', label: 'Genel bakış', icon: LayoutDashboard },
  { id: 'online', label: 'Çevrimiçi', icon: Users },
  { id: 'profile', label: 'Profilim', icon: UserRound },
  { id: 'garage', label: 'Garajım', icon: CarFront },
  { id: 'stats', label: 'İstatistikler', icon: Trophy },
];

const emptyProfile = { displayName: '', bio: '', favoriteCar: '', updatedAt: 0 };

async function api(path, options = {}, csrf = '') {
  const headers = new Headers(options.headers || {});
  if (options.body) headers.set('Content-Type', 'application/json');
  if (csrf) headers.set('X-TRP-CSRF', csrf);
  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || ('İstek başarısız (' + response.status + ')'));
  return data;
}

function duration(seconds = 0) {
  const value = Math.max(0, Number(seconds) || 0);
  if (value < 60) return Math.floor(value) + ' sn';
  if (value < 3600) return Math.floor(value / 60) + ' dk';
  const hours = Math.floor(value / 3600);
  return hours + ' sa ' + Math.floor((value % 3600) / 60) + ' dk';
}
function shortTime(value) {
  if (!value) return 'Henüz kaydedilmedi';
  try { return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  catch { return 'Kaydedildi'; }
}
function initials(name = 'TRPOLARIS') {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || 'TP';
}
function BrandMark({ small = false }) {
  return <div className={'hub-mark ' + (small ? 'hub-mark-small' : '')} aria-hidden="true"><span>T</span><i /></div>;
}
function StatCard({ icon: Icon, label, value, detail, tone = 'coral', trend }) {
  return <motion.article className={'hub-stat hub-stat-' + tone} whileHover={{ y: -3 }} transition={{ duration: .18 }}>
    <div className="hub-stat-top"><span className="hub-stat-icon"><Icon size={18} /></span>{trend && <span className="hub-stat-trend">{trend}</span>}</div>
    <div className="hub-stat-value">{value ?? '—'}</div>
    <div className="hub-stat-label">{label}</div>
    {detail && <div className="hub-stat-detail">{detail}</div>}
  </motion.article>;
}
function ActivityBadge({ activity }) {
  const details = {
    online: ['Online', 'status-online'],
    'free-roam': ['Serbest dolaşım', 'status-roam'],
    lan: ['LAN / Online menüsü', 'status-lan'],
    menus: ['Menüler', 'status-menu'],
  };
  const [label, cls] = details[activity] || details.menus;
  return <span className={'hub-status ' + cls}><i />{label}</span>;
}
function PlayerTable({ players, loading, onRefresh, compact = false }) {
  return <section className={'hub-panel hub-player-panel ' + (compact ? 'hub-panel-compact' : '')}>
    <div className="hub-panel-head">
      <div><div className="hub-eyebrow">CANLI SUNUCU VERİSİ</div><h2>Şu anda pistte</h2><p>Rust sunucusunun gerçek switch kayıtları</p></div>
      <button className="hub-icon-button" type="button" onClick={onRefresh} aria-label="Listeyi yenile" title="Yenile"><RefreshCw size={16} className={loading ? 'hub-spinning' : ''} /></button>
    </div>
    {loading && !players.length ? <div className="hub-empty"><LoaderCircle className="hub-spinning" /> Oyuncular alınıyor…</div>
      : !players.length ? <div className="hub-empty hub-empty-quiet"><span className="hub-empty-icon"><Users size={19} /></span><strong>Şu anda kimse oynamıyor</strong><span>Bir oyuncu bağlandığında burada görünecek.</span></div>
      : <div className="hub-player-list">
        {players.slice(0, compact ? 5 : 100).map((player, index) => <motion.div className="hub-player-row" key={player.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * .025, .2) }}>
          <div className="hub-player-avatar">{initials(player.name)}</div>
          <div className="hub-player-name"><strong>{player.name || 'Oyuncu'}</strong><span>Bağlı · {duration(player.connectedSeconds)}</span></div>
          <ActivityBadge activity={player.activity} />
        </motion.div>)}
      </div>}
    <div className="hub-panel-foot"><span><i className="hub-live-dot" /> Canlı veri · 8 saniyede yenilenir</span><span>{players.length} oyuncu</span></div>
  </section>;
}

function App() {
  const [route, setRoute] = useState(() => location.hash.replace(/^#\/?/, '') || 'overview');
  const [booting, setBooting] = useState(true);
  const [csrf, setCsrf] = useState('');
  const [profile, setProfile] = useState(emptyProfile);
  const [players, setPlayers] = useState([]);
  const [counts, setCounts] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileForm, setProfileForm] = useState(emptyProfile);
  const [vehicleForm, setVehicleForm] = useState({ manufacturer: '', model: '', year: '', notes: '' });

  const showNotice = useCallback((message, tone = 'success') => {
    setNotice({ message, tone });
    window.setTimeout(() => setNotice(null), 3800);
  }, []);

  const refreshLive = useCallback(async () => {
    setLiveLoading(true);
    try {
      const [live, summary] = await Promise.all([api('/api/v1/live/players'), api('/players')]);
      setPlayers(Array.isArray(live.players) ? live.players : []);
      setCounts(summary);
    } catch (error) {
      showNotice(error.message || 'Canlı sunucu verisi alınamadı.', 'error');
    } finally { setLiveLoading(false); }
  }, [showNotice]);

  const loadPrivateData = useCallback(async () => {
    const [me, garage] = await Promise.all([api('/api/v1/me'), api('/api/v1/garage')]);
    setProfile(me.profile || emptyProfile);
    setProfileForm(me.profile || emptyProfile);
    setVehicles(Array.isArray(garage.vehicles) ? garage.vehicles : []);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const session = await api('/api/v1/session');
        if (!alive) return;
        setCsrf(session.csrf || '');
        await loadPrivateData();
        if (!alive) return;
        await refreshLive();
      } catch (error) {
        if (alive) showNotice(error.message || 'Oyuncu merkezi başlatılamadı.', 'error');
      } finally { if (alive) setBooting(false); }
    })();
    return () => { alive = false; };
  }, [loadPrivateData, refreshLive, showNotice]);

  useEffect(() => {
    const onHash = () => { setRoute(location.hash.replace(/^#\/?/, '') || 'overview'); setMobileNavOpen(false); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    const id = window.setInterval(() => { void refreshLive(); }, 8000);
    return () => window.clearInterval(id);
  }, [refreshLive]);

  const navigate = (id) => { location.hash = '/' + id; setRoute(id); setMobileNavOpen(false); };

  const saveProfile = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      const result = await api('/api/v1/me', { method: 'PUT', body: JSON.stringify(profileForm) }, csrf);
      setProfile(result.profile || profileForm);
      showNotice('Profilin bu tarayıcıya kaydedildi.');
    } catch (error) { showNotice(error.message, 'error'); }
    finally { setSaving(false); }
  };

  const addVehicle = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      const payload = {
        manufacturer: vehicleForm.manufacturer,
        model: vehicleForm.model,
        year: vehicleForm.year ? Number(vehicleForm.year) : null,
        notes: vehicleForm.notes,
      };
      const result = await api('/api/v1/garage', { method: 'POST', body: JSON.stringify(payload) }, csrf);
      setVehicles(result.vehicles || []);
      setVehicleForm({ manufacturer: '', model: '', year: '', notes: '' });
      showNotice('Araç garajına eklendi. Bu kayıt henüz oyundan otomatik alınmıyor.');
    } catch (error) { showNotice(error.message, 'error'); }
    finally { setSaving(false); }
  };
  const removeVehicle = async (id) => {
    try {
      const result = await api('/api/v1/garage/' + encodeURIComponent(id), { method: 'DELETE' }, csrf);
      setVehicles(result.vehicles || []);
      showNotice('Araç garajdan kaldırıldı.');
    } catch (error) { showNotice(error.message, 'error'); }
  };

  const activeNav = NAV.find(item => item.id === route) || NAV[0];
  const displayName = profile.displayName?.trim() || 'Sürücü';
  const liveCount = counts?.players ?? players.length;
  const roamCount = counts?.roam ?? null;
  const onlineCount = counts?.online ?? null;
  const pageTitles = {
    overview: ['KOMUTA MERKEZİ', 'Sürüşe hazır mısın?', 'Sunucudaki hareketi, profilini ve garajını tek merkezden takip et.'],
    online: ['SUNUCU / CANLI', 'Çevrimiçi oyuncular', 'Sunucuya bağlı oyuncuların gerçek durumları.'],
    profile: ['SÜRÜCÜ KİMLİĞİ', 'Profilim', 'Bu tarayıcıya özel oyuncu profilini düzenle.'],
    garage: ['ARAÇ KOLEKSİYONU', 'Garajım', 'Kendi araç koleksiyonunu oluştur. Oyun içi senkronizasyon sonraki aşamada eklenecek.'],
    stats: ['PERFORMANS / KAYIT', 'İstatistikler', 'Doğrulanmış kariyer verileri geldikçe burada toplanacak.'],
  };
  const [eyebrow, title, subtitle] = pageTitles[route] || pageTitles.overview;

  if (booting) return <div className="hub-boot"><BrandMark /><span>TRPOLARIS PLAYER HUB</span><LoaderCircle className="hub-spinning" /></div>;

  return <div className="hub-app">
    <div className="hub-atmosphere" aria-hidden="true"><span className="hub-atmosphere-orb hub-atmosphere-coral" /><span className="hub-atmosphere-orb hub-atmosphere-violet" /><span className="hub-atmosphere-grid" /></div>
    <motion.aside initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .34, ease: [.2, .8, .2, 1] }} className={'hub-sidebar ' + (mobileNavOpen ? 'hub-sidebar-open' : '')}>
      <a className="hub-brand" href="/" aria-label="TRPOLARIS ana sayfa"><BrandMark /><span><strong>TRPOLARIS</strong><small>PLAYER HUB <i>V1</i></small></span></a>
      <div className="hub-side-label">OYUNCU MERKEZİ</div>
      <nav className="hub-nav" aria-label="Oyuncu merkezi">
        {NAV.map(item => {
          const Icon = item.icon;
          return <a key={item.id} href={'#/' + item.id} onClick={() => setMobileNavOpen(false)} className={'hub-nav-link ' + (route === item.id ? 'is-active' : '')} aria-current={route === item.id ? 'page' : undefined}>
            {route === item.id && <motion.span className="hub-nav-indicator" layoutId="hub-nav-indicator" transition={{ type: 'spring', stiffness: 430, damping: 36 }} />}
            <Icon size={18} strokeWidth={1.8} /><span>{item.label}</span>{item.id === 'online' && <i className="hub-nav-live" />}
          </a>;
        })}
      </nav>
      <div className="hub-sidebar-spacer" />
      <div className="hub-server-card"><div className="hub-server-label"><span className="hub-live-dot" /> SUNUCU DURUMU</div><strong>{counts ? 'Çevrimiçi' : 'Bağlantı bekleniyor'}</strong><span>{liveCount} aktif oyuncu</span></div>
      <a className="hub-back-game" href="/"><Gamepad2 size={17} /> Oyuna dön <ArrowUpRight size={15} /></a>
      <div className="hub-sidebar-foot">TRPOLARIS · NFSU2 WEB</div>
    </motion.aside>

    <main className="hub-main">
      <header className="hub-topbar">
        <button className="hub-mobile-menu" type="button" onClick={() => setMobileNavOpen(v => !v)} aria-label="Menüyü aç"><Menu /></button>
        <div className="hub-breadcrumb"><span>TRPOLARIS</span><ChevronRight size={14} /><span>{activeNav.label.toUpperCase()}</span></div>
        <div className="hub-top-actions"><span className={'hub-connection ' + (counts ? 'is-connected' : 'is-disconnected')}><i className="hub-live-dot" /> {counts ? 'SUNUCUYA BAĞLI' : 'BAĞLANTI BEKLENİYOR'}</span><div className="hub-user-chip"><span>{initials(displayName)}</span><strong>{displayName}</strong></div></div>
      </header>

      <div className="hub-content">
        <motion.div className="hub-page-heading" key={route} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .28 }}>
          <div className="hub-eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.section key={route} className="hub-page" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .22 }}>
            {route === 'overview' && <div className="hub-overview">
              <div className="hub-welcome">
                <div className="hub-welcome-copy"><div className="hub-welcome-kicker"><Sparkles size={14} /> UNDERGROUND NETWORK</div>
                  <h2>Tekrar hoş geldin,<br /><em>{displayName}.</em></h2>
                  <p>Sunucudaki sürüş hareketini takip et. Profilini tamamla, garajını oluştur.</p>
                  <button className="hub-primary-button" onClick={() => navigate('profile')}>Profilini düzenle <ArrowRight size={16} /></button>
                </div>
                <div className="hub-welcome-art" aria-hidden="true"><div className="hub-art-orbit orbit-one" /><div className="hub-art-orbit orbit-two" /><div className="hub-art-number">02</div><div className="hub-art-label">NIGHT<br />DRIVE</div><div className="hub-art-scan" /></div>
              </div>
              <div className="hub-stats-grid">
                <StatCard icon={Users} label="Aktif oyuncu" value={liveCount} detail="Sunucuya bağlı" tone="coral" trend="LIVE" />
                <StatCard icon={Gauge} label="Serbest dolaşım" value={roamCount ?? '—'} detail="Anlık serbest sürüş" tone="violet" />
                <StatCard icon={Zap} label="Online modu" value={onlineCount ?? '—'} detail="Online menü / yarış" tone="blue" />
                <StatCard icon={CarFront} label="Garajımdaki araç" value={vehicles.length} detail="Tarayıcı profilinde kayıtlı" tone="green" />
              </div>
              <div className="hub-dashboard-grid">
                <PlayerTable players={players} loading={liveLoading} onRefresh={refreshLive} compact />
                <section className="hub-panel hub-profile-card">
                  <div className="hub-panel-head"><div><div className="hub-eyebrow">SÜRÜCÜ KARTI</div><h2>Profil özeti</h2></div><span className="hub-profile-avatar">{initials(displayName)}</span></div>
                  <div className="hub-profile-name">{displayName}</div><p>{profile.bio || 'Kendin hakkında kısa bir açıklama ekle.'}</p>
                  <div className="hub-profile-favorite"><CarFront size={16} /><span>{profile.favoriteCar || 'Favori araç belirlenmedi'}</span></div>
                  <button className="hub-secondary-button hub-wide-button" onClick={() => navigate('profile')}>Profili aç <ArrowRight size={15} /></button>
                  <div className="hub-private-note"><ShieldCheck size={14} /> Bu profil bu tarayıcıdaki özel oturuma bağlıdır.</div>
                </section>
              </div>
              <section className="hub-next-card"><div className="hub-next-icon"><Activity size={19} /></div><div><strong>Oyun verisi entegrasyonu sıradaki aşama</strong><p>Gerçek araç koleksiyonu, kariyer istatistikleri ve yarış geçmişi için WASM telemetri köprüsü kurulacak.</p></div><button className="hub-icon-button" onClick={() => navigate('stats')} aria-label="İstatistikleri aç"><ArrowRight size={17} /></button></section>
            </div>}

            {route === 'online' && <div className="hub-online-page">
              <div className="hub-online-summary"><div><span className="hub-live-dot" /> CANLI SUNUCU AKIŞI</div><strong>{players.length} <small>oyuncu bağlı</small></strong><button className="hub-secondary-button" onClick={refreshLive}><RefreshCw size={15} /> Yenile</button></div>
              <PlayerTable players={players} loading={liveLoading} onRefresh={refreshLive} />
              <div className="hub-data-disclaimer"><ShieldCheck size={16} /><span>Oyuncu adları ve durumları Rust switch kayıtlarından gelir. IP adresleri ve özel oturum kimlikleri arayüze aktarılmaz.</span></div>
            </div>}

            {route === 'profile' && <form className="hub-panel hub-form-panel" onSubmit={saveProfile}>
              <div className="hub-panel-head"><div><div className="hub-eyebrow">KİŞİSEL ALAN</div><h2>Sürücü bilgileri</h2><p>Bu bilgiler şimdilik yalnızca bu tarayıcı oturumunda saklanır.</p></div><span className="hub-profile-avatar hub-profile-avatar-large">{initials(profileForm.displayName || 'TRPOLARIS')}</span></div>
              <div className="hub-form-grid">
                <label className="hub-field"><span>Görünen ad</span><input maxLength={24} value={profileForm.displayName || ''} onChange={e => setProfileForm(v => ({ ...v, displayName: e.target.value }))} placeholder="Örn. TRPOLARIS" /><small>En fazla 24 karakter.</small></label>
                <label className="hub-field"><span>Favori araç</span><input maxLength={48} value={profileForm.favoriteCar || ''} onChange={e => setProfileForm(v => ({ ...v, favoriteCar: e.target.value }))} placeholder="Örn. Nissan Skyline GT-R" /><small>Oyundan otomatik okunmaz; şimdilik manuel.</small></label>
                <label className="hub-field hub-field-full"><span>Hakkımda</span><textarea rows={4} maxLength={160} value={profileForm.bio || ''} onChange={e => setProfileForm(v => ({ ...v, bio: e.target.value }))} placeholder="Sürüş tarzını veya kendini kısaca anlat…" /><small>{(profileForm.bio || '').length}/160</small></label>
              </div>
              <div className="hub-form-footer"><span><ShieldCheck size={15} /> Özel tarayıcı profili · Sunucuya güvenli kayıt</span><button className="hub-primary-button" type="submit" disabled={saving}>{saving ? <LoaderCircle className="hub-spinning" size={16} /> : <Check size={16} />} Değişiklikleri kaydet</button></div>
            </form>}

            {route === 'garage' && <div className="hub-garage-page">
              <div className="hub-garage-toolbar"><div><strong>{vehicles.length} araç</strong><span>Özel garaj koleksiyonun</span></div><span className="hub-manual-pill">MANUEL KAYIT</span></div>
              <form className="hub-panel hub-form-panel" onSubmit={addVehicle}>
                <div className="hub-panel-head"><div><div className="hub-eyebrow">KOLEKSİYONUNA EKLE</div><h2>Yeni araç kaydı</h2><p>Oyun içi araç içe aktarma köprüsü hazır olduğunda kayıtlar otomatik senkronize edilecek.</p></div><div className="hub-form-icon"><Plus /></div></div>
                <div className="hub-form-grid hub-car-form">
                  <label className="hub-field"><span>Marka</span><input required maxLength={32} value={vehicleForm.manufacturer} onChange={e => setVehicleForm(v => ({ ...v, manufacturer: e.target.value }))} placeholder="Nissan" /></label>
                  <label className="hub-field"><span>Model</span><input required maxLength={48} value={vehicleForm.model} onChange={e => setVehicleForm(v => ({ ...v, model: e.target.value }))} placeholder="Skyline GT-R" /></label>
                  <label className="hub-field"><span>Yıl</span><input type="number" min="1990" max="2035" value={vehicleForm.year} onChange={e => setVehicleForm(v => ({ ...v, year: e.target.value }))} placeholder="2002" /></label>
                  <label className="hub-field"><span>Not</span><input maxLength={160} value={vehicleForm.notes} onChange={e => setVehicleForm(v => ({ ...v, notes: e.target.value }))} placeholder="Kurulum / görünüm notu" /></label>
                </div>
                <div className="hub-form-footer"><span><ShieldCheck size={15} /> Kayıt yalnızca sana ait oturumda tutulur.</span><button className="hub-primary-button" type="submit" disabled={saving || !vehicleForm.manufacturer.trim() || !vehicleForm.model.trim()}>{saving ? <LoaderCircle className="hub-spinning" size={16} /> : <Plus size={16} />} Garaja ekle</button></div>
              </form>
              {vehicles.length ? <div className="hub-vehicle-grid">{vehicles.map((car, index) => <motion.article className="hub-vehicle-card" key={car.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * .04, .25) }}>
                <div className="hub-vehicle-art"><div className="hub-vehicle-number">{String(index + 1).padStart(2, '0')}</div><CarFront size={54} strokeWidth={1.1} /><span>GARAGE / ENTRY</span></div>
                <div className="hub-vehicle-info"><div className="hub-vehicle-make">{car.manufacturer} {car.year ? '· ' + car.year : ''}</div><h3>{car.model}</h3>{car.notes && <p>{car.notes}</p>}<div className="hub-vehicle-footer"><span>Oyuncu girişi</span><button className="hub-text-danger" type="button" onClick={() => removeVehicle(car.id)}>Kaldır</button></div></div>
              </motion.article>)}</div> : <div className="hub-panel hub-empty hub-garage-empty"><span className="hub-empty-icon"><CarFront size={24} /></span><strong>Garajın henüz boş</strong><span>İlk aracını ekleyerek koleksiyonunu oluşturmaya başla.</span></div>}
              <div className="hub-data-disclaimer"><CircleHelp size={16} /><span>Bu liste şimdilik oyuncunun girdiği kayıtları içerir; oyun save dosyasından araç listesi okunmuyor.</span></div>
            </div>}

            {route === 'stats' && <div className="hub-stats-page">
              <div className="hub-panel hub-empty hub-stats-empty"><span className="hub-empty-icon"><Trophy size={24} /></span><strong>Kariyer verisi henüz bağlanmadı</strong><span>Galibiyet, yarış geçmişi, para, seviye ve performans değerlerini göstermek için oyun içi telemetri kaynağı gerekiyor.</span><button className="hub-secondary-button" onClick={() => navigate('online')}>Canlı oyuncuları görüntüle <ArrowRight size={15} /></button></div>
              <div className="hub-stats-grid hub-muted-stats">
                <StatCard icon={Trophy} label="Galibiyet" value="—" detail="Oyun verisi bekleniyor" tone="violet" />
                <StatCard icon={Gauge} label="En iyi derece" value="—" detail="Oyun verisi bekleniyor" tone="blue" />
                <StatCard icon={CarFront} label="Sürülen araç" value="—" detail="Oyun verisi bekleniyor" tone="green" />
                <StatCard icon={Activity} label="Toplam yarış" value="—" detail="Oyun verisi bekleniyor" tone="coral" />
              </div>
            </div>}
          </motion.section>
        </AnimatePresence>
        <footer className="hub-footer"><span>TRPOLARIS PLAYER HUB</span><span>RUST API · REACT UI · SAME ORIGIN</span></footer>
      </div>
    </main>

    <AnimatePresence>
      {notice && <motion.div className={'hub-toast hub-toast-' + notice.tone} role="status" initial={{ opacity: 0, y: 16, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }}><span>{notice.tone === 'success' ? <Check size={17} /> : <CircleHelp size={17} />}</span>{notice.message}<button type="button" onClick={() => setNotice(null)} aria-label="Bildirimi kapat"><X size={15} /></button></motion.div>}
    </AnimatePresence>
    {mobileNavOpen && <button className="hub-mobile-backdrop" onClick={() => setMobileNavOpen(false)} aria-label="Menüyü kapat" />}
  </div>;
}

createRoot(document.getElementById('player-hub-root')).render(<App />);
