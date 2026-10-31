(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Filtre ---------- */
  function fold(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i");
  }
  function slug(s) { return fold(s).trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

  var q = document.getElementById("q");
  var grid = document.getElementById("grid");
  var cards = Array.prototype.slice.call(grid.querySelectorAll(".card"));
  var chips = Array.prototype.slice.call(document.querySelectorAll("#chips .chip[data-cat]"));
  var tagChip = document.getElementById("tag-chip");
  var count = document.getElementById("count");
  var empty = document.getElementById("empty");

  var params = new URLSearchParams(location.search);
  var state = { text: params.get("q") || "", cat: params.get("category") || "", tag: params.get("tag") || "" };
  q.value = state.text;

  cards.forEach(function (c) {
    c._text = fold(c.dataset.text);
    c._cat = slug(c.dataset.cat);
    c._tags = (c.dataset.tags || "").split("|").filter(Boolean).map(slug);
  });

  function apply() {
    var terms = fold(state.text).split(/\s+/).filter(Boolean);
    var cat = slug(state.cat), tag = slug(state.tag), shown = 0;
    cards.forEach(function (c) {
      var ok = (!cat || c._cat === cat) && (!tag || c._tags.indexOf(tag) > -1) &&
        terms.every(function (t) { return c._text.indexOf(t) > -1; });
      c.hidden = !ok;
      if (ok) shown++;
    });
    chips.forEach(function (b) { b.setAttribute("aria-pressed", String(slug(b.dataset.cat) === cat)); });
    tagChip.hidden = !tag;
    if (tag) tagChip.textContent = "#" + state.tag + "  ×";
    var filtered = !!(terms.length || cat || tag);
    grid.classList.toggle("filtered", filtered);
    count.textContent = filtered ? shown + " yazı bulundu" : "";
    empty.hidden = shown > 0;

    var p = new URLSearchParams();
    if (state.text) p.set("q", state.text);
    if (state.cat) p.set("category", state.cat);
    if (state.tag) p.set("tag", state.tag);
    var s = p.toString();
    history.replaceState(null, "", location.pathname + (s ? "?" + s : "") + location.hash);
  }

  q.addEventListener("input", function () { state.text = q.value; apply(); });
  chips.forEach(function (b) {
    b.addEventListener("click", function () { state.cat = b.dataset.cat; apply(); });
  });
  tagChip.addEventListener("click", function () { state.tag = ""; apply(); });
  document.getElementById("reset").addEventListener("click", function () {
    state = { text: "", cat: "", tag: "" }; q.value = ""; apply(); q.focus();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== q && !/input|textarea/i.test(document.activeElement.tagName)) {
      e.preventDefault(); q.focus();
    } else if (e.key === "Escape" && document.activeElement === q) {
      q.value = ""; state.text = ""; apply();
    }
  });
  apply();

  /* ---------- Terminal ---------- */
  var out = document.getElementById("term-out");
  if (!out) return;

  var catCounts = chips.filter(function (b) { return b.dataset.cat; }).map(function (b) {
    var n = b.querySelector("span").textContent;
    var name = b.dataset.cat;
    return { name: name, n: n };
  });
  var pad = function (s, n) { s = String(s); while (s.length < n) s += " "; return s; };

  var scenes = [
    [
      ["cmd", "nmap -A -T4 -Pn 10.10.90.119"],
      ["o", "PORT     STATE SERVICE       VERSION"],
      ["o", "53/tcp   open  domain        Simple DNS Plus"],
      ["hi", "88/tcp   open  kerberos-sec  Microsoft Windows Kerberos"],
      ["hi", "389/tcp  open  ldap          Microsoft Windows AD LDAP"],
      ["o", "445/tcp  open  microsoft-ds?"],
      ["ok", "Service Info: Host: DC; OS: Windows"]
    ],
    [
      ["cmd", "vol.py -f infected.vmem windows.pslist"],
      ["o", "PID    PPID   ImageFileName"],
      ["o", "4      0      System"],
      ["o", "1484   1464   explorer.exe"],
      ["w", "1640   1484   reader_sl.exe"],
      ["hi", "[!] şüpheli süreç: reader_sl.exe"]
    ],
    [
      ["cmd", "index=blog | stats count by category"]
    ].concat([["o", pad("category", 20) + "count"]]).concat(catCounts.map(function (c) {
      return ["ok", pad(c.name, 20) + c.n];
    })),
    [
      ["cmd", "index=win EventCode=4625 | stats count by src_ip"],
      ["o", pad("src_ip", 18) + "count"],
      ["w", pad("203.0.113.45", 18) + "1847"],
      ["w", pad("198.51.100.23", 18) + "412"],
      ["o", pad("192.0.2.77", 18) + "36"],
      ["hi", "[!] brute-force eşiği aşıldı: 203.0.113.45"]
    ],
    [
      ["cmd", "yara -r rules/ sample.bin"],
      ["hi", "Suspicious_Packed_PE   sample.bin"],
      ["w", "Generic_Downloader      sample.bin"],
      ["cmd", "strings -n 8 sample.bin | head -3"],
      ["o", "GetProcAddress"],
      ["o", "VirtualAllocEx"],
      ["hi", "[!] enjeksiyon API'leri bulundu"]
    ]
  ];

  var PROMPT = '<span class="p">gurkan@soc:~$</span> ';
  function esc(s) { return s.replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function line(kind, text) {
    return kind === "cmd" ? PROMPT + '<span class="cmd">' + esc(text) + "</span>" : '<span class="' + kind + '">' + esc(text) + "</span>";
  }

  if (reduce) {
    out.innerHTML = scenes[0].map(function (l) { return line(l[0], l[1]); }).join("\n");
    return;
  }

  var si = 0, html = "";
  var caret = '<span class="caret"></span>';
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function render(extra) { out.innerHTML = html + (extra || "") + caret; }

  function typeCmd(text) {
    var i = 0;
    return new Promise(function (done) {
      (function step() {
        render(PROMPT + '<span class="cmd">' + esc(text.slice(0, i)) + "</span>");
        if (i++ < text.length) setTimeout(step, 28 + Math.random() * 40);
        else { html += line("cmd", text) + "\n"; done(); }
      })();
    });
  }

  async function run() {
    while (true) {
      var scene = scenes[si % scenes.length];
      html = "";
      for (var k = 0; k < scene.length; k++) {
        var l = scene[k];
        if (l[0] === "cmd") { await wait(400); await typeCmd(l[1]); await wait(250); }
        else { html += line(l[0], l[1]) + "\n"; render(); await wait(90); }
      }
      render(PROMPT);
      await wait(3200);
      si++;
    }
  }
  run();
})();
