/* Hacker katmanı: yalnızca görünüm. Yazı içeriğini değiştirmez. */
(function () {
  "use strict";
  var d = document, root = d.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var rand = function (n) { return Math.floor(Math.random() * n); };

  /* ---------- Sistem çubuğu: SID + saat ---------- */
  var sid = d.getElementById("sys-sid");
  if (sid) {
    var bytes = new Uint8Array(4);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (var i = 0; i < 4; i++) bytes[i] = rand(256);
    sid.textContent = Array.prototype.map.call(bytes, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }
  var clock = d.getElementById("sys-clock");
  if (clock) {
    var fmt;
    try {
      fmt = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: "Europe/Istanbul" });
    } catch (e) { fmt = null; }
    var tick = function () { clock.textContent = fmt ? fmt.format(new Date()) : new Date().toTimeString().slice(0, 8); };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- Matrix yağmuru ---------- */
  var cv = d.getElementById("rain");
  if (cv && !reduce && !(navigator.connection && navigator.connection.saveData)) rain(cv);

  function rain(cv) {
    var ctx = cv.getContext("2d");
    if (!ctx) return;
    var glyphs = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ABCDEF<>/{}$#=+*".split("");
    var fs = 16, w = 0, h = 0, cols = 0, drops = [], rgb = "57,255,136", head = "220,255,232", last = 0;

    function readColor() {
      var v = getComputedStyle(root).getPropertyValue("--g").trim();
      if (!v) return;
      rgb = v;
      head = v.split(",").map(function (c) { c = parseInt(c, 10); return Math.round(c + (255 - c) * 0.78); }).join(",");
    }
    function fit() {
      var nw = window.innerWidth, nh = window.innerHeight;
      if (nw !== w) {
        w = cv.width = nw;
        cols = Math.ceil(w / fs);
        drops = [];
        for (var i = 0; i < cols; i++) drops[i] = -rand(Math.ceil(nh / fs));
      }
      if (nh !== h) { h = cv.height = nh; }
      ctx.font = fs + "px monospace";
      ctx.textBaseline = "top";
    }
    function frame(t) {
      requestAnimationFrame(frame);
      if (d.hidden || t - last < 60) return;
      last = t;
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,.12)";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      for (var i = 0; i < cols; i++) {
        var y = drops[i] * fs;
        if (y >= -fs) {
          ctx.fillStyle = "rgb(" + rgb + ")";
          ctx.fillText(glyphs[rand(glyphs.length)], i * fs, y - fs);
          ctx.fillStyle = "rgb(" + head + ")";
          ctx.fillText(glyphs[rand(glyphs.length)], i * fs, y);
        }
        if (y > h && Math.random() > 0.972) drops[i] = 0; else drops[i]++;
      }
    }
    readColor();
    fit();
    var rt;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(fit, 150); });
    window.addEventListener("mgk:theme", readColor);
    requestAnimationFrame(frame);
  }

  /* ---------- Boot sekansı (oturumda bir kez, yalnızca ana sayfada) ---------- */
  var bootEl = d.getElementById("boot"), bootOut = d.getElementById("boot-out");
  var booting = root.classList.contains("booting");
  if (booting && bootEl && bootOut) {
    try { sessionStorage.setItem("mgk-boot", "1"); } catch (e) {}
    var finished = false;
    var finish = function () {
      if (finished) return;
      finished = true;
      bootEl.classList.add("out");
      root.classList.remove("booting");
      setTimeout(function () { bootEl.hidden = true; }, 600);
    };
    bootEl.addEventListener("pointerdown", finish);
    d.addEventListener("keydown", finish, { once: true });

    var script = [
      ['d', "BIOS v2.6.1 // mgk-01"],
      ['ok', "[ OK ] mounting /dev/blog"],
      ['ok', "[ OK ] loading threat-intel feeds"],
      ['ok', "[ OK ] starting siem-ingest"],
      ['ok', "[ OK ] parsing yara rules"],
      ['w', "[WARN] unsigned packets dropped"],
      ['ok', "[ OK ] sealing keyring"],
      ['d', "auth: guest@mgk ... "]
    ];
    var n = 0, text = "";
    (function step() {
      if (finished) return;
      if (n < script.length) {
        text += '<span class="' + script[n][0] + '">' + script[n][1] + "</span>\n";
        bootOut.innerHTML = text;
        n++;
        setTimeout(step, 90 + rand(90));
      } else {
        bootOut.innerHTML = text + '<span class="grant">ACCESS GRANTED</span><span class="hint">[ geçmek için dokun / tuşa bas ]</span>';
        setTimeout(finish, 650);
      }
    })();
    setTimeout(finish, 5000);
  }

  /* ---------- Başlık çözme efekti ---------- */
  function scramble(el) {
    var final = el.textContent;
    if (!final.trim() || reduce) return;
    el.setAttribute("aria-label", final);
    var pool = "!<>-_\\/[]{}=+*^?#0123456789ABCDEF";
    var q = final.split("").map(function (c, i) {
      return { c: c, end: 6 + i * 1.1 + Math.random() * 9, ch: "" };
    });
    var f = 0;
    var iv = setInterval(function () {
      var out = "", done = 0;
      q.forEach(function (it) {
        if (f >= it.end || /\s/.test(it.c)) { out += it.c; done++; }
        else {
          if (!it.ch || Math.random() < 0.3) it.ch = pool.charAt(rand(pool.length));
          out += it.ch;
        }
      });
      el.textContent = out;
      if (done === q.length) { clearInterval(iv); el.textContent = final; }
      f++;
    }, 35);
  }
  var startDelay = booting ? 1700 : 120;
  var title = d.querySelector(".post-title");
  if (title) setTimeout(function () { scramble(title); }, startDelay);
  var h2 = d.querySelector(".posts-head h2");
  if (h2 && "IntersectionObserver" in window) {
    var seen = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { seen.disconnect(); scramble(h2); } });
    }, { threshold: 0.6 });
    seen.observe(h2);
  }

  /* ---------- Rastgele glitch patlamaları ---------- */
  var targets = Array.prototype.slice.call(d.querySelectorAll(".name, .post-title, .brand .host"));
  if (targets.length && !reduce) {
    (function loop() {
      setTimeout(function () {
        if (!d.hidden) {
          var el = targets[rand(targets.length)];
          el.classList.add("glitching");
          setTimeout(function () { el.classList.remove("glitching"); }, 340);
        }
        loop();
      }, 4200 + Math.random() * 6500);
    })();
  }

  /* ---------- Okuma ilerlemesi (yazı sayfaları) ---------- */
  var bar = d.querySelector(".progress i");
  if (bar) {
    var queued = false;
    var upd = function () {
      queued = false;
      var max = d.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.transform = "scaleX(" + p + ")";
    };
    var req = function () { if (!queued) { queued = true; requestAnimationFrame(upd); } };
    window.addEventListener("scroll", req, { passive: true });
    window.addEventListener("resize", req);
    upd();
  }

  /* ---------- Konami: kırmızı alarm modu ---------- */
  var seq = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"], pos = 0;
  d.addEventListener("keydown", function (e) {
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    pos = (k === seq[pos]) ? pos + 1 : (k === seq[0] ? 1 : 0);
    if (pos !== seq.length) return;
    pos = 0;
    var on = root.classList.toggle("redalert");
    var lvl = d.getElementById("sys-lvl");
    if (lvl) lvl.textContent = on ? "kritik" : "düşük";
    window.dispatchEvent(new Event("mgk:theme"));
  });

  if (window.console && console.log) {
    console.log("%c root@mgk:~# ", "background:#040806;color:#39ff88;font:700 14px monospace;padding:4px 8px;border:1px solid #22573A");
    console.log("%cDevTools'u açtığına göre doğru yerdesin. ↑↑↓↓←→←→BA", "color:#8FCBA2;font:12px monospace");
  }
})();
