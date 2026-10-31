# TRPOLARIS NFSU2 Web Control Center

Windows masaüstünden NFSU2 Web sunucusunu kurmak ve yönetmek için geliştirilen WPF uygulaması.

> **Sürüm:** 1.5.6  
> **Platform:** Windows x64  
> **Teknoloji:** C# / WPF / .NET 10

## Amaç

Control Center, NFSU2 Web'in kendisi değildir. Windows tarafında WSL2 / Ubuntu ve Docker altyapısını kullanarak NFSU2 Web projesinin kurulum ve yönetim işlemlerini kolaylaştıran ayrı bir yönetim aracıdır.

## Özellikler

- Windows üzerinden tek tık kurulum akışı
- WSL2 / Ubuntu ve Docker durum denetimleri
- NFSU2 Web sunucu ve container yönetimi
- Yerel ağ ve dış erişim profilleri
- Proje dosyalarını görüntüleme ve düzenleme
- Tanılama ve bakım araçları
- Canlı işlem günlüğü ve işlem ilerleme göstergeleri
- Kaldırma merkezi

## Gereksinimler

- Windows x64
- .NET 10 SDK (kaynak kodundan derleme için)
- WPF masaüstü geliştirme bileşenleri
- WSL2 ve desteklenen bir Ubuntu dağıtımı
- Docker Desktop veya erişilebilir Docker Engine

Uygulama self-contained tek dosyalı EXE olarak yayımlanacak şekilde yapılandırılmıştır. Kullanıcı tarafında .NET runtime kurulumu gerektirmeyen dağıtım hedeflenir; WSL2 ve Docker gibi sunucu altyapısı gereksinimleri ayrıca geçerlidir.

## Kaynak yapısı

```text
control-center/
├── TRPOLARIS.NFSU2.WebControlCenter.sln
├── Publish-SingleFile.ps1
├── CHANGELOG.md
└── src/
    └── TRPOLARIS.NFSU2.WebControlCenter/
        ├── App.xaml
        ├── MainWindow.xaml
        ├── MainWindow.xaml.cs
        ├── Assets/
        ├── Properties/PublishProfiles/
        └── Resources/
            ├── NFSU2-Windows-OneClick-Installer.ps1
            ├── nfsu2-access.sh
            ├── nfsu2-project-lookup.sh
            └── nfsu2-git-update.sh
```

## Kaynaktan derleme

Depo kök dizininden, Windows PowerShell içinde:

```powershell
dotnet restore .\control-center\TRPOLARIS.NFSU2.WebControlCenter.sln
dotnet publish .\control-center\src\TRPOLARIS.NFSU2.WebControlCenter\TRPOLARIS.NFSU2.WebControlCenter.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -o .\control-center\publish
```

Alternatif olarak Control Center klasöründen:

```powershell
.\Publish-SingleFile.ps1
```

Çıktı:

```text
control-center/publish/TRPOLARIS.NFSU2.WebControlCenter.exe
```

## Günlük kayıtları

Uygulama günlükleri Windows kullanıcı profilinde aşağıdaki dizinde tutulur:

```text
%LOCALAPPDATA%\TRPOLARIS\NFSU2-Web-Control-Center\logs
```

Günlükleri herkese açık paylaşmadan önce IP adresi, kullanıcı adı, alan adı, tünel veya bağlantı kimlik bilgileri ve benzeri özel verileri kontrol edin.

## Güvenlik notları

- Uygulama EA oyun dosyalarını içermez veya dağıtmaz. Kullanıcı kendi yasal NFSU2 PC kurulumunu sağlamalıdır.
- Docker temizliği veya kaldırma işlemlerinden önce container, ağ, volume ve oyun verilerinin kapsamını kontrol edin.
- Başka projelere ait Docker volume'larını veya kullanıcı verilerini silmeyin.
- Public Cloudflare Tunnel URL'si tek başına kimlik doğrulama sağlamaz. İnternete açık erişim için Cloudflare Access veya eşdeğer erişim denetimi kullanın.
- TLS özel anahtarları, sertifikalar, parolalar, API token'ları ve canlı sunucu durum dosyaları kaynak depoya eklenmemelidir.

## Sürüm ve yayın

Kaynak sürümü 1.5.6'dır. Windows Release derlemesi ve temiz WSL/Docker kurulum doğrulaması tamamlandığında indirilebilir EXE GitHub Releases sayfasında yayımlanacaktır:

https://github.com/trpolaris/NFSU2-Web/releases

## Lisans ve telif

Kaynak kodunun lisans koşulları depo kökündeki [LICENSE](../LICENSE) dosyasında belirtilir. Bu lisans Need for Speed: Underground 2 oyununu veya Electronic Arts'a ait varlıkları kapsamaz.
