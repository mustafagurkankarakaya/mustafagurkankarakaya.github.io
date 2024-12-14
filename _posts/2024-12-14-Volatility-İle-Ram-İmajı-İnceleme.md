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

python vol.py -f /root/cridex.vmem — profile=WinXPSP2x86 pslist

komutunu yazarak çalışmakta olan processleri listeleyelim.


![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V2.webp)

python vol.py -f /root/cridex.vmem — profile=WinXPSP2x86 psxview

komutu kendisini gizlemeye çalışan processleri listeler.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V3.webp)

Burada gizlenen process yok gizlenen process olsaydı pslist ve psscan değerleri false olarak gözükecekti.

python vol.py -f /root/cridex.vmem — profile=WinXPSP2x86 dlllist

komutuyla çalışmakta olan processlerin DLL lerini görüntülemek için kullanılır.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V4.webp)

Belirli bir işlemin dll listesini görüntüleyebilmek için işlemin PID değerini belirtmemiz gerekir.

python vol.py -f /root/cridex.vmem — profile=WinXPSP2x86 dllist -p 1640

komutuyla PID numarası 1640 olan işlemin dll lerini listeledik.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/V5.webp)
