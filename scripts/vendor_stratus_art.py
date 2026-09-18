#!/usr/bin/env python3
import io
import json
import re
import time
import unicodedata
from pathlib import Path
from difflib import SequenceMatcher
from urllib.parse import quote

import requests
from PIL import Image, ImageDraw, ImageFont, ImageOps

SGDB_KEY = "4013cee64ddceaa6dfab638c7e90eb79"
SGDB_API = "https://www.steamgriddb.com/api/v2"
CATALOG_URL = "https://raw.githubusercontent.com/evanjeffrey1212-eng/stratus-api/main/cloud.json"
OUT = Path("assets/stratus-covers")
MANIFEST = OUT / "manifest.json"
REPORT = OUT / "vendor-report.json"
SIZE = (480, 720)

session = requests.Session()
session.headers.update({
    "User-Agent": "Xbox-web-replica artwork vendor/1.0",
    "Accept": "application/json,image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
})
sgdb_headers = {"Authorization": f"Bearer {SGDB_KEY}"}

def clean_title(value):
    value = unicodedata.normalize("NFKD", str(value or ""))
    value = value.replace("™", "").replace("®", "")
    value = re.sub(r"\bMOD version\b", "", value, flags=re.I)
    value = re.sub(r"[:：–—_-]+", " ", value)
    value = re.sub(r"\s+", " ", value).strip().lower()
    return value

ALIASES = {
    "witchers 3": "The Witcher 3 Wild Hunt",
    "tekken8": "TEKKEN 8",
    "fifa23": "FIFA 23",
    "fifa19": "FIFA 19",
    "football pes 2021": "eFootball PES 2021",
    "cod6 modern warfare": "Call of Duty Modern Warfare 2 2009",
    "minecraft dungeons": "Minecraft Dungeons",
    "subnautica zero": "Subnautica Below Zero",
    "sniper ghost warrior contracts2": "Sniper Ghost Warrior Contracts 2",
    "party hard2": "Party Hard 2",
    "attack on titan2": "Attack on Titan 2",
    "ranch simulator22": "Ranch Simulator",
    "god of war 4": "God of War",
    "ratchet & clank": "Ratchet and Clank Rift Apart",
    "gta v mod version": "Grand Theft Auto V",
}

def query_title(name):
    c = clean_title(name)
    return ALIASES.get(c, str(name).strip())

def get_json(url, *, headers=None, timeout=25):
    for attempt in range(4):
        try:
            r = session.get(url, headers=headers, timeout=timeout)
            if r.status_code == 429:
                time.sleep(2.5 * (attempt + 1))
                continue
            r.raise_for_status()
            return r.json()
        except Exception:
            if attempt == 3:
                raise
            time.sleep(1.2 * (attempt + 1))

def pick_game(name, rows):
    if not rows:
        return None
    target = clean_title(name)
    def score(row):
        candidate = clean_title(row.get("name", ""))
        ratio = SequenceMatcher(None, target, candidate).ratio()
        if target == candidate:
            ratio += 2
        elif target in candidate or candidate in target:
            ratio += .35
        return ratio
    return max(rows[:12], key=score)

def pick_grid(rows):
    usable = [
        r for r in rows
        if r.get("url") and not r.get("nsfw") and not r.get("humor")
    ]
    if not usable:
        return None
    def score(row):
        s = float(row.get("score") or 0)
        dims = str(row.get("dimensions") or "")
        if dims == "600x900":
            s += 120
        elif dims == "342x482":
            s += 80
        if row.get("style") in ("alternate", "material"):
            s += 5
        return s
    return max(usable, key=score)

def steamgriddb_cover(name):
    q = query_title(name)
    found = get_json(
        f"{SGDB_API}/search/autocomplete/{quote(q, safe='')}",
        headers=sgdb_headers
    ).get("data") or []
    game = pick_game(name, found)
    if not game:
        return None, None

    grids = get_json(
        f"{SGDB_API}/grids/game/{game['id']}?dimensions=600x900,342x482&types=static",
        headers=sgdb_headers
    ).get("data") or []
    grid = pick_grid(grids)
    if not grid:
        return None, {"game_id": game.get("id"), "game_name": game.get("name")}
    return grid.get("url"), {
        "game_id": game.get("id"),
        "game_name": game.get("name"),
        "grid_id": grid.get("id"),
        "dimensions": grid.get("dimensions"),
    }

def fetch_image(url):
    for attempt in range(4):
        try:
            r = session.get(url, timeout=35)
            r.raise_for_status()
            if len(r.content) < 2048:
                raise ValueError("image payload too small")
            return r.content
        except Exception:
            if attempt == 3:
                raise
            time.sleep(1.0 * (attempt + 1))

def save_jpeg(payload, path):
    with Image.open(io.BytesIO(payload)) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        im = ImageOps.fit(im, SIZE, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
        im.save(path, "JPEG", quality=88, optimize=True, progressive=True)

def placeholder(name, path):
    im = Image.new("RGB", SIZE, (20, 22, 24))
    draw = ImageDraw.Draw(im)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 35)
    except Exception:
        font = ImageFont.load_default()
    words = str(name).split()
    lines, line = [], ""
    for word in words:
        test = (line + " " + word).strip()
        if draw.textlength(test, font=font) <= SIZE[0] - 60:
            line = test
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    lines = lines[:5]
    total = len(lines) * 48
    y = (SIZE[1] - total) // 2
    for line in lines:
        box = draw.textbbox((0, 0), line, font=font)
        x = (SIZE[0] - (box[2] - box[0])) // 2
        draw.text((x, y), line, font=font, fill=(235, 235, 235))
        y += 48
    im.save(path, "JPEG", quality=88, optimize=True, progressive=True)

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    catalog = get_json(CATALOG_URL)
    if not isinstance(catalog, list):
        raise SystemExit("Stratus catalogue is not a list")

    manifest = {}
    report = {"total": len(catalog), "steamgriddb": [], "stratus_fallback": [], "placeholder": [], "errors": []}

    for index, raw in enumerate(catalog, 1):
        key = str(raw.get("game_key") or raw.get("key") or "").strip()
        name = str(raw.get("name") or key).strip()
        if not key:
            continue
        path = OUT / f"{key.lower()}.jpg"
        source = None
        meta = {}

        try:
            url, meta = steamgriddb_cover(name)
            if url:
                save_jpeg(fetch_image(url), path)
                source = "steamgriddb"
                report["steamgriddb"].append({"key": key, "name": name, **(meta or {})})
        except Exception as exc:
            report["errors"].append({"key": key, "name": name, "stage": "steamgriddb", "error": str(exc)[:240]})

        if source is None:
            fallback_url = str(raw.get("cover") or raw.get("image") or "").strip()
            if fallback_url:
                try:
                    save_jpeg(fetch_image(fallback_url), path)
                    source = "stratus-vendored-fallback"
                    report["stratus_fallback"].append({"key": key, "name": name})
                except Exception as exc:
                    report["errors"].append({"key": key, "name": name, "stage": "stratus-cover", "error": str(exc)[:240]})

        if source is None:
            placeholder(name, path)
            source = "local-placeholder"
            report["placeholder"].append({"key": key, "name": name})

        manifest[key] = {
            "name": name,
            "path": f"assets/stratus-covers/{key.lower()}.jpg",
            "source": source,
        }
        print(f"[{index:03}/{len(catalog)}] {key} {name}: {source}", flush=True)
        time.sleep(0.12)

    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(
        f"Done: {len(report['steamgriddb'])} SteamGridDB, "
        f"{len(report['stratus_fallback'])} vendored fallback, "
        f"{len(report['placeholder'])} placeholders."
    )

if __name__ == "__main__":
    main()
