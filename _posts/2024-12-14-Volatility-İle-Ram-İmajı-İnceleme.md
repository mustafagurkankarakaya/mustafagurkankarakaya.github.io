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
