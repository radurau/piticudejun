#!/usr/bin/env python3
"""Export radu.songs (MySQL) to data/shows.json and bump the data version in index.html.

    python3 scripts/export_json.py            # write data/shows.json, bump ?v= in index.html
    python3 scripts/export_json.py --check    # print what would change, write nothing

One episode per line, so a weekly update is a one-line git diff. Per-episode notes and
sources come from ../piticu/export_annotated.py (NOTES and the SOURCE sets) when that file
exists; otherwise the note/src already in data/shows.json are kept.
"""
import argparse
import datetime as dt
import importlib.util
import json
import os
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "data" / "shows.json"
INDEX = REPO / "index.html"
ANNOTATED = Path(os.environ.get("PITICU_DIR", REPO.parent / "piticu")) / "export_annotated.py"
MYSQL = ["docker", "exec", "github-database-1", "mysql", "-uroot", "--default-character-set=utf8mb4",
         "-N", "-B", "radu"]
# Order matters: the first set that contains an episode wins (same as export_annotated.source_of).
SOURCE_SETS = (("shazam", "SHAZAM"), ("spotify", "SPOTIFY"), ("fb_radu", "FB_BY_RADU"),
               ("fb_early", "FB_EARLY"), ("fb_recent", "FB_RECENT"), ("original", "ORIGINAL"))
UNKNOWN_NOTE = "playlist unknown"


def load_annotations():
    """Return (notes, src_of_episode, sources) from export_annotated.py, or None if it is missing."""
    if not ANNOTATED.exists():
        return None
    spec = importlib.util.spec_from_file_location("export_annotated", ANNOTATED)
    mod = importlib.util.module_from_spec(spec)
    argv, sys.argv = sys.argv, [str(ANNOTATED)]  # it reads sys.argv[1] at import time
    sys.dont_write_bytecode = True  # leave no __pycache__ in the piticu folder
    try:
        spec.loader.exec_module(mod)
    finally:
        sys.argv = argv

    def src_of(ep):
        for key, attr in SOURCE_SETS:
            if ep in getattr(mod, attr):
                return key
        return None

    return dict(mod.NOTES), src_of, dict(mod.SOURCE)


def fetch_rows():
    query = ("SELECT episode, IFNULL(date,''), IFNULL(special,''), IFNULL(artist,''), IFNULL(song,'') "
             "FROM songs ORDER BY episode, played_order, id")
    out = subprocess.run(MYSQL + ["-e", query], capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit(f"mysql failed: {out.stderr.strip()}")
    return [line.split("\t") for line in out.stdout.splitlines()]


def build(rows, previous):
    annotations = load_annotations()
    episodes = {}
    for ep, date, special, artist, song in rows:
        e = episodes.setdefault(int(ep), {"n": int(ep), "date": date, "special": special or None, "tracks": []})
        if artist and song:
            e["tracks"].append([artist, song])
    prev = {e["n"]: e for e in previous.get("episodes", [])}
    for n, e in episodes.items():
        if annotations:
            notes, src_of, _ = annotations
            note, src = notes.get(n), src_of(n)
        else:
            note, src = prev.get(n, {}).get("note"), prev.get(n, {}).get("src")
        if not e["tracks"]:
            note = UNKNOWN_NOTE
        if note:
            e["note"] = note
        if src:
            e["src"] = src
    sources = annotations[2] if annotations else previous.get("sources", {})
    return [episodes[n] for n in sorted(episodes)], sources


def serialise(episodes, sources):
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":"))
    lines = ",\n".join(dump(e) for e in episodes)
    return (f'{{"show":"Piticu Dejun","generated":"{stamp}","sources":{dump(sources)},'
            f'"episodes":[\n{lines}\n]}}\n')


def bump_version(version, write):
    if not INDEX.exists():
        print("warning: index.html not found, data version not bumped", file=sys.stderr)
        return 0
    html = INDEX.read_text(encoding="utf-8")
    new, count = re.subn(r"(data/(?:shows|aliases)\.json\?v=)[\w.-]*", rf"\g<1>{version}", html)
    if count == 0:
        print("warning: no data/shows.json?v= reference found in index.html", file=sys.stderr)
    elif write and new != html:
        INDEX.write_text(new, encoding="utf-8")
    return count


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true", help="show the summary, write nothing")
    args = parser.parse_args()

    previous = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    episodes, sources = build(fetch_rows(), previous)
    tracks = sum(len(e["tracks"]) for e in episodes)
    version = f"{len(episodes)}-{tracks}"
    print(f"{len(episodes)} episodes (#{episodes[0]['n']}..#{episodes[-1]['n']}), {tracks} tracks, "
          f"latest {episodes[-1]['date']}; data version {version}")
    if args.check:
        return
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(serialise(episodes, sources), encoding="utf-8")
    refs = bump_version(version, write=True)
    print(f"wrote {OUT.relative_to(REPO)}; bumped {refs} data reference(s) in index.html")


if __name__ == "__main__":
    main()
