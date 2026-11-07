# TRPOLARIS NFSU2 Web — Sistem Karşılaştırması ve Entegrasyon Yol Haritası

> **Güncelleme:** 7 Kasım 2026  
> **Amaç:** TRPOLARIS ana sistemi ile upstream `th0mk/nfsu2-web` kod tabanını karşılaştırmak; PR #21'e eklenen değişiklikleri, ayrı deneysel dallardaki çalışmaları, doğrulama durumunu ve sıradaki geliştirme adımlarını tek yerde tutmak.

Bu belge, proje ana README'sinin yerine geçmez. Entegrasyon çalışmalarının teknik durum raporudur. Aşağıdaki “eklendi” ifadesi kodun belirtilen dalda bulunduğunu; “doğrulandı” ise adı geçen otomatik veya manuel testin gerçekten tamamlandığını ifade eder. Bir özellik kod olarak eklenmiş olsa bile gerçek oyun oturumu veya üçüncü taraf oyun varlığı gerektiren testler yapılmadıysa bu ayrıca belirtilir.

---

## 1. Güncel depo ve dal durumu

| Öğe | Güncel durum | Bağlantı |
|---|---|---|
| TRPOLARIS deposu | Ana proje deposu | [trpolaris/NFSU2-Web](https://github.com/trpolaris/NFSU2-Web) |
| Upstream referansı | Karşılaştırma ve seçici port kaynağı | [th0mk/nfsu2-web](https://github.com/th0mk/nfsu2-web) |
| Üretim/varsayılan dal | `main`, HEAD `82616f9` | [main](https://github.com/trpolaris/NFSU2-Web/tree/main) |
| Ana entegrasyon dalı | `integration/upstream-2026-11-06`, aktif entegrasyon dalı | [Dal](https://github.com/trpolaris/NFSU2-Web/tree/integration/upstream-2026-11-06) |
| Ana entegrasyon PR'ı | PR #21, açık ve taslak; henüz birleştirilmedi | [PR #21](https://github.com/trpolaris/NFSU2-Web/pull/21) |
| World Map protokol dalı | `integration/world-map-mapd`, HEAD `ecf7f03` | [Dal](https://github.com/trpolaris/NFSU2-Web/tree/integration/world-map-mapd) |
| Minimap/NEARD çalışma dalı | `feature/world-map-meets`, HEAD `1bb6b23` | [Dal](https://github.com/trpolaris/NFSU2-Web/tree/feature/world-map-meets) |

**7 Kasım 2026 son kod kontrolü:** PR #21 HEAD `dd90cbd963fae7826074d826a1476feab1052df9`, 482 commit ve 206 değişen dosyadır. PR açık/taslak ve merge edilmedi. `main` HEAD `82616f9d9367203bda308005c07f6970f0ab4995` olarak kaldı; production deploy yapılmadı. MAPD/NEARD, `/lan?check`, World Map/Minimap/Car Meet runtime, yeni upstream name-filter ve remote-engine portları bu entegrasyon dalındadır. Deneysel World Map dalları otomatik birleştirilmedi; uyumlu kod seçilerek port edildi.

- [main ile ana entegrasyon dalının farkı](https://github.com/trpolaris/NFSU2-Web/compare/main...integration/upstream-2026-11-06)
- [main ile World Map dalının farkı](https://github.com/trpolaris/NFSU2-Web/compare/main...integration/world-map-mapd)
- [main ile Minimap dalının farkı](https://github.com/trpolaris/NFSU2-Web/compare/main...feature/world-map-meets)

---

## 2. İki sistemin mimari karşılaştırması

TRPOLARIS, upstream projesini olduğu gibi kopyalamak yerine, uyumlu oyun/runtime geliştirmelerini kendi arayüzü, Rust backend'i ve ağ protokolü içinde tutmayı hedefliyor.

| Alan | TRPOLARIS mevcut mimarisi | Upstream referansı | Entegrasyon yaklaşımı |
|---|---|---|---|
| Web arayüzü | Kendi React tabanlı sayfaları, F9 kontrol merkezi, Mini Chat HUD, ayrı sohbet penceresi, Player Hub ve yönetim ekranları | Upstream'in kendi web kabuğu ve sayfa akışı | Mevcut TRPOLARIS arayüzü korunuyor; upstream özellikleri mevcut panellere/servislere uyarlanıyor. |
| Oyun çalışma zamanı | C tabanlı oyun hook'ları ve WebAssembly/native derleme yolları | C runtime ve WebAssembly oyun tarafı | Oyun fonksiyonları ve veri yapıları uyumluysa port ediliyor; fork'a özel runtime kodu korunuyor. |
| Çok oyunculu ağ | TRPOLARIS'in Rust servisleri, WebSocket/LAN köprüsü, Free Roam protokolü ve typed chat mesajları | Upstream Rust hub ve kendi mesaj/protokol düzeni | Paket tipleri ve alanları karşılaştırılıyor; mesaj kimliği çakışmalarında doğrudan kopyalama yapılmıyor. |
| Sunucu | Rust tabanlı HTTP, Online, LAN, Free Roam, Vault/Cloud ve Player Hub servisleri | Upstream Rust sunucu/hub | Ortak iş mantığı seçici olarak alınıyor; mevcut API sözleşmeleri ve depolama yapısı korunuyor. |
| Arkadaşlık | Mevcut EA Messenger/Buddy kayıtları, claimed-name sahipliği ve yeni `/friends` köprüsü | Upstream Buddy/friend işlemleri ve hub bağlantıları | Yeni bir ayrı arkadaş veritabanı açılmadan mevcut kayıtlar genişletiliyor. |
| Mod ve oyun verisi | Oyun verisi manifest'i, dosya overlay mekanizmaları, pack üreticileri | Upstream mod/asset paketleme mantığı | Üçüncü taraf varlıklar depoya eklenmiyor; kullanıcıya ait oyun/mod klasörlerinden paket üretiliyor. |
| Kullanıcı arayüzü tasarımı | TRPOLARIS'in mevcut sayfa, kart, renk, kontrol ve çeviri düzeni | Upstream'in kendi UI düzeni | Özellik davranışı taşınıyor; arayüzün birebir upstream'e çevrilmesi hedeflenmiyor. |

### Neden doğrudan upstream kopyası yapılmıyor?

1. **Ağ protokolü farklılıkları:** TRPOLARIS Free Roam typed chat için mesaj türü 17'yi kullanıyor. Upstream World Map MAPD için aynı türü kullanıyor. Bu iki mesaj aynı tür numarasıyla güvenli şekilde çalışamaz.
2. **Arayüz farklılığı:** TRPOLARIS'in F9 kontrol merkezi, Mini Chat HUD, Player Hub ve yönetim ekranları korunmalı.
3. **Sunucu veri modeli farklılığı:** Arkadaş kayıtları, isim sahipliği, oda bilgisi, Cloud Save ve LAN bildirimleri mevcut Rust servislerine bağlı.
4. **Dağıtım ve kaynak sınırları:** Büyük oyuncu limitleri, üçüncü taraf mod varlıkları ve yeni paketler sunucu belleği, bant genişliği ve lisans koşulları doğrulanmadan varsayılan olarak açılmamalı.

---

## 3. PR #21 ana entegrasyon dalına eklenenler

Bu bölümdeki çalışmalar `integration/upstream-2026-11-06` dalındadır ve [PR #21](https://github.com/trpolaris/NFSU2-Web/pull/21) üzerinden incelenebilir. README bağlantısı ve bu rapor eklendikten sonra PR'da 144 dosya değişikliği listeleniyor. PR açık/taslak durumundadır.

### 3.1 Arkadaşlar, Online ve Free Roam

- Mevcut EA Messenger Buddy arkadaş listesi sınırı 50'den 250'ye çıkarıldı; engellenen ve yakın zamanda karşılaşılan listeler 50'de bırakıldı.
- Mevcut Buddy kayıtlarını kullanan doğrulanmış aynı-kaynak `GET/POST /friends` API'si eklendi.
- İsimle arkadaşlık isteği, kabul/ret, silme/engelleme, doğrudan mesaj, bekleyen mesaj kutusu ve Discord kullanıcı adı işlemleri bağlandı.
- F9 içindeki mevcut **Sürücü Ağı** alanına arkadaş listesi, istekler, çevrimiçi/Free Roam durumu, arama ve 20 satırlık sayfalama eklendi.
- Web sayfasındaki Friends & Crews alanı mevcut `/friends` kayıtlarıyla çalışacak şekilde eklendi.
- RoamHub tarafında karşılıklı arkadaş listesi, arkadaş öncelikli bağlantı, oda etiketi ve taze konum bilgisi eklendi.
- Aynı claimed-name sahibine ait birden fazla açık sekmenin ilişkileri korunacak şekilde sahiplik/sekme temizliği düzenlendi.
- Oyun içi FriendPrompt, ön tampon temasından sonra güvenli onay akışı ve varsayılan F kısayolu eklendi. Kısayol çakışma riski varsa veya tuş haritası okunamıyorsa işlem kapalı kalır.
- Crew daveti, dört öğelik bekleyen davet kuyruğu, Join/Decline ve oda/crew değişikliğinin güvenli zamanda uygulanması eklendi.

**Önemli dosyalar:** [friends API](https://github.com/trpolaris/NFSU2-Web/blob/integration/upstream-2026-11-06/web/server-rs/src/app/friends.rs) · [hub](https://github.com/trpolaris/NFSU2-Web/blob/integration/upstream-2026-11-06/web/server-rs/crates/roam/src/hub.rs) · [Friends UI](https://github.com/trpolaris/NFSU2-Web/tree/integration/upstream-2026-11-06/web/src/app)

### 3.2 Oyun/runtime uyumluluğu ve hata düzeltmeleri

- Kariyer Free Roam durumunda takılı kalan Engage/showcase işaretçileri için koşullu kurtarma ve regresyon senaryosu eklendi.
- Multiplayer yarışına geçerken Online menüsünün yanlış alt ekranda kalmasına karşı sınırlı geri çıkma/yeniden Lobby seçme akışı eklendi.
- Uzak araçlarda lastik dumanı, toprak ve nitro efektleri için oyun motorunun native efekt yolu kullanıldı; duraklatılmış veya sabit pozlarda takılı kalan efektlerin kapatılması sağlandı.
- Tarayıcı odağı kaybı, ilk modifier tuşunun repeat görünmesi, AltGr ve klavye düzeni sorunları için düzeltmeler eklendi.
- Kariyer kayıtlarında eksik araç handle'ı için güvenli kurtarma eklendi.
- Photo Mode'a auto-turn, kamera hareket hızı (0.1×–4×) ve yükseklik koruma seçenekleri mevcut ayar paneli içinde eklendi.
- Steam Controller/Steam Deck WebHID, Xbox Bluetooth/macOS ve Zikway HID düzeltmeleri; harici USB pedal eşlemesi ve iki parmaklı mobil garaj hareket düzeltmeleri eklendi.
- Touch Reset kontrolünün hız yükselince güvenli şekilde gizlenmesi ve aktif dokunma/tuş durumunun bırakılması sağlandı.

**Önemli dosyalar:** [runtime](https://github.com/trpolaris/NFSU2-Web/tree/integration/upstream-2026-11-06/runtime) · [game tests](https://github.com/trpolaris/NFSU2-Web/tree/integration/upstream-2026-11-06/tests/scripts) · [input tests](https://github.com/trpolaris/NFSU2-Web/tree/integration/upstream-2026-11-06/web/test)

### 3.3 Bellek, GPU ve cihaz tanılaması

- Mobil oyunun 1.024 MB başlangıç belleği korunarak 4 GB'a kadar büyüyebilen shared memory deneniyor; tarayıcı bu maksimumu ayıramazsa aynı başlangıç belleğiyle sabit bellek seçeneğine dönülüyor.
- Sınırlı runtime heap ve oyun oturumu sona erdiğinde dokunma-input referanslarının serbest bırakılması eklendi.
- Oyun durumu loglarına gerçek bellek/heap bilgisi eklendi.
- JavaScript JIT kapalı/interpreter-only WebAssembly ve SwiftShader/llvmpipe gibi yazılım GPU fallback durumları için kullanıcı tanılaması eklendi.
- PowerVR B-Series cihazlarda varsayılan pencere modu uyumluluğu eklendi; kullanıcının açık seçimi ezilmez.

### 3.4 GPS Distance HUD

- `gps_distance` ayarı varsayılan kapalı olarak mevcut Game Settings ekranına ve `settings.ini` şablonuna eklendi.
- Oyun içindeki doğal yön oku altında hedefe düz çizgi mesafesi gösterilir; yol mesafesi değildir.
- Speedometer Units ayarına göre metrik/imperial birim kullanılır.
- GPS kapalıyken veya yarıştayken metin gizlenir.
- Bu fork'ta yerel co-op bulunmadığı için port yalnızca Player 1 içindir.

**Dosya ve test:** [gpsdistance.c](https://github.com/trpolaris/NFSU2-Web/blob/integration/upstream-2026-11-06/runtime/gpsdistance.c) · [GPS native tests](https://github.com/trpolaris/NFSU2-Web/tree/integration/upstream-2026-11-06/tests)

### 3.5 Art Factory 28–34 vinyl paketi

- Art Factory 27 sonrasına yedi yeni Sha_Do vinyl tasarımı için runtime desteği eklendi.
- Orijinal `GLOBALB` verisi değiştirilmeden korumalı oyun verisi kopyası üzerinden yeni kayıtlar sunuluyor.
- `VPAK` overlay ve `tools/vinylpacks.py` üreticisi, native/WASM build wiring ve manifest izin listesi eklendi.
- Kaynak texture/mod varlıkları Git deposuna konmadı; kullanıcı uyumlu mod klasöründen paket üretmeli.

**Kurulum ve doğrulama:** [VINYLPACKS.md](https://github.com/trpolaris/NFSU2-Web/blob/integration/upstream-2026-11-06/docs/web/VINYLPACKS.md) · [vinyl pack builder](https://github.com/trpolaris/NFSU2-Web/blob/integration/upstream-2026-11-06/tools/vinylpacks.py) · [shop test](https://github.com/trpolaris/NFSU2-Web/blob/integration/upstream-2026-11-06/tests/scripts/vinylpacks_shop.txt)

### 3.6 Mods / Mod Packs — deneysel, mağaza özelliği geçici olarak kapalı

- `runtime/modpacks.c` paket başlığını/içeriğini okuyan ve `MODPACKS/PARTS.BIN` kayıtlarını doğrulayan runtime modülü; `tools/modpacks.py` ise deneysel pack builder olarak dalda bulunur.
- Builder'ın güncel CLI'si `--mod` kullanır; eski `--ug2net` örneği geçerli değildir.
- Son runtime kararı gereği mod rim shop aktivasyonu `g.on[] = 0` ile zorunlu kapalıdır. `NFSU2_MOD_RIMS` satırı ve eski `ug2net_parts` / `others_mod_parts` web ayarları kaldırılmıştır.
- Bu nedenle pack parser/builder altyapısının bulunması, Blitz/mod rimlerin Body Shop'ta açıldığı anlamına gelmez. Eski `modpacks_rims*.txt` senaryoları güncel kullanıcıya açık özellik olarak kabul edilmemelidir.

**Henüz yapılması gereken:** Rim shop davranışı ve kullanıcı ayarları birlikte yeniden etkinleştirilmeli; MODPARTS sidecar/save-load ve farklı pack ayarlarına sahip iki istemcinin uzaktaki araç görünümü gerçek oyunla yeniden doğrulanmalıdır.

**Dosyalar:** [MODPACKS.md](https://github.com/trpolaris/NFSU2-Web/blob/integration/upstream-2026-11-06/docs/web/MODPACKS.md) · [runtime/modpacks.c](https://github.com/trpolaris/NFSU2-Web/blob/integration/upstream-2026-11-06/runtime/modpacks.c) · [tools/modpacks.py](https://github.com/trpolaris/NFSU2-Web/blob/integration/upstream-2026-11-06/tools/modpacks.py) · [modpack test senaryoları](https://github.com/trpolaris/NFSU2-Web/tree/integration/upstream-2026-11-06/tests/scripts)

### 3.8 WebSocket bağlantı teşhisi ve LAN preflight

- WebSocket bağlantısı art arda üç kez hiç açılamazsa istemci aynı origin'deki `GET /lan?check` endpoint'inden neden sorgular.
- Sunucu `ok`, `busy`, `fast` veya `page` durumlarından birini döndürür; kontrol bağlantı bütçesi/rate-limit kotası tüketmez.
- Sonraki WebSocket de sunucu kabul edebileceği halde açılmazsa ağ, antivirüs veya tarayıcı eklentisi kaynaklı engel kullanıcıya bildirilir.
- Bağlantı açıldıktan sonra ping gönderip pong alamayan üç ardışık bağlantı için ayrı “bağlantı sürekli kopuyor” tanılaması vardır.
- Bildirim oyun oturumu başına sınırlanır; oyuncu bağlantı yokken LAN/Online ekranını tekrar açarsa bilinen neden yeniden gösterilir.
- `web/test/net-trouble.test.mjs` reddedilen upgrade, ağ engeli, sunucu yeniden başlatma sonrası başarılı bağlantı, `fast`/eski sunucu davranışı ve sessiz bağlantı senaryolarını kapsar.

**Önemli dosyalar:** [net/index.ts](https://github.com/trpolaris/NFSU2-Web/blob/integration/upstream-2026-11-06/web/src/net/index.ts) · [lan.rs](https://github.com/trpolaris/NFSU2-Web/blob/integration/upstream-2026-11-06/web/server-rs/src/app/lan.rs) · [net trouble regression](https://github.com/trpolaris/NFSU2-Web/blob/integration/upstream-2026-11-06/web/test/net-trouble.test.mjs)

### 3.7 Cloud Save, isim sahipliği ve çıkış güvenliği

- Name-claim deposunda süre aşımı temizliğinin sıklığı ve kilit altında JSON serileştirme maliyeti düzenlendi.
- Claim deposunun hard cap değeri 5.000.000 ve isim tutma süresi 180 gündür. Beş milyon kayıt için dağıtım ölçeğinde bellek/disk/yazma yük testi yapılmış kabul edilmemelidir.
- Başarılı Cloud Save okuma/yazma işlemleri claimed-name etkinliğini mevcut saatlik sınırla yeniler; hatalı, bulunamayan veya çakışan işlemler yenilemez.
- Son kayıttan en az 10 dakika geçmişse veya oturumda henüz kayıt yoksa ilk Quit game işleminde uyarı çıkar; Cancel oyunu açık tutar.

**Dosyalar:** [claims crate](https://github.com/trpolaris/NFSU2-Web/tree/integration/upstream-2026-11-06/web/server-rs/crates/claims) · [Cloud Save/Vault](https://github.com/trpolaris/NFSU2-Web/blob/integration/upstream-2026-11-06/web/server-rs/src/app/vault.rs) · [Quit akışı](https://github.com/trpolaris/NFSU2-Web/blob/integration/upstream-2026-11-06/web/src/app/shell.ts)

---

## 4. Ayrı dallardaki deneysel World Map ve Minimap çalışmaları

Bu deneysel dallar kaynak referansıdır; yalnızca uyumlu ve uyarlanmış parçalar PR #21'e taşındı. MAPD/NEARD protokolü, hub sorgusu, NEARD-only oyuncuların oyun içi minimap marker renderer'ı ve Car Meet/legend/selection/GPS kodu ana entegrasyon dalında bulunuyor. `roam mp near [all]` ve `roam mp meet` tanılamaları ile 24 sabit istemcili Car Meet senaryosu eklendi. Kod entegrasyonu tamamlandı; gerçek oyun ve çok istemcili görsel doğrulama hâlâ açık.

### 4.1 World Map — MAPD protokolü

Upstream World Map geliştirmesi 512/tek seferlik snapshot yaklaşımından artımlı konum delta'larına, daha fazla oyuncuya ve hareket tahminine geçiyor. Referans upstream commit'i: [World Map MAPD ve marker interpolation](https://github.com/th0mk/nfsu2-web/commit/dd32a0adfa4ba445d5bcc864c006a51d3273924a).

TRPOLARIS tarafındaki temel protokol çakışması:
- TRPOLARIS typed Free Roam chat mesajı **17** türünü kullanıyor.
- Upstream MAPD de **17** türünü kullanıyor.
- Bu nedenle entegrasyon prototipinde MAPD için **18** ayrıldı; chat kimliği korunuyor.

PR #21'e taşınanlar:
- C ağ çekirdeğinde MAPD encode/decode, değişken uzunluklu giriş doğrulaması ve parçalı cevap birleştirme.
- Rust hub'da slot anahtarlı delta üretimi; legacy iki bayt MAPREQ ve yeni max/base biçimleriyle geriye uyumluluk.
- Native World Map renderer'ın slot kimliklerini koruyarak MAPD sonuçlarını uygulaması ve 250 ms canlı yenileme.
- MAPD için **18** ayrıldı; TRPOLARIS typed Free Roam chat'in **17** kimliği değişmedi.

Açık işler:
- Oda değişimi/işaretçi temizliği ve hız kestirimi için uçtan uca gerçek oyun testi.
- İlk hedef olarak 2.048 oyunculuk cevap sınırı; daha yüksek kapasiteyi ayrı yük testine bırakmak.

**Kaynak dal:** [integration/world-map-mapd](https://github.com/trpolaris/NFSU2-Web/tree/integration/world-map-mapd). Dal kodu otomatik birleştirilmedi; uyumlu parçalar PR #21'e port edildi.

### 4.2 Minimap — NEARREQ / NEARD ve Car Meet

Upstream Minimap geliştirmesi, oyuncunun çevresindeki araçları ayrı tek datagramlı bir yakınlık isteğiyle almayı ve hareket eden okları güncellemeyi hedefliyor. Referanslar:
- [NEARD minimap ve mekânsal grid upstream commit'i](https://github.com/th0mk/nfsu2-web/commit/7caf20dbab809f2048c5ec27a8625a2803b4e721)
- [Car Meet / GPS upstream commit'i](https://github.com/th0mk/nfsu2-web/commit/109bdcc471831ff57b24a03982119167f1abf1cd)
- [20 oyunculuk meet ve 4.096 World Map kapasitesi](https://github.com/th0mk/nfsu2-web/commit/a5892bac86f571b5e1c854a8512fc92ec9503a7d)

TRPOLARIS Minimap prototipinde:
- Mesaj kimlikleri: MAPD **18**, NEARREQ **19**, NEARD **20**; chat **17** olarak kalır.
- Rust wire codec'te NEARREQ decode/dispatch ve MAPD biçimli NEARD datagram yazımı; C core'da NEARREQ üretimi, NEARD decode ve slot bazlı delta birleştirme API'si (rc_ask_near) eklendi.
- Rust hub'da oda hücre grid'i, aday önbelleği, link/engel/oda filtreleri, tek datagram cevabı ve tick yaşam döngüsü eklendi; ölçülen hub yüküne göre 150/500/1000 ms geri basınç uygulanıyor.
- Aktif HUD akışına `rc_ask_near` polling bağlandı: oyun döngüsü NEARD ister, cevapları session lock altında snapshot'a kopyalar ve hız verisiyle marker konumlarını ileri taşır. `roam mp status` toplam cevap/ok/ikon sayısını ve arama yarıçapını; `roam mp near [all]` ise her okun konum, mesafe ve ikon bayraklarını gösterir.
- C unit testleri tam NEARD snapshot, slot güncelleme/silme ve eski request cevabının reddini kapsar; oda geçişi testi eski peer, World Map/Minimap snapshot ve lobi/mesaj kuyruklarının temizlendiğini doğrular.
- Oyun içi renderer port edildi: NEARD oyuncuları için stand-in oyuncu kayıtları, Player tipi ikonlar, `AIRACERINDICATOR_0` kopyaları ve visual pool yönetimi oluşturuluyor. Konumlar hız/başlık verisiyle güncelleniyor; yüklü arkadaş araçlarının yakınındaki çift işaretçiler eleniyor; stale/out-of-range ikonlar gizleniyor; HUD/icon listesi rebuild algılanıp eski pointer'lar tekrar kullanılmıyor.
- `NFSU2_ROAM_NEAR` varsayılan 64, 0–96 aralığında; 0 özelliği kapatır. `roam mp near [all]` marker, cevap, havuz ve mesafe tanılaması verir.
- Açık işler: native/WASM oyun derlemesi ve gerçek oyun ekranında ikon yön/konum testi; paket kaybı, oda değişimi ve 2+ gerçek istemciyle doğrulama.
- Car Meet runtime kodu; 25 m hareket toleransı içinde 60 saniye park eden oyuncuları toplar, 50 m içindeki en az 24 oyuncudan meet kümesi oluşturur, yıldız/label/legend satırı ve seçim item'i üretir. `roam mp meet` açık harita üzerinde marker, ikon/label görünürlüğü, seçili item ve GPS trigger koordinatlarını raporlar.
- `tests/scripts/roam_crowd_meet.txt` 24 sabit crowd istemcisiyle (speed 0, spread 6 m) hub'ın 60 saniyelik parked penceresini bekler ve meet marker/label/item/trigger tanılamasını alır. Gerçek oyunda Car meets legend satırını göster/gizle, meet seç, GPS hedefini sür ve 40 m içinde otomatik temizlenmeyi doğrula.

**Kaynak dal:** [feature/world-map-meets](https://github.com/trpolaris/NFSU2-Web/tree/feature/world-map-meets). Kaynak dal otomatik birleştirilmedi; NEARD renderer ve Car Meet marker/legend/selection/GPS parçaları seçilerek ana entegrasyon dalına uyarlandı. `roam mp near`, `roam mp meet` ve manuel oyun senaryoları mevcut; son davranış doğrulaması gerçek oyun oturumunda yapılmalı.

---

## 5. Henüz yapılmayan veya daha geniş çalışma gerektiren upstream güncellemeleri

| Öncelik | Alan | Yapılacak iş | Tamamlanma koşulu |
|---|---|---|---|
| P0 | PR #21 stabilizasyonu | Son PR head üzerinde tam Multiplayer & Regression CI çalıştırmak; iptal edilen koşuyu yeşil sonuçla değiştirmek. | PR head'inde CI başarılı, derleme/test hatası yok. |
| P0 | Gerçek oyun testi | Mod pack, vinyl pack, GPS HUD, FriendPrompt, crew daveti ve Save/Load akışını gerçek oyunla doğrulamak. | İki istemcili ve kariyer kayıtlı test senaryoları geçer; bulgular kaydedilir. |
| P0 | MODPACKS rim shop özelliğini yeniden etkinleştirme | Runtime'da zorunlu kapalı olan `g.on[]` kararını, UI ayarlarını ve save/remote-car davranışını birlikte yeniden tasarla. | Güvenli ayar kaydı, native/WASM testleri, uyumlu paket üretimi ve iki istemcili Body Shop/remote-car/save doğrulaması geçer. |
| P1 | World Map MAPD | Port edildi; yeni CI ve gerçek oyun oda/marker testleri bekleniyor. | Legacy MAPREQ snapshot ve yeni MAPD delta birleştirmesi geçer; oda değişimi temizlenir; 2.048 oyuncu testi tamamlanır. |
| P1 | Minimap NEARD | Rust grid/dispatch, C protocol/merge, aktif polling, Player ikon/visual renderer, interpolation/extrapolation, stale/duplicate temizliği ve diagnostics port edildi. | Native/WASM oyun build'i; marker yön/konum, HUD rebuild, oda değişimi, paket kaybı ve 2+ istemcili oyun testi geçer. |
| P1 | Car Meet | Park kümesi, meet marker/label/item, legend seçimi ve GPS trigger kodu port edildi; `roam mp meet` diagnostics ve 24 sabit istemcili test senaryosu eklendi. | 24 oyuncu 60 s park sonrası meet görünür; legend hide/show çalışır; seçilen meet GPS hedeflenir ve 40 m içinde rota temizlenir. |
| P2 | World Map kapasite artışı | 4.096 marker ve daha fazla MAPD parçası için istemci bellek, marker havuzu ve UDP veri boyutunu ölçmek. | Bellek/CPU/packet limitleri ölçülür; yük testi ve cihaz profilleri onaylanır. |
| P2 | Hub kapasitesi | LAN switch adres/admission alanı 24.000'e genişletildi (`10.77.0.0/17`); Free Roam hub'ın ayrı 6.144 oyuncu sınırı korunuyor. Compose 24k peer/192k bağlantı bütçesini ve descriptor limitlerini açığa çıkarıyor. | 24.000 gerçek oyuncu performans hedefi değildir. Kademeli yük testleri, gerçek VPS kaynak bütçesi, ağ topolojisi ve degrade davranışı hâlâ doğrulanmalı. |
| P2 | Multiplayer kariyer kredileri | Yarışa katılım uygunluğu, arkadaş/crew credit maskeleri, sonuç ve kariyer kaydı, lobby/UI. | Kayıt bozulmadan tek/çok oyunculu yarış sonucuna doğru kredi yazılır. |
| P2 | Vehicle Show-Off | Kaput/bagaj/kapı durumları, hoparlör/ses, uzaktaki araç animasyonu. | Ağ paketleri, animasyon state ve düşük bant genişliği testleri geçer. |
| P2 | Photo Mode genişletmesi | Kamera yolu, lens/scene efektleri, freeze-time ve daha yüksek çözünürlük seçenekleri. | Var olan Photo Mode kontrolleriyle çakışmadan runtime ve UI testleri geçer. |
| P3 | Co-op / Split Screen | 2–4 oyunculuk render, bellek, input, kamera, kariyer ve yarış sistemleri. | Her oyuncunun kontrol/kamera/kayıt davranışı doğrulanır; yalnızca dosya kopyasıyla yapılmaz. |
| P3 | Diğer upstream özellikleri | Çoklu lobby/Quick Chat iyileştirmeleri, gizli Special vinyls, araç filtresi/unique unlock, Visual Reputation Remover, hava durumu senkronizasyonu, pause-menu save, save recovery, Last.fm/EA Trax, country RTT ve kalan çarpışma/efekt düzeltmeleri. | Her özellik için ayrı protokol, runtime, UI ve regresyon senaryosu tamamlanır. |

**MAPD kapasite uygulaması:** Rust hub'da MAPD yolu için `mapd_limit` 2.048 kayıt (yükseklikli isteklerde 1.664), legacy `map()` yolu için `legacy_map_limit` 690 kayıt kullanır. `RoamOptions::default().map_max` 512'dir; `NFSU2_ROAM_MAP_MAX` ile 1–2.048 arasında açıkça yükseltilebilir. Hub unit testleri 2.048/1.664 limitlerini, varsayılanı, clamp davranışını, 690 legacy sınırını ve 16 parçalı tam snapshot paket bütçesini doğrular. Bu, kod ve otomatik test kapsamıdır; 2.048 gerçek oyunculu yük testi değildir.

**Önerilen sıra:** Son PR HEAD'in Multiplayer & Regression CI'sini tamamla; native/WASM oyun build'lerini al; ardından World Map/NEARD marker'larını gerçek oyunda ve iki istemcide doğrula; sonra Car Meet/GPS akışını gerçek oyunda tamamla. MODPACKS rim mağaza akışını yeniden etkinleştirme ve 24k switch kapasitesi için yük profili daha sonraki ayrı işlerdir. 24k adres üst sınırını 24k Free Roam oyuncusu gibi sunma.


## 10. Upstream delta audit — 7 Kasım 2026

Bu audit PR #21'in 7 Kasım 2026 tarihli devam HEAD'ini ve upstream'in aynı gün yayımladığı son değişiklikleri kapsar. “Port edildi” kodun mevcut olduğunu, gerçek cihaz/oyun testi yapıldığı anlamına gelmediğini belirtir.

| Upstream alanı | Entegrasyon durumu | Kalan doğrulama |
|---|---|---|
| PATCH_MAX 24 → 64 | Zaten entegre; `runtime/dispatch.c` upstream ile aynı içerik SHA'sını taşıyor. | Yeni kod değişikliği gerekmiyor. |
| World 1–4 / named worlds ve F9 Controls | Dünya seçimi, oda sayımları ve F9 sayfa davranışı TRPOLARIS kontrol merkezine uyarlandı; upstream UI birebir kopyalanmadı. | Oda değişimi gerçek oyuncularla tekrar kontrol edilmeli. |
| Name filter genişletmesi | Altı katmanlı C header, Rust implementation/cross-check/tests ve browser implementation/tests port edildi; `Nazli`/`Nazilli` benzeri yanlış pozitif korumaları da dahil. | Tam CI ve canlı isim örnekleri. |
| Open-hood remote engine textures | `overrides.c` ve `roam_game.c` içine fork'a uyarlanmış engine-texture list davranışı port edildi. | Farklı araç tipleriyle iki istemcili gerçek oyun testi. |
| iPhone/WebKit memory fixes | Off-page `WebAssembly.Memory`, worker MessagePort aktarımı, memory-grow buffer bildirimi, OPFS cache'den doğrudan okuma ve GPU render-queue sınırı port edildi. | Gerçek iPhone Safari/WebKit cihaz testi; CI bu testi sağlamaz. |
| Automatic race bans | `NFSU2_CAR_BANS` ile opsiyonel kW/rating eşikleri, mevcut ban store üzerinden iki haftalık otomatik ban ve opsiyonel `NFSU2_BAN_WEBHOOK` Discord bildirimi eklendi. | Varsayılan kapalı davranış, operatörün kendi eşikleri ve gerçek race telemetry ile kontrollü doğrulama. |
| 24k LAN address space | LAN switch `/17`, 24.000 sanal adres ve 1–24.000 `--max-peers` sınırı; Docker image/Compose yapılandırması buna göre güncellendi. | 24k yük testi yok. Free Roam hub ayrı 6.144 peer limiti taşır; 24k adres alanı 24k Free Roam oyuncu garantisi değildir. |
| Claim store 5M cap | Kod hard cap'i 5.000.000'e yükseltildi; 180 günlük hold ve expiry pruning korundu. | 5M kayıtlı bellek, disk ve JSON yazma maliyeti yük testine tabi değil. |
| MODPACKS / rim brands | Parser ve builder mevcut; son güvenli kararda shop activation kapalı ve eski web ayarları kaldırılmış durumda. | UI/runtime yeniden eşleştirilmeden kullanıcıya açık özellik sayılmamalı. |

### 10.1 Son port ve dağıtım notları — 7 Kasım 2026

- WebKit tarafında sayfa artık canlı `WebAssembly.Memory` nesnesini tutmak yerine buffer wrapper kullanabiliyor; I/O worker belleği yaratıp oyun worker'larına port üzerinden iletiyor. Memory büyümesi sayfaya bildirilir. OPFS cache dosyalarından doğrudan oyun belleğine okuma ve büyüyen buffer sınırı için regresyon kodu eklendi.
- Remote araç yüklemesi, kaput açıkken motor texture hash'ini araç texture listesine ekler. Bu yalnızca oyun C kodunun port edildiğini doğrular; görünür motorun gerçek oyunda test edildiği anlamına gelmez.
- Otomatik race-ban politikası boş env ile kapalıdır. `NFSU2_CAR_BANS=kw=...` ve/veya `rating=...` pozitif eşikleri kullanılır; iki eşikten herhangi biri ban sebebi olabilir. Ban iki haftalıktır. `NFSU2_BAN_WEBHOOK` opsiyonel Discord bildirimi içindir; webhook URL'si secret olarak tutulmalıdır.
- Docker Compose `NFSU2_MAX_PEERS` (varsayılan 24000), `NFSU2_CAR_BANS`, `NFSU2_BAN_WEBHOOK` ve `NFSU2_ROAM_MAP_MAX` ayarlarını konteynere geçirir. Caddy/backend bağlantı ve descriptor limitleri 24k switch üst sınırına göre yükseltildi. Bu konfigürasyon bir 24k yük testi değildir.
- Claim store hard cap 5.000.000'dur. Bu sayı doğrulanmış aktif oyuncu veya gerçek deployment ölçeği değildir; yük testi gerekir.
- MODPACKS rim mağaza girişi geçici olarak kapalıdır. Güncel builder `--mod` kullanır; eski `--ug2net`, `ug2net_parts` ve `others_mod_parts` örnekleri kullanılmamalıdır.
## 6. Test ve CI durumu nasıl okunmalı?

Son branch HEAD `dd90cbd963fae7826074d826a1476feab1052df9` (PR #21: 482 commit, 206 değişen dosya) için kontrol anında image-rs ve Multiplayer/Regression koşuları çalışıyordu. Önceki tam olmayan Multiplayer koşusu Chromium regression aşamasında iptal edildi; bu nedenle o koşu tam CI başarısı sayılmaz. Compose ve dokümantasyon güncellemelerinden sonra oluşan yeni HEAD'in kendi Actions sonucu esas alınmalıdır.

- [Tüm GitHub Actions çalışmaları](https://github.com/trpolaris/NFSU2-Web/actions)
- [Multiplayer & Regression workflow](https://github.com/trpolaris/NFSU2-Web/actions/workflows/multiplayer-ci.yml)
- [Container image workflow](https://github.com/trpolaris/NFSU2-Web/actions/workflows/image-rs.yml)

Bir önceki `d26f8de` snapshot'ında native runtime syntax, TypeScript, web build, Cargo.lock, Rust workspace, GPS HUD, mailbox layout, MAPD/NEARD core, server binary ve synthetic Online load/abuse smoke test adımları geçti; Chromium regression adımı tamamlanmadan koşu iptal edildi. Image-rs job'u aynı snapshot'ta başarılıydı. Bunlar daha sonraki HEAD'in CI sonucu yerine geçmez.

### Bir özelliğin tamamlandı sayılması için

1. Kod doğru dalda ve doğru mesaj/protokol kimliğiyle bulunmalı.
2. C/native ve WebAssembly build yolları derlenmeli.
3. Rust sunucu testleri ve web/TypeScript regresyonları geçmeli.
4. Eski istemciler için geri uyumluluk veya açık sürüm sınırı olmalı.
5. Gerekli oyun verisi kullanıcı tarafından üretilebilmeli ve manifest üzerinden sunulmalı.
6. Gerçek oyun testi gereken yerde bir veya iki istemcili test yapılmalı; yalnızca unit test sonucu yeterli sayılmamalı.
7. İlgili PR onaylanmalı, birleştirilmeli ve dağıtım ayrı bir kontrollü adımda yapılmalı.
## 7. Kullanıcıya ait varlıklar ve dağıtım notları

- Oyun dosyaları veya üçüncü taraf mod texture'ları bu depoya eklenmez.
- `tools/vinylpacks.py` ve `tools/modpacks.py` kullanıcıya ait/uyumlu kaynak klasörlerden sunucuya özel paket üretmek için kullanılır.
- `MODPARTS.DAT` profil sidecar'ı ilgili kariyer kaydıyla birlikte yedeklenmelidir.
- `VINYLPACKS/` ve `MODPACKS/` oyun verisi klasörleridir; save overlay ile karıştırılmamalıdır.
- Üretim sunucusuna dağıtım, PR birleştirme ve CI başarısından ayrı tutulmalıdır. Bu raporda belirtilen hiçbir deneysel dal üretim sunucusuna dağıtılmış kabul edilmez.

---

## 8. Önemli bağlantılar

### TRPOLARIS
- [Ana depo](https://github.com/trpolaris/NFSU2-Web)
- [Ana dal](https://github.com/trpolaris/NFSU2-Web/tree/main)
- [PR #21 — upstream entegrasyonu](https://github.com/trpolaris/NFSU2-Web/pull/21)
- [Ana entegrasyon dalı](https://github.com/trpolaris/NFSU2-Web/tree/integration/upstream-2026-11-06)
- [Önce/sonra karşılaştırması](https://github.com/trpolaris/NFSU2-Web/compare/main...integration/upstream-2026-11-06)

### Entegrasyon belgeleri ve kaynak kod
- [Bu entegrasyon raporu](https://github.com/trpolaris/NFSU2-Web/blob/integration/upstream-2026-11-06/docs/UPSTREAM-COMPARISON-ROADMAP.md)
- [Upstream port notları](https://github.com/trpolaris/NFSU2-Web/blob/integration/upstream-2026-11-06/docs/UPSTREAM-INTEGRATION-2026-11-06.md)
- [MODPACKS rehberi](https://github.com/trpolaris/NFSU2-Web/blob/integration/upstream-2026-11-06/docs/web/MODPACKS.md)
- [VINYLPACKS rehberi](https://github.com/trpolaris/NFSU2-Web/blob/integration/upstream-2026-11-06/docs/web/VINYLPACKS.md)
- [Oyun test senaryoları](https://github.com/trpolaris/NFSU2-Web/tree/integration/upstream-2026-11-06/tests/scripts)

### Upstream referans commit'leri
- [Mod Packs](https://github.com/th0mk/nfsu2-web/commit/29c28302c17b7e99d9e9ae75ef74def1337b7201)
- [World Map MAPD / interpolation](https://github.com/th0mk/nfsu2-web/commit/dd32a0adfa4ba445d5bcc864c006a51d3273924a)
- [Minimap NEARD](https://github.com/th0mk/nfsu2-web/commit/7caf20dbab809f2048c5ec27a8625a2803b4e721)
- [Car Meet ve GPS](https://github.com/th0mk/nfsu2-web/commit/109bdcc471831ff57b24a03982119167f1abf1cd)
- [4.096 World Map oyuncusu / 48 MAPD parçası](https://github.com/th0mk/nfsu2-web/commit/a5892bac86f571b5e1c854a8512fc92ec9503a7d)

---

## 9. Son karar ve çalışma ilkesi

Şu an en güvenli yaklaşım; PR #21'deki ana entegrasyonu ayrı tutmak, son commit üzerinde tam CI ve gerçek oyun kontrollerini bitirmek, ardından World Map ve Minimap protokollerini bağımsız dallarda tamamlamaktır. Ana dalı ve üretim sunucusunu, bu doğrulamalar yapılmadan değiştirmemek gerekir.

Bu yol haritası, her özellik için kod, protokol, test ve dağıtım durumunun ayrı değerlendirilmesini esas alır. Böylece “dosyaya eklendi”, “CI'dan geçti”, “oyun içinde doğrulandı” ve “üretime alındı” adımları birbirine karıştırılmaz.
