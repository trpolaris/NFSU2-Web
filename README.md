<div align="center">

# 🏁 TRPOLARIS · NFSU2 Web

**Need for Speed: Underground 2 deneyimini WebAssembly, WebGPU ve modern web teknolojileriyle tarayıcıya taşıyan topluluk projesi.**

[![Maintainer](https://img.shields.io/badge/Maintainer-TRPOLARIS-111827?style=for-the-badge)](https://github.com/trpolaris)
[![License](https://img.shields.io/badge/License-MIT-0f766e?style=for-the-badge)](LICENSE)
[![Multiplayer CI](https://github.com/trpolaris/NFSU2-Web/actions/workflows/multiplayer-ci.yml/badge.svg?branch=main)](https://github.com/trpolaris/NFSU2-Web/actions/workflows/multiplayer-ci.yml)
[![Container Image](https://github.com/trpolaris/NFSU2-Web/actions/workflows/image-rs.yml/badge.svg?branch=main)](https://github.com/trpolaris/NFSU2-Web/actions/workflows/image-rs.yml)
[![Control Center CI](https://github.com/trpolaris/NFSU2-Web/actions/workflows/control-center.yml/badge.svg?branch=main)](https://github.com/trpolaris/NFSU2-Web/actions/workflows/control-center.yml)
[![WebAssembly](https://img.shields.io/badge/Runtime-WebAssembly-654ff0?style=flat-square&logo=webassembly&logoColor=white)](https://webassembly.org/)
[![WebGPU](https://img.shields.io/badge/Graphics-WebGPU-2563eb?style=flat-square)](https://developer.mozilla.org/docs/Web/API/WebGPU_API)

[🚘 Proje](#-proje-hakkında) · [✨ Özellikler](#-öne-çıkan-özellikler) · [🖥️ Control Center](#️-windows-control-center) · [📋 Gereksinimler](#-gereksinimler) · [🧰 Yerel Kurulum](#-yerel-kurulum) · [🌐 VPS Kurulumu](#-vps-ve-docker-kurulumu) · [🎮 Oynama](#-oynama-ve-kontroller) · [🛠️ Geliştirme](#️-geliştirme) · [⚖️ Lisans](#️-lisans-ve-telif)

</div>

---

## 🚘 Proje hakkında

**TRPOLARIS NFSU2 Web**, *Need for Speed: Underground 2* oyununu modern web tarayıcılarında çalıştırmak amacıyla geliştirilen bir uyarlamadır. Proje; oyunun kendi PC sürümünden üretilen WebAssembly çalışma modülünü, TypeScript tabanlı tarayıcı arayüzünü ve Rust ile geliştirilen oyun sunucusunu bir araya getirir.

Hedef yalnızca oyunu tarayıcıda açmak değildir. Yerel oynama deneyiminin yanında, uygun bir sunucu üzerinden LAN, serbest dolaşım (Free Roam) ve oyunun Online modu gibi çok oyunculu özellikleri de desteklemektir.

> [!IMPORTANT]
> **Bu depo oyun dosyalarını içermez.** SPEED2.EXE, server.dll, oyun arşivleri, oyun verileri ve telifli içerikler GitHub deposuna eklenmez. Çalıştırmak için kendi yasal PC oyun kopyanızı kullanmanız gerekir. Proje oyun dosyalarını indirmez veya dağıtmaz.

### Projenin çalışma mantığı

1. Kullanıcı kendi uyumlu PC oyun kopyasını sağlar.
2. **web/gen.sh**, oyun çalıştırılabilir dosyasını analiz ederek tarayıcı derlemesi için gerekli üretilmiş kaynakları hazırlar.
3. **web/build.sh**, çalışma zamanı kaynaklarını WASI SDK ile WebAssembly modülüne dönüştürür.
4. TypeScript tabanlı web uygulaması oyunu tarayıcıda yükler; WebGPU grafik, Web Audio ses ve tarayıcı giriş API'lerini kullanır.
5. Rust sunucusu web uygulamasını, oyun verilerini ve çok oyunculu ağ servislerini sunar.

Bu yapı sayesinde oyun dosyaları uygulama kaynak kodundan ayrı tutulur. Sunucu kurulumunda oyun klasörü salt okunur olarak bağlanır; oyuncuların kayıtları ve sunucuya ait kalıcı bilgiler ayrı bir durum alanında tutulur.

## ✨ Öne çıkan özellikler

| Alan | Özellik | Açıklama |
|---|---|---|
| 🧠 Çalışma zamanı | WebAssembly | Oyunun analiz edilmiş ve derlenmiş kodu tarayıcıda çalışır. |
| 🎨 Grafik | WebGPU | Destekleyen tarayıcılarda GPU hızlandırmalı çizim altyapısı kullanılır. |
| 🔊 Ses | Web Audio | Oyun sesi tarayıcı ses altyapısı üzerinden işlenir. |
| 🌐 Çok oyunculu | Virtual LAN | Sunucu üzerinden oyuncular arasında sanal LAN bağlantısı kurulur. |
| 🏙️ Oyun modu | Free Roam | Uygun sunucuya bağlanan oyuncular serbest dolaşımda birlikte oynayabilir. |
| 🏁 Oyun modu | Online | Oyunun Online modu için gerekli sunucu servisleri desteklenir. |
| 🎮 Giriş | Klavye ve fare | Menü ve oyun kontrolleri tarayıcı üzerinden kullanılabilir. |
| 🕹️ Giriş | Oyun kumandası | Tarayıcının Gamepad API'si üzerinden uyumlu kontrol cihazları kullanılabilir. |
| 🏎️ Giriş | Direksiyon ve dokunmatik | Tarayıcının tanıdığı uyumlu direksiyonlar ve desteklenen dokunmatik ekranlar kullanılabilir. |
| 💾 Kayıt | Yerel kayıtlar | Kayıtlar, ayarlar ve ekran görüntüleri tarayıcı depolama alanında saklanır. |
| ☁️ Kayıt | Bulut kayıtları | Desteklenen sunucu kurulumlarında anahtar kelime/parola tabanlı kayıt senkronizasyonu kullanılabilir. |
| 📱 Web uygulaması | PWA ve çevrimdışı önbellek | Daha önce yüklenmiş uygulama ve önbelleğe alınmış oyun verileriyle çevrimdışı başlatma desteklenir. |
| 🌍 Arayüz | Çoklu dil | Çok dilli arayüz ve ayrı Türkçe dil paketi desteği bulunur. |
| 🧩 Özelleştirme | Modlar ve ayarlar | Mod kataloğu, favoriler, erişilebilirlik ve ayar seçenekleri sunulur. |
| 📊 Tanılama | F8 ağ göstergeleri | Bağlantı durumu, RTT ve sanal LAN aktarım sayaçları oyun içinden görüntülenebilir. |

### Ağ tanılama ekranı

Oyun sırasında **F8** ile kare hızı göstergesi açılabilir; ayrıntılı görünümde ağ bağlantısı bilgileri de gösterilir. Ölçümler bağlantı durumunu, sanal LAN anahtarına yapılan WebSocket gidiş-dönüş süresini (RTT), aktarım sayaçlarını ve kuyruk bilgilerini kapsar.

> **RTT notu:** F8 ekranındaki RTT, oyuncunun doğrudan başka bir oyuncuya yaptığı ping değildir. Ölçüm, istemci ile sanal LAN sunucusu arasındaki WebSocket gidiş-dönüşünü temsil eder. Oyun kare süresi veya tek başına paket kaybı yüzdesi olarak yorumlanmamalıdır.

Ayrıntılar: [Ağ Tanılama Rehberi](docs/web/NETWORK-DIAGNOSTICS.md).

## 🖥️ Windows Control Center

**TRPOLARIS NFSU2 Web Control Center**, NFSU2 Web sunucusunu Windows üzerinden kurmak ve yönetmek için geliştirilen ayrı bir masaüstü uygulamasıdır. Web oyununun parçası değildir; Windows tarafında WSL2 / Ubuntu ve Docker altyapısını yöneterek NFSU2 Web kurulumunu kolaylaştırır.


### Başlıca özellikler

- **Tek tık kurulum:** Windows üzerinden WSL2 / Ubuntu, proje kaynakları ve Docker tabanlı sunucu kurulum akışını yönetir.
- **Sunucu yönetimi:** Kurulu NFSU2 Web sunucusunun durumunu, container ve servis işlemlerini takip eder.
- **Erişim ve paylaşım:** Yerel ağ ve dış erişim profillerini yönetmek için araçlar sunar.
- **Tanılama ve bakım:** WSL, Docker ve sunucu durumunu incelemeye yönelik kontroller içerir.
- **Canlı işlem günlüğü:** Kurulum ve yönetim işlemlerini aşamalı ilerleme ve günlük kayıtlarıyla gösterir.
- **Dosya yöneticisi:** WSL içinde kurulu proje dosyalarını görüntüleme ve düzenleme akışı sağlar.
- **Kaldırma merkezi:** Projeye ait bileşenleri yönetmek için ayrı kaldırma araçları sunar.

### İndirme

Windows uygulamasının yayımlanan sürümleri [GitHub Releases](https://github.com/trpolaris/NFSU2-Web/releases) sayfasında paylaşılacaktır. Henüz yayınlanmamış derlemeler için indirme bağlantısı bulunmayabilir.

### Kaynak kodu ve derleme

Control Center kaynak kodu, web uygulamasından ayrı olarak `control-center/` klasöründe tutulur. Bu bölümün kaynakları depoya eklendiğinde ayrıntılı kurulum ve geliştirici yönergeleri [Control Center README](control-center/README.md) dosyasında yer alacaktır.

Uygulama **C# / WPF ve .NET 10** kullanır; hedef platform **Windows x64**'tür. Kaynaktan Release derlemesi için Windows üzerinde .NET 10 SDK ve WPF geliştirme bileşenleri gerekir.

### Güvenlik ve veri

Control Center, kullanıcının kendi NFSU2 oyun kurulumunu kullanır; oyuna ait telifli dosyalar bu depoya veya uygulama paketine dahil edilmez. Sunucuyu internete açarken erişim denetimi yapılandırın. Cloudflare Tunnel tek başına uygulama seviyesinde kimlik doğrulaması sağlamaz. Docker volume'larını veya oyun verilerini silmeden önce yedek alın ve kaldırma kapsamını kontrol edin.

---

## 📋 Gereksinimler

### Oyuncular için

- Güncel **Google Chrome** veya **Firefox** önerilir. Bu tarayıcılar proje rehberinde test edilen masaüstü tarayıcılarıdır.
- Android cihazlarda Chrome ile dokunmatik kullanım desteklenir.
- iPhone ve iPad tarafında Safari için iOS 26 / iPadOS 26 gereksinimi belirtilmiştir.
- WebGPU desteği işletim sistemi, tarayıcı sürümü, GPU ve sürücüye bağlıdır. Tarayıcının WebGPU desteği bulunmuyorsa oyun başlatılamayabilir.
- Sunucunun başka bir cihazda barındırıldığı kullanımda sayfanın **HTTPS** üzerinden sunulması gerekir. Aynı bilgisayardaki **localhost** geliştirme adresi yerel kullanım için uygundur.

### Geliştirme ve kaynak kodundan derleme için

| Bileşen | Gereksinim | Kullanım amacı |
|---|---|---|
| İşletim sistemi | Linux / WSL2 veya macOS | Derleme betikleri Bash ortamında çalışır. Windows üzerinde WSL2 Ubuntu kullanılması önerilir. |
| Git | Güncel sürüm | Kaynak kodunu almak ve sürüm kontrolü yapmak için. |
| Python | Python 3 | Oyun kodu analiz ve üretim araçları için. |
| Node.js | 24.x (CI'da 24.22.2) | Web arayüzü, paketler ve test araçları için. |
| Rust | Stable toolchain | Rust oyun sunucusunu derlemek için. |
| C/C++ araç zinciri | GCC/Clang, build-essential, cmake, pkg-config | Rust sunucusunun yerel C bağımlılıkları ve bazı derleme adımları için. |
| WASI SDK | **34** | Oyunun wasm32-wasip1-threads hedefi için WebAssembly derlemesi. |
| Oyun | Uyumlu PC sürümü | WebAssembly modülünü üretmek için kullanılır. |

Windows kullanıcıları için önerilen yol, depoyu ve derleme araçlarını **WSL2 içindeki Ubuntu dosya sisteminde** kullanmaktır. Projeyi Windows tarafındaki **/mnt/c/** dizininden derlemek yerine WSL'nin Linux dosya sistemine klonlamak dosya sistemi performansı ve araç uyumluluğu açısından daha sağlıklı olur.

### Desteklenen oyun sürümü

Proje belgelerinde hedeflenen PC sürümü **Need for Speed: Underground 2 v1.2 North America** olarak belirtilir.

| Kontrol | Beklenen değer |
|---|---|
| Dosya | SPEED2.EXE |
| Boyut | 4.800.512 bayt |
| SHA-256 | f9dd86c054878ce6276beb07c1fd61874f7a1e4bf1f241b084c65b73e24168a7 |

Diğer bölge veya sürümlerdeki çalıştırılabilir dosyalar uyumlu olmayabilir. Dosyanızı kontrol etmek için oyun klasöründe:

~~~bash
stat -c %s SPEED2.EXE
sha256sum SPEED2.EXE
~~~

Komutlar Linux / WSL içindir. Oyun klasörünüzde **server.dll** bulunuyorsa **SPEED2.EXE** ile aynı klasörde bırakın. Web üretim betiği bu dosyayı da analiz eder; dosya yoksa sunucu modülü için bir yedek/stub üretir ve EA LAN sunucu modülü gerektiren işlevler kullanılamaz.

## 🧰 Yerel kurulum

Bu bölüm, oyunu kendi bilgisayarınızda tarayıcı üzerinden çalıştırmak isteyen geliştiriciler ve kullanıcılar içindir. İlk kurulumda çalışma zamanı üretimi ve WebAssembly derlemesi yapılır. Bu işlem, hazır bir web sayfasını açmaktan farklıdır; gerekli araç zincirlerinin kurulmuş olması gerekir.

### 1. Gerekli Linux paketlerini kurun

Ubuntu veya WSL2 Ubuntu terminalinde:

~~~bash
sudo apt update
sudo apt install -y git curl python3 python3-venv python3-pip build-essential clang cmake pkg-config
~~~

### 2. Node.js 24 ve Rust stable kurun

Node.js 24.x ve npm kurulu olmalıdır. Projenin CI iş akışında Node.js **24.22.2** kullanılır. Node.js'i [resmî indirme sayfasından](https://nodejs.org/en/download) veya kullandığınız sürüm yöneticisi üzerinden kurun.

Rust stable toolchain kurulumu:

~~~bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustup toolchain install stable
~~~

Kurulumları kontrol edin:

~~~bash
node --version
npm --version
python3 --version
rustc --version
cargo --version
~~~

### 3. Depoyu klonlayın

~~~bash
git clone https://github.com/trpolaris/NFSU2-Web.git
cd NFSU2-Web
~~~



### 4. WASI SDK 34 kurun

WebAssembly modülünü derlemek için **WASI SDK 34** gereklidir. Aşağıdaki komutları az önce klonladığınız **NFSU2-Web** depo kök dizininde çalıştırın; SDK, derleme betiğinin otomatik bulacağı **deps/** klasörüne çıkarılır. Resmî paketler: [WebAssembly / wasi-sdk – Releases](https://github.com/WebAssembly/wasi-sdk/releases/tag/wasi-sdk-34).

Linux x86-64 veya WSL2 x86-64 için:

~~~bash
mkdir -p deps
cd deps
curl -fL -o wasi-sdk-34.0-x86_64-linux.tar.gz https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-34/wasi-sdk-34.0-x86_64-linux.tar.gz
tar -xzf wasi-sdk-34.0-x86_64-linux.tar.gz
cd ..
~~~

Apple Silicon macOS için aynı sürümün **wasi-sdk-34.0-arm64-macos.tar.gz** paketini kullanın. Diğer mimarilerde SDK'nın uygun paketini seçip **web/build.sh** çalıştırırken **WASI** değişkeniyle SDK dizinini açıkça belirtin. Örneğin ARM64 Linux:

~~~bash
WASI="$PWD/deps/wasi-sdk-34.0-arm64-linux" web/build.sh
~~~

**web/build.sh**, desteklenen standart Linux x86-64 ve Apple Silicon macOS paket dizinlerini **deps/** altında otomatik bulabilir.

### 5. Python sanal ortamını oluşturun

Depo kök dizininde:

~~~bash
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
~~~

Bu bağımlılıklar oyun çalıştırılabilir dosyasının analiz edilmesi ve derleme sırasında kullanılan Python araçları içindir.

### 6. Kendi oyun dosyanızdan WebAssembly kaynaklarını üretin

**SPEED2.EXE** dosyasının tam yolunu kendi sisteminize göre girin:

~~~bash
web/gen.sh "/path/to/Need for Speed Underground 2/SPEED2.EXE"
~~~

Bu işlem, oyunun çalıştırılabilir dosyasını analiz eder ve web çalışma zamanının ihtiyaç duyduğu üretilmiş kaynakları hazırlar. **server.dll** aynı klasörde bulunuyorsa o da ayrı bir modül olarak işlenir.

> [!IMPORTANT]
> **web/start.sh** bu analiz adımını sizin yerinize otomatik yapmaz. Temiz bir kaynak kurulumunda önce **web/gen.sh** çalıştırılmalıdır.

### 7. WebAssembly modülünü derleyin

~~~bash
web/build.sh
~~~

Başarılı derleme sonucunda aşağıdaki dosyalar üretilir:

~~~text
out/web/
├── nfsu2.wasm
└── nfsu2.json
~~~

**nfsu2.wasm** oyunun tarayıcı çalışma modülüdür. **nfsu2.json** ise modülün bellek ve derleme bilgilerini içerir. Bu iki dosya VPS kurulumunda da kullanılır.

### 8. Yerel web sunucusunu başlatın

~~~bash
web/start.sh --data "/path/to/Need for Speed Underground 2"
~~~

Başlatma betiği ihtiyaç halinde:

- Web arayüzünün npm paketlerini yükler.
- WebAssembly modülünün mevcut ve güncel olup olmadığını kontrol eder.
- Web arayüzünü derler.
- Rust tabanlı oyun sunucusunu derler.
- Sunucuyu belirtilen oyun klasörüyle başlatır.

Varsayılan yerel adres:

[http://localhost:8080](http://localhost:8080)

Başka bir port kullanmak için:

~~~bash
web/start.sh --data "/path/to/Need for Speed Underground 2" --http-port 9080
~~~

Sunucuyu durdurmak için terminalde **Ctrl + C** kullanın. **web/start.sh --help** desteklenen seçenekleri gösterir.

> [!NOTE]
> Yerel başlatma akışı aynı bilgisayarda test ve oynama içindir. Başka bilgisayarlardan veya internet üzerinden erişim için HTTPS sağlayan bir ters proxy, TLS yapılandırması ya da Cloudflare Tunnel gerekir. Bunun için aşağıdaki VPS kurulumunu veya [VPS rehberini](docs/web/VPS.md) kullanın.

## 🌐 VPS ve Docker kurulumu

Arkadaşlarınızın farklı ağlardan oyuna bağlanmasını istiyorsanız projeyi bir Linux VPS üzerinde yayınlayabilirsiniz. Depo, Rust sunucu imajı ve Caddy ile HTTPS sağlayan Docker Compose yapılandırmasını içerir.

### Docker mimarisi

Docker imajı aşağıdaki bileşenleri içerir:

- Rust tabanlı NFSU2 Web sunucusu.
- Derlenmiş web arayüzü.
- Sunucunun çalışması için gerekli uygulama dosyaları.

**Docker imajı oyun dosyalarını veya WebAssembly oyun modülünü içermez.** Bunlar ayrı dizinlerden bağlanır:

| Sunucu yolu | İçerik | Bağlama şekli |
|---|---|---|
| /game | Kendi NFSU2 oyun klasörünüz | Salt okunur |
| /module | nfsu2.wasm ve nfsu2.json | Salt okunur |
| /state | Sunucu anahtarları, kayıtlar, Online verileri ve kalıcı sunucu durumu | Kalıcı Docker volume |

Varsayılan dağıtım yapılandırması **web/deploy/compose.yml** dosyasındadır. Sunucu imajı GitHub Container Registry üzerinden yayımlanır:

~~~text
ghcr.io/trpolaris/need-for-speed-underground-2-web-rs:latest
~~~

İmajın VPS tarafından giriş yapmadan çekilebilmesi için GitHub Container Registry paketinin herkese açık olması gerekir. Paket özel ise VPS tarafında uygun GitHub Container Registry oturumu açılmalıdır.

### VPS ön koşulları

- Linux tabanlı bir VPS.
- Docker Engine ve Docker Compose eklentisi.
- VPS IP adresine yönlenen bir alan adı veya alt alan adı.
- Kendi NFSU2 oyun dosyalarınız.
- Yerel derlemeden elde edilmiş **out/web/nfsu2.wasm** ve **out/web/nfsu2.json**.
- Varsayılan Caddy yapılandırması için dışarıdan erişilebilir TCP 80 ve TCP/UDP 443 portları.

### 1. DNS kaydını hazırlayın

Alan adınızın DNS panelinde VPS IP adresine yönlenen bir **A** kaydı oluşturun. IPv6 kullanıyorsanız uygun **AAAA** kaydını da ekleyin.

Örnek:

~~~text
game.example.com  →  VPS IPv4 adresi
~~~

### 2. VPS üzerinde dizinleri ve ortam dosyasını oluşturun

VPS'ye SSH ile bağlanın. Docker kurulu değilse [Docker'ın resmî kurulum rehberini](https://docs.docker.com/engine/install/) izleyin. Sunucuda Docker zaten kullanılıyorsa yeniden kurmayın; Docker'ın yeniden başlatılması diğer container'ları da etkileyebilir.

~~~bash
docker compose version
sudo mkdir -p /srv/nfsu2/game /srv/nfsu2/module
printf 'NFSU2_HOST=game.example.com\n' | sudo tee /srv/nfsu2/.env
~~~

**game.example.com** değerini kendi alan adınızla değiştirin. **.env** dosyası, oyuncuların açacağı alan adını sunucuya bildirir.

### 3. Compose dosyasını ve WebAssembly modülünü VPS'ye gönderin

Bu komutları kaynak kodunun bulunduğu bilgisayarda, depo kök dizininden çalıştırın. **<VPS_IP>** bölümünü VPS IP adresiyle değiştirin:

~~~bash
scp web/deploy/compose.yml root@<VPS_IP>:/srv/nfsu2/
scp out/web/nfsu2.wasm out/web/nfsu2.json root@<VPS_IP>:/srv/nfsu2/module/
~~~

### 4. Kendi oyun dosyalarınızı VPS'ye kopyalayın

Kendi oyun klasörünüzün içine geçin ve sunucunun ihtiyaç duyduğu oyun dosyalarını gönderin:

~~~bash
cd "/path/to/Need for Speed Underground 2"
rsync -rlt SPEED2.EXE server.dll server.cfg CARS CREDITS FRONTEND GLOBAL LANGUAGES memcard MOVIES NIS pfdata SOUND speech SUBTITLES TRACKS root@<VPS_IP>:/srv/nfsu2/game/
~~~

Bu komut yalnızca listelenen oyun dosyalarını ve veri klasörlerini gönderir. Oyun klasörünüzde bulunmayan isteğe bağlı bir dosya veya klasör varsa ilgili öğeyi komuttan çıkarın. Başka bir dilin ek ses ve film paketleri gibi isteğe bağlı içerikler ayrıca aktarılabilir.

Sunucunun oyun verilerini okuyabilmesi için VPS üzerinde izinleri düzenleyin:

~~~bash
ssh root@<VPS_IP> 'chmod -R u=rwX,go=rX /srv/nfsu2/game /srv/nfsu2/module'
~~~

### 5. Güvenlik duvarını kontrol edin

Varsayılan Caddy yapılandırması için dış erişimde HTTP 80/TCP ve HTTPS 443/TCP+UDP gerekir. VPS sağlayıcınızın ağ güvenlik duvarında da bu portların açık olduğundan emin olun.

UFW zaten etkinse gerekli kuralları ekleyin:

~~~bash
sudo ufw allow 80/tcp
sudo ufw allow 443
~~~

**Mevcut güvenlik duvarı politikasını incelemeden yeni bir güvenlik duvarını etkinleştirmeyin.** VPS üzerinde başka servisler çalışıyorsa yanlış bir firewall değişikliği bu servislerin bağlantısını kesebilir.

### 6. Sunucuyu başlatın

~~~bash
cd /srv/nfsu2
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs -f server
~~~

Caddy, DNS doğru yönlenmiş ve gerekli portlara erişilebiliyorsa alan adınız için Let's Encrypt TLS sertifikası alır ve yeniler. Sunucu modülünü başarıyla sunmaya başladığında Docker sağlık kontrolü **healthy** durumuna geçer.

### 7. Oyuna bağlanın

Tarayıcıda kendi HTTPS adresinizi açın:

~~~text
https://game.example.com/
~~~

Başlangıç ekranındaki kontroller tamamlandığında **Play** seçeneğiyle oyunu başlatın.

### Alternatif yayın yöntemleri

| Senaryo | Kullanılacak yapılandırma |
|---|---|
| Standart VPS + otomatik HTTPS | web/deploy/compose.yml |
| Port 80 başka bir uygulama tarafından kullanılıyorsa | web/deploy/compose.443.yml ile ek Compose yapılandırması |
| Gelen bağlantı portu açmadan yayın | web/deploy/compose.tunnel.yml ve Cloudflare Tunnel |
| Mevcut Cloudflare proxy veya ters proxy | web/deploy/compose.cloudflare.yml, compose.origin.yml veya mevcut proxy yapılandırmanız |

Bu alternatifler ek DNS, proxy, token ve TLS ayarları gerektirebilir. Uygulamadan önce [VPS kurulum rehberindeki](docs/web/VPS.md) ilgili bölümü takip edin.

> [!WARNING]
> **Sunucu varsayılan olarak kullanıcı hesabı, parola veya izin listesi sunmaz.** Sunucuya erişebilen kişiler oyunu oynayabilir ve sunucunun sunduğu oyun dosyalarını indirebilir. Paylaşım kapsamını güvenlik duvarı, erişim kontrolü veya uygun bir proxy katmanıyla sınırlandırın. Cloudflare Tunnel kullanılması tek başına uygulama seviyesinde kullanıcı doğrulaması sağlamaz.

## 🎮 Oynama ve kontroller

### İlk çalıştırma

1. Web sayfasını desteklenen ve güncel bir tarayıcıda açın.
2. Başlangıç ekranındaki donanım ve oyun dosyası kontrollerinin tamamlanmasını bekleyin.
3. Gerekli oyun verileri yüklendikten sonra **Play** seçeneğini kullanın.
4. Kontrolleri, görüntüyü, sesi ve diğer seçenekleri oyun içindeki **Controls** ve **Settings** alanlarından düzenleyin.

İlk açılışta tarayıcı oyun kodunu ve ihtiyaç duyduğu oyun verilerini sunucudan indirir. Bu veriler tarayıcıda önbelleğe alınır; sonraki açılışlarda indirme ihtiyacı azalır. Başlangıç ekranındaki **Preload the game data** seçeneği, oyun verilerinin büyük bölümünü önceden indirmek için kullanılabilir.

### Temel klavye kontrolleri

| Tuş | İşlev |
|---|---|
| Ok tuşları veya W A S D | Gaz, fren/geri ve direksiyon |
| Alt | Nitro |
| Space | El freni |
| Left Shift / Left Ctrl | Manuel vites yükseltme / düşürme |
| C | Kamera |
| B | Arkaya bakış |
| R | Aracı yeniden konumlandırma |
| N | Korna (desteklenen oyun modlarında) |
| M / Tab | Harita / mesajlar |
| Esc veya P | Duraklatma |
| Enter | Menü seçimi |
| F8 | FPS ve ayrıntılı ağ tanılama görünümü |
| F9 | Oyun içi sayfa menüsü |
| F12 | Fotoğraf modu veya ekran görüntüsü |

Kontrollerin tam listesi, kontrol cihazı eşlemeleri, dokunmatik kullanım, direksiyon desteği, ayarlar, kayıt sistemi ve çevrimiçi oyun açıklamaları için [Oynama Rehberi](docs/web/PLAYING.md) sayfasına bakın.

### Çevrimdışı kullanım

Bir tarayıcı oyun ve gerekli oyun verilerini daha önce yüklediyse, sunucuya erişilemediğinde uygulama çevrimdışı başlatılabilir. Bunun için oyun verilerinin önceden ilgili cihazda önbelleğe alınmış olması gerekir.

Çevrimdışı kullanım tek oyunculu oynama ve tarayıcıda saklanan kayıtlarla sınırlıdır. **Free Roam, LAN ve Online gibi ağ özellikleri sunucu bağlantısı gerektirir.**

## 🛠️ Geliştirme

### Depo yapısı

~~~text
NFSU2-Web/
├── web/
│   ├── src/                 # TypeScript tabanlı tarayıcı uygulaması
│   ├── server-rs/           # Rust oyun sunucusu ve crate'ler
│   ├── deploy/              # Docker Compose, Caddy, Cloudflare ve VPS dosyaları
│   ├── test/                # Web, ağ, sunucu ve regresyon testleri
│   ├── tools/               # Web geliştirme ve tanılama araçları
│   ├── build.mjs            # Web arayüzü derleme betiği
│   ├── gen.sh               # WebAssembly için oyun kodu üretimi
│   ├── build.sh             # WebAssembly modülünü derleme
│   └── start.sh             # Yerel web sunucusunu hazırlama ve başlatma
├── runtime/                 # Ortak oyun çalışma zamanı ve platform uyarlamaları
├── tools/                   # Python analiz, kod üretimi ve dönüştürme araçları
├── LANGPACKS/turkish/       # Türkçe dil paketi
├── app/                     # Uygulama varsayılanları
├── win/                     # Windows yardımcı bileşenleri
├── tests/                   # Genel otomasyon ve regresyon testleri
├── control-center/          # Windows WPF yönetim uygulaması kaynakları
├── docs/web/                # Oynama, mimari, ağ ve VPS belgeleri
├── requirements.txt         # Python araç bağımlılıkları
└── LICENSE
~~~

> **Betik isimleri hakkında:** Depo kökündeki **gen.sh** ve **build.sh** ile **web/** klasöründeki **web/gen.sh** ve **web/build.sh** farklı derleme akışlarıdır. Tarayıcı sürümü için yukarıdaki **web/** altındaki betikleri kullanın.

### Web arayüzünü kontrol etme ve derleme

Depo kök dizininden:

~~~bash
cd web
npm ci
npm run check
npm run build
cd ..
~~~

- **npm ci:** package-lock.json ile sabitlenmiş web bağımlılıklarını kurar.
- **npm run check:** TypeScript kontrolünü çalıştırır.
- **npm run build:** tarayıcı uygulamasını web/dist/ klasörüne derler.

### Rust sunucusunu derleme ve test etme

~~~bash
web/server-rs/build.sh
~~~

Sunucu ikilileri **out/web/server-rs/** altına yazılır. Rust çalışma alanının testlerini de çalıştırmak için:

~~~bash
web/server-rs/build.sh --test
~~~

### Web regresyon testleri

Tam web regresyon testleri için sunucu ikililerinin derlenmiş olması ve Playwright Chromium bileşenlerinin yüklenmesi gerekir:

~~~bash
cd web
npx playwright install --with-deps chromium
cd ..
node --test --test-concurrency=1 web/test/*.test.mjs
~~~

CI iş akışı ayrıca Rust workspace testlerini, TypeScript kontrolünü, web derlemesini ve sentetik Online yük/regresyon kontrollerini çalıştırır. İş akışları:

- [Multiplayer and Regression CI](.github/workflows/multiplayer-ci.yml)
- [Rust Container Image](.github/workflows/image-rs.yml)

### Teknik dokümantasyon

| Belge | İçerik |
|---|---|
| [PLAYING.md](docs/web/PLAYING.md) | İlk açılış, oyun kontrolleri, cihazlar, ayarlar, kayıtlar, Free Roam ve Online |
| [VPS.md](docs/web/VPS.md) | VPS, Docker, Caddy, TLS, Cloudflare, kalıcı veriler ve güvenlik |
| [NETWORK-DIAGNOSTICS.md](docs/web/NETWORK-DIAGNOSTICS.md) | F8 ağ göstergeleri ve metriklerin anlamları |
| [DESIGN.md](docs/web/DESIGN.md) | Uygulama mimarisi, çalışma zamanı, test yaklaşımı ve tasarım kararları |
| [gpu-abi.md](docs/web/gpu-abi.md) | Oyun çalışma zamanı ile WebGPU çizim katmanı arasındaki arayüz |
| [web/server-rs/README.md](web/server-rs/README.md) | Rust sunucusunun derlenmesi, çalıştırılması, testleri ve crate yapısı |
| [control-center/README.md](control-center/README.md) | Windows Control Center kurulumu, kaynak derlemesi ve yayın akışı |

## 🧯 Sorun giderme

| Belirti | Kontrol / çözüm |
|---|---|
| SPEED2.EXE not found | --data parametresine dosyanın kendisini değil, SPEED2.EXE içeren oyun klasörünü verin. |
| Oyun dosyası uyumsuzluğu | SPEED2.EXE dosya boyutunu ve SHA-256 değerini gereksinimler tablosuyla karşılaştırın. |
| wasi-sdk not found in deps/ | WASI SDK 34 paketini depo kökündeki deps/ içine çıkarın veya WASI=/tam/yol web/build.sh kullanın. |
| gen/all missing | WebAssembly derlemesinden önce web/gen.sh /tam/yol/SPEED2.EXE komutunu çalıştırın. |
| Port 8080 is in use | Yerel sunucuyu --http-port 9080 gibi boş bir portla başlatın. |
| Başka cihazdan sayfa açılamıyor | Yerel localhost sunucusu yerine HTTPS sağlayan VPS, ters proxy veya Cloudflare Tunnel yapılandırın. |
| Oyun verileri tekrar indiriliyor | Tarayıcı önbelleğini temizleyip temizlemediğinizi ve sunucu modülünün/oyun verilerinin güncel olup olmadığını kontrol edin. |
| F8 ağ metrikleri boş veya bilinmiyor | Önce LAN/Online bağlantısının etkin olduğunu ve sunucu bağlantısının kurulduğunu doğrulayın. |

Daha ayrıntılı açıklamalar için [Oynama Rehberi – Sorun Giderme](docs/web/PLAYING.md) ve [VPS Rehberi](docs/web/VPS.md) sayfalarını inceleyin.

## ⚖️ Lisans ve telif

Kaynak kodunun lisans koşulları için depodaki [LICENSE](LICENSE) dosyasını inceleyin. Lisans, oyunun kendisini veya Electronic Arts'a ait oyun varlıklarını kapsamaz.

*Need for Speed* ve *Need for Speed: Underground 2*, Electronic Arts'ın ticari markalarıdır. **TRPOLARIS, Electronic Arts ile bağlantılı değildir; EA tarafından desteklenmez veya onaylanmaz.** Kullanıcılar kendi oyun kopyalarının yasal kullanımından ve telif haklarına uygunluğundan sorumludur.

---

<div align="center">

**TRPOLARIS**  
*Modern tarayıcı deneyimi. Kendi oyun kopyanızla.*

[⬆ README'nin başına dön](#-trpolaris--nfsu2-web)

</div>
