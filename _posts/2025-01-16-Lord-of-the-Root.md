---
title: "Lord of The Root"
date: 2025-01-16 00:00:00 +0800 
categories: [Red Team]
tags: [Red Team]     # TAG names should always be lowercase
---

Hedef makinenin IP adresini netdiscover aracılığıyla öğrenerek başlayalım.nmap taraması yaparak açık olan portları ve bu portlar üzerinde çalışan servisleri öğrenelim.

nmap -A -T4 192.168.0.20 -n

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord1.webp)

Sadece ssh portu açık ssh ile bağlantı yapmaya deneyelim.
ssh 192.168.0.20

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord2.webp)

Burda bize bir ipucu vermiş port knocking yapmamız için.Port knocking dışarıdan bir tarama sonucu açık olarak gözükmesini istemedimiz portların kapalı olarak gözükmesi knock işlemi yapılmadan kapalı portların açılmamasıdır.githubtan toolu indirip knock işlemi yapalım bir script kullanılarak da yapılabilir.

./knock 192.168.0.20 1 2 3

komutuyla knock işlemini yapalım.Tekrar bir nmap taraması yaparak açılan port var mı diye kontrol edelim.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord3.webp)


1337 portunun açıldığını görüyoruz.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord4.webp)

Bu url altında bir dizin taraması yapalım.Bunun için gobuster aracını kullanabiliriz.

gobuster dir -u “http://192.168.0.20:1337/” -w /usr/share/wordlist/dirbuster/directory-list-2.3-small.txt -t 40 -x .php,.txt,.html

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord5.webp)

Image dizinine gidip resim dosyaları indirip steghide aracı ile içinde data saklanmış diye kontrol edelim.

steghide extract -sf 1.jpg

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord6.webp)

Resim dosyalarının içinden herhangi bir data çıkmadı.Robots.txt dizine gidelim.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord7.webp)

Dizine curl atalım ve içeriğini görüntüleyelim .

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord8.webp)

base64 le decode edilmiş bir metin var bunu online decoderla ya da terminal üstünden decode edebiliriz.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord9.webp)

Decode işlemini yaptıktan sonra bize bir dizin verdi bu dizine gidelim.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord10.webp)

Bir login ekranı çıktı karşımıza username ya da password sekmesine sql injection zafiyeti var mı diye bakalım.Bunun için sqlmap aracını kullanacağız.Proxyimizi localhost ayarlayarak BurpSuite aracı ile araya girip isteği yakalayalım.İsteği kaydedip bunu sqlmap için kullanalım.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord11.webp)

sqlmap -r SQLLORD — risk 3 — level 5 — dbms mysql -p username — dbs

Username parametresi için sql injection açıklığını kontrol edelim.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord12.webp)

Time based sql injection açıklığını buldu ve databaseleri çekti.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord13.webp)

Webapp veritabanını kullanarak tablo isimlerini bulmaya çalışalım.

sqlmap -r SQLLORD — risk 3 — level 5 — dbms mysql -p username -D Webapp — tables

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord14.webp)
![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord15.webp)

Webapp veritabındaki User tablosunu çekti.Users tablosundaki verileri çekelim.

sqlmap -r SQLLORD — risk 3 — level 5 — dbms mysql -p username -D Webapp -T Users — dump

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord16.webp)
![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord17.webp)

Usernameleri ve passwordleri bize verdi.SSH portumuz açıktı bu usernameler ve passwordlerle sözlük saldırısı yapmayı deneyelim.Usernameler ve passwordler için wordlist oluşturarak hydra aracını kullanalım.

hydra -l smeagol -P passwords.txt ssh://192.168.0.20 -t 4

komutuyla smeagol için ssh passwordunu bulduk.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord18.webp)

SSH bağlantısı yapalım.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord19.webp)

SSH bağlantımızı kurduktan sonra SUID biti ile çalışan programları bulalım. SUID biti normal kullanıcının programa root yetkileriyle erişebilmesine imkan sağlayan bittir.Bu yüzden yetki yükseltme işlemlerinde kullanılabilir.

find / -perm -u=s -type f 2>/dev/null

komutuyla SUID ile çalışan programları listeledik.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord20.webp)
![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord21.webp)

SECRET klasörüne baktığımız zaman file adında bir program var programın türünü öğrenmek için

file file

diyerek çalıştırılabilir bir dosya olduğunu görüyoruz../file diyerek çalıştırdığımızda input olarak string alan bir program olduğunu anladık.Programın input olarak string aldığını biliyoruz fuzzing yaparak yani programa çok sayıda string yollayarak ne zaman crash olacağını araştıralım.Programı test etmek için home dizinin altında smeagol kullanıcısının altına bof ismiyle kaydedelim.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord22.webp)

python da -c parametresini kullandığımızda kodları doğrudan shell den çalıştırmamızı sağlar.

./bof $(python -c ‘print “A” * 150’)

./bof $(python -c ‘print “A” * 250’)

./bof $(python -c ‘print “A” * 200’)

./bof $(python -c ‘print “A” * 190’)

./bof $(python -c ‘print “A” * 180’)

./bof $(python -c ‘print “A” * 175’)

./bof $(python -c ‘print “A” * 170’)

./bof $(python -c ‘print “A” * 171’)

kodlarını sırasıyla denediğimizde programın maximum 170 tane string karakter aldığını görüyoruz.171. string ifadeyi aldığına bellek taşması(buffer overflow)meydana geliyor.Bu değer programın offset değeridir.


![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord23.webp)

bof programını local makinemize kopyalamak için programın base64 ile encode edelim.

bof base64

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord24.webp)

Local makinemizde txt dosyası açıp bu base64 değerini yapıştıralım ve txt dosyasını base64 le decode edelim.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord25.webp)
![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord26.webp)
![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord27.webp)

Scriptini yazarak programı gdb-peda exploit geliştirme ortamında inceleyelim.GDP-PEDA ile fonksiyonları görüntüleyelim.

info functions

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord28.webp)

info variables

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord29.webp)

r $(python -c ‘print “A”*171 + “B”*4 +”C”*4

python koduyla programa 171 tane A 4 tane B 4 tane C gönderelim.Burada EIP,EBP,ESP değerleri Pointer registerın hafızadaki bölümleridir.

EIP : Instruction pointerdır.Bir sonraki çalışacak komutun adresini saklar.

EBP: Base pointerdır.Stackte ilk giren yani son çıkacak olan değeri gösterir.

ESP: Stack bölgesinin en üst noktasını gösterir.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord30.webp)

\x90 baytı NOP instructionsıdır.20 tane NOP instructionsu programa gönderdiğimizde ESP değerinin yani stackin en üst noktasının değiştiğini görürüz.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord31.webp)

Şimdi programdan shell almak istiyoruz linux için bir shellcode oluşturalım bunu daha sonradan oluşturacağımız exploitin içerine import edeceğiz.

shellcode generate x86/linux exec

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord32.webp)
![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord33.webp)

Exploitini yazarak ssh bağlantısı kurduğumuz smeagol kullanıcısının /tmp klasörüne gidelim ve exploiti çalıştıralım. Exploit kodumuz

find / -perm -u=s -type f 2>/dev/null

komutuyla bulduğumuz /SECRET klasörü içerisindeki door1,door2,door3 klasörlerindeki çalıştırılabilir file programlarına fuzzing işlemi yapıyor buffer overflow zafiyeti olduğundan explotimize shellcode import edip shell döndürmesini bekliyoruz.Shellcode umuzu oluştururken root olmayı hedeflediğimizden exec komutunu ekliyoruz.

Exploitimiz çalıştıralım.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord34.webp)

Buffer overflow zafiyetinden yararlanarak root yetkisini alıp flag dosyasını okuduk.

![resim]({{ site.url }}{{ site.baseurl }}/assets/img/posts/Lord35.webp)

