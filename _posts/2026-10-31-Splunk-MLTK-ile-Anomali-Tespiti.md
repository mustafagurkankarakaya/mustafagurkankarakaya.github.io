---
title: "Splunk MLTK (AI Toolkit) ile Anomali Tespiti: Sıfırdan Model Eğitimi"
date: 2026-10-31 14:00:00 +0300
categories: [Blue Team]
tags: [splunk, mltk, machine-learning, anomaly-detection, siem, detection-engineering, densityfunction]
description: "Splunk Machine Learning Toolkit ile kullanıcı bazında oturum açma hacminde anomali tespiti — DensityFunction ile model eğitimi, fit/apply/summary akışı, eşik ayarı, RBA'ya bağlama ve saha notları."
image:
  path: /assets/img/posts/mltk-cover.svg
  alt: "Splunk MLTK anomali tespiti"
---

Bir kuralın eşiğini elle koyduğunuz her an aslında bir tahminde bulunuyorsunuz: "Saatte 10 başarısız oturum çok mu?" Belki bir kullanıcı için çoktur, servis hesabı için gürültüdür. Statik eşiklerin derdi bu; herkese aynı pantolonu giydiriyorsunuz. Oturup her varlık için ayrı ayrı eşik yazmak da sürdürülebilir değil — ortamda beş bin kullanıcı varsa beş bin eşik bakamazsınız.

İşte "normalin ne olduğunu" veriye öğretme fikri tam burada devreye giriyor. Splunk'ın Machine Learning Toolkit'i (son sürümlerde arayüzde **AI Toolkit** adıyla da karşınıza çıkar) bunu SPL'in içinden, ayrı bir platforma veri taşımadan yapmanıza izin veriyor. Aşağıda uçtan uca bir senaryoyu — kullanıcı bazında oturum açma hacminde anomali tespitini — gerçek sorgularla kuracağız: veriyi hazırlamaktan modeli eğitmeye, canlıya almaya ve sonucu RBA'ya bağlamaya kadar.

> Not: Örnekler Splunk Enterprise 9.x + MLTK 5.5 üzerinde. Algoritma parametreleri sürümle değişebiliyor, kendi ortamınızda `| fit DensityFunction` üstüne bir `help` çekmekten üşenmeyin.
{: .prompt-info }

## MLTK aslında ne yapıyor?

Kafadaki soru işaretini baştan silelim: MLTK sihir değil, scikit-learn'ü SPL'e bağlayan bir köprü. Arka planda **Python for Scientific Computing (PSC)** add-on'u çalışıyor; MLTK'yi kurarken onu da kurmanız şart, yoksa `fit` komutu "algoritma bulunamadı" der geçer.

Pratikte üç komutla yaşıyorsunuz:

- `fit` — bir algoritmayı veriye uydurur (eğitir) ve isterseniz modeli `into <isim>` ile saklar. Saklanan model aslında bir lookup; `__mlspl_<isim>.csv` olarak `lookups` dizininde durur.
- `apply` — kayıtlı modeli yeni veriye uygular, yani skorlar.
- `summary` — eğitilmiş modelin içini gösterir.

![MLTK anomali tespiti akışı]({{ site.url }}{{ site.baseurl }}/assets/img/posts/mltk-pipeline.svg)
_Akış tek yönlü değil: eğitimi periyodik, skorlamayı sürekli çalıştırırsınız._

Anomali tarafında elinizde birkaç seçenek var — `OneClassSVM`, `LocalOutlierFactor`, `IsolationForest`, çok değişkenli için `MultivariateOutlierDetection`. Ama günlük işte en çok yaslandığım, bu yazının da kahramanı **`DensityFunction`**. Sebebi basit: `by` ile her varlık için **ayrı** bir olasılık dağılımı öğrenebiliyor, modeli diske yazıp `apply` ile tekrar tekrar kullanabiliyorsunuz (LocalOutlierFactor'ı mesela `into` ile kaydedemiyorsunuz, o yüzden canlı skorlama için uygun değil).

## Senaryo

Amacımız şu: her kullanıcının **saatlik oturum açma sayısı** için bir "normal" profili çıkarmak, sonra canlı veride bu profilin dışına taşan davranışı yakalamak. Ele geçirilmiş bir hesabın gece yarısı 40 kere oturum açması ya da normalde günde iki kez görünen bir servis hesabının aniden saatte 25'e fırlaması — statik eşikle bunların hepsine tek rakam koyamazsınız, ama kullanıcı başına öğrenilmiş bir dağılım bunu doğal olarak yakalar.

Veri kaynağı olarak kimlik doğrulama loglarını (`index=auth`, Windows'ta 4624'ler, Linux'ta `sshd` vb. — kendi ortamınıza göre `sourcetype`) alıyorum.

## 1. Veriyi anlamak ve şekle sokmak

Modelden önce veriyi tanıyın. Ham olaydan modele giren şey saatlik sayım olacak, o yüzden `bin` + `stats` ile zamanı kovalara bölüp kullanıcı başına sayıyoruz:

```spl
index=auth action=success earliest=-7d@d latest=@d
| bin _time span=1h
| stats count AS login_count by _time, user
```

Modele vermeden önce alanın dağılımına bakmak iyi alışkanlık — `login_count` sağa çarpık mı, kaç benzersiz kullanıcı var, boş değer dönüyor mu:

```spl
index=auth action=success earliest=-7d@d latest=@d
| bin _time span=1h
| stats count AS login_count by _time, user
| fieldsummary
```

Burada görmek istediğiniz şey: `login_count` makul bir aralıkta, çok sayıda kullanıcı için yeterince satır var. **Kritik eşik**: `DensityFunction`'ın her grup için sağlıklı bir dağılım çıkarabilmesi için grup başına en az ~50 veri noktası ister. Haftada 24×7 = 168 saatlik kova demek; günde birkaç kez görünen kullanıcılar için bu yeterli, ama ayda bir görünen birini modellemeye kalkarsanız anlamsız sonuç alırsınız. Bu tür düşük-frekanslı varlıkları ya ayrı ele alın ya da zaman penceresini genişletin.

## 2. Baz çizgiyi öğrenmek: `fit DensityFunction`

İşin kalbi tek satır. Son 30 günü "normal" kabul edip kullanıcı başına dağılımı öğreniyoruz ve modeli `app:auth_baseline` olarak kaydediyoruz:

```spl
index=auth action=success earliest=-30d@d latest=@d
| bin _time span=1h
| stats count AS login_count by _time, user
| fit DensityFunction login_count by user into app:auth_baseline
    dist=auto threshold=0.01 show_density=true
```

Parametreleri tek tek açayım, çünkü anomali tespitinde oynayacağınız düğmeler bunlar:

- **`by user`** — asıl mesele bu. Her kullanıcı için ayrı bir dağılım fit ediliyor. `admin` ile stajyerin "normal"i aynı olmak zorunda değil. En fazla 5 alanla gruplayabilir, varsayılan 1024 grup sınırını `max_groups` ile artırabilirsiniz.
- **`dist=auto`** — MLTK dört dağılımı (`norm`, `expon`, `gaussian_kde`, `beta`) dener ve en iyi uyanı seçer. Verinizin şeklini bilmiyorsanız `auto` güvenli. Dağılımı biliyorsanız (ör. sayım verisi çoğu zaman sağa çarpıktır, `expon` iyi oturur) elle vermek hem hızlı hem stabil olur.
- **`threshold=0.01`** — dağılımın hangi kadarının "aykırı" sayılacağı. Varsayılan %1. Yani olasılık yoğunluğu en düşük %1'lik kuyruğa düşen her nokta `IsOutlier=1` alır. Bu rakam doğrudan false-positive oranınızı belirliyor; birazdan ayarına geleceğiz.
- **`show_density=true`** — çıktıya `ProbabilityDensity` ekler. Sadece 0/1 bayrağı değil, "ne kadar anormal" bilgisini de istiyorsanız (RBA skoru için şart) açın.

![DensityFunction dağılım ve eşik]({{ site.url }}{{ site.baseurl }}/assets/img/posts/mltk-density.svg)
_Model her kullanıcı için böyle bir yoğunluk eğrisi öğrenir; kuyruğa düşen noktalar aykırı işaretlenir._

## 3. Modeli incelemek: `summary`

Eğittikten sonra körlemesine canlıya almayın, modele bir bakın:

```spl
| summary app:auth_baseline
```

Çıktıda her grup (kullanıcı) için seçilen dağılım tipini (`type`), ortalama/standart sapmayı, kardinaliteyi ve `wasserstein`/`kolmogorov_smirnov` mesafesini görürsünüz. Mesafe metriği, öğrenilen dağılımın gerçek veriye ne kadar oturduğunu söyler — çok yüksekse o grup için model zayıf demektir, o kullanıcıyı ayrı değerlendirmek gerekebilir. `svc_backup` gibi deterministik servis hesaplarının dağılımı sivri çıkar; bu iyi, çünkü en ufak sapmayı yakalarlar.

## 4. Canlıya almak: `apply`

Model hazır. Şimdi onu taze veriye uyguluyoruz. Son bir saati skorlayıp sadece aykırıları süzelim:

```spl
index=auth action=success earliest=-1h@h latest=now
| bin _time span=1h
| stats count AS login_count by _time, user
| apply auth_baseline
| where 'IsOutlier(login_count)'=1
| sort - 'ProbabilityDensity(login_count)'
| table _time, user, login_count, "IsOutlier(login_count)", "ProbabilityDensity(login_count)"
```

Alan adlarındaki tırnaklara dikkat — `IsOutlier(login_count)` parantez içerdiği için SPL'de tek tırnakla sarmak gerekir, yoksa parser takılır. Çıktı aşağıdaki gibi görünür; `svc_backup` normalde 2-3 bandındayken 27'ye çıkmış ve `ProbabilityDensity` dibe vurmuş:

![apply çıktısı — İstatistik sekmesi]({{ site.url }}{{ site.baseurl }}/assets/img/posts/mltk-results.svg)
_`ProbabilityDensity` ne kadar küçükse nokta o kadar beklenmedik; RBA skorunu bunun üstüne kurabilirsiniz._

Aynı sonucu zaman ekseninde görselleştirince hikâye netleşiyor — mavi çizgi gerçek trafik, kırmızı noktalar modelin "bu beklenmedik" dediği saatler:

![Saatlik oturum açma ve anomaliler]({{ site.url }}{{ site.baseurl }}/assets/img/posts/mltk-timeline.svg)
_Beklenen aralığın (gölgeli bant) dışına taşan üç saat anomali olarak işaretlendi._

## 5. Eşiği ve dağılımı ayarlamak

İlk modelin çok gürültü yaparsa panik yok, normal. Üç yerden ayar çekersiniz:

**Eşiği sıkın/gevşetin.** `threshold`'ı düşürmek (ör. `0.005`) daha az ama daha emin alarm demek. Çift taraflı sorun yaşıyorsanız tek yönlü eşik kullanın — oturum açmada bizi genelde *yüksek* taraf ilgilendirir, düşük sayım alarm değildir:

```spl
... | fit DensityFunction login_count by user into app:auth_baseline
    dist=auto upper_threshold=0.01 show_density=true
```

**Birden fazla eşikle katmanlı uyarı** üretebilirsiniz — biri "izle", biri "müdahale et":

```spl
... | apply auth_baseline threshold="0.01,0.001"
```

Bu, `IsOutlier(login_count)_th=0.01` ve `..._th=0.001` diye ayrı kolonlar döndürür; düşük eşikli olanı doğrudan notable'a, yükseği risk puanına bağlarsınız.

**Dağılımı elle seçin.** `dist=auto` bazen beklenmedik bir dağılım seçip sınırları garipleştirebiliyor. Sayım verisinde `dist=expon` ya da `exclude_dist="beta"` çoğu zaman daha stabil sonuç verir. Kararsızsanız aynı veriyle iki model fit edip `summary`'deki mesafe metriklerini karşılaştırın.

## 6. Yeniden eğitim ve concept drift

Model donmuş bir fotoğraf; dünya değişiyor. Yeni projeyle bir ekibin trafiği kalıcı olarak artarsa eski baz çizgi sürekli yanlış alarm üretir. İki yaklaşım:

Tam yeniden eğitimi zamanlanmış bir aramaya bağlayıp (ör. her gece) modeli tazeleyebilirsiniz. Ya da büyük veride her şeyi baştan fit etmek pahalıysa **artımlı eğitim** ile modeli günceller, geçmişi yeniden işlemezsiniz:

```spl
index=auth action=success earliest=-1d@d latest=@d
| bin _time span=1h
| stats count AS login_count by _time, user
| fit DensityFunction login_count by user into app:auth_baseline partial_fit=true
```

> `partial_fit=true` iken yeni parametreler (yeni `threshold`, `dist` vb.) yok sayılır; mevcut modelin ayarlarıyla devam eder. Dağılımı değiştirmek istiyorsanız tam yeniden eğitim şart.
{: .prompt-warning }

Bir de **soğuk başlangıç** derdi var: dün işe giren kullanıcının modeli yok. Bunları `apply` sonrası `isnull()` ile ayıklayıp ayrı bir "yeni varlık" kuralına düşürmek, modele güvenmekten daha sağlıklı.

## 7. Tespiti operasyonel hale getirmek

Sorgu güzel ama dashboard'da durduğu sürece tespit değil. İki şekilde sahaya çıkarırım.

**Zamanlanmış alarm** olarak: yukarıdaki `apply` sorgusunu saatlik çalışan bir scheduled search yapıp sonuç döndüğünde tetikleyebilirsiniz. Ama tek başına alarm, modern SOC'ta gürültü demek.

**Risk tabanlı (RBA)** yaklaşım çok daha iyi oturuyor: anomaliyi doğrudan notable'a çevirmek yerine kullanıcının risk puanına katkı olarak yazıyoruz. `ProbabilityDensity` ne kadar düşükse katkı o kadar yüksek:

```spl
index=auth action=success earliest=-1h@h latest=now
| bin _time span=1h
| stats count AS login_count by _time, user
| apply auth_baseline
| where 'IsOutlier(login_count)'=1
| eval density='ProbabilityDensity(login_count)'
| eval risk_score = round(min(100, 30 + 12 * ln(1 / (density + 0.0001))), 0)
| eval risk_object=user, risk_object_type="user",
       risk_message="Oturum açma hacminde anomali: ".login_count." (baz dışı)"
| table _time, risk_object, risk_object_type, risk_score, risk_message
| collect index=risk
```

Böylece tek bir anomali alarm yağdırmaz; aynı kullanıcıda gün içinde anomali + farklı kaynaktan oturum + yeni bir süreç gibi sinyaller **biriktikçe** risk eşiğini aşar ve tek, zengin bir notable üretir. ES kullanıyorsanız bunu doğrudan bir Risk Incident Rule'a bağlarsınız. ML tabanlı tespitin UEBA ile buluştuğu yer tam burası.

## Tek değişkenin ötesi

Oturum sayısı tek başına bazen yetmez; "az oturum ama çok veri çıkışı" gibi kombinasyonları tek alan yakalamaz. Çok değişkenli tarafta MLTK'nin hazır bir sarmalayıcısı var: `MultivariateOutlierDetection` arka planda `StandardScaler` → `PCA` → `DensityFunction` zincirini kurar:

```spl
index=auth earliest=-30d@d latest=@d
| bin _time span=1h
| stats count AS login_count, dc(src_ip) AS distinct_src, sum(bytes_out) AS bytes_out by _time, user
| fit MultivariateOutlierDetection login_count distinct_src bytes_out by user into app:auth_mv threshold=0.005
```

Alternatiflere kısaca değinmek gerekirse: `IsolationForest` ve `OneClassSVM` modeli `into` ile kaydedip `apply` edebildiğiniz için canlı skorlamaya uygun; `LocalOutlierFactor` ise kaydedilemiyor, daha çok keşif/tek seferlik analiz için. Gerçek derin öğrenmeye (kendi PyTorch/TensorFlow modeliniz, GPU, container) ihtiyaç duyarsanız oyun **DSDL**'e (Splunk App for Data Science and Deep Learning, eski adıyla DLTK) kayar — ama çoğu SOC anomali ihtiyacı DensityFunction'la fazlasıyla çözülüyor, ağır topları gereksiz yere masaya sürmeyin.

## Sahadan birkaç not

Kâğıt üstünde her şey güzel; üretimde canınızı yakan ayrıntılar şunlar:

- **Model boyutu sessiz bir sınır.** Binlerce kullanıcıyı `by` ile modellerseniz lookup şişer. `mlspl.conf` içindeki `max_model_size_mb`, `max_inputs` ve `max_fit_time` limitlerine takılırsınız; takıldığınızda hata net olmayabilir, "model kaydedilemedi" gibi döner. Büyük ortamda kullanıcıları segmentlere bölüp (ör. departman) ayrı modeller tutmak hem performans hem isabet açısından daha iyi.
- **Kardinalite = maliyet.** `by` alanındaki benzersiz değer sayısı doğrudan eğitim süresini belirler. Gürültülü alanlarla (ör. tam `src_ip`) gruplamayın.
- **`_time` hizası.** `bin span=1h` ile `earliest/latest`'i aynı sınıra oturtun (`@h`, `@d`), yoksa yarım kovalar yapay anomali üretir. En sık yapılan hata bu.
- **Lookup izinleri.** `fit` ile kaydettiğiniz model bir lookup; `app:` kapsamında kaydedip paylaşım izinlerini ayarlamazsanız zamanlanmış arama "model bulunamadı" der. `into app:...` ile global/app kapsamını bilinçli seçin.
- **PSC sürümü.** MLTK'yi yükselttiğinizde PSC add-on'unu da eşlemeyi unutmayın; sürüm uyumsuzluğu `fit`'i sessizce bozar.

Statik eşikten baz-çizgi öğrenen bir modele geçmek, kural sayınızı azaltmaz ama kurallarınızı "herkese tek rakam"dan "her varlığa kendi normali"ne taşır. Bir hafta canlıda bırakıp ürettiği aykırıları gözle doğrulayın; eşiği ortam konuşmaya başlayınca kendisi söyler.

---

### Kaynaklar

- [Algorithms in the Splunk Machine Learning Toolkit](https://help.splunk.com/en/splunk-enterprise/apply-machine-learning/use-ai-toolkit/5.5.0/algorithms-and-scoring-metrics-in-mltk/algorithms-in-the-splunk-machine-learning-toolkit) — DensityFunction ve diğer algoritmaların resmi referansı
- Splunk MLTK User Guide — `fit` / `apply` / `summary` komut sözdizimi
