"""
Liest die Änderungen einer Version aus CHANGELOG.md.

  python3 scripts/changelog.py 1.1.4          → gibt den Abschnitt „## 1.1.4“ aus
  python3 scripts/changelog.py --backfill     → trägt die Abschnitte in jellyfin-repository.json ein
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def sections():
    text = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    parts = re.split(r"^## +(\S+)\s*$", text, flags=re.MULTILINE)
    return {version: body.strip() for version, body in zip(parts[1::2], parts[2::2])}


def entry(version):
    return sections().get(version.removesuffix(".0") if version.count(".") == 3 else version, "")


def backfill():
    path = ROOT / "jellyfin-repository.json"
    repo = json.loads(path.read_text(encoding="utf-8"))
    for plugin in repo:
        for version in plugin["versions"]:
            text = entry(version["version"])
            if text:
                version["changelog"] = text
    path.write_text(json.dumps(repo, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    if sys.argv[1:] == ["--backfill"]:
        backfill()
    else:
        print(entry(sys.argv[1]))
