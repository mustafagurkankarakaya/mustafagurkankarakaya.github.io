---
title: "Volatility İle Ram İmajı İnceleme"
date: 2024-12-06 00:00:00 +0800 
categories: [Forensic]
tags: [Forensic]     # TAG names should always be lowercase
---

# Forensic



İnceleyeceğimiz RAM imajı volatility sitesinde (https://github.com/volatilityfoundation/volatility/wiki/Memory-Samples) bankaları hedef alan bir malware ile saldırıya uğramış bir kurban makinenin imajıdır.

# python vol.py -f /root/cridex.vmem imageinfo

komutunu yazarak imaj hakkında daha fazla bilgi edinelim -f parametresi kullanacağımız imaj dosyası imageinfo ise volatility aracı için kullanmak istediğimiz plugindir.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V1.webp)

RAM imajının bir windows işletim sistemine sahip makineye ait olduğunu öğrendik.Bundan sonrası için komutlarımızı yazarken profil belirtip pluginlerimizi yazacağız.

# python vol.py -f /root/cridex.vmem — profile=WinXPSP2x86 pslist

komutunu yazarak çalışmakta olan processleri listeleyelim.


![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V2.webp)

# python vol.py -f /root/cridex.vmem — profile=WinXPSP2x86 psxview

komutu kendisini gizlemeye çalışan processleri listeler.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V3.webp)

Burada gizlenen process yok gizlenen process olsaydı pslist ve psscan değerleri false olarak gözükecekti.

# python vol.py -f /root/cridex.vmem — profile=WinXPSP2x86 dlllist

komutuyla çalışmakta olan processlerin DLL lerini görüntülemek için kullanılır.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V4.webp)

Belirli bir işlemin dll listesini görüntüleyebilmek için işlemin PID değerini belirtmemiz gerekir.

# python vol.py -f /root/cridex.vmem — profile=WinXPSP2x86 dllist -p 1640

komutuyla PID numarası 1640 olan işlemin dll lerini listeledik.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V5.webp)

# python vol.py -f /root/cridex.vmem — profile=WinXPSP2x86 psscan

Psscan plugini daha önceden sona eren işlemleri ve bir rootkit tarafından gizlenmiş veya bağlantısız olan işlemleri bulmamızı sağlar.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V6.webp)

# python vol.py -f /root/cridex.vmem — profile=WinXPSP2x86 kdbgscan

komutu kdbg değerini bulmamızı sağlar.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V7.webp)



# python vol.py -f /root/cridex.vmem — profile=WinXPSP2x86 iehistory

komutuyla internet geçmişini öğrenebiliriz.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V8.webp)


# python vol.py -f /root/cridex.vmem — profile=WinXPSP2x86 cmdline

komutu çalıştırılmış cmd komutlarını listelemeyi sağlar.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V9.webp)


# python vol.py -f /root/cridex.vmem — profile=WinXPSP2x86 envars

bir işlemin ortam değişkenlerinin gösterilmesini sağlar. CPU’ların sayısını donanım mimarisini işlemin geçerli olduğu dizini oturum adını bilgisayar adını gösterir.Üstte yapmış olduğumuz kdbscan plugini envars pluginine göre daha güvenilir sonuçlar vermektedir.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V10.webp)


python vol.py -f /root/cridex.vmem — profile=WinXPSP2x86 connscan

komutu sonlandırılmış ya da aktif olan bağlantıları bulmamızı sağlar.


![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V11.webp)


RAM imajının ait olduğu windows makinenin local IP adresi 172.16.112.128 olarak görülmüştür.Bu makineye remote olarak 2 farklı IP den 1037 ve 1038 portlarına bağlantı yapılmış online olarak bu IP lerin whois bilgilerine bakıp adres bilgisi,telefon numarası bilgisi,hedef alan adının kullanmış olduğu IP adresleri,email adres bilgisi gibi verileri öğrenebiliriz.

# 125.19.103.198 IP si için whois bilgileri

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V12.webp)

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V13.webp)

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V14.webp)

# 41.168.5.140 IP si için whois bilgileri

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V15.webp)

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V16.webp)

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V17.webp)

python vol.py -f /root/cridex.vmem — profile=WinXPSP2x86 sockets

bu komut TCP ve UDP bağlantılarını görmemizi sağlar.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V18.webp)

python vol.py -f /root/cridex.vmem — profile=WinXPSP2x86 svcscan

bu komut sistemde çalışan hizmetleri verir.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V19.webp)

# RAM İMAJINDAKİ KÖTÜ AMAÇLI YAZILIMIN BULUNMASI

Bunun için malfind pluginini kullanacağız.

python vol.py -f /root/cridex.vmem — profile=WinXPSP2x86 malfind | grep 5 ‘MZ’

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V20.webp)

Malfind plugini iki tane malware buldu birincisi PID numarası 1484 olan explorer.exe diğeride PID numarası 1640 olan reader_sl.exe .Şimdi bir dosya oluşturup bu malwareleri çekelim ve virus totale yükleyerek malwareleri inceleyelim.

mkdir dump

komutuyla klasör oluşturduk.

python vol.py -f /root/cridex.vmem — profile=WinXPSP2x86 malfind — dump-dir=dump/

komutuyla malwareleri oluşturduğumuz /dump klasörüne içine attık.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V21.webp)

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V22.webp)

Şimdi dosyanın md5sum değerini alıp virus totale yükleyebiliriz.

md5sum process.0x81e7bda0.0x3d0000.dmp

komutuyla md5sum değerini alalım.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V22.webp)

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V23.webp)

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V24.webp)

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V25.webp)


PID değeri 1484 ve 1640 olan bu iki processin mutex objelerini bulmaya çalışalım.Bunun için violitilitynin handles pluginini kullanalım.

python vol.py -f /root/cridex.vmem — profile=WinXPSP2x86 handles -t Mutant -p1484 -s

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V26.webp)


details sekmesinde çıkan mutex objelerini googleda arattığımız zaman bu objelerin bazı malwarelerin içerisinde de rastlanıldığını görürüz.

Bu processlerin VAD segmentlerini çekelim ve ‘strings’ komutuyla içeriğini inceleyerek ilginç bir şey var mı bakalım.

python vol.py -f /root/cridex.vmem — profile=WinXPSP2x86 vaddump -p1484 — dump-dir=dump2/

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V27.webp)

python vol.py -f /root/cridex.vmem — profile=WinXPSP2x86 vaddump -p1640— dump-dir=dump3/


![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V29.webp)


strings 1640.dmp | less

komutunu yazdığımız zaman PID değeri 1640 olan process üzerinden banka domain sayfalarını görüntülüyoruz.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V30.webp)

PID değeri 1484 olan process için içinde önceden bulduğumuz remote olarak bağlanan IP değerlerini grep ile bulup inceleyelim.

strings -af * | grep “125.19.103.198”

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V31.webp)


strings -af * | grep “41.168.5.140”

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V32.webp)


String komutunun sonucunda bu IP lerin portunu ve bu porttaki dizin bilgisinide(/zb/v_01_a/in/) öğrendik.Greple bu dizin bilgisini de arayıp dizinle ilgili başka IP ler var mı diye kontrol edelim.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V33.webp)

Bu dizinle bağlantılı olarak 188.40.0.138 IP sini ve cp.php dosyasını da bulmuş olduk.

