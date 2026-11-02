<div align="center">

# 🏁 TRPOLARIS
## Need for Speed: Underground 2 · Web Edition

**Underground 2 deneyimini WebAssembly, WebGPU ve modern web teknolojileriyle tarayıcıya taşıyan bağımsız topluluk projesi.**

<p>
  <a href="https://github.com/trpolaris/NFSU2-Web/actions/workflows/multiplayer-ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/trpolaris/NFSU2-Web/multiplayer-ci.yml?branch=main&label=Multiplayer%20%26%20Regression%20CI&logo=githubactions&logoColor=white" alt="Multiplayer and Regression CI"></a>
  <a href="https://github.com/trpolaris/NFSU2-Web/actions/workflows/image-rs.yml"><img src="https://img.shields.io/github/actions/workflow/status/trpolaris/NFSU2-Web/image-rs.yml?branch=main&label=Container%20Image&logo=docker&logoColor=white" alt="Container Image CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-16a085.svg" alt="MIT License"></a>
  <a href="https://webassembly.org/"><img src="https://img.shields.io/badge/Runtime-WebAssembly-654ff0.svg?logo=webassembly&logoColor=white" alt="WebAssembly"></a>
  <a href="https://developer.mozilla.org/docs/Web/API/WebGPU_API"><img src="https://img.shields.io/badge/Graphics-WebGPU-2563eb.svg" alt="WebGPU"></a>
  <a href="https://www.rust-lang.org/"><img src="https://img.shields.io/badge/Backend-Rust-000000.svg?logo=rust&logoColor=white" alt="Rust"></a>
  <a href="https://github.com/trpolaris/NFSU2-Web/releases"><img src="https://img.shields.io/github/v/release/trpolaris/NFSU2-Web?display_name=tag&label=Releases" alt="GitHub Release"></a>
</p>

[🎮 Özellikler](#-nfsu2-web) · [🖥️ Kontrol Merkezi](#️-trpolaris-control-center) · [🧭 Player Hub](#-trpolaris-player-hub) · [🏗️ Mimari](#️-sistem-mimarisi) · [⚙️ Kurulum](#-kurulum) · [🧪 Testler](#-geliştirme-ve-testler)

**Ana dal:** `main` · **Sunucu:** Rust · **Oyun çalışma zamanı:** WebAssembly

</div>

---

## 📌 Proje hakkında

**TRPOLARIS NFSU2 Web**, *Need for Speed: Underground 2* PC sürümünü kullanıcıya ait oyun dosyalarından üretilen WebAssembly modülüyle tarayıcıda çalıştırmayı amaçlayan bağımsız bir topluluk projesidir.

Proje yalnızca oyunu tarayıcıya taşımakla kalmaz. Oyun deneyimini tamamlayan üç ayrı aracı tek bir ekosistemde bir araya getirir:

| Bileşen | Teknoloji / Platform | Sorumluluk |
|---|---|---|
| **NFSU2 Web** | WebAssembly · TypeScript · WebGPU · Web Audio | Tarayıcıda oyun, giriş aygıtları, yerel kayıtlar, çevrimiçi oyun ve Free Roam. |
| **TRPOLARIS Player Hub** | React · Rust API | Oyuncu profili, canlı oyuncular, kişisel garaj ve oyuncu merkezi. |
| **TRPOLARIS Control Center** | Windows · WPF · .NET 10 · WSL2 · Docker | Sunucu kurulumu, yönetimi, erişim profilleri, dosyalar ve tanılama. |

Ana oyun arayüzü `/`, Player Hub ise aynı sunucudaki `/hub/` yolunda çalışır. Player Hub ayrı bir port veya ikinci bir backend gerektirmez. Control Center ise web uygulamasından bağımsız bir Windows masaüstü aracıdır.

### ⚖️ Kaynak, telif ve oyun dosyaları

Teknik esin kaynağı [th0mk/nfsu2-web](https://github.com/th0mk/nfsu2-web) açık kaynak projesidir. TRPOLARIS bu tarayıcı tabanlı yaklaşımı temel alır; kendi web arayüzünü, Rust sunucu geliştirmelerini, Player Hub'ı, oyun içi sohbet deneyimini, dağıtım akışlarını ve Windows yönetim aracını ekler.

> [!IMPORTANT]
> Bu depo **Need for Speed: Underground 2 oyun dosyalarını içermez**. `SPEED2.EXE`, `server.dll`, oyun arşivleri, sesler, videolar veya başka telifli oyun varlıkları Git deposuna ya da Docker imajına eklenmez. Derleme ve kullanım için kendi yasal PC oyun kopyanızı sağlamanız gerekir.

---

## 🖼️ Ekran galerisi

Aşağıdaki GIF'ler arayüzleri ve kullanım akışlarını kendi bölümleri altında gösterir.

### 🌃 Ana web arayüzü

Oyun ana sayfası, çevrimiçi alanı, mod kitaplığı, kayıtlar, kontroller, ayarlar, sistem tanılaması ve proje bilgileri.

<p align="center">
  <img src="docs/screenshots/trpolaris-main-web-explained-compact-info.gif" alt="TRPOLARIS NFSU2 Web ana arayüzü ve bölümleri" width="96%">
</p>

### 🧭 Player Hub

Genel bakış, çevrimiçi oyuncular, profil, garaj ve istatistik ekranları.

<p align="center">
  <img src="docs/screenshots/trpolaris-player-hub-explained-compact-info.gif" alt="TRPOLARIS Player Hub ekranları" width="96%">
</p>

### 💬 Oyun içi sohbet HUD

Sohbet kapalıyken kompakt mesaj akışı; açıkken kanallar, arama, bildirim ve yazma araçları.

<p align="center">
  <img src="docs/screenshots/trpolaris-chat-hud-explained.gif" alt="NFSU2 oyun içi sohbet HUD kapalı ve açık görünümleri" width="96%">
</p>

### 🎛️ F9 sürücü menüsü

Oyun sırasında açılan sürücü seçenekleri ve Chat HUD görünüm ayarları.

<p align="center">
  <img src="docs/screenshots/trpolaris-f9-driver-options-explained-fixed.gif" alt="TRPOLARIS F9 sürücü seçenekleri menüsü" width="96%">
</p>

### 🖥️ Windows Control Center

WSL2, Ubuntu, Docker, sunucu yaşam döngüsü, dosya yönetimi, kurulum, erişim profilleri, tanılama, kaldırma ve canlı işlem günlüğü.

<p align="center">
  <img src="docs/screenshots/trpolaris-control-center-explained.gif" alt="TRPOLARIS NFSU2 Web Control Center ekran galerisi" width="96%">
</p>

---

<a id="nfsu2-web"></a>

## 🎮 NFSU2 Web

NFSU2 Web, oyunun PC kodunu hazır ve telifli bir oyun paketi olarak dağıtmaz. Kullanıcının oyun klasöründeki yürütülebilir dosyalardan desteklenen kodu üretir, web uyumluluk katmanıyla birleştirir ve WebAssembly modülüne dönüştürür.

### ✨ Oyun ve tarayıcı özellikleri

| Özellik | Açıklama |
|---|---|
| 🧠 **WebAssembly** | Oyun kodu `wasm32-wasip1-threads` hedefi için derlenir ve özel tarayıcı host/runtime katmanıyla çalışır. |
| 🎨 **WebGPU** | Grafik çıkışı tarayıcının GPU API'si üzerinden oluşturulur. Destek cihaz, işletim sistemi, tarayıcı ve sürücüye bağlıdır. |
| 🔊 **Web Audio** | Oyun sesleri tarayıcı ses katmanı üzerinden yürütülür. |
| ⚡ **Worker mimarisi** | Oyun host'u, veri yükleme ve arka plan işleri worker modüllerine ayrılır. |
| 🎮 **Çoklu giriş** | Klavye, fare, uyumlu gamepad, dokunmatik kontroller ve tarayıcının tanıdığı direksiyon setleri. |
| 💾 **Yerel kayıtlar** | Oyun kayıtları ve ayarlar tarayıcı profiline ait depolama alanında tutulur. |
| 🌐 **Çok oyunculu** | Rust sunucusu üzerinden sanal LAN, Free Roam ve oyunun Online akışları. |
| 📦 **PWA / önbellek** | Service Worker, sayfa ve oyun modülünün sürümlü kopyalarını saklar. Önceden indirilmiş oyun verileriyle tek oyunculu kullanım ağ kesintisinde de açılabilir. |
| 🌍 **16 dil** | İngilizce, Fransızca, Almanca, İtalyanca, İspanyolca, Felemenkçe, İsveççe, Danca, Korece, Geleneksel Çince, Japonca, Rusça, Tayca, Brezilya Portekizcesi, Lehçe ve Türkçe. |

**Tarayıcı:** En güncel Google Chrome önerilir. Proje ayrıca Firefox ve desteklenen iPhone/iPad Safari sürümlerini hedefler. WebGPU, SharedArrayBuffer ve diğer güvenli bağlam özellikleri cihaz bazında değişir; başlangıç öncesinde **Sistem Tanılaması** kontrollerini çalıştırın.

### 🏁 Oynanış akışı

1. Tarayıcı ana sayfayı açar ve güvenli bağlam, grafik, depolama ve oyun modülü kontrollerini yapar.
2. Gerekli oyun modülü ve oyun verileri yüklenir; indirme ve hazır olma durumu ekranda gösterilir.
3. **Oyna** düğmesi veya Enter ile oyun başlatılır.
4. Klavye, fare, gamepad veya desteklenen dokunmatik girişlerle menüler ve sürüş kontrol edilir.
5. Sunucu bağlantısı etkinse LAN, Free Roam veya Online oyun akışları kullanılabilir.

İlk kullanımda oyun modülü ve ihtiyaç duyulan oyun verileri indirilir. Oyuncu **Game Data / Bu bilgisayardaki oyun verileri** bölümünden uygun oyun verilerini önceden yükleyebilir. Çevrimdışı tek oyunculu kullanım için sayfanın önceden açılmış ve gerekli oyun verilerinin bu tarayıcıda önceden indirilmiş olması gerekir. Free Roam ve Online sunucu bağlantısı gerektirir.

### 🕹️ Temel kontroller

| Tuş / Girdi | İşlev |
|---|---|
| **W A S D / Ok tuşları** | Gaz, fren/geri ve direksiyon |
| **Alt** | Nitro |
| **Space** | El freni |
| **Left Shift / Left Ctrl** | Manuel viteste vites yükselt / düşür |
| **C / B** | Kamera / arkaya bak |
| **R** | Yeniden doğ |
| **H / J** | Hidrolik kontrolleri (uygun araç parçasıyla) |
| **N** | Korna |
| **X** | Free Roam drift modu |
| **1–4** | Free Roam hızlı sohbet seçimleri |
| **M / Tab** | Harita / mesajlar |
| **Esc / P** | Duraklat; Esc menülerde geri gider |
| **Enter** | Menü seçimi; Free Roam etkinliği veya outrun başlatma |
| **F12** | Sürüş sırasında fotoğraf modu; diğer ekranlarda ekran görüntüsü |
| **F8** | FPS sayacı ve ayrıntılı ağ tanılama görünümü |
| **F9** | Oyun içi sürücü seçenekleri menüsü |

Uyumlu Xbox/PlayStation kontrolcüleri ve tarayıcının game controller olarak sunduğu direksiyonlar kullanılabilir. Dokunmatik cihazlarda sanal sürüş kontrolleri, direksiyon düğmeleri, joystick veya eğim kontrolü gibi seçenekler bulunur. Ayrıntılı tuş ve cihaz açıklamaları: [Oynama Rehberi](docs/web/PLAYING.md).

### 🎛️ F9 sürücü seçenekleri

F9 menüsü oyun oturumu sırasında açılır ve farklı sürücü ayarlarını bir araya getirir:

- **Chat HUD:** Sohbet panelinin boyutu, arka plan opaklığı ve ekrandaki konumu.
- **Game Session:** Aktif oyun oturumuyla ilgili seçenekler.
- **Driver / Online:** Sürücü ve çevrimiçi deneyimiyle ilgili alanlar.
- **Radio / Music:** Radyo ve müzik seçenekleri.
- **Career Data:** Kariyer verisi alanı.

Gösterilen seçenekler ve veriler oyun çalışma zamanının desteklediği kapsamla sınırlıdır.

### 💬 Free Roam sohbet sistemi

Sohbet HUD'u oyun ekranına entegre edilmiştir; ayrı bir demo WebSocket servisi kullanmaz. Rust Free Roam hub üzerinden çalışır.

- **All / Herkes:** Aynı Free Roam odasındaki aktif oyunculara mesaj gönderir.
- **Crew / Ekip:** Aynı odada ve aynı Crew grubunda bulunan oyunculara mesaj gönderir.
- Mesaj akışı, oyuncu adları, kanal bilgisi ve sistem bildirimleri.
- Arama alanı, kanal filtreleri, etiket bildirimi sesi ve hazır hızlı ifadeler.
- Yerel oyuncunun mesajları için ayrı görsel vurgu.
- Sohbet kapalıyken mesajlar kompakt HUD üzerinde görünür; tekrar açıldığında oturum geçmişi okunabilir.
- HUD oturum başına en fazla **200 mesaj satırı** tutar; oturum bittiğinde temizlenir.
- Yazılı mesaj alanı istemcide 80 karakterle sınırlıdır. Sunucu protokolü 160 Unicode karakter / 512 UTF-8 byte sınırı uygular.
- Sunucu, oyuncu başına kayan 5 saniyelik pencerede en fazla 4 yazılı mesaj kabul eder.

| Tuş | İşlev |
|---|---|
| **Y** | Sohbet yazı alanını aç |
| **Enter** | Odak yazı alanındayken mesaj gönder |
| **Tab** | All ve mevcut Crew kanalları arasında geçiş |
| **Esc** | Yazı alanını kapat |

Ayrıntılar: [Free Roam Sohbet Rehberi](docs/web/FREEROAM-CHAT.md).

### 🧰 Mod Kitaplığı

Mod Kitaplığı, önerilen mod kaynaklarını ve kullanıcının kendi bağlantı listesini düzenlemeye yarar. Çeviri, HUD/texture veya altyazı iyileştirmeleri gibi paketler için referans bağlantıları saklanabilir.

> **Önemli:** Mod Kitaplığı mod dosyalarını barındırmaz ve otomatik kurulum yapmaz. Liste; mod adı, kategori ve bağlantı bilgilerini tutar. Dosyaların kaynağını, sürümünü ve oyun kopyanızla uyumluluğunu ayrıca doğrulayın.

### 💾 Kayıtlar ve TRPOLARIS Cloud

- Yerel oyun kayıtları tarayıcı profilinde tutulur; yedeklenebilir ve geri yüklenebilir.
- F12 ile alınan ekran görüntüleri kayıtlar ekranında görüntülenebilir.
- Cloud kayıtları aynı origin üzerindeki Rust sunucusunun **TRPOLARIS Cloud v1** servisini kullanır.
- Bulut kaydı için e-posta hesabı yerine sekiz kelimelik bir anahtar ifade kullanılır.
- Tarayıcı kayıt arşivini PBKDF2/AES-GCM ile şifreler; sunucu şifreli içeriği ve anahtar ifadenin türetilmiş kimlik hash'ini saklar.
- `GET / PUT / DELETE /cloud/v1/saves` uç noktaları ve ETag/koşullu yazma, eşzamanlı tarayıcıların birbirinin kaydını sessizce ezmesini önlemeye yardımcı olur.
- Sunucu son kayıtla birlikte önceki UTC gününden kurtarma kopyasını saklar. Tek snapshot sınırı 256 KiB'dir.

**Kalıcı sunucu state alanı gereklidir.** Docker'da `docker compose down -v` state volume'unu da silebilir; kayıtlarınızı korumak istiyorsanız bu komutu kullanmayın. Ayrıntılar: [TRPOLARIS Cloud Rehberi](docs/web/TRPOLARIS-CLOUD.md).

### ⚙️ Ayarlar, erişilebilirlik ve tanılama

Ayarlar ekranı dil, ses, altyazı, arka planda çalışma, çözünürlük ölçeği, FPS, gamepad davranışı, titreşim, ölü bölgeler ve dokunmatik kontroller gibi tercihleri sunar. Bir seçeneğin uygulanması ilgili tarayıcı ve cihaz desteğine bağlıdır.

Sistem Tanılaması; tarayıcıyı, güvenli bağlamı, WebGPU'yu, depolama alanını, oyun modülünü ve ilgili çalışma koşullarını kontrol eder. F8 ayrıntılı performans/ağ görünümünde gösterilen RTT, oyuncular arası doğrudan ping değil, istemci ile sanal-LAN switch'i arasındaki WebSocket gidiş-dönüş süresidir. [Ağ Tanılama Rehberi](docs/web/NETWORK-DIAGNOSTICS.md).

### 🔒 Oyun verilerinin güvenli sunulması

Rust sunucusu oyun klasörünün tamamını web'e açmaz. `/data-manifest` yalnızca oyunun çalışması için izin verilen oyun dosyalarını listeler. Kurulum günlükleri, kaldırma dosyaları, kullanıcı kayıtları, mod scriptleri, yedekler, notlar ve izin verilmeyen klasörler sunulmaz. Docker dağıtımında `/game` salt okunur bağlanır.

---

<a id="player-hub"></a>

## 🧭 TRPOLARIS Player Hub

Player Hub, ana oyun arayüzünden ayrı bir React uygulamasıdır. Aynı Rust sunucu sürecini ve aynı origin'i kullanır; `/hub/` yolunda açılır. Oyun çalışma zamanını veya ana oyunun DOM yapısını React'e dönüştürmez.

### 🗂️ Hub sayfaları

| Bölüm | İşlev |
|---|---|
| **Genel Bakış** | Canlı oyuncu sayısı, Free Roam/Online özeti, profil özeti ve garaj sayısı. |
| **Çevrimiçi** | Rust sunucusunun aktif oyuncu listesini ve mevcut etkinlik durumunu gösterir. Liste yenilenebilir. |
| **Profilim** | Görünen ad, kısa biyografi ve favori araç etiketini düzenler. |
| **Garajım** | Marka, model, yıl ve not alanlarıyla oyuncunun manuel eklediği araç kayıtlarını tutar. |
| **İstatistikler** | Kariyer telemetrisi için ayrılmış alandır; gerçek oyun verisi bağlanana kadar yer tutucu gösterilir. |

### 🔌 Player Hub API

React istemcisi aynı origin üzerindeki Rust API uç noktalarını kullanır:

| Endpoint | Metot | Açıklama |
|---|---|---|
| `/api/v1/session` | GET | Anonim tarayıcı oturumu oluşturur/sürdürür ve CSRF token döndürür. |
| `/api/v1/live/players` | GET | Gerçek switch kayıtlarından canlı oyuncu listesini döndürür. |
| `/api/v1/me` | GET / PUT | Geçerli tarayıcı oturumunun profilini okur/günceller. |
| `/api/v1/garage` | GET / POST | Oturum sahibinin garaj kayıtlarını listeler veya yeni araç ekler. |
| `/api/v1/garage/:id` | DELETE | Oturum sahibine ait bir garaj kaydını siler. |

Güvenlik katmanı host-only `HttpOnly`, `Secure`, `SameSite=Strict` oturum çerezi, CSRF token başlığı, aynı-origin kontrolü ve sınırlandırılmış istek gövdesi kullanır. Profil ve garaj verileri sunucunun kalıcı `/state` alanında saklanır. Canlı oyuncu API'si herkese açık listede sanal IP, gerçek istemci IP'si, tarayıcı kimliği veya claim token döndürmez.

### ℹ️ Player Hub veri kapsamı

- Profil, anonim tarayıcı oturumuna bağlıdır; e-posta/şifre hesabı ve cihazlar arası ortak kimlik sistemi değildir.
- Garaj kayıtları kullanıcı tarafından manuel girilir. Oyun save dosyasındaki araç envanteri veya modifiye parçalar otomatik okunmaz.
- Galibiyet, yarış geçmişi, para, seviye ve en iyi süre gibi kariyer verileri henüz oyun telemetrisiyle sunucuya aktarılmaz. İstatistik ekranı entegrasyon bekleyen alanları yer tutucu olarak gösterir.

---

<a id="control-center"></a>

## 🖥️ TRPOLARIS Control Center

**Control Center**, Windows masaüstünden WSL2, Ubuntu ve Docker tabanlı NFSU2 Web sunucusunu kurmak ve yönetmek için geliştirilmiş bağımsız bir WPF uygulamasıdır. Web oyununun kendisi değildir ve oyun dosyalarını içermez.

<p align="center">
  <img src="docs/screenshots/trpolaris-control-center-explained.gif" alt="TRPOLARIS Control Center yönetim ekranları" width="96%">
</p>

### 🛠️ Yönetim özellikleri

| Modül | Açıklama |
|---|---|
| **Genel Bakış** | WSL2, Ubuntu, Docker ve NFSU2 sunucu durumunu tek ekranda gösterir. |
| **Sunucu Yönetimi** | Konteyneri başlatır, durdurur, yeniden başlatır ve sağlık durumunu izler. |
| **Dosya Yöneticisi** | WSL içindeki proje dosyalarını görüntüler, açar ve düzenler. |
| **Tek Tık Kurulum** | Oyun klasörü ve port bilgileriyle kurulum akışını yönetir. |
| **Erişim ve Paylaşım** | Local, LAN/HTTPS ve isteğe bağlı tünel profillerini yapılandırır. |
| **Tanılama ve Bakım** | WSL, Ubuntu, Docker, port ve oyun dosyalarını denetler. |
| **Kaldırma Merkezi** | Seçilen NFSU2 bileşenlerini kaldırır; geniş kapsamlı seçenekleri ayrıca sunar. |
| **Canlı İşlem Günlüğü** | PowerShell ve WSL işlem çıktılarını, filtreleri ve ilerlemeyi gösterir. |

### 📋 Control Center gereksinimleri

- Windows 10/11 x64.
- WSL2 ve desteklenen Ubuntu dağıtımı.
- Docker Desktop veya erişilebilir Docker Engine.
- Kaynaktan derlemek için .NET 10 SDK ve WPF masaüstü bileşenleri.
- Kurulum ve bağımlılıklar için internet bağlantısı.
- WASM oluşturmak için kullanıcının kendi NFSU2 PC oyun klasörü.

Control Center **1.5.6** sürümünde .NET 10 / WPF hedefler ve self-contained tek dosyalı Windows EXE olarak yayımlanacak şekilde yapılandırılmıştır.

- [📦 GitHub Releases](https://github.com/trpolaris/NFSU2-Web/releases)
- [📘 Control Center kullanım ve derleme rehberi](control-center/README.md)
- [📁 Control Center kaynak kodu](control-center/)

> [!WARNING]
> Kaldırma veya Docker temizliği öncesinde oyun kayıtlarını ve önemli dosyaları yedekleyin. Ubuntu WSL dağıtımını veya Docker volume'larını kaldırmak başka projeleri ve kalıcı verileri de silebilir.

---

<a id="system-architecture"></a>

## 🏗️ Sistem mimarisi

```mermaid
flowchart TB
    subgraph Browser["🌐 Tarayıcı"]
        WEB["NFSU2 Web<br/>TypeScript · WASM Host"]
        HUB["Player Hub<br/>React"]
        GPU["WebGPU · Web Audio"]
        STORAGE["OPFS · Service Worker"]
        WEB --> GPU
        WEB --> STORAGE
    end

    subgraph Server["🦀 Rust Server"]
        HTTP["HTTP / TLS"]
        WS["WebSocket"]
        LAN["Virtual LAN Switch"]
        ROAM["Free Roam Hub"]
        ONLINE["Online Services"]
        CLOUD["Cloud Saves"]
        API["Player Hub API"]
        WS --> LAN
        WS --> ROAM
        WS --> ONLINE
        HTTP --> CLOUD
        HTTP --> API
    end

    GAME["/game<br/>Kullanıcının oyun dosyaları<br/>Salt okunur"]
    MODULE["/module<br/>nfsu2.wasm + nfsu2.json<br/>Salt okunur"]
    STATE["/state<br/>Kalıcı sunucu durumu"]

    WEB --> HTTP
    WEB --> WS
    HUB --> HTTP
    HTTP --> GAME
    HTTP --> MODULE
    CLOUD --> STATE
    API --> STATE
    LAN --> STATE
    ROAM --> STATE
    ONLINE --> STATE
```

### 🧩 Teknik bileşenler

| Katman | Teknoloji | Kullanım |
|---|---|---|
| Oyun kodu | C · Python · Capstone · pefile | Kullanıcıya ait EXE/DLL kodundan desteklenen kaynakların üretilmesi. |
| WebAssembly | WASI SDK 34 · Clang · wasm-ld | `wasm32-wasip1-threads` hedefinde çok iş parçacıklı WASM derlemesi. |
| Ana web istemcisi | TypeScript · JavaScript · esbuild | Oyun host'u, arayüz, ayarlar, giriş aygıtları ve ağ istemcisi. |
| Grafik ve ses | WebGPU · Web Audio | Tarayıcı GPU ve ses çıkışı. |
| Player Hub | React · Motion · Lucide · Tailwind | Oyuncu merkezinin arayüzü ve bileşenleri. |
| Backend | Rust 2024 · Tokio · rustls | HTTP/TLS, WebSocket, LAN, Online, Free Roam, Cloud ve Hub API. |
| Paketleme | Docker · Docker Compose · Caddy | Sunucu imajı, servis yaşam döngüsü ve HTTPS reverse proxy. |
| Masaüstü yönetim | C# · WPF · .NET 10 | Windows Control Center. |
| Test ve yardımcı araçlar | Node.js · Playwright · Python | Derleme kontrolü, tarayıcı ve multiplayer testleri, kod üretimi. |

### 🦀 Rust sunucu modülleri

Rust backend `web/server-rs/` altında bir workspace olarak düzenlenir (Rust 2024 edition, minimum Rust 1.85).

| Modül | Görev |
|---|---|
| `nfsu2-http` | HTTP/1.1 istekleri, bağlantı yönetimi ve TLS entegrasyonu. |
| `nfsu2-ws` | WebSocket handshake ve frame işleme. |
| `nfsu2-lan` | Sanal LAN switch'i, oyuncu adresleri ve paket yönlendirme. |
| `nfsu2-roam` | Free Roam hub'ı ve yakındaki oyuncuların durum güncellemeleri. |
| `nfsu2-online` | Oyunun Online lobby, oturum, mesaj ve yarış akışları. |
| `nfsu2-vault` | Şifreli Cloud kayıtlarının sunucu tarafı saklama motoru. |
| `nfsu2-claims` / `nfsu2-bans` | İsim sahipliği ve operatör ban kayıtları. |
| `nfsu2-server` | HTTP rotaları, yapılandırma, servis entegrasyonu ve ana binary. |
| `nfsu2-roamload` | Free Roam yük testleri için simüle oyuncu üreticisi. |

### 💽 Sunucu veri alanları

Docker dağıtımında üç temel veri alanı kullanılır:

| Mount | İçerik | Erişim |
|---|---|---|
| `/game` | Kullanıcının NFSU2 kurulum klasörü | Salt okunur |
| `/module` | `nfsu2.wasm` ve `nfsu2.json` | Salt okunur |
| `/state` | ETag anahtarları, LAN/Online durumu, ban/claim kayıtları, Cloud ve Player Hub verileri | Kalıcı, yazılabilir volume |

**Güncelleme sırasında `/state` korunmalıdır.** Sunucu imajı oyun dosyalarını içermez. Docker volume'unu silmek oyuncu verilerinin veya sunucu kimlik durumunun kaybına yol açabilir.

---

<a id="installation"></a>

## ⚙️ Kurulum

### ✅ Gereksinimler

**Oyun dosyaları**

Projenin belgelenmiş hedefi **Need for Speed: Underground 2 v1.2 North America** PC sürümüdür.

| Dosya | Beklenen bilgi |
|---|---|
| `SPEED2.EXE` | 4.800.512 bayt |
| SHA-256 | `f9dd86c054878ce6276beb07c1fd61874f7a1e4bf1f241b084c65b73e24168a7` |

`server.dll` ve `server.cfg`, mevcut oyun kurulumunuzdan kullanılır. Orijinal oyun dosyalarını GitHub'a veya Docker imajına yüklemeyin.

**Derleme ortamı**

- 64-bit Linux veya WSL2 Ubuntu.
- Git ve Python 3, `venv`, pip.
- `requirements.txt`: Capstone 5.x, pefile ve Pillow.
- Node.js ve npm (Docker build ortamı Node 24 kullanır).
- Rust stable toolchain (workspace minimum Rust 1.85).
- WASI SDK 34 (Linux x86_64 için uygun paket).
- Native build araçları ve C derleyicisi.

### 🐧 Linux / WSL2 üzerinde yerel kurulum

Aşağıdaki adımlar kendi oyun klasörünüzden WASM modülü üretir ve Rust web sunucusunu başlatır.

**1. Depoyu klonlayın**

```bash
git clone https://github.com/trpolaris/NFSU2-Web.git
cd NFSU2-Web
```

**2. Python ortamını hazırlayın**

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

**3. WASI SDK 34'ü hazırlayın**

[WASI SDK Releases](https://github.com/WebAssembly/wasi-sdk/releases) sayfasından Linux x86_64 için WASI SDK 34 paketini indirin ve depo kökündeki `deps/` klasörüne açın. Beklenen dizin:

```text
deps/
└── wasi-sdk-34.0-x86_64-linux/
    └── bin/
        ├── clang
        └── wasm-ld
```

**4. Kendi NFSU2 oyun klasörünüzü tanımlayın**

`NFSU2_DATA`, içinde `SPEED2.EXE` bulunan klasörü göstermelidir. WSL örneği:

```bash
export NFSU2_DATA="/mnt/c/Program Files (x86)/Need For Speed Underground 2"
```

**5. Oyun kodunu üretin ve WASM modülünü derleyin**

```bash
bash web/gen.sh "$NFSU2_DATA/SPEED2.EXE"

WASI="$PWD/deps/wasi-sdk-34.0-x86_64-linux" \
J="$(nproc)" bash web/build.sh
```

Beklenen çıktılar:

```text
out/web/nfsu2.wasm
out/web/nfsu2.json
```

**6. Web istemcisini kontrol edip derleyin**

```bash
cd web
npm ci
npm run check
npm run build
cd ..
```

**7. Rust sunucusunu derleyin ve test edin**

```bash
bash web/server-rs/build.sh --test
```

**8. Yerel sunucuyu başlatın**

```bash
bash web/start.sh --data "$NFSU2_DATA"
```

Varsayılan yerel adres:

```text
http://localhost:8080/
```

Sunucuyu durdurmak için `Ctrl+C` kullanın. Port doluysa örneğin `--http-port 9080` verebilirsiniz.

> [!TIP]
> `web/start.sh`, gerekli sayfa ve Rust sunucu çıktılarının eksik veya kaynaklardan eski olup olmadığını kontrol eder; uygun bağımlılıklar hazırsa eksik derlemeleri yapar. WASM üretimi için WASI SDK ile `web/gen.sh` tarafından oluşturulan `gen/all/` kaynakları gerekir.

### 🌐 LAN ve internet erişimi

Tarayıcı oyunun WebGPU ve SharedArrayBuffer gibi özellikleri için güvenli bağlam gerekir. Yerel geliştirmede `http://localhost` kullanılabilir. Diğer bilgisayarlar için HTTPS sağlayan sertifika, reverse proxy veya tünel gereklidir.

- **Caddy / Nginx:** HTTPS sonlandırma ve WebSocket geçişi.
- **Docker Compose:** Sunucu konteyneri, kalıcı state volume'u ve oyun/modül mount'ları.
- **Cloudflare Tunnel:** Uygun tünel profiliyle public HTTPS erişimi.
- **Güvenlik:** Sunucu varsayılan olarak kullanıcı adı/parola tabanlı genel hesap sistemi sağlamaz. İnternete açık kullanımda Cloudflare Access veya eşdeğer erişim denetimi yapılandırın.

### 🐳 VPS / Docker dağıtımı

Depoda hazır dağıtım dosyaları bulunur:

- Compose: `web/deploy/compose.yml`
- Caddy: `web/deploy/Caddyfile`
- Rust imajı: `web/server-rs/Dockerfile`
- Alternatif Compose profilleri: `compose.443.yml`, `compose.cloudflare.yml`, `compose.origin.yml`, `compose.tunnel.yml`
- Ayrıntılı kurulum: [VPS Kurulum Rehberi](docs/web/VPS.md)

Temel dağıtım akışı:

1. Linux VPS ve alan adı hazırlayın; DNS kayıtlarını VPS'e yönlendirin.
2. Kendi oyun dosyalarınızı `/srv/nfsu2/game` dizinine aktarın.
3. Derlenen `nfsu2.wasm` ve `nfsu2.json` dosyalarını modül dizinine yerleştirin.
4. Compose ve `.env` yapılandırmasını sunucunuza göre ayarlayın.
5. Gerekli HTTP/HTTPS portları ve reverse proxy/TLS ayarlarını yapılandırın.
6. `docker compose up -d` ile başlatın; `docker compose logs -f server` ile günlükleri izleyin.

İmaj GitHub Container Registry'de yayımlanır: [GHCR container paketi](https://github.com/trpolaris/NFSU2-Web/pkgs/container/need-for-speed-underground-2-web-rs). İmaj oyun varlıklarını içermez; oyun ve modül dosyaları ayrı mount edilir.

> [!CAUTION]
> Kalıcı `/state` volume'unu yedeklemeden silmeyin. Public sunucuya erişebilen kişiler oyun dosyalarını indirebilir ve sunucuya bağlanabilir; erişim politikasını firewall, reverse proxy ve gerekiyorsa kimlik doğrulama katmanıyla sınırlayın.

---

<a id="development"></a>

## 🧪 Geliştirme ve testler

### 📁 Depo yapısı

| Dizin | Amaç |
|---|---|
| `app/` | Ortak registry/default verileri. |
| `runtime/` | C çalışma zamanı, platform uyumluluk katmanı ve web host entegrasyonu. |
| `gen/` | Oyun EXE/DLL dosyalarından üretilen kaynaklar; yerel üretilir. |
| `out/` | WASM, sunucu binary'leri, derleme cache'i ve test çıktıları. |
| `deps/` | WASI SDK ve yerel build bağımlılıkları. |
| `.venv/` | Python sanal ortamı. |
| `web/src/app/` | Ana web arayüzü, oyun ayarları, kayıtlar, giriş ve sohbet modülleri. |
| `web/src/hub/` | React Player Hub. |
| `web/server-rs/` | Rust sunucusu, crate'ler ve Dockerfile. |
| `web/deploy/` | Compose, Caddy ve dağıtım araçları. |
| `web/tools/` | Derleme yardımcıları, sunucu ve multiplayer test sürücüleri. |
| `web/test/` | Web, güvenlik, veri, UI, multiplayer ve entegrasyon testleri. |
| `docs/web/` | Oynama, VPS, ağ tanılama, Cloud ve tasarım belgeleri. |
| `docs/screenshots/` | README ve dokümantasyon GIF'leri. |
| `control-center/` | Windows WPF/.NET 10 uygulaması. |
| `.github/workflows/` | Multiplayer/regresyon CI ve container image workflow'ları. |

`gen/`, `out/`, `deps/` ve `.venv/` geliştirme sırasında yerel oluşturulan içeriklerdir; Git deposuna eklenmemelidir.

### 🧰 Kontrol komutları

Web istemcisi:

```bash
cd web
npm ci
npm run check
npm run build
cd ..
```

Rust backend ve workspace testleri:

```bash
bash web/server-rs/build.sh --test
```

Web regresyonları:

```bash
node --test --test-concurrency=1 web/test/*.test.mjs
```

CI ayrıca Rust sunucusunu derler, sentetik Online protokol yük/kötüye kullanım testini, Chromium tabanlı web regresyonlarını ve container image build'ini çalıştırır.

- [⚙️ Multiplayer & Regression CI](https://github.com/trpolaris/NFSU2-Web/actions/workflows/multiplayer-ci.yml)
- [🐳 Container Image CI](https://github.com/trpolaris/NFSU2-Web/actions/workflows/image-rs.yml)
- [📦 Releases](https://github.com/trpolaris/NFSU2-Web/releases)

### 📚 Teknik dokümantasyon

| Belge | İçerik |
|---|---|
| [Oynama Rehberi](docs/web/PLAYING.md) | Tarayıcı desteği, ilk açılış, çevrimdışı kullanım ve kontroller. |
| [VPS / Docker Kurulumu](docs/web/VPS.md) | Linux sunucu, HTTPS, Caddy, Cloudflare ve dağıtım seçenekleri. |
| [Ağ Tanılama](docs/web/NETWORK-DIAGNOSTICS.md) | F8 metrikleri ve ağ gecikmesi açıklamaları. |
| [Free Roam Sohbeti](docs/web/FREEROAM-CHAT.md) | All/Crew kanalları, kontroller, limitler ve HUD geçmişi. |
| [TRPOLARIS Cloud](docs/web/TRPOLARIS-CLOUD.md) | Şifreli bulut kayıtları ve senkronizasyon davranışı. |
| [Web Tasarım Sistemi](docs/web/WEB-UX-DESIGN-SYSTEM.md) | UI dili, responsive kurallar ve Player Hub tasarımı. |
| [Web / Oyun Tasarımı](docs/web/DESIGN.md) | Web runtime ve oyun arayüzü tasarım notları. |
| [Rust Sunucu Rehberi](web/server-rs/README.md) | Backend bileşenleri, build, test ve performans ölçümleri. |
| [Control Center Rehberi](control-center/README.md) | Windows uygulaması ve kaynak kodundan derleme. |
| [Multiplayer Doğrulama](docs/MULTIPLAYER-VALIDATION.md) | Online, LAN, Free Roam ve yük doğrulama senaryoları. |

---

## 🧭 Kapsam ve bilinen sınırlar

Şeffaflık için mevcut veri kapsamı:

- Player Hub profilleri anonim tarayıcı oturumuna bağlıdır; e-posta/şifre hesabı ve cihazlar arası ortak kimlik sistemi değildir.
- Player Hub garajı manuel kullanıcı girişidir; oyun save içindeki gerçek araç ve modifiye envanterini otomatik içe aktarmaz.
- Kariyer istatistikleri ve yarış performansı için sürüm kontrollü telemetri entegrasyonu gerekir; bağlantı tamamlanana kadar ilgili alanlar yer tutucu gösterir.
- Mod Kitaplığı mod dosyalarını barındırmaz veya otomatik kurmaz; bağlantı ve liste yönetimi sağlar.
- Çevrimdışı tek oyunculu başlatma, sayfanın ve gerekli oyun verilerinin daha önce bu tarayıcıda indirilmiş olmasına bağlıdır. Free Roam ve Online sunucu gerektirir.
- WebGPU, Web Audio, gamepad, dokunmatik ve direksiyon desteği tarayıcı/cihaz/driver yeteneklerine bağlıdır.
- LAN'da denenmiş olması farklı ISP/NAT/proxy koşullarında internet erişiminin otomatik olarak doğrulandığı anlamına gelmez. Public dağıtımı ayrıca test edin.

---

## 🔐 Güvenlik ve lisans

- Oyun klasörü sunucu tarafından izin listesiyle sunulur; klasörün tamamı web'e açılmaz.
- Player Hub oturumları, CSRF ve aynı-origin kontrolleriyle korunur.
- Docker'da `/game` ve `/module` salt okunur, `/state` kalıcı ve yazılabilir olarak ayrılır.
- TLS özel anahtarları, sertifikalar, parolalar, API token'ları, gerçek IP adresleri ve kullanıcı kayıtları kaynak depoya eklenmemelidir.
- Kaynak kodunun lisansı için [LICENSE](LICENSE) dosyasına bakın. MIT lisansı Need for Speed: Underground 2 oyununu veya Electronic Arts'a ait varlıkları kapsamaz.
- Need for Speed ve Need for Speed: Underground 2, Electronic Arts'ın ticari markalarıdır. **TRPOLARIS, Electronic Arts ile bağlantılı değildir; EA tarafından desteklenmez veya onaylanmaz.**

Teknik esin kaynağı: [th0mk/nfsu2-web](https://github.com/th0mk/nfsu2-web). Orijinal projenin kaynak kodu ve katkıları kendi sahiplerine aittir; TRPOLARIS'e ait eklemeler bu depoda ayrı olarak geliştirilir.

---

<div align="center">

## 🏎️ TRPOLARIS

**Underground 2 · Your city, your rules.**

[⭐ GitHub'da projeyi incele](https://github.com/trpolaris/NFSU2-Web) · [📦 Sürümler](https://github.com/trpolaris/NFSU2-Web/releases) · [🐛 Hata bildir](https://github.com/trpolaris/NFSU2-Web/issues)

<sub>Topluluk odaklı bağımsız bir web uyarlaması. Oyun dosyaları kullanıcı tarafından sağlanır.</sub>

</div>