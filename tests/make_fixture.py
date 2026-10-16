#!/usr/bin/env python3
"""Produce tests/fixture.json: expected stats computed by MySQL (radu.songs).

SQL does the counting on the exact stored spellings; this script only merges the groups that
data/aliases.json and js/data.js norm() treat as one (same rules, re-implemented below).

    python3 tests/make_fixture.py && node tests/check_stats.mjs
"""
import json
import re
import subprocess
import sys
import unicodedata
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
MYSQL = ["docker", "exec", "github-database-1", "mysql", "-uroot", "--default-character-set=utf8mb4", "-N", "-B", "radu"]
CHAR_MAP = {"ø": "o", "æ": "ae", "œ": "oe", "ß": "ss", "ł": "l", "đ": "d", "ı": "i", "ð": "d", "þ": "th"}


def sql(q):
    out = subprocess.run(MYSQL + ["-e", q], capture_output=True, text=True)
    if out.returncode:
        sys.exit(out.stderr)
    return [line.split("\t") for line in out.stdout.splitlines()]


def norm(s):  # mirror of js/data.js norm()
    s = "".join(c for c in unicodedata.normalize("NFKD", s) if not ("̀" <= c <= "ͯ")).lower()
    s = "".join(CHAR_MAP.get(c, c) for c in s)
    s = re.sub("[‘’‚‛′`´]", "'", s)
    s = re.sub("[“”„″]", '"', s)
    s = re.sub("[‐-―]", "-", s)
    return re.sub(r"\s+", " ", s).strip()


aliases = json.loads((REPO / "data" / "aliases.json").read_text(encoding="utf-8"))
A = {norm(k): v for k, v in aliases["artists"].items()}
S = {}
for k, v in aliases["songs"].items():
    artist, song = k.rsplit("|", 1)
    S[norm(A.get(norm(artist), artist)) + "|" + norm(song)] = v


def keys(artist, song):
    ak = norm(A.get(norm(artist), artist))
    return ak, ak + "|" + norm(S.get(ak + "|" + norm(song), song))


def merged(where):
    rows = sql(f"SELECT artist, song, COUNT(*) FROM songs WHERE artist IS NOT NULL {where} "
               "GROUP BY BINARY artist, BINARY song")
    songs, artists = Counter(), Counter()
    for artist, song, n in rows:
        ak, sk = keys(artist, song)
        songs[sk] += int(n)
        artists[ak] += int(n)
    return songs, artists


def top(counter, k=10):
    items = counter.most_common()
    cut = items[k - 1][1]
    return {"counts": [n for _, n in items[:k]], "above_cut": sorted(key for key, n in items if n > cut), "cut": cut}


reg_songs, reg_artists = merged("AND special IS NULL")
all_songs, all_artists = merged("")
fixture = {
    "plays": int(sql("SELECT COUNT(*) FROM songs WHERE artist IS NOT NULL")[0][0]),
    "episodes": int(sql("SELECT COUNT(DISTINCT episode) FROM songs WHERE artist IS NOT NULL")[0][0]),
    "regular_episodes": int(sql("SELECT COUNT(DISTINCT episode) FROM songs WHERE artist IS NOT NULL AND special IS NULL")[0][0]),
    "plays_per_year": {y: int(n) for y, n in sql("SELECT YEAR(date), COUNT(*) FROM songs WHERE artist IS NOT NULL GROUP BY 1")},
    "regular_plays_per_year": {y: int(n) for y, n in sql(
        "SELECT YEAR(date), COUNT(*) FROM songs WHERE artist IS NOT NULL AND special IS NULL GROUP BY 1")},
    "dm_plays": int(sql("SELECT COUNT(*) FROM songs WHERE artist = 'Depeche Mode'")[0][0]),
    "dm_regular_plays": int(sql("SELECT COUNT(*) FROM songs WHERE artist = 'Depeche Mode' AND special IS NULL")[0][0]),
    "dm_regular_episodes": int(sql("SELECT COUNT(DISTINCT episode) FROM songs WHERE artist = 'Depeche Mode' AND special IS NULL")[0][0]),
    "top_songs_regular": top(reg_songs),
    "top_artists_regular": top(reg_artists),
    "artists_played_once": sum(1 for n in all_artists.values() if n == 1),
    "songs_played_once": sum(1 for n in all_songs.values() if n == 1),
    "artists": len(all_artists),
    "songs": len(all_songs),
}
(REPO / "tests" / "fixture.json").write_text(json.dumps(fixture, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(f"wrote tests/fixture.json: {fixture['plays']} plays, {fixture['artists']} artists, {fixture['songs']} songs")
