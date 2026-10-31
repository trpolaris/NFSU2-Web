<div align="center">

# 🏁 TRPOLARIS · NFSU2 Web

**Need for Speed: Underground 2 deneyimini WebAssembly, WebGPU ve modern web teknolojileriyle tarayıcıya taşıyan topluluk projesi.**

[![Maintainer](https://img.shields.io/badge/Maintainer-TRPOLARIS-111827?style=for-the-badge)](https://github.com/trpolaris)
[![License](https://img.shields.io/badge/License-MIT-0f766e?style=for-the-badge)](LICENSE)
[![Multiplayer CI](https://github.com/trpolaris/NFSU2-Web/actions/workflows/multiplayer-ci.yml/badge.svg?branch=main)](https://github.com/trpolaris/NFSU2-Web/actions/workflows/multiplayer-ci.yml)
[![Container Image](https://github.com/trpolaris/NFSU2-Web/actions/workflows/image-rs.yml/badge.svg?branch=main)](https://github.com/trpolaris/NFSU2-Web/actions/workflows/image-rs.yml)
[![WebAssembly](https://img.shields.io/badge/Runtime-WebAssembly-654ff0?style=flat-square&logo=webassembly&logoColor=white)](https://webassembly.org/)
[![WebGPU](https://img.shields.io/badge/Graphics-WebGPU-2563eb?style=flat-square)](https://developer.mozilla.org/docs/Web/API/WebGPU_API)

[🚘 Proje](#-proje-hakkında) · [🖥️ Control Center](#-control-center) · [🌐 NFSU2 Web](#-nfsu2-web) · [📋 Gereksinimler](#-gereksinimler) · [🧰 Kurulum](#-kurulum) · [🎮 Oynama](#-oynama-ve-kontroller) · [🛠️ Geliştirme](#️-geliştirme) · [⚖️ Lisans](#️-lisans-ve-telif)

</div>

---

<a id="proje"></a>
## 🚘 Proje hakkında

**TRPOLARIS NFSU2 Web**, *Need for Speed: Underground 2* oyununu modern web tarayıcılarında çalıştırmak amacıyla geliştirilen bir uyarlamadır. Proje; kullanıcının kendi PC oyun kopyasından üretilen WebAssembly çalışma modülünü, TypeScript tabanlı tarayıcı arayüzünü ve Rust ile geliştirilen oyun sunucusunu bir araya getirir.

Bu depo iki ayrı uygulamayı tek yerde barındırır:

| Uygulama | Platform | Sorumluluk |
|---|---|---|
| **NFSU2 Web** | Web tarayıcısı / Linux sunucu | Oyunu tarayıcıda çalıştırır; yerel, LAN ve çok oyunculu sunucu özelliklerini sunar. |
| **TRPOLARIS Control Center** | Windows masaüstü | WSL, Ubuntu ve Docker üzerinden NFSU2 Web kurulumunu ve sunucu yaşam döngüsünü yönetir. |

İki uygulama aynı GitHub deposunda bulunur ancak kaynak kodları, derleme adımları ve sürümleme süreçleri birbirinden ayrıdır. Control Center'ın WPF/.NET kodu web oyununun çalışma zamanına karıştırılmaz.

> [!IMPORTANT]
> **Bu depo oyun dosyalarını içermez.** `SPEED2.EXE`, `server.dll`, oyun arşivleri ve telifli oyun verileri GitHub'a eklenmez. Çalıştırmak için kendi yasal PC oyun kopyanızı kullanmanız gerekir. Proje oyun dosyalarını indirmez veya dağıtmaz.

## 🧭 Genel mimari

```text
Windows
└── TRPOLARIS Control Center (WPF / .NET 10)
    └── WSL 2 / Ubuntu
        └── Docker Engine
            └── NFSU2 Web sunucusu
                ├── Web arayüzü
                ├── Rust HTTP / WebSocket servisleri
                ├── Kullanıcının oyun verileri (salt okunur)
                ├── WebAssembly modülü
                └── Kalıcı sunucu durumu

Tarayıcı
└── NFSU2 Web
    ├── TypeScript arayüzü
    ├── WebAssembly oyun çalışma zamanı
    ├── WebGPU grafik / Web Audio ses
    └── Local, LAN ve Online bağlantıları
```

---

<a id="control-center"></a>
# 🖥️ TRPOLARIS Control Center

**TRPOLARIS Control Center**, NFSU2 Web projesini Windows üzerinden kurmak, yapılandırmak, başlatmak, izlemek ve kaldırmak için geliştirilmiş bağımsız bir masaüstü yönetim aracıdır. C# / WPF ile hazırlanır ve **.NET 10** hedefler.

Uygulamanın amacı, kullanıcının WSL, Ubuntu, Docker, portlar, oyun klasörü ve sunucu komutları arasında elle işlem yapma ihtiyacını azaltmaktır. Kurulumdan günlük sunucu yönetimine, ağ erişiminden tanılamaya kadar temel işlemleri tek bir arayüzde toplar.

## 🎞️ Control Center ekran galerisi

Aşağıdaki otomatik kayan galeri, uygulamanın sekiz ana ekranını sırayla gösterir. Tek tek ve yüksek çözünürlüklü görüntüleri açmak için ekran adlarına tıklayın.

<p align="center">
  <img src="docs/screenshots/control-center/slider.gif" alt="TRPOLARIS Control Center ekran galerisi" width="100%" />
</p>

### 1. Genel Bakış

WSL 2, Ubuntu, Docker Engine ve NFSU2 sunucusunun anlık durumunu; etkin yerel/LAN adreslerini ve sık kullanılan işlemleri tek ekranda sunar. [Tam boy ekran görüntüsünü aç](docs/screenshots/control-center/01-genel-bakis.jpg).

### 2. Sunucu Yönetimi

NFSU2 sunucu container'ını başlatma, durdurma, yeniden başlatma ve sağlık durumunu izleme işlemlerini içerir. GitHub kaynak güncellemesi, kurulum bilgileri ve sunucu günlüklerine erişim sağlar. [Tam boy ekran görüntüsünü aç](docs/screenshots/control-center/02-sunucu-yonetimi.jpg).

### 3. Dosya Yöneticisi

WSL içindeki proje dosyalarını görüntüler. Dosyaları VS Code veya Not Defteri ile açma, indirme, yükleme, yeniden adlandırma ve düzenleme işlemlerini sağlar. Kaydedilen web kaynakları, otomatik uygulama seçeneği etkinse yeniden derleme akışını başlatabilir. [Tam boy ekran görüntüsünü aç](docs/screenshots/control-center/03-dosya-yoneticisi.jpg).

### 4. Tek Tık Kurulum

HTTP portunu ve oyun klasörünü seçerek kaynakları hazırlama, bağımlılıkları kurma, WebAssembly modülünü üretme ve Docker sunucusunu başlatma akışını yürütür. Kurulum başlamadan önce sistem denetimi yapılabilir. [Tam boy ekran görüntüsünü aç](docs/screenshots/control-center/04-tek-tik-kurulum.jpg).

### 5. Erişim ve Paylaşım

Yerel bilgisayar, aynı ağdaki cihazlar ve isteğe bağlı Cloudflare Tunnel için Local, LAN / HTTPS ve Public erişim profillerini yönetir. Etkin profilin adresini ve sağlık kontrolünü gösterir. [Tam boy ekran görüntüsünü aç](docs/screenshots/control-center/05-erisim-ve-paylasim.jpg).

### 6. Tanılama ve Bakım

WSL, Ubuntu, Docker Engine, portlar, oyun dosyaları ve sunucu container'ı için sistem denetimleri sunar. Paket yöneticisi durumunu kontrol ederek güvenli bakım işlemlerine yardımcı olur. [Tam boy ekran görüntüsünü aç](docs/screenshots/control-center/06-tanilama-ve-bakim.jpg).

### 7. Kaldırma Merkezi

NFSU2 container'ları, sunucu image'ları, erişim süreçleri, state volume'u, proje dosyaları ve oyun klasörü için ayrı kaldırma seçenekleri sunar. Ubuntu WSL veya Docker Desktop kaldırma seçenekleri ayrıca değerlendirilmelidir. [Tam boy ekran görüntüsünü aç](docs/screenshots/control-center/07-kaldirma-merkezi.jpg).

### 8. Canlı İşlem Günlüğü

PowerShell ve WSL işlem çıktılarını canlı izler. Günlükleri işlem türüne göre filtreleme, yenileme, dışa aktarma ve ilgili log dosyasını açma kontrolleri içerir. [Tam boy ekran görüntüsünü aç](docs/screenshots/control-center/08-canli-islem-gunlugu.jpg).

## Control Center özellikleri

- **Tek noktadan kurulum:** NFSU2 Web kaynaklarını ve gerekli Linux araç zincirini hazırlar; kullanıcının seçtiği oyun klasöründen WebAssembly üretim sürecini çalıştırır.
- **Sunucu yaşam döngüsü:** NFSU2 Docker container'ının başlatılması, durdurulması, yeniden başlatılması ve sağlık durumunun izlenmesi.
- **Dosya yönetimi:** WSL proje alanındaki web ve sunucu dosyalarını düzenleme ve değişiklikleri uygulama.
- **Erişim profilleri:** Yerel bilgisayardan erişim, aynı ağdaki cihazlar için LAN / HTTPS ve isteğe bağlı geçici Cloudflare Tunnel.
- **Tanılama:** WSL, Ubuntu, Docker Desktop, Docker CLI, Docker Engine, Docker Context, port ve container bilgilerinin ayrı ayrı görüntülenmesi.
- **Canlı günlükler:** PowerShell ve WSL komutlarının çıktılarını tek yerde toplama.
- **Seçmeli kaldırma:** NFSU2 kaynaklarını ayrı ayrı seçerek kaldırma; tüm Docker veya WSL ortamını kaldırmayı varsayılan işlem hâline getirmeme.

## Gereksinimler

- Windows x64 bilgisayar.
- Etkinleştirilmiş **WSL 2**.
- WSL 2 içinde **Ubuntu** dağıtımı.
- Çalışan **Docker Engine**. Docker Desktop veya WSL içinde yapılandırılmış uygun bir Docker kurulumu kullanılabilir.
- Kurulum sırasında kaynak kodu ve araçları alabilmek için internet bağlantısı.
- WebAssembly üretimi için desteklenen, kullanıcıya ait NFSU2 PC oyun kopyası.
- Control Center'ı kaynak kodundan derlemek için **.NET 10 SDK**.

Control Center, Docker bileşenlerini tek bir sürüm numarası gibi değerlendirmemelidir: Docker Desktop, Docker CLI, aktif Docker Engine ve Docker Context ayrı bilgilerdir.

## İndirme ve kurulum

**Windows uygulaması:** [GitHub Releases](https://github.com/trpolaris/NFSU2-Web/releases) · **Kaynak kodu:** [`control-center/`](control-center/) · **Control Center rehberi:** [`control-center/README.md`](control-center/README.md)

Control Center sürümleri web oyunundan bağımsız etiketlenir. Örnek sürüm etiketi: `control-center-v1.5.6`. İlgili sürüm yayımlandığında Release sayfasında Windows EXE ve doğrulama dosyaları bulunmalıdır.

1. **Windows sürümünü indirin.** GitHub Releases sayfasından yayımlanmış Control Center Windows paketini alın. İndirme sayfasında henüz Control Center sürümü yoksa kaynak kodunun yayınlanmasını bekleyen bir sürüm olabilir.
2. **WSL 2 ve Ubuntu'yu kontrol edin.** Control Center açıldığında Dashboard veya Tanılama ve Bakım ekranından WSL/Ubuntu durumunu doğrulayın.
3. **Docker Engine'i doğrulayın.** Docker'ın çalıştığını ve Control Center'ın aktif Docker Context üzerinden Engine'e erişebildiğini kontrol edin.
4. **Oyun klasörünü seçin.** Tek Tık Kurulum ekranında `SPEED2.EXE` içeren kendi oyun klasörünüzü gösterin. Oyun dosyaları uygulama tarafından indirilmez.
5. **Kurulum ayarlarını belirleyin.** HTTP portunu ve kurulum sonrası erişim profilini seçin. Varsayılan proje kökü `C:\nfsu2`, yerel HTTP portu `9093`, LAN HTTPS portu ise varsayılan yapılandırmada `8443` olarak tanımlanmıştır; uygulamadaki etkin ayarlar farklı olabilir.
6. **Kurulumu başlatın.** Uygulama kaynakları hazırlar, gerekli bağımlılıkları kurar, oyun kodundan WASM modülünü üretir, Docker imajını oluşturur ve NFSU2 sunucusunu başlatır.
7. **Sağlık kontrolünü doğrulayın.** Container durumu `healthy` olmadan kurulumu başarılı kabul etmeyin. Ardından Local veya LAN / HTTPS adresini açarak tarayıcı bağlantısını test edin.

### Oyun dosyası uyumluluğu

Proje belgelerinde hedeflenen PC sürümü **Need for Speed: Underground 2 v1.2 North America** olarak belirtilir.

| Kontrol | Beklenen değer |
|---|---|
| Dosya | `SPEED2.EXE` |
| Boyut | `4.800.512` bayt |
| SHA-256 | `f9dd86c054878ce6276beb07c1fd61874f7a1e4bf1f241b084c65b73e24168a7` |

`server.dll` dosyanız varsa `SPEED2.EXE` ile aynı klasörde bırakın. Diğer bölge veya sürümlerdeki çalıştırılabilir dosyalar uyumlu olmayabilir.

### Günlük kullanım

- **Genel Bakış:** WSL, Ubuntu, Docker ve NFSU2 sunucusunun genel durumunu kontrol edin.
- **Sunucu Yönetimi:** Container'ı başlatın, durdurun veya yeniden başlatın; güncelleme öncesinde yerel değişikliklerinizi kontrol edin.
- **Dosya Yöneticisi:** WSL içindeki web / backend kaynaklarında değişiklik yapın. Otomatik uygulama seçeneği açıksa kaydedilen ilgili değişiklikler derleme ve sunucuya uygulama sürecini başlatabilir.
- **Erişim ve Paylaşım:** Kullanım amacına göre Local, LAN / HTTPS veya Public Tunnel profilini etkinleştirin.
- **Canlı İşlem Günlüğü:** Kurulum, derleme ve yönetim işlemlerinin çıktısını ve ilerlemesini takip edin.
- **Tanılama ve Bakım:** Sorun yaşandığında sistem kontrollerini çalıştırıp ilgili logları inceleyin.

### Günlük dosyaları

Varsayılan Windows log klasörü:

```text
%LOCALAPPDATA%\TRPOLARIS\NFSU2-Web-Control-Center\logs
```

## Güvenlik ve kaldırma

> [!WARNING]
> **Public Cloudflare Tunnel profili tek başına uygulama seviyesinde kimlik doğrulaması eklemez.** Geçici HTTPS adresini bilen kişiler sunucuya erişebilir. İnternete açık kullanımda Cloudflare Access veya eşdeğer bir kimlik doğrulama / erişim politikası kurun. Oyun verilerinizi herkese açık paylaşmadığınızdan emin olun.

> [!CAUTION]
> Kaldırma Merkezi'nde yalnızca kaldırmak istediğiniz kaynakları seçin. İşlem öncesinde oyun kayıtlarını, oyun klasörünü ve önemli proje dosyalarını yedekleyin. Kaldırma seçeneklerinin etkileri birbirinden farklıdır:

| Seçenek | Etki |
|---|---|
| NFSU2 container'larını kaldır | NFSU2 sunucu container'larını durdurur ve kaldırır. |
| NFSU2 sunucu image'larını kaldır | NFSU2 için kullanılan Docker imajlarını kaldırır. |
| Local / Public Tunnel süreçlerini kapat | NFSU2 erişim süreçlerini ve ilgili erişim kaydını temizler. |
| NFSU2 kayıt hacmini sil | Sunucu state volume'unu siler; burada tutulan oyun / sunucu kayıtları kaybolabilir. |
| `C:\nfsu2` proje kaynaklarını sil | Seçilen proje kodu, modül ve ayar dosyalarını kaldırır. |
| Oyun klasörünü sil | Kullanıcının seçtiği oyun dosyalarını kalıcı olarak kaldırır. Öncesinde yedek alın. |
| Ubuntu WSL dağıtımını kaldır | O Ubuntu dağıtımının içindeki **tüm Linux dosyalarını** siler. NFSU2 dışındaki WSL verileri de kaybolabilir. |
| Docker Desktop'ı kaldır | Bilgisayardaki NFSU2 dışındaki Docker projelerini de etkileyebilir. |

v1.5.6 kaynaklarında state temizliği belirli NFSU2 volume adlarıyla sınırlandırılmıştır: `nfsu2-web-local_state`, `nfsu2-web_state` ve `nfsu2-web-local-state`. Oyun verisi, modül ve sertifika hacimlerinin bu state temizliğiyle otomatik silindiği varsayılmamalıdır. **Başka projelere ait Docker volume, container veya image'larını topluca silmeyin.**

---

<a id="nfsu2-web"></a>
# 🌐 NFSU2 Web

NFSU2 Web, oyunu tarayıcıda çalıştıran bölümüdür. Web uygulaması oyun arayüzünü ve istemci tarafı çalışma zamanını sunarken Rust sunucusu HTTP, WebSocket, sanal LAN ve ilgili çok oyunculu servisleri yönetir.

## 🎞️ NFSU2 Web ekran galerisi

Oyun arayüzünün sekiz ana sayfası aşağıdaki otomatik kayan galeride gösterilir. Her sayfanın özgün ekran görüntüsünü açmak için tablodaki bağlantıyı kullanın.

<p align="center">
  <img src="docs/screenshots/web/slider.gif" alt="TRPOLARIS NFSU2 Web arayüz galerisi" width="100%" />
</p>

### 9. Ana Sayfa

Oyunu başlatma alanını, runtime yükleme durumunu, sistem tanılama özetini ve çevrimiçi oyun, mod kitaplığı, kayıtlar, kontroller ve ayarlara hızlı erişimi bir arada sunar. [Tam boy ekran görüntüsünü aç](docs/screenshots/web/09-ana-sayfa.jpg).

### 10. Çevrimiçi

Serbest dolaşım deneyimini; oyuncu görünürlüğü, ekipler, konvoy, oda, hayalet modu, hızlı sohbet ve ilgili çevrimiçi tercihleriyle yönetir. [Tam boy ekran görüntüsünü aç](docs/screenshots/web/10-cevrimici.jpg).

### 11. Mod Kitaplığı

Community Picks alanını, kullanıcının mod koleksiyonunu ve mod bağlantısı ekleme formunu içerir. Mod listesi dışa aktarılabilir ve yüklenen paketler denetlenebilir. [Tam boy ekran görüntüsünü aç](docs/screenshots/web/11-mod-kitapligi.jpg).

### 12. Kayıtlar

Yerel oyun kayıtlarını görüntüleme, indirme / yedekleme ve geri yükleme işlemlerini sunar. Ekran görüntüleri ve desteklenen bulut kayıtları için ayrı alanlar bulunur. [Tam boy ekran görüntüsünü aç](docs/screenshots/web/12-kayitlar.jpg).

### 13. Kontroller

Klavye ve uyumlu oyun kumandası girişlerini eşlemek; direksiyon, gaz, fren, nitro, kamera ve menü kontrollerini düzenlemek için kullanılır. Dokunmatik kontrol boyutları da ayarlanabilir. [Tam boy ekran görüntüsünü aç](docs/screenshots/web/13-kontroller.jpg).

### 14. Ayarlar

Oyun dili, görüntü ve ses tercihleri, arayüz davranışı, erişilebilirlik seçenekleri ve kullanıcı ayar profillerini yönetir. [Tam boy ekran görüntüsünü aç](docs/screenshots/web/14-ayarlar.jpg).

### 15. Sistem Tanılaması

Tarayıcı ve WebGPU uygunluğunu, uygulama / sunucu sürümünü, önbellek durumunu, oyun modülünü ve yerel oyun verilerinin durumunu kontrol etmeye yardımcı olur. [Tam boy ekran görüntüsünü aç](docs/screenshots/web/15-sistem-tanilamasi.jpg).

### 16. Proje Hakkında

Web sürümünün orijinal oyundan farklarını, proje bilgisini, kaynak kodu ve geri bildirim bağlantılarını, bağımsız proje bildirimini ve katkı teşekkürlerini gösterir. [Tam boy ekran görüntüsünü aç](docs/screenshots/web/16-proje-hakkinda.jpg).

## Öne çıkan özellikler

| Alan | Özellik | Açıklama |
|---|---|---|
| 🧠 Çalışma zamanı | WebAssembly | Oyunun analiz edilmiş ve derlenmiş kodu tarayıcıda çalışır. |
| 🎨 Grafik | WebGPU | Destekleyen tarayıcılarda GPU hızlandırmalı çizim altyapısı kullanılır. |
| 🔊 Ses | Web Audio | Oyun sesi tarayıcı ses altyapısı üzerinden işlenir. |
| 🌐 Çok oyunculu | Virtual LAN | Sunucu üzerinden oyuncular arasında sanal LAN bağlantısı kurulur. |
| 🏙️ Oyun modu | Free Roam | Uygun sunucuya bağlanan oyuncular serbest dolaşımda birlikte oynayabilir. |
| 🏁 Oyun modu | Online | Oyunun Online modu için gerekli sunucu servisleri desteklenir. |
| 🎮 Giriş | Klavye ve oyun kumandası | Tarayıcının giriş API'leri üzerinden uyumlu cihazlar kullanılabilir. |
| 🏎️ Giriş | Direksiyon ve dokunmatik | Tarayıcının tanıdığı uyumlu direksiyonlar ve desteklenen dokunmatik ekranlar kullanılabilir. |
| 💾 Kayıt | Yerel kayıtlar | Kayıtlar, ayarlar ve ekran görüntüleri tarayıcı depolama alanında saklanır. |
| ☁️ Kayıt | Bulut kayıtları | Desteklenen sunucu kurulumlarında anahtar kelime / parola tabanlı kayıt senkronizasyonu kullanılabilir. |
| 📱 Web uygulaması | PWA ve çevrimdışı önbellek | Daha önce yüklenmiş uygulama ve önbelleğe alınmış oyun verileriyle çevrimdışı başlatma desteklenir. |
| 🌍 Arayüz | Çoklu dil | Çok dilli arayüz ve ayrı Türkçe dil paketi desteği bulunur. |
| 🧩 Özelleştirme | Modlar ve ayarlar | Mod kataloğu, favoriler, erişilebilirlik ve ayar seçenekleri sunulur. |
| 📊 Tanılama | F8 ağ göstergeleri | Bağlantı durumu, RTT ve sanal LAN aktarım sayaçları oyun içinden görüntülenebilir. |

### Ağ tanılama ve F8 ekranı

Oyun sırasında **F8** ile FPS göstergesi ve ayrıntılı ağ tanılama görünümü açılabilir. Ekranda bağlantı durumu, WebSocket RTT, görünen eşler ve aktarım / kuyruk sayaçları gibi bilgiler yer alır.

> **RTT notu:** F8 ekranındaki RTT, oyuncunun doğrudan başka bir oyuncuya yaptığı ping değildir. Ölçüm, istemci ile sanal LAN sunucusu arasındaki WebSocket gidiş-dönüş süresini temsil eder; oyun kare süresi veya tek başına paket kaybı yüzdesi olarak yorumlanmamalıdır.

Ayrıntılar: [Ağ Tanılama Rehberi](docs/web/NETWORK-DIAGNOSTICS.md).

---

<a id="gereksinimler"></a>
## 📋 Gereksinimler

### Oyuncular için

- Güncel **Google Chrome** veya **Firefox** önerilir.
- Android cihazlarda Chrome ile dokunmatik kullanım desteklenir.
- iPhone ve iPad tarafında Safari için iOS 26 / iPadOS 26 gereksinimi belirtilmiştir.
- WebGPU desteği işletim sistemi, tarayıcı sürümü, GPU ve sürücüye bağlıdır. WebGPU desteği bulunmuyorsa oyun başlatılamayabilir.
- Sunucunun başka bir cihazda barındırıldığı kullanımda sayfanın **HTTPS** üzerinden sunulması gerekir. Aynı bilgisayardaki `localhost` geliştirme adresi yerel kullanım için uygundur.

### Kaynak kodundan derleme için

| Bileşen | Gereksinim | Kullanım amacı |
|---|---|---|
| İşletim sistemi | Linux / WSL2 veya macOS | Derleme betikleri Bash ortamında çalışır. Windows üzerinde WSL2 Ubuntu önerilir. |
| Git | Güncel sürüm | Kaynak kodunu almak ve sürüm kontrolü yapmak için. |
| Python | Python 3 | Oyun kodu analiz ve üretim araçları için. |
| Node.js | 24.x | Web arayüzü, paketler ve test araçları için. |
| Rust | Stable toolchain | Rust oyun sunucusunu derlemek için. |
| C/C++ araç zinciri | GCC/Clang, build-essential, cmake, pkg-config | Rust sunucusunun yerel C bağımlılıkları ve derleme adımları için. |
| WASI SDK | **34** | Oyunun `wasm32-wasip1-threads` hedefi için WebAssembly derlemesi. |
| Oyun | Uyumlu PC sürümü | WebAssembly modülünü üretmek için kullanılır. |

Windows üzerinde kaynak kodundan derleme yaparken depoyu ve araç zincirini **WSL2 içindeki Ubuntu dosya sisteminde** tutmak önerilir. Projeyi Windows tarafındaki `/mnt/c/` dizininden derlemek yerine WSL Linux dosya sistemini kullanmak dosya sistemi performansı ve araç uyumluluğu açısından daha uygundur.

### Desteklenen oyun sürümü

Proje belgelerinde hedeflenen PC sürümü **Need for Speed: Underground 2 v1.2 North America** olarak belirtilir.

| Kontrol | Beklenen değer |
|---|---|
| Dosya | `SPEED2.EXE` |
| Boyut | `4.800.512` bayt |
| SHA-256 | `f9dd86c054878ce6276beb07c1fd61874f7a1e4bf1f241b084c65b73e24168a7` |

Dosyanızı Linux / WSL üzerinde kontrol etmek için oyun klasöründe:

```bash
stat -c %s SPEED2.EXE
sha256sum SPEED2.EXE
```

---

<a id="yerel-kurulum"></a>
## 🧰 Yerel kurulum

Bu bölüm, web oyununu kendi bilgisayarında tarayıcı üzerinden çalıştırmak isteyen geliştiriciler içindir. Control Center kullanmıyorsanız aşağıdaki adımlarla kaynak kodundan kurulum yapabilirsiniz.

### 1. Linux paketlerini yükleyin

Ubuntu veya WSL2 Ubuntu terminalinde:

```bash
sudo apt update
sudo apt install -y git curl python3 python3-venv python3-pip build-essential clang cmake pkg-config
```

### 2. Node.js 24 ve Rust stable kurun

Node.js 24.x ve npm kurulu olmalıdır. Node.js'i [resmî indirme sayfasından](https://nodejs.org/en/download) veya sürüm yöneticiniz üzerinden kurun.

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustup toolchain install stable
```

Kurulumları kontrol edin:

```bash
node --version
npm --version
python3 --version
rustc --version
cargo --version
```

### 3. Depoyu klonlayın

```bash
git clone https://github.com/trpolaris/NFSU2-Web.git
cd NFSU2-Web
```

### 4. WASI SDK 34 kurun

Linux x86-64 veya WSL2 x86-64 için depo kök dizininde:

```bash
mkdir -p deps
cd deps
curl -fL -o wasi-sdk-34.0-x86_64-linux.tar.gz https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-34/wasi-sdk-34.0-x86_64-linux.tar.gz
tar -xzf wasi-sdk-34.0-x86_64-linux.tar.gz
cd ..
```

Apple Silicon macOS için aynı sürümün `wasi-sdk-34.0-arm64-macos.tar.gz` paketini kullanın. Diğer mimarilerde uygun paketi seçip `WASI` değişkeniyle SDK dizinini belirtin. Örneğin:

```bash
WASI="$PWD/deps/wasi-sdk-34.0-arm64-linux" web/build.sh
```

### 5. Python sanal ortamını oluşturun

Depo kök dizininde:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
```

### 6. Oyun dosyalarından WebAssembly kaynaklarını üretin

`SPEED2.EXE` dosyasının tam yolunu kendi sisteminize göre girin:

```bash
web/gen.sh "/path/to/Need for Speed Underground 2/SPEED2.EXE"
```

Bu işlem çalıştırılabilir dosyayı analiz ederek web çalışma zamanının ihtiyaç duyduğu üretilmiş kaynakları hazırlar. `server.dll` aynı klasörde bulunuyorsa o da ayrı bir modül olarak işlenir.

> [!IMPORTANT]
> Temiz kaynak kurulumunda önce `web/gen.sh` çalıştırılmalıdır. `web/start.sh` bu analiz adımını sizin yerinize otomatik yapmaz.

### 7. WebAssembly modülünü derleyin

```bash
web/build.sh
```

Başarılı derleme sonucunda aşağıdaki dosyalar üretilir:

```text
out/web/
├── nfsu2.wasm
└── nfsu2.json
```

### 8. Yerel web sunucusunu başlatın

```bash
web/start.sh --data "/path/to/Need for Speed Underground 2"
```

Başlatma betiği ihtiyaç halinde web paketlerini yükler, WebAssembly çıktısını kontrol eder, web arayüzünü ve Rust sunucusunu derler ve sunucuyu seçilen oyun klasörüyle başlatır.

Varsayılan yerel adres: [http://localhost:8080](http://localhost:8080)

Başka bir port kullanmak için:

```bash
web/start.sh --data "/path/to/Need for Speed Underground 2" --http-port 9080
```

Sunucuyu durdurmak için terminalde `Ctrl + C` kullanın. Desteklenen seçenekler için `web/start.sh --help` komutunu çalıştırın.

> [!NOTE]
> Yerel başlatma akışı aynı bilgisayarda test ve oynama içindir. Başka bilgisayarlardan veya internet üzerinden erişim için HTTPS sağlayan bir ters proxy, TLS yapılandırması ya da Cloudflare Tunnel gerekir.

---

## 🌐 VPS ve Docker kurulumu

Arkadaşlarınızın farklı ağlardan oyuna bağlanmasını istiyorsanız projeyi bir Linux VPS üzerinde yayınlayabilirsiniz. Depo, Rust sunucu imajı ve Caddy ile HTTPS sağlayan Docker Compose yapılandırması içerir.

### Docker mimarisi

Docker imajı Rust tabanlı NFSU2 Web sunucusunu, derlenmiş web arayüzünü ve sunucu uygulama dosyalarını içerir. **Oyun dosyaları ve WebAssembly oyun modülü imaja gömülmez.** Bunlar ayrı dizinlerden bağlanır:

| Sunucu yolu | İçerik | Bağlama şekli |
|---|---|---|
| `/game` | Kullanıcının NFSU2 oyun klasörü | Salt okunur |
| `/module` | `nfsu2.wasm` ve `nfsu2.json` | Salt okunur |
| `/state` | Sunucu anahtarları, kayıtlar, Online verileri ve kalıcı durum | Kalıcı Docker volume |

Varsayılan dağıtım yapılandırması `web/deploy/compose.yml` dosyasındadır. Sunucu imajı GitHub Container Registry üzerinden yayımlanır:

```text
ghcr.io/trpolaris/need-for-speed-underground-2-web-rs:latest
```

### VPS ön koşulları

- Linux tabanlı VPS.
- Docker Engine ve Docker Compose eklentisi.
- VPS IP adresine yönlenen alan adı veya alt alan adı.
- Kullanıcıya ait NFSU2 oyun dosyaları.
- `out/web/nfsu2.wasm` ve `out/web/nfsu2.json` çıktıları.
- Varsayılan Caddy yapılandırması için dışarıdan erişilebilir TCP 80 ve TCP/UDP 443 portları.

### 1. DNS kaydı oluşturun

Alan adınızın DNS panelinde VPS IP adresine yönlenen bir `A` kaydı oluşturun. IPv6 kullanıyorsanız uygun `AAAA` kaydını da ekleyin.

```text
game.example.com  →  VPS IPv4 adresi
```

### 2. VPS dizinlerini hazırlayın

VPS'ye SSH ile bağlanın. Docker kurulu değilse [Docker resmî kurulum rehberini](https://docs.docker.com/engine/install/) izleyin. Sunucuda Docker zaten kullanılıyorsa yeniden kurmayın.

```bash
docker compose version
sudo mkdir -p /srv/nfsu2/game /srv/nfsu2/module
printf 'NFSU2_HOST=game.example.com\n' | sudo tee /srv/nfsu2/.env
```

`game.example.com` değerini kendi alan adınızla değiştirin.

### 3. Compose dosyasını ve WebAssembly modülünü gönderin

Aşağıdaki komutları kaynak kodunun bulunduğu bilgisayarda, depo kök dizininden çalıştırın. `<VPS_IP>` değerini VPS IP adresiyle değiştirin:

```bash
scp web/deploy/compose.yml root@<VPS_IP>:/srv/nfsu2/
scp out/web/nfsu2.wasm out/web/nfsu2.json root@<VPS_IP>:/srv/nfsu2/module/
```

### 4. Oyun dosyalarını gönderin

Kendi oyun klasörünüze geçin ve sunucunun ihtiyaç duyduğu dosyaları aktarın:

```bash
cd "/path/to/Need for Speed Underground 2"
rsync -rlt SPEED2.EXE server.dll server.cfg CARS CREDITS FRONTEND GLOBAL LANGUAGES memcard MOVIES NIS pfdata SOUND speech SUBTITLES TRACKS root@<VPS_IP>:/srv/nfsu2/game/
```

Oyun klasörünüzde bulunmayan isteğe bağlı dosya veya klasörleri komuttan çıkarın. Ardından VPS üzerinde izinleri düzenleyin:

```bash
ssh root@<VPS_IP> 'chmod -R u=rwX,go=rX /srv/nfsu2/game /srv/nfsu2/module'
```

### 5. Güvenlik duvarını kontrol edin

Varsayılan Caddy yapılandırması dış erişimde HTTP 80/TCP ve HTTPS 443/TCP+UDP gerektirir. UFW zaten etkinse gerekli kuralları ekleyin:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443
```

Mevcut güvenlik duvarı politikasını incelemeden yeni bir güvenlik duvarını etkinleştirmeyin. VPS üzerinde başka servisler çalışıyorsa yanlış bir kural bağlantılarını kesebilir.

### 6. Sunucuyu başlatın

```bash
cd /srv/nfsu2
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs -f server
```

DNS doğru yönlenmiş ve gerekli portlara erişilebiliyorsa Caddy alan adı için TLS sertifikası alır ve yeniler. Sunucu sağlık kontrolü başarılı olduğunda container `healthy` durumuna geçer.

### 7. Oyuna bağlanın

Tarayıcıda kendi HTTPS adresinizi açın:

```text
https://game.example.com/
```

Başlangıç kontrolleri tamamlandığında **Play / Oyna** seçeneğini kullanın.

### Alternatif yayın yöntemleri

| Senaryo | Yapılandırma |
|---|---|
| Standart VPS + otomatik HTTPS | `web/deploy/compose.yml` |
| Port 80 başka uygulama tarafından kullanılıyorsa | `web/deploy/compose.443.yml` |
| Gelen bağlantı portu açmadan yayın | `web/deploy/compose.tunnel.yml` ve Cloudflare Tunnel |
| Mevcut Cloudflare proxy veya ters proxy | `compose.cloudflare.yml`, `compose.origin.yml` veya mevcut proxy yapılandırmanız |

Ayrıntılı DNS, proxy, token ve TLS adımları için [VPS rehberini](docs/web/VPS.md) izleyin.

> [!WARNING]
> **Sunucu varsayılan olarak kullanıcı hesabı, parola veya izin listesi sunmaz.** Sunucuya erişebilen kişiler oyunu oynayabilir ve sunucunun sunduğu oyun dosyalarını indirebilir. Erişimi güvenlik duvarı, kimlik doğrulama veya uygun bir proxy katmanıyla sınırlandırın. Cloudflare Tunnel kullanılması tek başına uygulama seviyesinde kullanıcı doğrulaması sağlamaz.

---

<a id="oynama"></a>
## 🎮 Oynama ve kontroller

### İlk çalıştırma

1. Web sayfasını desteklenen ve güncel bir tarayıcıda açın.
2. Başlangıç ekranındaki donanım ve oyun dosyası kontrollerinin tamamlanmasını bekleyin.
3. Gerekli oyun verileri yüklendikten sonra **Oyna / Play** seçeneğini kullanın.
4. Kontrolleri, görüntüyü, sesi ve diğer seçenekleri oyun içindeki **Kontroller** ve **Ayarlar** alanlarından düzenleyin.

İlk açılışta tarayıcı oyun kodunu ve ihtiyaç duyduğu oyun verilerini sunucudan indirir. Veriler tarayıcı önbelleğinde tutulur; sonraki açılışlarda indirme ihtiyacı azalabilir. **Preload the game data** seçeneği oyun verilerinin büyük bölümünü önceden indirmek için kullanılabilir.

### Temel klavye kontrolleri

| Tuş | İşlev |
|---|---|
| Ok tuşları veya W A S D | Gaz, fren / geri ve direksiyon |
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

Tam liste, kontrol cihazı eşlemeleri, dokunmatik kullanım, direksiyon desteği, ayarlar ve kayıt sistemi için [Oynama Rehberi](docs/web/PLAYING.md) dosyasına bakın.

### Çevrimdışı kullanım

Oyun ve gerekli veriler daha önce aynı tarayıcıda yüklenmişse sunucuya erişilemediğinde uygulama çevrimdışı başlatılabilir. Bu kullanım, önceden önbelleğe alınmış dosyalara bağlıdır. **Free Roam, LAN ve Online gibi ağ özellikleri sunucu bağlantısı gerektirir.**

---

<a id="gelistirme"></a>
## 🛠️ Geliştirme

### Depo yapısı

```text
NFSU2-Web/
├── app/                         # Uygulama varsayılanları
├── runtime/                     # Ortak oyun çalışma zamanı ve platform uyarlamaları
├── web/                         # Tarayıcı arayüzü, Rust sunucusu ve web araçları
│   ├── src/                     # TypeScript tabanlı web uygulaması
│   ├── server-rs/               # Rust oyun sunucusu ve crate'ler
│   ├── deploy/                  # Docker Compose, Caddy ve VPS yapılandırmaları
│   ├── test/                    # Web ve ağ regresyon testleri
│   ├── build.mjs                # Web arayüzü derlemesi
│   ├── gen.sh                   # WebAssembly için oyun kodu üretimi
│   ├── build.sh                 # WebAssembly modülü derlemesi
│   └── start.sh                 # Yerel sunucuyu hazırlama ve başlatma
├── tools/                       # Python analiz, kod üretimi ve dönüştürme araçları
├── win/                         # Windows yardımcı bileşenleri
├── control-center/              # Bağımsız Windows WPF / .NET 10 uygulaması
│   ├── src/                     # WPF kaynak projesi
│   ├── assets/                  # Simge ve uygulama varlıkları
│   ├── scripts/                 # Yardımcı ve yayın betikleri
│   ├── tests/                   # Control Center doğrulama testleri
│   ├── docs/                    # Uygulamaya özel belgeler
│   ├── installer/               # Paketleme / kurulum dosyaları
│   └── README.md                # Control Center kullanım ve geliştirme rehberi
├── docs/
│   ├── web/                     # Web, oynama, mimari, ağ ve VPS belgeleri
│   └── screenshots/             # README ekran galerileri ve özgün görseller
├── tests/                       # Genel otomasyon ve regresyon testleri
├── LANGPACKS/turkish/           # Türkçe dil paketi
├── .github/workflows/
│   ├── multiplayer-ci.yml       # Web / çok oyunculu regresyon CI
│   ├── image-rs.yml             # Rust container image yayını
│   └── control-center-ci.yml    # Control Center için bağımsız Windows CI (entegrasyon hedefi)
├── requirements.txt             # Python araç bağımlılıkları
└── LICENSE
```

> **Betik isimleri hakkında:** Depo kökündeki `gen.sh` / `build.sh` ile `web/` altındaki `web/gen.sh` / `web/build.sh` farklı akışlardır. Tarayıcı sürümü için `web/` altındaki betikleri kullanın.

### Web arayüzünü kontrol etme ve derleme

Depo kök dizininden:

```bash
cd web
npm ci
npm run check
npm run build
cd ..
```

- `npm ci`: `package-lock.json` ile sabitlenmiş web bağımlılıklarını kurar.
- `npm run check`: TypeScript kontrolünü çalıştırır.
- `npm run build`: tarayıcı uygulamasını `web/dist/` klasörüne derler.

### Rust sunucusunu derleme ve test etme

```bash
web/server-rs/build.sh
web/server-rs/build.sh --test
```

Sunucu ikilileri `out/web/server-rs/` altına yazılır.

### Web regresyon testleri

Tam web regresyon testleri için sunucu ikililerinin derlenmiş olması ve Playwright Chromium bileşenlerinin yüklenmesi gerekir:

```bash
cd web
npx playwright install --with-deps chromium
cd ..
node --test --test-concurrency=1 web/test/*.test.mjs
```

Mevcut web iş akışları:

- [Multiplayer and Regression CI](.github/workflows/multiplayer-ci.yml)
- [Rust Container Image](.github/workflows/image-rs.yml)

Control Center için Windows üzerinde .NET 10 restore / Release build, WPF-XAML kontrolleri, PowerShell betik kontrolü ve tek dosyalı EXE publish adımlarının ayrı bir CI iş akışında tutulması hedeflenir. Bu iş akışının başarılı olması ve gerçek Windows temiz kurulum testi tamamlanmadan Control Center'ın yayın doğrulaması tamamlandı sayılmamalıdır.

### Control Center sürümleme modeli

- Control Center kaynak kodu yalnızca `control-center/` altında tutulur.
- Windows x64 Release derlemesi web uygulamasının derleme sürecinden bağımsızdır.
- Control Center sürümleri `control-center-vX.Y.Z` etiketiyle ayrılır; örnek: `control-center-v1.5.6`.
- Yayın paketinde EXE ile birlikte `SHA256SUMS.txt` ve `RELEASE-NOTES.md` bulunması hedeflenir.
- Web uygulamasının sürümleri ve CI süreci bu etiketlerden etkilenmez.

### Teknik dokümantasyon

| Belge | İçerik |
|---|---|
| [PLAYING.md](docs/web/PLAYING.md) | İlk açılış, kontroller, cihazlar, ayarlar, kayıtlar, Free Roam ve Online |
| [VPS.md](docs/web/VPS.md) | VPS, Docker, Caddy, TLS, Cloudflare, kalıcı veriler ve güvenlik |
| [NETWORK-DIAGNOSTICS.md](docs/web/NETWORK-DIAGNOSTICS.md) | F8 ağ göstergeleri ve metriklerin anlamları |
| [DESIGN.md](docs/web/DESIGN.md) | Uygulama mimarisi, çalışma zamanı, test yaklaşımı ve tasarım kararları |
| [gpu-abi.md](docs/web/gpu-abi.md) | Oyun çalışma zamanı ile WebGPU çizim katmanı arasındaki arayüz |
| [Control Center README](control-center/README.md) | Windows yönetim uygulamasının kurulumu, kullanımı ve geliştirilmesi |
| [Rust sunucu README](web/server-rs/README.md) | Rust sunucusunun derlenmesi, çalıştırılması, testleri ve crate yapısı |

---

## 🧯 Sorun giderme

| Belirti | Kontrol / çözüm |
|---|---|
| `SPEED2.EXE not found` | `--data` parametresine dosyanın kendisini değil, `SPEED2.EXE` içeren oyun klasörünü verin. |
| Oyun dosyası uyumsuzluğu | `SPEED2.EXE` boyutunu ve SHA-256 değerini gereksinimler tablosuyla karşılaştırın. |
| `wasi-sdk not found in deps/` | WASI SDK 34 paketini depo kökündeki `deps/` içine çıkarın veya `WASI=/tam/yol web/build.sh` kullanın. |
| `gen/all missing` | WebAssembly derlemesinden önce `web/gen.sh /tam/yol/SPEED2.EXE` komutunu çalıştırın. |
| Yerel port kullanımda | `--http-port 9080` gibi boş bir port belirleyin. |
| Başka cihazdan sayfa açılamıyor | Yerel `localhost` sunucusu yerine HTTPS sağlayan VPS, ters proxy veya Cloudflare Tunnel yapılandırın. |
| Oyun verileri tekrar indiriliyor | Tarayıcı önbelleğini ve sunucudaki modül / oyun verisi dosyalarının güncelliğini kontrol edin. |
| F8 ağ metrikleri bilinmiyor | LAN / Online bağlantısının etkin ve sunucu bağlantısının kurulmuş olduğunu doğrulayın. |
| Control Center WSL'yi göremiyor | WSL 2 ve Ubuntu dağıtımının çalıştığını, Windows tarafından erişilebildiğini kontrol edin. |
| Docker Engine'e bağlanılamıyor | Aktif Docker Context'i, Engine hizmetini ve WSL-Docker bağlantısını kontrol edin. |
| NFSU2 container `unhealthy` | Sunucu günlüklerini Control Center Live Logs veya `docker compose logs -f server` üzerinden inceleyin. |

Daha ayrıntılı web açıklamaları için [Oynama Rehberi](docs/web/PLAYING.md), [VPS Rehberi](docs/web/VPS.md) ve [Ağ Tanılama Rehberi](docs/web/NETWORK-DIAGNOSTICS.md) dosyalarını inceleyin.

<a id="lisans"></a>
## ⚖️ Lisans ve telif

Kaynak kodunun lisans koşulları için depodaki [LICENSE](LICENSE) dosyasını inceleyin. Lisans, oyunun kendisini veya Electronic Arts'a ait oyun varlıklarını kapsamaz.

*Need for Speed* ve *Need for Speed: Underground 2*, Electronic Arts'ın ticari markalarıdır. **TRPOLARIS, Electronic Arts ile bağlantılı değildir; EA tarafından desteklenmez veya onaylanmaz.** Kullanıcılar kendi oyun kopyalarının yasal kullanımından ve telif haklarına uygunluğundan sorumludur.

---

<div align="center">

**TRPOLARIS**  
*Modern tarayıcı deneyimi. Kendi oyun kopyanızla.*

[⬆ README'nin başına dön](#-trpolaris--nfsu2-web)

</div>
