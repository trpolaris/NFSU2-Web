# Multiplayer doğrulama ve regresyon planı

Bu belge, NFSU2-Web'in mevcut Online, LAN ve serbest dolaşım altyapısını kararlı sürümü etkilemeden doğrulamak için kullanılır.

## Güvenli çalışma kuralları

- Bütün geliştirmeler `feature/online-multiplayer` dalında yapılır.
- `main` ve `v2026.10.30.04` etiketi, bilinçli bir yayın kararı olmadan değiştirilmez.
- Yük, kötüye kullanım ve kopma testleri canlı üretim sunucusuna değil, yerel veya ayrı bir staging sunucusuna uygulanır.
- Tarayıcı yarış testleri kullanıcının kendi lisanslı PC oyun dosyalarını ve üretilmiş oyun WASM modülünü kullanır. Bu dosyalar GitHub'a veya CI artifact'larına yüklenmez.
- Bir test, gerekli oyun verisi bulunmadığı için atlandıysa bu PASS olarak yorumlanmaz; sonuç SKIP olarak raporlanır.

## GitHub Actions

`.github/workflows/multiplayer-ci.yml` aşağıdaki kontrolleri çalıştırır:

1. `web/server-rs/build.sh --test`: Rust sunucusunu oluşturur ve Rust workspace testlerini çalıştırır.
2. `npm ci`, `npm run check`, `npm run build`: web bağımlılıklarını, TypeScript kontrolünü ve web derlemesini doğrular.
3. `node --test --test-concurrency=1 web/test/*.test.mjs`: Node tabanlı web regresyon testlerini sırayla çalıştırır.

GitHub-hosted runner'a NFSU2 oyun dosyaları veya gerçek oyun WASM'ı verilmez. Bu nedenle `NFSU2_DATA` ve `out/web/nfsu2.wasm` gerektiren deploy, gerçek oyun ve bazı tarayıcı entegrasyon testleri SKIP olabilir. CI'nin başarılı olması bu gerçek oyun senaryolarının test edildiği anlamına gelmez.

## Yerel tam doğrulama

Komutları, lisanslı oyun dosyalarının bulunduğu ve kaynak kod deposunun klonlandığı WSL/Linux çalışma ağacında çalıştırın. `NFSU2_DATA`, doğrudan `SPEED2.EXE` ve oyunun PC veri klasörlerini içeren kökü göstermelidir.

```bash
export NFSU2_DATA="/path/to/your/Need for Speed Underground 2"
test -f "$NFSU2_DATA/SPEED2.EXE"
```

Önce sunucu ve birim testlerini, sonra web derlemesini hazırlayın:

```bash
bash web/server-rs/build.sh --test
cd web
npm ci
npm run check
npm run build
npx playwright install chrome
cd ..
```

### 2 oyunculu gerçek Online yarışı

```bash
node web/tools/online-pair.mjs \
  --players 2 --mode circuit --races 1 \
  --out out/web/multiplayer-audit/online-2p-circuit
```

Başarılı senaryoda iki ayrı tarayıcı oturumu Online menüsüne girer, bir oyuncu yarışı oluşturur, diğeri katılır, yarış başlar ve oyun sonuç ekranlarına ulaşır. Araç `summary.json`, oyuncu logları ve sunucu izini üretir.

### 6 oyuncu ve yarış türleri

Önce altı oyunculu en büyük oda senaryosunu deneyin:

```bash
node web/tools/online-pair.mjs \
  --players 6 --mode circuit --races 1 \
  --out out/web/multiplayer-audit/online-6p-circuit
```

Ardından yarış türlerini tek tek doğrulayın:

```bash
for mode in circuit sprint drag drift streetx; do
  node web/tools/online-pair.mjs \
    --players 2 --mode "$mode" --races 1 \
    --out "out/web/multiplayer-audit/online-2p-$mode"
done
```

### Yarış sırasında oyuncunun ayrılması

İkinci oyuncuyu yarış başladıktan 30 saniye sonra ayıran senaryo:

```bash
node web/tools/online-pair.mjs \
  --players 2 --mode circuit --races 1 \
  --quit-mid 2:30000 \
  --out out/web/multiplayer-audit/online-player-leave
```

Bu senaryoda diğer oyuncunun yarışı tamamlaması ve ayrılan oyuncunun beklenen şekilde sonuç dışında kalması incelenir.

### Yük ve kötüye kullanım testi

Bu araç kendi yerel test sunucusunu başlatır; gerçek oyun istemcileri yerine protokol konuşan sahte tarayıcılar kullanır. Varsayılan senaryo 200 istemci ve 60 saniyedir:

```bash
node web/tools/online-load.mjs \
  --clients 200 --seconds 60 \
  --out out/web/multiplayer-audit/load-200
```

Araç giriş ve sohbet gecikmelerini, yarış başlatma/sonuç sayılarını, sunucu CPU/bellek kullanımını ve chat flood, aşırı büyük mesaj, aşırı oturum ve sahte kaynak adresi senaryolarını raporlar. Bu testi üretim sunucusuna `--base` ile yönlendirmeyin.

## Sunucu yeniden başlatma ve bağlantı koruması

Rust workspace testleri Online servisinin kendi testlerini ve sanal ağ entegrasyon testlerini içerir. Özellikle aşağıdaki senaryolar kapsam dahilindedir:

- `races_over_a_restart` ve `races_over_a_restart_who_left`: devam eden yarışların sunucu yeniden başlatması boyunca durumunun korunması.
- `onl4_double_login`: aynı persona ile eşzamanlı giriş davranışı.
- `onl5_races_and_browsers`: yarışların farklı tarayıcı/istemci sınırlarına uyması.
- `onl7_results`: yarış sonuçlarının kabul ve sıralama kuralları.
- `onl8_lines_and_keys`: istemciye bağlı log bütçesi ve anahtarlar.
- `onl9_share_of_the_lobby`: lobi kaynaklarının istemciler arasında paylaştırılması.
- `churning_connections_never_takes_a_dropped_players_address` ve resume testleri: kopan bağlantıların ve adres rezervasyonlarının korunması.
- `a_ticket_takes_the_place_its_page_was_given_as_its_link_went`: bekleme kuyruğu sırası ve devam bileti.

Bunlar kaynak kodundaki testlerin kapsamını açıklar; testler CI tamamlanmadan başarılı sayılmaz. Yük ölçümü olarak işaretlenmiş `#[ignore]` testler standart `cargo test` çalıştırmasında otomatik koşmaz.

## Farklı internet bağlantılarından canlı doğrulama

Gerçek internet testi, iki ayrı internet bağlantısındaki iki oyuncuyla ayrı bir staging sunucusunda yapılmalıdır:

1. Her oyuncu staging adresini açar ve oyun modülünün tamamen yüklendiğini doğrular.
2. Birinci oyuncu Online modda oda açar; ikinci oyuncu odayı bulup katılır.
3. İki oyuncu Circuit, Sprint veya Drag yarışını tamamlar.
4. Bir oyuncu sekmeyi kapatıp yeniden açar; sunucu ve oyun istemcisinin beklenen ayrılma/yeniden bağlanma davranışı incelenir.
5. Sunucu logları ve iki istemcinin `summary.json`/sayfa logları karşılaştırılır.

Tek bir bilgisayarda veya aynı LAN'da yapılan test, farklı ISP, NAT, proxy ve uzak bağlantı koşullarını doğrulamaz. Bu nedenle bu bölümün sonucu yalnızca iki farklı ağdan gerçekten denendikten sonra PASS olarak işaretlenmelidir.

## Sonuç kaydı

Her doğrulama turunda aşağıdakileri saklayın:

- Git commit SHA ve test tarihi
- CI workflow bağlantısı ve Rust/web test sonuçları
- Her `online-pair` çalışmasının `summary.json` dosyası
- `online-load` çalışmasının `load.json` dosyası
- Gerçek uzak ağ testi için kullanılan istemci sayısı, yarış türü ve kopma/yeniden bağlanma sonucu

Parola, CD key, gerçek IP, oyun arşivi veya kullanıcı kayıtlarını artifact olarak paylaşmayın.
