# FreeRoam oyun içi sohbet

Bu belge, NFSU2 Web'in Rust FreeRoam hub üzerinden çalışan yazılı sohbetini açıklar. Sohbet web HUD'unda görünür; ayrı bir localhost demo WebSocket sunucusu kullanmaz.

## Kanallar

- **All / Herkes:** aynı yapılandırılmış FreeRoam odasında aktif olan oyunculara iletilir.
- **Crew:** yalnızca gönderenle aynı Crew hash'ine sahip, aynı odada aktif oyunculara iletilir. Sunucu üyeliği kendi oyuncu tablosundan doğrular; istemcinin seçtiği kanal tek başına erişim sağlamaz.
- Sohbet arayüzü seçili Crew'nin gerçek adını hem yazma alanındaki kanal etiketinde hem de mesaj satırında gösterir.
- Gönderenin oyuncu adı sunucudaki aktif oyuncu kaydından alınır. Tarayıcı, adları ve mesajları HTML olarak değil metin olarak çizer. Yerel oyuncunun kendi satırları ayrı bir görsel vurgu alır.

## Kontroller

| Tuş | İşlev |
|---|---|
| Y | Yazı alanını açar |
| Enter | Yalnızca yazı alanı odaktayken mesaj gönderir; sohbeti açmaz |
| Tab | All ve mevcut Crew kanalları arasında geçiş yapar |
| Esc | Yazı alanını kapatır |

Orijinal hızlı mesaj butonları ve mevcut sabit ifade Quick Chat sistemi ayrı olarak korunur.

## Limitler ve bildirimler

- Tarayıcı yazı alanı tek mesajı 80 karakterle sınırlar.
- Sunucu protokolü 160 Unicode karakter ve 512 UTF-8 byte üst sınırı uygular.
- Sunucu, oyuncu başına kayan 5 saniyelik pencerede en fazla 4 yazılı mesaj kabul eder. İstemci aynı sınırı önceden uygular.
- Yerel bekleme sınırına ulaşıldığında HUD'da sistem bildirimi görünür. Gönderilmeyen taslak korunur ve yazma alanı açık kalır.
- Sunucu ayrıca aktif FreeRoam durumunu, aynı odayı ve Crew üyeliğini doğrular; kontrol karakterlerini ve mesaj içerik filtresini uygular, gönderen adını da kendi aktif oyuncu kaydından ekler. Sunucu tarafından reddedilen mesajlara ayrı bir teslim/alındı onayı yoktur; yerel uyarı yalnızca istemci tarafında bilinen hız sınırı içindir.

## Mesaj geçmişi ve kaynak kullanımı

- Sohbet kapalıyken yeni mesajlar 5 saniye sonra kısa bir fade animasyonuyla soluklaşır; satırlar oturum geçmişinde kalır ve sohbet yeniden açıldığında tekrar okunabilir.
- Sohbet yazma alanı açıkken fade zamanlayıcıları bekletilir ve mevcut satırlar görünür tutulur. Alan kapatıldığında geçmiş satırların fade süresi yeniden başlar.
- HUD, sohbet açıkken de kapalıyken de en fazla 200 mesaj satırı tutar. Sınır aşıldığında en eski satırlar ve bunların zamanlayıcıları temizlenir.
- Oyun oturumu bittiğinde tüm mesajlar, zamanlayıcılar ve çizim katmanları temizlenir.

## Test

Depodaki otomatik kontroller:

- `web/test/quickchat-history.test.mjs`: fade ve yeniden görünür olma davranışı, 200 satır sınırı ve oturum sonunda temizleme.
- `web/test/quickchat-appearance.test.mjs`: geçmişte okuma konumunun korunması ve en yeni mesaja yumuşak kaydırma.
- `web/test/quickchat-ux.test.mjs`: Crew isimleri, güvenli oyuncu adı çizimi, kendi mesaj vurgusu ve 4/5 sn gönderim limiti.
- `web/server-rs/crates/roam/src/wire.rs`: geçerli/geçersiz chat wire frame'leri.
- Multiplayer CI, Rust workspace testleri, web build ve regresyon paketini çalıştırır.

Gerçek oyunculu All/Crew izolasyon testi ayrıca iki aynı Crew oyuncusu ve başka Crew'de üçüncü oyuncuyla staging sunucusunda yapılmalıdır. CI'daki sentetik test bu gerçek oyun senaryosunun yerine geçmez.

## Dağıtım

Sohbet UI ve Rust hub değişiklikleri sunucu imajında bulunur. Yalnızca bu sohbet güncellemesi için `nfsu2.wasm` yeniden üretilmez; mevcut oyun modülü korunur.

### Yerel Docker test sunucusu

Kullanıcının WSL checkout'unda yeni commit'in imajını build edip yalnızca server servisini yeniden oluşturun:

```bash
docker build -f web/server-rs/Dockerfile -t nfsu2-web-rs:local .
docker compose \
  --project-directory /home/trpolaris/nfsu2-web-trpolaris \
  -f /home/trpolaris/nfsu2-web-trpolaris/compose.local.yml \
  up -d --no-build --force-recreate server
```

Ardından `docker compose ps` ile `healthy` durumunu, `docker compose logs --tail=100 server` ile başlangıç günlüklerini doğrulayın. Mevcut oyun verisi, sertifika, state ve diğer volume'leri silmeyin.

### Docker VPS / production

Ana dala merge tamamlandıktan ve `image-rs` GitHub Actions işi başarılı olduktan sonra depo kökünden mevcut modül klasörüyle güvenli release aracını kullanın. Örneğin yerel `out/web` klasörünüzde hâlihazırda `nfsu2.wasm` ve `nfsu2.json` bulunuyorsa:

```bash
git fetch origin
git switch main
git pull --ff-only
web/deploy/release.sh -n root@SUNUCU_ADRESI out/web MAIN_MERGE_COMMIT_SHA
```

Ön izleme doğruysa `-n` olmadan çalıştırın:

```bash
web/deploy/release.sh root@SUNUCU_ADRESI out/web MAIN_MERGE_COMMIT_SHA
```

Release aracı GHCR'deki `sha-<commit>` imajının mevcut olduğunu doğrular, imajı önce çeker, sunucuda yeni modül dosyası değiştirmeden mevcut modül ve `.env` yedeğini alır, yalnızca server servisini yeniden başlatır ve `healthy` durumunu bekler. Hata veya geri dönüş gerekirse:

```bash
web/deploy/release.sh root@SUNUCU_ADRESI --undo
```

Bu sohbet değişikliği modül dosyalarını değiştirmediği için eski ama geçerli `out/web/nfsu2.wasm` ve `out/web/nfsu2.json` çiftini kullanabilirsiniz. Script, modül revizyonu ile imaj revizyonunun ilişkisini kontrol eder. GHCR image workflow henüz bitmediyse script güvenli biçimde imaj yok hatası verir; yayın tamamlandıktan sonra tekrar çalıştırın.

**Önemli:** Canlı VPS'ye erişim yetkisi ve SSH anahtarı sunucu sahibinin ortamındadır. Bu belge ve kod, uzaktan dağıtımın tamamlandığını iddia etmez. Yayın sonrasında `docker compose ps`, server logları ve gerçek iki/üç oyunculu All/Crew testleriyle doğrulama yapın. Kalıcı `state` volume'unu, oyun verisini, modül volume'unu veya sertifika volume'unu silmeyin.

## Güncel HUD görünümü

- Sohbet mevcut stage katmanında çalışır ve aynı Rust FreeRoam chat protokolünü kullanır; ikinci WebSocket servisi veya ikinci origin yoktur.
- Mevcut yerel F9 sürücü menüsündeki **Chat HUD** sekmesi korunur. Ölçek, arka plan opaklığı, konum ve genişlik ayarları aynı `QuickChat` örneğine uygulanır; yeni HUD başlığı ve arama paneli ikinci bir ayar deposu oluşturmaz.
- Ayrı Next.js prototipindeki geçici sohbet sunucusu ve örnek oyun verileri bu projeye taşınmaz; uygulama mevcut React/TypeScript arayüzü ve Rust FreeRoam protokolü üzerinde kalır.
- Y, serbest dolaşım sürüşünde sohbeti açar; yazı veya arama alanına odaklanıldığında normal karakter olarak kalır. Odak metin alanı dışında ve sohbet açıkken tekrar basıldığında kapatır. ESC önce arama panelini kapatır; panel kapalıysa sohbeti kapatır.
- Sohbet üst çubuğundaki ARA düğmesi mesaj geçmişi arama panelini açar/kapatır. Panel yalnızca açıldığında görünür; arama mevcut oturumdaki en fazla 200 mesajı filtreler.
- Mesajlar kanal etiketi, oyuncu adı ve mesaj metni olarak kart biçiminde çizilir. Uzun mesajlar satıra sarılır; içerik metin olarak render edilir.
- Telefon ve tabletlerde HUD güvenli ekran boşluklarını kullanır; sohbet açıldığında mesaj listesi esner ve yazma alanı ekran altına yerleşir. Mevcut dokunmatik Quick Chat düğmeleri korunur.

## Yönetim arayüzü sınırı

- Player Hub React uygulamasına #/admin rotasında ayrı bir Yönetim görünümü eklenir.
- Görünüm mevcut /api/v1/live/players ve /players verisini kullanır. Gerçek admin rol doğrulaması, kick/ban/unban, ekonomi/araç düzenleme veya audit-log API'si doğrulanmadığı için yönetim eylemleri etkinmiş gibi gösterilmez.
- Admin işlemleri eklenmeden önce roller Rust tarafında doğrulanmalı; mutasyon endpoint'leri session + CSRF + origin doğrulaması ve audit log ile korunmalıdır. Yalnızca ön yüzde menüyü saklamak yetkilendirme değildir.
