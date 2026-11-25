#!/usr/bin/env python3
"""Build the Moodle status page from a scan JSON.

Usage:
  python3 build_report.py SCAN.json OUT.html [--notes NOTES.json] [--fragment] [--title "..."] [--portal PORTAL.json]

SCAN.json   window.__moodleScan from moodle-scan.js (or `michlala.py scan --out`).
NOTES.json  optional per-task annotations written by Claude, keyed by cmid:
            {"<cmid>": {"note": "...", "alerts": ["..."], "tags": ["בזוגות"], "status": "done", "hidden": false}}
PORTAL.json optional `michlala.py portal --out` output; adds lecturer names / attendance when Moodle lacks them.
--fragment  write the body-only page (for the Artifact tool, which adds its own <html>/<head>).
            Without it, a complete standalone HTML document is written (open it in any browser).
Standard library only.
"""
import argparse, json, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TEMPLATE = HERE.parent / "assets" / "report-template.html"

FLAG_TEXT = {
    "group-signup-missing": "את/ה לא רשום/ה לאף קבוצה. צריך להירשם לקבוצה/לשיבוץ לפני ההגשה, אחרת אין אפשרות להגיש.",
    "deadline-conflict": "התאריך בכותרת היחידה שונה מהתאריך במערכת. כדאי לתכנן לפי המוקדם מביניהם.",
    "zero-grade": "הציון שמופיע הוא 0. אולי זו מטלה בלי ציון, ואולי משהו לא נקלט. כדאי לבדוק מול המרצה.",
    "closed-cutoff-passed": "תאריך הנעילה עבר. ייתכן שאי אפשר להגיש בלי הארכה מהמרצה.",
}


def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8")) if p else {}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("scan"); ap.add_argument("out")
    ap.add_argument("--notes"); ap.add_argument("--portal")
    ap.add_argument("--fragment", action="store_true")
    ap.add_argument("--title", default="מטלות מודל – מכללה ירושלים")
    a = ap.parse_args()

    scan = load(a.scan)
    notes = {str(k): v for k, v in load(a.notes).items()} if a.notes else {}
    portal = load(a.portal) if a.portal else {}

    courses = scan.get("courses", [])
    # Fill missing lecturer names from the student portal (matched by 5-digit course code).
    pcourses = (portal.get("GetCourses") or {}).get("courses") or []
    by_code = {}
    for pc in pcourses:
        code = str(pc.get("iStudCourseCode") or "")
        name = pc.get("sMainTeacherName") or pc.get("sTeacherName")
        if code and name:
            by_code.setdefault(code[:5], set()).add(name.strip())
    for c in courses:
        if not c.get("teachers") and c.get("code") in by_code:
            c["teachers"] = sorted(by_code[c["code"]])

    tasks = []
    for t in scan.get("tasks", []):
        n = notes.get(str(t.get("cmid")), {})
        item = {
            "cmid": t.get("cmid"), "mod": t.get("mod"), "courseid": t.get("courseid"), "name": t.get("name"),
            "status": n.get("status") or t.get("status", "unknown"), "statusLabel": n.get("statusLabel"),
            "due": t.get("effectiveDue") or t.get("due"), "open": t.get("open"), "grade": t.get("grade") or "",
            "tags": n.get("tags", []), "note": n.get("note", ""), "hidden": n.get("hidden", False),
            "alerts": list(n.get("alerts", [])),
        }
        if not n.get("replaceAlerts"):
            for f in t.get("flags", []) or []:
                if f in FLAG_TEXT and FLAG_TEXT[f] not in item["alerts"]:
                    item["alerts"].append(FLAG_TEXT[f])
        tasks.append(item)

    data = {
        "title": a.title, "site": scan.get("meta", {}).get("site", "https://moodle4.michlala.edu"),
        "scannedAt": scan.get("meta", {}).get("scannedAt"), "courses": courses, "tasks": tasks,
    }
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    body = TEMPLATE.read_text(encoding="utf-8").replace("/*REPORT_DATA*/", payload)

    if a.fragment:
        html = body
    else:
        head_end = body.index("</style>") + len("</style>")
        html = ('<!doctype html>\n<html lang="he" dir="rtl">\n<head>\n<meta charset="utf-8">\n'
                '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
                + body[:head_end] + "\n<style>body{margin:0}</style>\n</head>\n<body>\n" + body[head_end:] + "\n</body>\n</html>\n")
    Path(a.out).write_text(html, encoding="utf-8")
    counts = {}
    for t in tasks:
        counts[t["status"]] = counts.get(t["status"], 0) + 1
    print(f"wrote {a.out} — {len(courses)} courses, tasks: {counts}")


if __name__ == "__main__":
    sys.exit(main())
