# Sürüm geçmişi

## v1.5.6

- Docker build context düzeltmesi daraltıldı; yalnızca gerekli `web/tools/i18n-keys.mjs` dosyası içeri alınıyor.
- Eski ve geniş `web/tools` kopyalama düzeltmesi kaldırıldı; Docker regresyon testlerinin kapsamı korunuyor.
- Önceki hatalı proje klasörlerinin normalize edilmesi ve kurulum akışının güvenilirliği iyileştirildi.
- WPF pencere başlığı ve görünür sürüm etiketi, proje sürümüyle tutarlı olacak şekilde `v1.5.6` olarak güncellendi.

> Kaynak paketi kontrollerinin geçmesi, Windows üzerinde Release derlemesinin veya temiz WSL/Docker canlı kurulumunun tamamlandığı anlamına gelmez. Bunlar CI ve gerçek kurulum testiyle ayrıca doğrulanmalıdır.
