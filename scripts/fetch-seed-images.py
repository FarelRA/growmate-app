#!/usr/bin/env python3
"""Download curated seed images, resize to 5 webp sizes, hash + attribute.

Sources: Wikimedia Commons (plants/topics) + 2 Openverse/Flickr direct URLs.
Output: public/seed-images/<hash>/<size>w.webp + ATTRIBUTION.json + hashmap.
Usage: python3 scripts/fetch-seed-images.py [--only <jobid-prefix>]
       python3 scripts/fetch-seed-images.py --from-attribution [--only <prefix>]
The --from-attribution mode rebuilds purely from the committed
public/seed-images/ATTRIBUTION.json (no /tmp survey inputs needed) and
verifies each digest is unchanged.
"""
import hashlib
import io
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

UA = {"User-Agent": "GrowMateSeedBot/1.0 (contact@growmate.bond)"}
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "seed-images"
SIZES = [50, 200, 400, 800, 1200]

# Own product photography (not downloadable — lives outside the repo).
# Override with MATERIAL_DIR env when the folder moves. The generated webp
# sets + ATTRIBUTION entries are committed, so deploys never need this path.
MATERIAL_DIR = Path(
    os.environ.get(
        "MATERIAL_DIR",
        str(Path.home() / "projects" / "personal" / "growmate" / "material" / "products"),
    )
)
LOCAL_FILES = {
    # job-id -> {file, title} (author GrowMate, license own work)
    "topic/product/pods": {"file": "GM Pods.png", "title": "GrowMate Pods product photo"},
    "topic/product/tech": {"file": "GM Tech.png", "title": "GrowMate Tech product photo"},
    "topic/product/addon": {"file": "GM Tech Add-on.png", "title": "GrowMate Tech Add-on product photo"},
    "topic/product/subscription": {"file": "Logo GrowMate.png", "title": "GrowMate logo"},
}
# Sibling filename (under MATERIAL_DIR's parent) for jobs whose source is
# not inside MATERIAL_DIR itself.
LOCAL_SIBLINGS = {
    "topic/product/subscription": "../Logo GrowMate.png",
}

MANUAL_TITLES = {
    "base/melati": "Jasmine (Jasminum sambac).jpg",
    "base/siomak": "Glebionis coronaria - Crown Daisy 01.jpg",
    "base/blueberry": "Five ripe blueberries.jpg",
    "base/salak": "Salacca zalacca 0zz.jpg",
    "base/kale": "CSA-Red-Russian-Kale.jpg",
    "topic/blog/mitos-pembersih-udara": "3 pots w seedlings.jpg",
    "topic/product/pods": "Leafy Greens Hydroponics.jpg",
    "topic/listing/poc": "DAP (Diammonium Phosphate) Granules (1).jpg",
}

DIRECT_URLS = {
    # job-id -> {url, title, author, license, page}
    "topic/listing/rockwool": {
        "url": "https://live.staticflickr.com/2029/2351924855_01518fd1f7_b.jpg",
        "title": "Hydroponics - Seedlings",
        "author": "AndyGoodwin",
        "license": "by-nc-sa",
        "page": "https://www.flickr.com/photos/54778175@N00/2351924855",
    },
}

ALIASES = {
    "padi-tambahan": "padi", "padi-gogo": "padi",
    "jagung-manis-tambahan": "jagung-manis", "jagung-pulut": "jagung-hibrida",
    "jagung-ketan-hitam": "jagung-hibrida",
    "kedelai-tambahan": "kedelai",
    "kacang-hijau-tambahan": "kacang-hijau",
    "bawang-merah-tambahan": "bawang-merah",
    "cabai-merah-tambahan": "cabai-merah-besar",
    "tomat-tambahan": "tomat", "terong-tambahan": "terong",
    "mawar-tambahan": "mawar", "anggrek-bulan-tambahan": "anggrek-bulan",
    "krisan-tambahan": "krisan", "sawi-manis": "sawi-hijau",
    "bayam-bangkok": "bayam", "kangkung-serasi": "kangkung",
    "cabai-setan": "cabai-rawit",
}


def local_path(job_id):
    local = LOCAL_FILES[job_id]
    if job_id in LOCAL_SIBLINGS:
        return (MATERIAL_DIR / LOCAL_SIBLINGS[job_id]).resolve(), local
    return MATERIAL_DIR / local["file"], local

def local_src(job_id):
    path, local = local_path(job_id)
    return path, {"title": local["title"], "page": "", "author": "GrowMate",
                  "license": "own work", "dl": f"material:{path.name}"}


def load_json(p):
    try:
        return json.load(open(p))
    except FileNotFoundError:
        return {}


def build_jobs():
    tmp = Path("/tmp/opencode")
    try:
        bases = json.load(open(tmp / "crop-bases.json"))
    except FileNotFoundError:
        bases = []
        print("no /tmp/opencode/crop-bases.json: survey-sourced jobs skipped", flush=True)
    if isinstance(bases, dict):
        bases = list(bases.keys())
    s1 = load_json(tmp / "survey.json")
    s3 = load_json(tmp / "survey3.json")
    s4 = load_json(tmp / "survey4.json")
    jobs = {}
    for base in bases:
        if base in ALIASES:
            continue
        jid = f"base/{base}"
        if jid in MANUAL_TITLES:
            jobs[jid] = {"title": MANUAL_TITLES[jid]}
            continue
        hit = None
        if jid in s4 and (s4[jid].get("pick") or {}).get("title"):
            hit = s4[jid]["pick"]["title"]
        elif jid in s3 and (s3[jid].get("pick") or {}).get("title"):
            hit = s3[jid]["pick"]["title"]
        elif base in s1 and (s1[base].get("tops") or [{}])[0].get("title"):
            hit = s1[base]["tops"][0]["title"]
        if not hit:
            print(f"NO SOURCE for {jid}", flush=True)
            continue
        jobs[jid] = {"title": hit}
    for jid, pick in [
        ("topic/blog/panduan-hidroponik", None), ("topic/blog/monstera-aglonema", None),
        ("topic/blog/lidah-mertua", None), ("topic/blog/mitos-pembersih-udara", "MANUAL"),
        ("topic/blog/anggrek-bulan", None), ("topic/blog/kaktus-sukulen", None),
        ("topic/blog/persiapan-rendeng", None), ("topic/blog/palawija-kemarau", None),
        ("topic/blog/tumpang-sari", None), ("topic/blog/irigasi-hemat", None),
        ("topic/blog/organik-anorganik", None), ("topic/blog/kompos-dapur", None),
        ("topic/blog/pestisida-nabati", None), ("topic/blog/baca-tanah", None),
        ("topic/blog/rotasi-tanaman", None), ("topic/blog/pranata-mangsa", None),
        ("topic/blog/semai", None), ("topic/blog/stek", None),
        ("topic/blog/ph-abmix", None), ("topic/blog/nft-dft", None),
        ("topic/blog/fotosintesis", None), ("topic/blog/panen-pascapanen", None),
        ("topic/blog/urban-farming", None), ("topic/blog/pht", None),
        ("topic/listing/bibit-selada", None), ("topic/listing/stek-mint", None),
        ("topic/listing/bayam-panen", None), ("topic/listing/netpot", None),
        ("topic/listing/poc", "MANUAL"), ("topic/listing/cocopeat", None),
        ("topic/listing/bibit-cabai", None), ("topic/listing/kemangi-panen", None),
        ("topic/listing/rockwool", "DIRECT"), ("topic/listing/jagung-petik", None),
        ("topic/listing/benih-kangkung", None), ("topic/listing/stroberi-petik", None),
        ("topic/listing/sekam-bakar", None), ("topic/listing/tomat-ceri-panen", None),
        ("topic/product/pods", "MANUAL"), ("topic/product/tech", None),
        ("topic/product/addon", None), ("topic/product/subscription", "LOCAL"),
    ]:
        if pick == "DIRECT":
            jobs[jid] = {"direct": DIRECT_URLS[jid]}
        elif pick == "LOCAL":
            jobs[jid] = {"local": LOCAL_FILES[jid]}
        elif pick == "MANUAL":
            jobs[jid] = {"title": MANUAL_TITLES[jid]}
        else:
            hit = (s3.get(jid) or {}).get("pick") or (s4.get(jid) or {}).get("pick") or {}
            if hit.get("title"):
                jobs[jid] = {"title": hit["title"]}
            else:
                print(f"NO SOURCE for {jid}", flush=True)
    # Own product shots override any surveyed Commons picks for these topics.
    for jid, local in LOCAL_FILES.items():
        jobs[jid] = {"local": local}
    # original-10 plants.ts entries (mint/rosemary had no survey1 base)
    jobs["orig/kemangi"] = {"title": "Ocimum Basilicum leaf lighted by the left.jpg"}
    jobs["orig/selada"] = {"title": "Lactuca sativa 'Ashbrook'.jpg"}
    jobs["orig/bayam"] = {"title": "Amaranthus hybridus 01.JPG"}
    jobs["orig/pakcoy"] = {"title": "Brassica rapa - April 2023 - Sarah Stierch 01.jpg"}
    # No orig/cabai-rawit job: convex/seedData/plants.ts reuses the
    # base/cabai-rawit photo, so a separate orig asset would be orphaned.
    jobs["orig/mint"] = {"title": "-2019-07-21 Mint (Mentha spicata), Trimingham.JPG"}
    jobs["orig/rosemary"] = {"title": "Rosmarinus officinalis (1).jpg"}
    jobs["orig/lidah-mertua"] = {"title": "Sansevieria trifasciata Plant 3264px.jpg"}
    jobs["orig/tomat-ceri"] = {"title": "Cherry Tomatoes From The Garden (120856445).jpeg"}
    jobs["orig/stroberi"] = {"title": "Fragaria vesca fruit - Keila.jpg"}
    return jobs


def resolve_commons(titles):
    """title -> {dl, page, author, license} via imageinfo, 40 per request."""
    out = {}
    titles = list(titles)
    for i in range(0, len(titles), 40):
        chunk = titles[i:i + 40]
        params = {"action": "query", "format": "json", "titles": "|".join("File:" + t for t in chunk),
                  "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": "1600"}
        url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers=UA)
        d = json.load(urllib.request.urlopen(req, timeout=60))
        for p in (d.get("query") or {}).get("pages", {}).values():
            if "missing" in p:
                continue
            ii = (p.get("imageinfo") or [{}])[0]
            title = (p.get("title") or "")[len("File:"):]
            meta = ii.get("extmetadata") or {}
            def txt(k):
                v = (meta.get(k) or {}).get("value", "")
                return v
            out[title] = {
                "dl": ii.get("thumburl") or ii.get("url"),
                "page": ii.get("descriptionurl"),
                "author": txt("Artist")[:200],
                "license": txt("LicenseShortName") or txt("UsageTerms")[:60],
                "width": ii.get("width"),
            }
    return out


def fetch(url, timeout=90):
    # staticflickr 403s non-browser UAs; keep the identifying bot UA for
    # Wikimedia (good API etiquette) and send a browser UA there only.
    host = urllib.parse.urlparse(url).hostname or ""
    ua = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
          if host.endswith("staticflickr.com") else UA["User-Agent"])
    req = urllib.request.Request(url, headers={"User-Agent": ua})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def process(job_id, src, attrib):
    raw = fetch(src["dl"])
    return process_bytes(job_id, raw, src, attrib)


def process_bytes(job_id, raw, src, attrib):
    from PIL import Image
    img = Image.open(io.BytesIO(raw))
    img = img.convert("RGB")
    w0, h0 = img.size
    if w0 < 200 or h0 < 200:
        raise ValueError(f"too small: {img.size}")
    blobs = {}
    for w in SIZES:
        h = max(1, round(h0 * w / w0))
        im = img.resize((w, h), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=82, method=6)
        blobs[w] = buf.getvalue()
    digest = hashlib.sha256(blobs[1200]).hexdigest()[:16]
    d = OUT / digest
    d.mkdir(parents=True, exist_ok=True)
    for w, b in blobs.items():
        (d / f"{w}w.webp").write_bytes(b)
    attrib[digest] = {
        "for": job_id,
        "title": src.get("title", ""),
        "page": src.get("page", ""),
        "author": src.get("author", ""),
        "license": src.get("license", ""),
        "source_url": src["dl"],
        "bytes_1200w": len(blobs[1200]),
        "orig_size": [w0, h0],
    }
    return digest


def main():
    only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
    from_attribution = "--from-attribution" in sys.argv
    if from_attribution:
        # Reproducible rebuild from committed data only: re-download every
        # asset recorded in public/seed-images/ATTRIBUTION.json and verify
        # the digest matches. Needs no /tmp survey inputs.
        attrib_path = OUT / "ATTRIBUTION.json"
        recorded = json.load(open(attrib_path))
        jobs = {}
        for digest, entry in recorded.items():
            jid = entry.get("for", "")
            if only and not jid.startswith(only):
                continue
            jobs[jid] = {"expect": digest, "attrib": entry}
        print(f"jobs: {len(jobs)} (from committed ATTRIBUTION.json)", flush=True)
        attrib, hashmap, failures = {}, {}, []
        for jid, job in jobs.items():
            try:
                entry = job["attrib"]
                if jid in LOCAL_FILES:
                    path, src = local_src(jid)
                    digest = process_bytes(jid, path.read_bytes(), src, attrib)
                else:
                    src = {"dl": entry["source_url"], "title": entry.get("title", ""),
                           "page": entry.get("page", ""), "author": entry.get("author", ""),
                           "license": entry.get("license", "")}
                    digest = process(jid, src, attrib)
                hashmap[jid] = digest
                if digest != job["expect"]:
                    failures.append({"job": jid, "error": f"digest moved {job['expect']} -> {digest}"})
                    print(f"MOVED {jid}: {job['expect']} -> {digest}", flush=True)
                else:
                    print(f"OK {jid} -> {digest} (verified)", flush=True)
            except Exception as e:
                failures.append({"job": jid, "error": str(e)[:200]})
                print(f"FAIL {jid}: {e}", flush=True)
        Path("/tmp/opencode/hashmap.json").write_text(json.dumps(hashmap, indent=1))
        Path("/tmp/opencode/img-failures.json").write_text(json.dumps(failures, indent=1))
        print(f"done: {len(hashmap)} ok, {len(failures)} failed", flush=True)
        return
    jobs = build_jobs()
    if only:
        jobs = {k: v for k, v in jobs.items() if k.startswith(only)}
    print(f"jobs: {len(jobs)}", flush=True)
    for v in jobs.values():
        if "title" in v and v["title"].startswith("File:"):
            v["title"] = v["title"][len("File:"):]
    titles = sorted({v["title"] for v in jobs.values() if "title" in v})
    resolved = resolve_commons(titles)
    print(f"resolved: {len(resolved)}/{len(titles)}", flush=True)
    attrib, hashmap, failures = {}, {}, []
    for jid, job in jobs.items():
        try:
            if "local" in job:
                path, src = local_src(jid)
                digest = process_bytes(jid, path.read_bytes(), src, attrib)
            elif "direct" in job:
                dd = job["direct"]
                src = {"dl": dd["url"], "title": dd["title"], "page": dd["page"],
                       "author": dd["author"], "license": dd["license"]}
                digest = process(jid, src, attrib)
            else:
                r = resolved.get(job["title"])
                if not r or not r.get("dl"):
                    raise ValueError(f"unresolved: {job['title']}")
                src = {"dl": r["dl"], "title": job["title"], "page": r.get("page", ""),
                       "author": r.get("author", ""), "license": r.get("license", "")}
                digest = process(jid, src, attrib)
            hashmap[jid] = digest
            print(f"OK {jid} -> {digest}", flush=True)
        except Exception as e:
            failures.append({"job": jid, "error": str(e)[:200]})
            print(f"FAIL {jid}: {e}", flush=True)
    (OUT / "ATTRIBUTION.json").write_text(json.dumps(attrib, indent=1, ensure_ascii=False))
    Path("/tmp/opencode/hashmap.json").write_text(json.dumps(hashmap, indent=1))
    Path("/tmp/opencode/img-failures.json").write_text(json.dumps(failures, indent=1))
    print(f"done: {len(hashmap)} ok, {len(failures)} failed", flush=True)


if __name__ == "__main__":
    main()
