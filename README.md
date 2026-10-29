<div align="center">

# 🏁 TRPOLARIS · NFSU2 Web

**Need for Speed: Underground 2 deneyimini modern tarayıcılara taşıyan topluluk projesi.**

[![Maintainer](https://img.shields.io/badge/Maintainer-TRPOLARIS-111827?style=for-the-badge)](https://github.com/trpolaris)
[![License](https://img.shields.io/badge/License-MIT-0f766e?style=for-the-badge)](LICENSE)
[![WebAssembly](https://img.shields.io/badge/Runtime-WebAssembly-654ff0?style=for-the-badge&logo=webassembly&logoColor=white)](https://webassembly.org/)
[![WebGPU](https://img.shields.io/badge/Graphics-WebGPU-2563eb?style=for-the-badge)](https://developer.mozilla.org/docs/Web/API/WebGPU_API)

[🚀 Özellikler](#-öne-çıkan-özellikler) · [🧰 Kurulum](#-kurulum) · [🎮 Oynama](#-oynama) · [🛠️ Geliştirme](#️-geliştirme) · [⚖️ Lisans](#️-lisans-ve-telif)

</div>

---

## 🚘 Proje hakkında

**TRPOLARIS NFSU2 Web**, *Need for Speed: Underground 2* deneyimini WebAssembly ve WebGPU tabanlı bir tarayıcı uygulaması olarak sunan bir uyarlamadır. Amaç, oyunu masaüstü tarayıcılarda çalıştırmak ve desteklenen sunucu kurulumlarında arkadaşlarla çevrimiçi oynamayı mümkün kılmaktır.

> ⚠️ **Oyun dosyaları bu depoda bulunmaz.** Çalıştırmak için kendi yasal oyun kopyanız gerekir. Depoya telifli oyun arşivleri, `SPEED2.EXE` veya oyunun veri dosyaları eklemeyin.

## ✨ Öne çıkan özellikler

| Özellik | Açıklama |
|---|---|
| ⚡ **WebAssembly çalışma zamanı** | Oyunun kodunu desteklenen tarayıcılarda çalıştırır. |
| 🎨 **WebGPU grafikleri** | Destekleyen tarayıcılarda GPU tabanlı görüntüleme sağlar. |
| 🔊 **Web Audio** | Tarayıcı üzerinden oyun sesini işler. |
| 🏎️ **Çevrimiçi oyun** | Kurulu sunucuya bağlı olarak serbest dolaşım ve Online mod desteği. |
| 🎮 **Kontroller** | Klavye, uyumlu oyun kumandaları ve dokunmatik arayüz seçenekleri. |
| 💾 **Kayıtlar** | Tarayıcı içi kayıtlar, ekran görüntüleri ve desteklenen sunucularda bulut kayıtları. |
| 🌐 **Çok dilli arayüz** | Birden fazla arayüz dili ve ayrı Türkçe dil paketi desteği. |
| 📱 **Yüklenebilir web uygulaması** | Desteklenen tarayıcılarda uygulama olarak yükleme olanağı. |
| 🧩 **Mod bağlantıları ve ayarlar** | Mod kataloğu, favoriler, erişilebilirlik seçenekleri ve ayar profilleri. |

## 🖥️ Gereksinimler

- **Tarayıcı:** Güncel Google Chrome veya WebGPU destekli Firefox. WebGPU kullanılabilirliği işletim sistemi, sürücü ve tarayıcı sürümüne bağlıdır.
- **Oyun:** Kendi yasal PC kopyanız; desteklenen sürüm v1.2 North America. `SPEED2.EXE` dosyası 4.800.512 bayt olmalı ve SHA-256 değeri `f9dd86c054878ce6276beb07c1fd61874f7a1e4bf1f241b084c65b73e24168a7` olmalıdır; diğer sürümler çalışmayabilir.
- **Derleme ortamı:** Python 3, Node.js 20 veya üzeri, Rust araç zinciri ve `wasi-sdk` 34.
- **Windows:** Kaynak kodunu Windows diskinden değil, WSL 2 içindeki Linux dosya sisteminde derlemek önerilir.

## 🧰 Kurulum

Bu depo kaynak kodunu içerir; derlenmiş oyun modülü ve oyun verileri hazır olarak gelmez.

### 1. Kaynak kodunu alın

```bash
git clone https://github.com/trpolaris/Need-for-Speed-Underground-2-WEB.git
cd Need-for-Speed-Underground-2-WEB
```

### 2. Python bağımlılıklarını kurun

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### 3. Kendi oyun dosyanızdan çalışma zamanı üretin

`SPEED2.EXE` dosyanızın bulunduğu dizini kendi sisteminize göre değiştirin:

```bash
web/gen.sh "/path/to/Need for Speed Underground 2/SPEED2.EXE"
web/build.sh
```

### 4. Yerel sunucuyu başlatın

```bash
web/start.sh --data "/path/to/Need for Speed Underground 2"
```

Ardından tarayıcıda [http://localhost:8080](http://localhost:8080) adresini açın. İlk derleme için gereken araç zincirleri ve ayrıntılı oyun içi yönergeler için [oynama rehberine](docs/web/PLAYING.md) göz atın.

## 🎮 Oynama

1. Başlangıç ekranındaki uyumluluk kontrollerinin tamamlanmasını bekleyin.
2. **Play** seçeneğini kullanarak oyunu başlatın.
3. Kontrolleri ve performans seçeneklerini **Controls** ve **Settings** bölümlerinden düzenleyin.
4. Çevrimiçi oyun için HTTPS üzerinden sunulan uygun bir NFSU2 Web sunucusuna bağlanın.

Sunucu kurmak isteyenler için Docker, TLS, Cloudflare ve oyun verisi yerleşimini anlatan [VPS kurulum rehberi](docs/web/VPS.md) bulunur.

## 🛠️ Geliştirme

Web arayüzü `web/`, Rust tabanlı oyun sunucusu `web/server-rs/`, oyun çalışma zamanı `runtime/`, derleme araçları ise `tools/` altındadır. Web arayüzündeki değişikliklerden sonra:

```bash
cd web
npm ci
npm run build
node --test test/trpolaris-merge.test.mjs
```

`web/src/gpu/` ve `runtime/web/` içindeki grafik arayüzü sözleşmeleri `docs/web/gpu-abi.md` içinde belgelenmiştir. Test ortamı ve derleme ayrıntıları için `docs/web/DESIGN.md` dosyasına bakın.

## 📂 Depo yapısı

```text
.
├── web/                  # Web arayüzü, oyun sunucusu ve tarayıcı araçları
├── runtime/              # Oyunun çalışma zamanı uyarlaması
├── tools/                # Derleme ve veri dönüştürme araçları
├── LANGPACKS/turkish/    # Türkçe oyun dil paketi dosyaları
├── app/                  # Uygulama varsayılanları
├── win/                  # Windows yardımcı bileşenleri
├── tests/                # Otomasyon ve regresyon testleri
├── docs/web/             # Gerekli oynama, sunucu ve teknik rehberler
├── LICENSE
└── README.md
```

## ⚖️ Lisans ve telif

Kaynak kodun lisans ve telif bildirimleri için [LICENSE](LICENSE) dosyasına bakın. Bu temizlik sırasında mevcut telif bildirimleri korunmuştur; TRPOLARIS tarafından yapılan uyarlamalar ayrıca belirtilmiştir.

*Need for Speed* ve *Need for Speed: Underground 2*, Electronic Arts'ın ticari markalarıdır. **TRPOLARIS bu şirketle bağlantılı değildir ve şirket tarafından desteklenmez.** Kullanıcılar kendi oyun kopyalarından ve bu kopyaları kullanma haklarından sorumludur.

---

<div align="center">

**TRPOLARIS** · Modern tarayıcı deneyimi, kendi oyun kopyanızla.

</div>
