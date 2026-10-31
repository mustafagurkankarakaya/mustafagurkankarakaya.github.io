(function () {
  "use strict";
  var body = document.querySelector(".post-body");
  if (!body) return;

  // Kod blokları: terminal başlığı + kopyala
  body.querySelectorAll("div.highlighter-rouge").forEach(function (block) {
    var pre = block.querySelector("pre");
    if (!pre) return;
    var m = block.className.match(/language-(\S+)/);
    var label = block.getAttribute("file") || (m && m[1] !== "plaintext" ? m[1] : "");
    var bar = document.createElement("div");
    bar.className = "code-bar";
    bar.innerHTML = "<i></i><i></i><i></i>";
    if (label) {
      var l = document.createElement("span");
      l.className = "lang";
      l.textContent = label;
      bar.appendChild(l);
    }
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy";
    btn.textContent = "Kopyala";
    btn.addEventListener("click", function () {
      var text = (pre.querySelector("code") || pre).innerText.replace(/\n$/, "");
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(text).then(function () {
        btn.textContent = "Kopyalandı";
        btn.classList.add("done");
        setTimeout(function () { btn.textContent = "Kopyala"; btn.classList.remove("done"); }, 1500);
      }, function () {});
    });
    bar.appendChild(btn);
    block.insertBefore(bar, block.firstChild);
  });

  // İçindekiler
  var heads = Array.prototype.filter.call(body.querySelectorAll("h2, h3"), function (h) { return h.id; });
  var toc = document.getElementById("toc");
  var list = document.getElementById("toc-list");
  if (!toc || heads.length < 3) return;
  var links = {};
  heads.forEach(function (h) {
    var li = document.createElement("li");
    if (h.tagName === "H3") li.className = "sub";
    var a = document.createElement("a");
    a.href = "#" + h.id;
    a.textContent = h.textContent;
    li.appendChild(a);
    list.appendChild(li);
    links[h.id] = a;
  });
  toc.hidden = false;
  if (!("IntersectionObserver" in window)) return;
  var current = null;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      if (current) current.classList.remove("active");
      current = links[e.target.id];
      current.classList.add("active");
    });
  }, { rootMargin: "0px 0px -70% 0px" });
  heads.forEach(function (h) { io.observe(h); });
})();
