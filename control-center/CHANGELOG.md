# Sürüm geçmişi

## v1.5.6

- Docker build context düzeltmesi daraltıldı; yalnızca gerekli `web/tools/i18n-keys.mjs` dosyası içeri alınıyor.
- Eski ve geniş `web/tools` kopyalama düzeltmesi kaldırıldı; Docker regresyon testlerinin kapsamı korunuyor.
- Önceki hatalı proje klasörlerinin normalize edilmesi ve kurulum akışının güvenilirliği iyileştirildi.
- Pencere başlığı ve uygulama içindeki sürüm etiketi `v1.5.6` ile eşitlendi.

> Kaynak paketi kontrollerinin geçmesi, Windows üzerinde Release derlemesinin veya temiz WSL/Docker canlı kurulumunun tamamlandığı anlamına gelmez. Bunlar ayrı doğrulama adımlarıdır.
