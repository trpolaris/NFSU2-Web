# TRPOLARIS NFSU2 Web Control Center v1.5.6

Windows masaüstünde NFSU2 Web sunucusunu kurmak ve yönetmek için geliştirilmiş WPF tabanlı yönetim uygulaması. Uygulama .NET 10 ve Windows x64 hedefler.

## Gereksinimler

- Windows x64
- .NET 10 SDK (kaynak kodundan derlemek için)
- WSL 2 ve Ubuntu dağıtımı
- Çalışır durumda Docker Engine
- Kurulum ve bağımlılıkları indirmek için internet bağlantısı
- WebAssembly üretimi için kullanıcının kendi uyumlu NFSU2 PC oyun kopyası

## Derleme

Windows üzerinde .NET 10 SDK veya Visual Studio 2026 ile klasör kökünden:

```powershell
dotnet restore .\TRPOLARIS.NFSU2.WebControlCenter.sln
dotnet build .\TRPOLARIS.NFSU2.WebControlCenter.sln -c Release
```

## Tek dosyalı Windows yayını

```powershell
.\Publish-SingleFile.ps1
```

Çıktı `publish/TRPOLARIS.NFSU2.WebControlCenter.exe` konumuna yazılır. Yayın win-x64, self-contained ve single-file olarak yapılandırılmıştır.

## Kaynak yapısı

- `src/TRPOLARIS.NFSU2.WebControlCenter/` — WPF uygulaması
- `src/TRPOLARIS.NFSU2.WebControlCenter/Resources/` — Kurulum, erişim ve Git yardımcı betikleri (uygulamaya gömülür)
- `src/TRPOLARIS.NFSU2.WebControlCenter/Assets/` — Uygulama simgesi

## Veri güvenliği

Kaldırma işlemlerinde yalnızca NFSU2 projesine ait olduğu doğrulanan kaynakları seçin. Ubuntu WSL dağıtımını kaldırmak dağıtım içindeki tüm Linux dosyalarını siler; Docker Desktop'ı kaldırmak diğer Docker projelerini etkileyebilir. Oyun klasörünü veya kalıcı volume'ları silmeden önce yedek alın.

Public tünel tek başına kimlik doğrulaması sağlamaz. İnternete açık kullanımda ayrıca erişim kontrolü yapılandırın.

**Sürüm:** 1.5.6. Kaynak arşivindeki sürüm bilgisi budur; Windows Release derlemesi ve temiz kurulum testi ayrıca doğrulanmalıdır.
