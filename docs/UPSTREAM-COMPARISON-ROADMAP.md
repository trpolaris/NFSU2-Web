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

**Önemli:** `main` ile entegrasyon dalı aynı değildir. PR #21 hâlâ açık taslaktır ve birleştirilmemiştir. World Map/Minimap deneysel dalları otomatik olarak dahil edilmedi; MAPD, NEARD ve seçilen native runtime parçaları PR #21'e seçici olarak port edildi. `main` ve üretim sunucusu değişmedi.

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

### 3.6 Mods / Mod Packs — kod eklendi, gerçek oyun doğrulaması bekliyor

- `runtime/modpacks.c` ve `tools/modpacks.py` eklendi.
- `MODPACKS/` dosya/texture overlay desteği, native/WASM build bağlantıları ve oyun verisi manifest izinleri eklendi.
- `ug2net_parts` ayarı Body Shop'ta Blitz jantlarının sunulmasını kontrol eder.
- `others_mod_parts` ayarı diğer oyuncu araçlarında mod parçası veya uyumlu orijinal stand-in gösterimini seçer.
- Eklenen parçalar profilin stok parça verisini değiştirmeden `MODPARTS.DAT` sidecar dosyasında saklanacak şekilde tasarlandı.
- Profil yedekleme/geri yükleme sırasında eşleşen sidecar'ın temizlenmesi için ek kod ve test yazıldı.

**Henüz yapılması gereken:** Uyumlu underground2.net mod varlıklarından gerçek `MODPACKS/` klasörü üretmek, farklı ayarlara sahip iki istemciyle aynı aracı görüntülemek, Body Shop ve kariyer kayıt/yükleme senaryolarını gerçek oyunla kontrol etmek.

**Dosyalar:** [MODPACKS.md](https://github.com/trpolaris/NFSU2-Web/blob/integration/upstream-2026-11-06/docs/web/MODPACKS.md) · [runtime/modpacks.c](https://github.com/trpolaris/NFSU2-Web/blob/integration/upstream-2026-11-06/runtime/modpacks.c) · [tools/modpacks.py](https://github.com/trpolaris/NFSU2-Web/blob/integration/upstream-2026-11-06/tools/modpacks.py) · [modpack test senaryoları](https://github.com/trpolaris/NFSU2-Web/tree/integration/upstream-2026-11-06/tests/scripts)

### 3.7 Cloud Save, isim sahipliği ve çıkış güvenliği

- Name-claim deposunda süre aşımı temizliğinin sıklığı ve kilit altında JSON serileştirme maliyeti düzenlendi.
- Mevcut 500.000 claim sınırı ve 180 günlük bekletme korunarak daha büyük upstream limitlerinin doğrudan alınması ertelendi.
- Başarılı Cloud Save okuma/yazma işlemleri claimed-name etkinliğini mevcut saatlik sınırla yeniler; hatalı, bulunamayan veya çakışan işlemler yenilemez.
- Son kayıttan en az 10 dakika geçmişse veya oturumda henüz kayıt yoksa ilk Quit game işleminde uyarı çıkar; Cancel oyunu açık tutar.

**Dosyalar:** [claims crate](https://github.com/trpolaris/NFSU2-Web/tree/integration/upstream-2026-11-06/web/server-rs/crates/claims) · [Cloud Save/Vault](https://github.com/trpolaris/NFSU2-Web/blob/integration/upstream-2026-11-06/web/server-rs/src/app/vault.rs) · [Quit akışı](https://github.com/trpolaris/NFSU2-Web/blob/integration/upstream-2026-11-06/web/src/app/shell.ts)

---

## 4. Ayrı dallardaki deneysel World Map ve Minimap çalışmaları

Bu deneysel dallar kaynak referansıdır; yalnızca uyumlu parçalar PR #21'e taşındı. Protokol ve sunucu tarafı MAPD/NEARD kodu entegre edildi; oyun içi minimap çizimi, Car Meet ve GPS tamamlanmadan özellik bütünüyle bitmiş sayılmaz.

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
- Aktif HUD akışına `rc_ask_near` polling bağlandı: oyun döngüsü bir saniyelik istemci sınırıyla NEARD ister, cevapları session lock altında snapshot'a kopyalar, XY konumlarını hızla ileri taşır ve 2,5 saniyeden eski kayıtları görünmez sayar. `roam mp status` yakın oyuncu toplamı, taze kayıt sayısı, delta nesli ve son sorgu yaşını gösterir.
- C unit testleri tam NEARD snapshot, slot güncelleme/silme ve eski request cevabının reddini kapsar; oda geçişi testi eski peer, World Map/Minimap snapshot ve lobi/mesaj kuyruklarının temizlendiğini doğrular.
- Açık işler: NEARD-only oyuncular için gerçek minimap ikon/ok çizimi ve görsel temizleme; gecikme/paket kaybı/oda değişimiyle canlı iki istemcili test.
- Car Meet park takibi, World Map etiket/seçim ve GPS kodu mevcut; gerçek oyunda marker/sayım/hedef davranışı doğrulanmalıdır.

**Kaynak dal:** [feature/world-map-meets](https://github.com/trpolaris/NFSU2-Web/tree/feature/world-map-meets). Yalnızca uyumlu protokol/sunucu parçaları PR #21'e port edildi; kaynak dalın kalan renderer ve Car Meet değişiklikleri otomatik dahil değil.

---

## 5. Henüz yapılmayan veya daha geniş çalışma gerektiren upstream güncellemeleri

| Öncelik | Alan | Yapılacak iş | Tamamlanma koşulu |
|---|---|---|---|
| P0 | PR #21 stabilizasyonu | Son PR head üzerinde tam Multiplayer & Regression CI çalıştırmak; iptal edilen koşuyu yeşil sonuçla değiştirmek. | PR head'inde CI başarılı, derleme/test hatası yok. |
| P0 | Gerçek oyun testi | Mod pack, vinyl pack, GPS HUD, FriendPrompt, crew daveti ve Save/Load akışını gerçek oyunla doğrulamak. | İki istemcili ve kariyer kayıtlı test senaryoları geçer; bulgular kaydedilir. |
| P0 | MODPACKS asset üretimi | Uyumlu underground2.net varlıklarından `MODPACKS/` üretip dosya manifest ve oyun açılışını kontrol etmek. | Paket açılır; eksik/yanlış boyutlu varlık yok; Body Shop ve uzak araçlarda tutarlı sonuç. |
| P1 | World Map MAPD | Port edildi; yeni CI ve gerçek oyun oda/marker testleri bekleniyor. | Legacy MAPREQ snapshot ve yeni MAPD delta birleştirmesi geçer; oda değişimi temizlenir; 2.048 oyuncu testi tamamlanır. |
| P1 | Minimap NEARD | Rust grid/dispatch, C protocol/merge, aktif HUD polling, snapshot cache, XY extrapolation ve status diagnostics port edildi; ikon/ok renderer'ı kaldı. | 1 datagramlık NEARD, 150/500/1000 ms yük geri basıncı, NEARD-only marker çizimi/temizliği ve iki istemci testi geçer. |
| P1 | Car Meet | Park etmiş oyuncu kümesini belirleme, meet işaretçisini çizme ve GPS hedefi/varış davranışı. | 20 oyunculuk meet senaryosu, legend gizleme ve GPS hedefleme gerçek oyunda çalışır. |
| P2 | World Map kapasite artışı | 4.096 marker ve daha fazla MAPD parçası için istemci bellek, marker havuzu ve UDP veri boyutunu ölçmek. | Bellek/CPU/packet limitleri ölçülür; yük testi ve cihaz profilleri onaylanır. |
| P2 | Hub kapasitesi | 24.000 oyuncu hedefini bağlantı, bellek, paket/s, thread yoğunluğu, container ve ağ topolojisiyle test etmek. | Kademeli yük testleri, kaynak bütçesi ve düşürme/koruma stratejisi belgelenir. |
| P2 | Multiplayer kariyer kredileri | Yarışa katılım uygunluğu, arkadaş/crew credit maskeleri, sonuç ve kariyer kaydı, lobby/UI. | Kayıt bozulmadan tek/çok oyunculu yarış sonucuna doğru kredi yazılır. |
| P2 | Vehicle Show-Off | Kaput/bagaj/kapı durumları, hoparlör/ses, uzaktaki araç animasyonu. | Ağ paketleri, animasyon state ve düşük bant genişliği testleri geçer. |
| P2 | Photo Mode genişletmesi | Kamera yolu, lens/scene efektleri, freeze-time ve daha yüksek çözünürlük seçenekleri. | Var olan Photo Mode kontrolleriyle çakışmadan runtime ve UI testleri geçer. |
| P3 | Co-op / Split Screen | 2–4 oyunculuk render, bellek, input, kamera, kariyer ve yarış sistemleri. | Her oyuncunun kontrol/kamera/kayıt davranışı doğrulanır; yalnızca dosya kopyasıyla yapılmaz. |
| P3 | Diğer upstream özellikleri | Çoklu lobby/Quick Chat iyileştirmeleri, gizli Special vinyls, araç filtresi/unique unlock, Visual Reputation Remover, hava durumu senkronizasyonu, pause-menu save, save recovery, Last.fm/EA Trax, country RTT ve kalan çarpışma/efekt düzeltmeleri. | Her özellik için ayrı protokol, runtime, UI ve regresyon senaryosu tamamlanır. |

**Önerilen sıra:** PR #21'in güncel CI'sini ve yeni native C protocol testini doğrula; World Map oda/marker akışını oyun içinde dene; ardından NEARREQ'yi minimap HUD'a bağlayıp Car Meet/GPS işlerini tamamla. 4.096 World Map ve 24.000 hub oyuncusu gibi büyük limitler profil ve yük testi olmadan etkinleştirilmemeli.

---

## 6. Test ve CI durumu nasıl okunmalı?

| Dal / çalışma | Son görünen durum | Yorum |
|---|---|---|
| PR #21 Multiplayer & Regression CI, code snapshot `7cd24b0` | [Beklemede](https://github.com/trpolaris/NFSU2-Web/actions/runs/42370792666) | Native runtime syntax, TypeScript/web ve Rust workspace testleri bu run üzerinde takip ediliyor; son adım tamamlanmadan başarı sayılmaz. |
| PR #21 image-rs, preceding code snapshot `71f4348` | [Başarılı](https://github.com/trpolaris/NFSU2-Web/actions/runs/42370639104) | Bu sonuç daha yeni `7cd24b0` head'i için image build geçtiğini kanıtlamaz. |
| World Map MAPD ve Minimap NEARD | Ayrı çalışma dallarından seçici port edildi | Bu eski dal CI kayıtları PR #21'in güncel HEAD testlerinin yerine geçmez. |

Daha eski ara commit'lerde TypeScript, web build, Cargo.lock, Rust testleri, GPS native C testleri, mailbox layout kontrolü ve sentetik Online yük testi gibi adımların geçtiği kayıtlar bulunabilir. Ancak **eski commit'in yeşil olması yeni HEAD'in de yeşil olduğu anlamına gelmez.** Sonuçlar daima ilgili dalın son commit'i ve o commit'e ait Actions run üzerinden okunmalıdır.

- [Tüm GitHub Actions çalışmaları](https://github.com/trpolaris/NFSU2-Web/actions)
- [Multiplayer & Regression workflow](https://github.com/trpolaris/NFSU2-Web/actions/workflows/multiplayer-ci.yml)
- [Container image workflow](https://github.com/trpolaris/NFSU2-Web/actions/workflows/image-rs.yml)

### Bir özelliğin tamamlandı sayılması için

1. Kod, doğru dalda ve doğru mesaj/protokol kimliğiyle bulunmalı.
2. C/native ve WebAssembly build yolları derlenmeli.
3. Rust sunucu testleri ve web/TypeScript regresyonları geçmeli.
4. Eski istemciler için geri uyumluluk veya açık sürüm sınırı olmalı.
5. Gerekli oyun verisi kullanıcı tarafından üretilebilmeli ve manifest üzerinden sunulmalı.
6. Gerçek oyun testi gereken yerde bir veya iki istemcili test yapılmalı; yalnızca unit test sonucu yeterli sayılmamalı.
7. İlgili PR onaylanmalı, birleştirilmeli ve dağıtım ayrı bir kontrollü adımda yapılmalı.

---

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
