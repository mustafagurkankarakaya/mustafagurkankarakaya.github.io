#!/usr/bin/env python3
"""
CISA KEV (Known Exploited Vulnerabilities) kataloğunu çeker ve en son
eklenen zafiyetleri _data/kev.json'a yazar. Build sırasında çalışır.
Ağ/erişim yoksa mevcut _data/kev.json korunur.
"""
import json, os, sys, datetime, urllib.request

SRC = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
LIMIT = 20
TIMEOUT = 25
UA = "Mozilla/5.0 (compatible; mgk-blog-kevbot/1.0; +https://mustafagurkankarakaya.com)"

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "_data", "kev.json"))


def clean(s):
    return " ".join(str(s or "").split()).strip()


def main():
    try:
        req = urllib.request.Request(SRC, headers={"User-Agent": UA, "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            cat = json.load(r)
    except Exception as ex:
        print(f"[ERR] KEV çekilemedi: {ex}; mevcut dosya korunuyor", file=sys.stderr)
        return 0

    vulns = cat.get("vulnerabilities") or []
    # en son eklenenler önce
    vulns.sort(key=lambda v: v.get("dateAdded", ""), reverse=True)

    items = []
    for v in vulns[:LIMIT]:
        cve = clean(v.get("cveID"))
        if not cve:
            continue
        items.append({
            "cve": cve,
            "vendor": clean(v.get("vendorProject")),
            "product": clean(v.get("product")),
            "name": clean(v.get("vulnerabilityName")),
            "dateAdded": clean(v.get("dateAdded")),
            "ransomware": clean(v.get("knownRansomwareCampaignUse")).lower() == "known",
        })

    if not items:
        print("KEV boş döndü; mevcut dosya korunuyor", file=sys.stderr)
        return 0

    data = {
        "generated": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        "catalogVersion": clean(cat.get("catalogVersion")),
        "items": items,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"{len(items)} KEV kaydı yazıldı -> {OUT}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
