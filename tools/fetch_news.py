#!/usr/bin/env python3
"""
Siber güvenlik haberlerini güvenilir RSS kaynaklarından çeker ve
_data/news.json dosyasına yazar. Build sırasında (GitHub Actions) çalışır.
Her kaynak kendi içinde korunur: biri çökse bile diğerleri yazılır.
Ağ erişimi yoksa veya her kaynak düşerse, mevcut _data/news.json korunur.
"""
import json, os, sys, time, datetime, urllib.request, urllib.error

try:
    import feedparser
except ImportError:
    print("feedparser yok; mevcut news.json korunuyor", file=sys.stderr)
    sys.exit(0)

FEEDS = [
    ("The Hacker News", "https://feeds.feedburner.com/TheHackersNews"),
    ("BleepingComputer", "https://www.bleepingcomputer.com/feed/"),
    ("Krebs on Security", "https://krebsonsecurity.com/feed/"),
    ("Dark Reading",      "https://www.darkreading.com/rss.xml"),
    ("SecurityWeek",      "https://www.securityweek.com/feed/"),
    ("CISA",              "https://www.cisa.gov/cybersecurity-advisories/all.xml"),
]

PER_SOURCE = 4      # kaynak başına en fazla
TOTAL      = 14     # toplam en fazla
TIMEOUT    = 20
UA = "Mozilla/5.0 (compatible; mgk-blog-newsbot/1.0; +https://mustafagurkankarakaya.com)"

HERE = os.path.dirname(os.path.abspath(__file__))
OUT  = os.path.normpath(os.path.join(HERE, "..", "_data", "news.json"))


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/rss+xml, application/xml, text/xml, */*"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return r.read()


def to_iso(entry):
    for key in ("published_parsed", "updated_parsed"):
        t = entry.get(key)
        if t:
            try:
                return datetime.datetime(*t[:6], tzinfo=datetime.timezone.utc).isoformat().replace("+00:00", "Z")
            except Exception:
                pass
    return None


def clean(s):
    return " ".join(str(s or "").split()).strip()


def collect():
    items = []
    for name, url in FEEDS:
        try:
            raw = fetch(url)
            parsed = feedparser.parse(raw)
            n = 0
            for e in parsed.entries:
                title = clean(e.get("title"))
                link = clean(e.get("link"))
                date = to_iso(e)
                if not (title and link and date):
                    continue
                items.append({"source": name, "title": title, "link": link, "date": date})
                n += 1
                if n >= PER_SOURCE:
                    break
            print(f"[OK]  {name}: {n} haber", file=sys.stderr)
        except Exception as ex:
            print(f"[ERR] {name}: {ex}", file=sys.stderr)
    return items


def main():
    items = collect()
    # link'e göre tekilleştir
    seen, uniq = set(), []
    for it in items:
        if it["link"] in seen:
            continue
        seen.add(it["link"])
        uniq.append(it)
    uniq.sort(key=lambda x: x["date"], reverse=True)
    uniq = uniq[:TOTAL]

    if not uniq:
        print("Hiç haber çekilemedi; mevcut dosya korunuyor.", file=sys.stderr)
        return 0

    data = {
        "generated": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        "items": uniq,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"{len(uniq)} haber yazıldı -> {OUT}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
