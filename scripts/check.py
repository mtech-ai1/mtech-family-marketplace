#!/usr/bin/env python3
"""Checks the marketplace before a push. Standard library only.

  python3 scripts/check.py                 # structure checks
  python3 scripts/check.py --base <git-ref> # also: every plugin changed since <git-ref> has a new version

Users only receive an update when a plugin's version string changes, so a change
without a version bump would silently never reach them.
"""
import argparse, json, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
errors = []


def err(msg):
    errors.append(msg)


def load(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        err(f"{path.relative_to(ROOT)}: not valid JSON ({e})")
        return None


def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)


def check_structure():
    market = load(ROOT / ".claude-plugin" / "marketplace.json")
    if not market:
        return []
    for key in ("name", "owner", "plugins"):
        if key not in market:
            err(f"marketplace.json: missing '{key}'")
    plugins = []
    seen = set()
    for entry in market.get("plugins", []):
        name, source = entry.get("name"), entry.get("source")
        if not name or not isinstance(source, str) or not source.startswith("./"):
            err(f"marketplace.json: entry {entry!r} needs a name and a './' source")
            continue
        if name in seen:
            err(f"marketplace.json: duplicate plugin '{name}'")
        seen.add(name)
        if "version" in entry:
            err(f"{name}: set the version in plugin.json only, not in marketplace.json")
        pdir = ROOT / source
        manifest = load(pdir / ".claude-plugin" / "plugin.json") if pdir.is_dir() else None
        if manifest is None:
            err(f"{name}: {source}/.claude-plugin/plugin.json not found or invalid")
            continue
        if manifest.get("name") != name:
            err(f"{name}: plugin.json name is '{manifest.get('name')}'")
        if not re.fullmatch(r"\d+\.\d+\.\d+", str(manifest.get("version", ""))):
            err(f"{name}: plugin.json needs a version like 1.2.3")
        skills = sorted((pdir / "skills").glob("*/SKILL.md"))
        if not skills:
            err(f"{name}: no skills/<name>/SKILL.md found")
        for skill in skills:
            text = skill.read_text(encoding="utf-8")
            m = re.match(r"---\n(.*?)\n---\n", text, re.S)
            front = m.group(1) if m else ""
            sname = re.search(r"^name:\s*(.+)$", front, re.M)
            if not sname or sname.group(1).strip() != skill.parent.name:
                err(f"{skill.relative_to(ROOT)}: frontmatter 'name' must equal the folder name")
            if not re.search(r"^description:\s*\S", front, re.M):
                err(f"{skill.relative_to(ROOT)}: frontmatter needs a description")
        plugins.append((name, source[2:].rstrip("/"), manifest.get("version")))
    return plugins


def check_bumps(plugins, base):
    if git("rev-parse", "--verify", "--quiet", base + "^{commit}").returncode != 0:
        print(f"note: base '{base}' not found, skipping the version-bump check")
        return
    for name, rel, version in plugins:
        if not git("diff", "--name-only", base, "--", rel).stdout.strip():
            continue
        old = git("show", f"{base}:{rel}/.claude-plugin/plugin.json")
        if old.returncode != 0:
            continue  # new plugin
        try:
            old_version = json.loads(old.stdout).get("version")
        except ValueError:
            continue
        if old_version == version:
            err(f"{name}: files changed since {base} but the version is still {version}. Bump it in {rel}/.claude-plugin/plugin.json")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", help="git ref to compare against for the version-bump check")
    a = ap.parse_args()
    plugins = check_structure()
    if a.base:
        check_bumps(plugins, a.base)
    if errors:
        print("\n".join("FAIL " + e for e in errors))
        sys.exit(1)
    print("OK  " + ", ".join(f"{n} {v}" for n, _, v in plugins))


if __name__ == "__main__":
    main()
