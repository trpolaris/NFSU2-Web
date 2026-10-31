<div align="center">

# 🏁 TRPOLARIS · NFSU2 Web

**Need for Speed: Underground 2 deneyimini modern tarayıcılara taşıyan bağımsız topluluk projesi.**

[![Maintainer](https://img.shields.io/badge/Maintainer-TRPOLARIS-111827?style=for-the-badge)](https://github.com/trpolaris)
[![License](https://img.shields.io/badge/License-MIT-0f766e?style=for-the-badge)](LICENSE)
[![Multiplayer CI](https://github.com/trpolaris/NFSU2-Web/actions/workflows/multiplayer-ci.yml/badge.svg?branch=main)](https://github.com/trpolaris/NFSU2-Web/actions/workflows/multiplayer-ci.yml)
[![Container Image](https://github.com/trpolaris/NFSU2-Web/actions/workflows/image-rs.yml/badge.svg?branch=main)](https://github.com/trpolaris/NFSU2-Web/actions/workflows/image-rs.yml)
[![WebAssembly](https://img.shields.io/badge/Runtime-WebAssembly-654ff0?style=flat-square&logo=webassembly&logoColor=white)](https://webassembly.org/)
[![WebGPU](https://img.shields.io/badge/Graphics-WebGPU-2563eb?style=flat-square)](https://developer.mozilla.org/docs/Web/API/WebGPU_API)

[Proje](#proje-hakkında) · [Ekran Görüntüleri](#ekran-görüntüleri) · [Control Center](#trpolaris-control-center) · [Web Oyunu](#nfsu2-web) · [Kurulum](#kurulum) · [Geliştirme](#geliştirme) · [Lisans](#lisans-ve-telif)

</div>

---

## Proje hakkında

**TRPOLARIS NFSU2 Web**, *Need for Speed: Underground 2* oyununu WebAssembly ve WebGPU teknolojileriyle tarayıcıda çalıştırmayı amaçlayan bağımsız bir topluluk projesidir. Web istemcisi, Rust tabanlı sunucu ve Windows için geliştirilen Control Center aynı depoda bulunur; ancak kendi kaynak kodu ve yayın süreçleriyle ayrı uygulamalar olarak geliştirilir.

### Projenin esin kaynağı

Bu çalışmanın temel teknik çıkış noktası ve ana esin kaynağı, [th0mk/nfsu2-web](https://github.com/th0mk/nfsu2-web) açık kaynak projesidir. TRPOLARIS, bu projede ortaya konan tarayıcı tabanlı NFSU2 yaklaşımını temel alarak kendi arayüzünü, sunucu yönetim akışlarını, ağ ve dağıtım düzenlemelerini ve Windows Control Center uygulamasını geliştirmektedir.

Orijinal projeye ve katkılarına açıkça atıfta bulunuyoruz. TRPOLARIS'e ait ek geliştirmeler, özgün projenin yazarı veya geliştiricileri tarafından hazırlanmış ya da onaylanmış gibi sunulmaz.

> [!IMPORTANT]
> **Bu depo Need for Speed: Underground 2 oyun dosyalarını içermez.** `SPEED2.EXE`, `server.dll`, oyun arşivleri ve telifli oyun verileri dağıtılmaz. Derleme ve kullanım için kendi yasal PC oyun kopyanız gerekir.

## İki bağımsız uygulama

| Uygulama | Platform | Görevi |
|---|---|---|
| **NFSU2 Web** | Web tarayıcısı / Linux sunucu | Oyunu tarayıcıda çalıştırır; Local, LAN ve çok oyunculu oyun deneyimini sunar. |
| **TRPOLARIS Control Center** | Windows / WPF / .NET 10 | WSL, Ubuntu ve Docker üzerinden NFSU2 Web kurulumunu ve sunucu yönetimini kolaylaştırır. |

```text
Windows
└── TRPOLARIS Control Center
    └── WSL 2 / Ubuntu
        └── Docker Engine
            └── NFSU2 Web sunucusu

Web tarayıcısı
└── NFSU2 Web
    ├── WebAssembly oyun çalışma zamanı
    ├── WebGPU grafikler
    ├── Web Audio ses
    └── Local / LAN / Online
```

---

## Ekran görüntüleri

Galeriler uygulamanın ana ekranlarını otomatik kayan önizlemelerle gösterir. Her ekranın tam boy görseli ilgili bağlantıdan açılabilir.

### TRPOLARIS Control Center

<p align="center">
  <img src="docs/screenshots/control-center/slider.gif" alt="TRPOLARIS Control Center ekran galerisi" width="100%" />
</p>

| Ekran | Açıklama |
|---|---|
| [01 · Genel Bakış](docs/screenshots/control-center/01-genel-bakis.jpg) | WSL, Ubuntu, Docker ve sunucu durumunu tek ekranda izleme. |
| [02 · Sunucu Yönetimi](docs/screenshots/control-center/02-sunucu-yonetimi.jpg) | Container işlemleri, güncelleme ve sunucu günlükleri. |
| [03 · Dosya Yöneticisi](docs/screenshots/control-center/03-dosya-yoneticisi.jpg) | WSL proje dosyalarını görüntüleme ve düzenleme. |
| [04 · Tek Tık Kurulum](docs/screenshots/control-center/04-tek-tik-kurulum.jpg) | Oyun klasörü ve port seçimiyle kurulum akışı. |
| [05 · Erişim ve Paylaşım](docs/screenshots/control-center/05-erisim-ve-paylasim.jpg) | Local, LAN / HTTPS ve Public Tunnel profilleri. |
| [06 · Tanılama ve Bakım](docs/screenshots/control-center/06-tanilama-ve-bakim.jpg) | WSL, Docker, port ve sunucu kontrolleri. |
| [07 · Kaldırma Merkezi](docs/screenshots/control-center/07-kaldirma-merkezi.jpg) | NFSU2 kaynaklarını seçerek kaldırma. |
| [08 · Canlı İşlem Günlüğü](docs/screenshots/control-center/08-canli-islem-gunlugu.jpg) | PowerShell ve WSL işlemlerini canlı izleme. |

### NFSU2 Web

<p align="center">
  <img src="docs/screenshots/web/slider.gif" alt="TRPOLARIS NFSU2 Web ekran galerisi" width="100%" />
</p>

| Ekran | Açıklama |
|---|---|
| [09 · Ana Sayfa](docs/screenshots/web/09-ana-sayfa.jpg) | Oyunu başlatma ve hızlı erişim alanları. |
| [10 · Çevrimiçi](docs/screenshots/web/10-cevrimici.jpg) | Oyuncular, ekipler, konvoy ve çevrimiçi tercihler. |
| [11 · Mod Kitaplığı](docs/screenshots/web/11-mod-kitapligi.jpg) | Community Picks ve kişisel mod listesi. |
| [12 · Kayıtlar](docs/screenshots/web/12-kayitlar.jpg) | Yerel kayıtlar, yedekleme ve bulut kayıtları. |
| [13 · Kontroller](docs/screenshots/web/13-kontroller.jpg) | Klavye ve oyun kumandası eşlemeleri. |
| [14 · Ayarlar](docs/screenshots/web/14-ayarlar.jpg) | Oyun, arayüz ve erişilebilirlik tercihleri. |
| [15 · Sistem Tanılaması](docs/screenshots/web/15-sistem-tanilamasi.jpg) | Tarayıcı, WebGPU, sürüm ve oyun verisi kontrolleri. |
| [16 · Proje Hakkında](docs/screenshots/web/16-proje-hakkinda.jpg) | Proje bilgisi, kaynak kodu ve bildirimler. |

---

## TRPOLARIS Control Center

Control Center, NFSU2 Web'i Windows üzerinden kurmak ve yönetmek için hazırlanmış bağımsız bir masaüstü uygulamasıdır. WSL 2, Ubuntu ve Docker işlemlerini tek arayüzde toplar.

### Öne çıkan özellikler

- **Kurulum:** Gerekli araçları hazırlar, kullanıcının oyun dosyalarından WebAssembly üretir ve sunucuyu başlatır.
- **Sunucu yönetimi:** NFSU2 container'ını başlatır, durdurur, yeniden başlatır ve sağlık durumunu izler.
- **Dosya yönetimi:** WSL içindeki proje dosyalarını VS Code veya metin düzenleyicisiyle açmayı kolaylaştırır.
- **Erişim profilleri:** Yerel kullanım, LAN / HTTPS ve isteğe bağlı Cloudflare Tunnel yapılandırması.
- **Tanılama:** WSL, Ubuntu, Docker, portlar ve sunucu durumunu denetler.
- **Canlı günlükler:** Kurulum ve yönetim işlemlerinin PowerShell / WSL çıktılarını gösterir.
- **Seçmeli kaldırma:** NFSU2 bileşenlerini ayrı ayrı hedefler; diğer Docker projeleri varsayılan olarak korunur.

### Gereksinimler

- Windows 10/11 x64.
- WSL 2 ve Ubuntu dağıtımı.
- Çalışır durumda Docker Engine (Docker Desktop veya uygun WSL Docker kurulumu).
- Kurulum ve bağımlılıkların indirilmesi için internet bağlantısı.
- WebAssembly üretimi için uyumlu, kullanıcıya ait NFSU2 PC oyun kopyası.

### İndirme ve kurulum

**[Control Center GitHub Releases](https://github.com/trpolaris/NFSU2-Web/releases)** · [Kaynak kodu](control-center/) · [Ayrıntılı kullanım rehberi](control-center/README.md)

1. GitHub Releases sayfasından yayımlanmış Windows sürümünü indirin.
2. WSL 2 ve Ubuntu'nun kurulu ve erişilebilir olduğunu doğrulayın.
3. Docker Engine'in çalıştığını kontrol edin.
4. Control Center'ı açıp **Tek Tık Kurulum** ekranına geçin.
5. `SPEED2.EXE` içeren kendi oyun klasörünüzü seçin ve port / erişim profilini belirleyin.
6. Kurulumu başlatın; işlem günlüğünden bağımlılık, WASM ve Docker adımlarını takip edin.
7. Container sağlık durumu `healthy` olduktan sonra Local veya LAN adresini tarayıcıda açın.

Varsayılan yapılandırmada proje kökü `C:\nfsu2`, yerel HTTP portu `9093`, LAN HTTPS portu `8443` olarak kullanılır. Etkin ayarlar uygulama içinde kontrol edilmelidir.

Windows logları:

```text
%LOCALAPPDATA%\TRPOLARIS\NFSU2-Web-Control-Center\logs
```

### Kaldırma ve veri güvenliği

> [!CAUTION]
> Kaldırma işleminden önce oyun kayıtlarınızı, oyun klasörünüzü ve önemli proje dosyalarınızı yedekleyin. Yalnızca kaldırmak istediğiniz NFSU2 bileşenlerini seçin.

Ubuntu WSL dağıtımını kaldırmak içindeki tüm Linux dosyalarını siler. Docker Desktop'ı kaldırmak NFSU2 dışındaki Docker projelerini etkileyebilir. Oyun klasörünü veya state volume'unu silmek oyun / sunucu verilerinin kaybolmasına neden olabilir. Bu seçenekleri yalnızca etkilerini anladıktan sonra kullanın.

Public Tunnel bağlantısı tek başına kimlik doğrulaması sağlamaz. İnternete açık kullanımda Cloudflare Access veya eşdeğer bir erişim kontrolü yapılandırın.

---

## NFSU2 Web

Web uygulaması, kullanıcının kendi oyun kopyasından üretilen WebAssembly modülünü tarayıcıda çalıştırır. Rust sunucusu web dosyalarını ve oyun verilerini sunar; ayrıca WebSocket üzerinden LAN ve çok oyunculu bağlantıları yönetir.

### Öne çıkan özellikler

- WebAssembly tabanlı oyun çalışma zamanı.
- WebGPU grafik altyapısı ve Web Audio ses sistemi.
- Klavye, fare, oyun kumandası ve desteklenen dokunmatik girişler.
- Local, sanal LAN, Free Roam ve Online bağlantı akışları.
- Yerel kayıtlar, desteklenen sunucu kurulumlarında bulut kayıtları.
- PWA ve önbelleğe alınmış verilerle sınırlı çevrimdışı kullanım.
- Çok dilli arayüz, mod kitaplığı ve oyun içi ayarlar.
- F8 üzerinden FPS ve ağ tanılama metrikleri.

### Tarayıcı gereksinimleri

- Güncel Google Chrome önerilir; WebGPU destekleyen Firefox sürümleri de kullanılabilir.
- WebGPU desteği tarayıcıya, işletim sistemine, GPU'ya ve sürücülere bağlıdır.
- Başka cihazlardan erişim için HTTPS gerekir. `localhost` yerel geliştirme kullanımında uygundur.

### Oyun dosyası uyumluluğu

Proje belgelerinde hedeflenen sürüm **Need for Speed: Underground 2 v1.2 North America** olarak belirtilir.

| Dosya | Beklenen değer |
|---|---|
| `SPEED2.EXE` | 4.800.512 bayt |
| SHA-256 | `f9dd86c054878ce6276beb07c1fd61874f7a1e4bf1f241b084c65b73e24168a7` |

Oyun dosyaları depoda bulunmaz ve uygulama tarafından indirilmez. `server.dll` dosyanız varsa `SPEED2.EXE` ile aynı oyun klasöründe bulundurun.

---

## Kurulum

### Control Center ile

Windows üzerinde en kolay yol Control Center kullanmaktır. Yukarıdaki [kurulum adımlarını](#indirme-ve-kurulum) izleyin.

### Linux / WSL üzerinden manuel kurulum

Geliştirme araçlarını Ubuntu veya WSL 2 içinde kurun:

```bash
sudo apt update
sudo apt install -y git curl python3 python3-venv python3-pip \
  build-essential clang cmake pkg-config
```

Node.js 24, Rust stable ve WASI SDK 34 de gereklidir. Ardından:

```bash
git clone https://github.com/trpolaris/NFSU2-Web.git
cd NFSU2-Web

python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
```

WASI SDK 34'ü depo kökündeki `deps/` dizinine kurduktan sonra kendi oyun dosyanızdan kaynakları üretin:

```bash
web/gen.sh "/path/to/Need for Speed Underground 2/SPEED2.EXE"
web/build.sh
```

Yerel sunucuyu başlatın:

```bash
web/start.sh --data "/path/to/Need for Speed Underground 2"
```

Tarayıcıdan açın:

```text
http://localhost:8080
```

Başka cihazlardan erişim veya arkadaşlarınızla çevrimiçi oynamak için HTTPS sağlayan bir sunucu / ters proxy gerekir.

---

## VPS ve Docker

NFSU2 Web, Linux VPS üzerinde Docker Compose ile yayımlanabilir. Varsayılan yapılandırma `web/deploy/compose.yml` içindedir.

Temel gereksinimler:

- Linux VPS ve Docker Engine / Compose.
- VPS IP adresine yönlenen alan adı.
- Kendi oyun dosyalarınız.
- `out/web/nfsu2.wasm` ve `out/web/nfsu2.json` derleme çıktıları.
- Varsayılan Caddy yapılandırması için dışarıya açık TCP 80 ve TCP/UDP 443.

Örnek başlatma:

```bash
cd /srv/nfsu2
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs -f server
```

Ayrıntılı dosya aktarımı, DNS, TLS, Cloudflare ve güvenlik adımları için [VPS kurulum rehberine](docs/web/VPS.md) bakın.

> [!WARNING]
> Sunucu varsayılan olarak uygulama seviyesinde kullanıcı hesabı veya parola zorunluluğu getirmez. İnternete açmadan önce erişim politikanızı belirleyin ve oyun dosyalarının kimler tarafından indirilebildiğini göz önünde bulundurun.

---

## Oynama ve kontroller

| Tuş | İşlev |
|---|---|
| Ok tuşları / W A S D | Gaz, fren ve direksiyon |
| Alt | Nitro |
| Space | El freni |
| Left Shift / Left Ctrl | Manuel vites yükseltme / düşürme |
| C | Kamera |
| B | Arkaya bakış |
| R | Aracı yeniden konumlandırma |
| Esc / P | Duraklatma |
| Enter | Menü seçimi |
| F8 | FPS ve ağ tanılama |
| F9 | Oyun içi sayfa menüsü |
| F12 | Fotoğraf modu / ekran görüntüsü |

Kontrol cihazı eşlemeleri, kayıtlar, oyun modları ve ayrıntılı kullanım için [Oynama Rehberi](docs/web/PLAYING.md) dosyasına bakın.

Çevrimdışı kullanım, daha önce tarayıcıya önbelleğe alınmış uygulama ve oyun verileriyle sınırlıdır. LAN ve Online özellikleri sunucu bağlantısı gerektirir.

---

## Geliştirme

### Depo yapısı

```text
NFSU2-Web/
├── app/
├── runtime/
├── web/                    # Web arayüzü ve Rust sunucusu
├── tools/
├── win/
├── control-center/         # Bağımsız WPF / .NET 10 uygulaması
├── docs/
│   ├── web/
│   └── screenshots/
├── tests/
└── .github/workflows/
```

### Web kontrolleri

```bash
cd web
npm ci
npm run check
npm run build
cd ..
```

Rust sunucusunu derlemek ve test etmek için:

```bash
web/server-rs/build.sh
web/server-rs/build.sh --test
```

### Control Center derlemesi

Control Center, web uygulamasından bağımsız olarak Windows üzerinde .NET 10 ile derlenir. Kaynak kodu ve uygulamaya özel yönergeler `control-center/README.md` içindedir. Windows Release derlemesi, tek dosyalı EXE yayını ve güvenli kurulum testleri tamamlanmadan sürüm doğrulanmış kabul edilmemelidir.

### Dokümantasyon

- [Oynama Rehberi](docs/web/PLAYING.md)
- [VPS Kurulumu](docs/web/VPS.md)
- [Ağ Tanılama](docs/web/NETWORK-DIAGNOSTICS.md)
- [Tasarım ve Mimari](docs/web/DESIGN.md)
- [Control Center Rehberi](control-center/README.md)
- [Rust Sunucu Rehberi](web/server-rs/README.md)

---

## Lisans ve telif

Bu depodaki kaynak kodunun lisans koşulları için [LICENSE](LICENSE) dosyasına bakın. Proje lisansı, *Need for Speed: Underground 2* oyununu veya Electronic Arts'a ait oyun varlıklarını kapsamaz.

*Need for Speed* ve *Need for Speed: Underground 2*, Electronic Arts'ın ticari markalarıdır. **TRPOLARIS, Electronic Arts ile bağlantılı değildir; EA tarafından desteklenmez veya onaylanmaz.**

TRPOLARIS, [th0mk/nfsu2-web](https://github.com/th0mk/nfsu2-web) projesini temel teknik esin kaynağı olarak belirtir. Orijinal proje ve katkıları kendi sahiplerine aittir; bu depodaki TRPOLARIS'e özgü düzenlemeler ayrıca geliştirilmiştir.

---

<div align="center">

**TRPOLARIS**  
*Underground 2 · Your city, your rules.*

[⬆ README'nin başına dön](#-trpolaris--nfsu2-web)

</div>
