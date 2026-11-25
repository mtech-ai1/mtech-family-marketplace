#!/usr/bin/env python3
"""michlala — command-line access to Michlala Jerusalem's Moodle and student portal (מידע).

The user logs in once in a real browser window; the session is kept in a private browser
profile on this computer, and later commands run headless with that session.

  python3 michlala.py login              # opens a browser; log in to Moodle AND the portal yourself
  python3 michlala.py status             # are the saved sessions still valid?
  python3 michlala.py scan  --out scan.json            # Moodle: all courses, tasks, due dates, status
  python3 michlala.py portal --out portal.json         # portal: courses, lecturers, attendance, schedule
  python3 michlala.py portal --action GetPayments --params '{"iStudiesYear":2027}'
  python3 michlala.py report --out report.html --open  # scan + portal + HTML status page
  python3 michlala.py export-auth --out auth.json      # cookies + portal headers for raw HTTP clients
  python3 michlala.py logout             # delete the saved profile and session files

Setup (once):  pip install playwright  &&  python3 -m playwright install chromium
Data dir:      ~/.michlala-cli  (override with MICHLALA_HOME). Files there are session secrets:
               owner-only permissions, never paste them into a chat, never commit them.
This tool only reads. It never submits, posts or changes anything on either site.
"""
import argparse, json, os, shutil, stat, subprocess, sys, time, webbrowser
from datetime import date
from pathlib import Path

MOODLE = "https://moodle4.michlala.edu"
MEYDA = "https://meyda.michlala.edu"
MEYDA_API = "https://api-meyda.michlala.edu/api/SendMessage"
HOME = Path(os.environ.get("MICHLALA_HOME", Path.home() / ".michlala-cli"))
PROFILE = HOME / "browser-profile"
AUTH = HOME / "meyda-auth.json"
HERE = Path(__file__).resolve().parent
SKILLS = HERE.parents[1]
SCANNER = SKILLS / "moodle-scan" / "scripts" / "moodle-scan.js"
BUILDER = SKILLS / "moodle-status-report" / "scripts" / "build_report.py"
KEEP_HEADERS = {"sid", "clientsessiondata", "role", "culturecode", "x-requested-with", "content-type", "accept"}


def die(msg, code=1):
    print(msg, file=sys.stderr); sys.exit(code)


def private_write(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    os.chmod(path.parent, stat.S_IRWXU)
    path.write_text(text, encoding="utf-8")
    os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)


def academic_year(today=None):
    """Israeli academic year as the portal numbers it: Sep 2026–Aug 2027 -> 2027 (תשפ"ז)."""
    t = today or date.today()
    return t.year + 1 if t.month >= 9 else t.year


def browser(headless=True):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        die("Playwright is missing. Run:  pip install playwright  &&  python3 -m playwright install chromium")
    pw = sync_playwright().start()
    PROFILE.mkdir(parents=True, exist_ok=True); os.chmod(HOME, stat.S_IRWXU)
    ctx = pw.chromium.launch_persistent_context(str(PROFILE), headless=headless, locale="he-IL",
                                                timezone_id="Asia/Jerusalem", viewport={"width": 1280, "height": 860})
    return pw, ctx


def moodle_logged_in(page):
    if "/login/" in page.url:
        return False
    try:
        return page.evaluate("() => typeof M !== 'undefined' && !!M.cfg.sesskey && document.body.id !== 'page-login-index'")
    except Exception:
        return False


# ---------------------------------------------------------------- login
def cmd_login(a):
    pw, ctx = browser(headless=False)
    captured = {}

    def on_request(req):
        if req.url.startswith(MEYDA_API) and req.method == "POST":
            h = {k: v for k, v in req.headers.items() if k.lower() in KEEP_HEADERS}
            if h.get("sid") or h.get("clientsessiondata"):
                captured.update(h)
    ctx.on("request", on_request)

    p1 = ctx.pages[0] if ctx.pages else ctx.new_page()
    p1.goto(MEYDA + "/#/")
    p2 = ctx.new_page(); p2.goto(MOODLE + "/my/")
    print("A browser window is open with two tabs:\n"
          "  1. the student portal (מידע) — log in there\n"
          "  2. Moodle — log in there too (it has its own login)\n"
          "Waiting up to 10 minutes. Do not close the window.")
    deadline = time.time() + 600
    moodle_ok = meyda_ok = False
    while time.time() < deadline and not (moodle_ok and meyda_ok):
        time.sleep(2)
        try:
            if not moodle_ok and "/login/" not in p2.url:
                if not p2.url.startswith(MOODLE + "/my"):
                    p2.goto(MOODLE + "/my/")
                moodle_ok = moodle_logged_in(p2)
                if moodle_ok: print("✓ Moodle session saved")
            if not meyda_ok and captured:
                meyda_ok = True
                private_write(AUTH, json.dumps({"api": MEYDA_API, "headers": captured, "savedAt": time.time()}, indent=1))
                print("✓ Portal session saved")
            elif not meyda_ok and "/student" in p1.url:
                p1.reload()  # trigger an API call so the session headers can be captured
        except Exception:
            pass
    ctx.close(); pw.stop()
    if not (moodle_ok and meyda_ok):
        die(f"Login incomplete (moodle={moodle_ok}, portal={meyda_ok}). Run login again.", 2)
    print(f"Done. Sessions are stored in {HOME} (owner-only).")


# ---------------------------------------------------------------- portal
def meyda_call(ctx, action, params, entity="Student"):
    if not AUTH.exists():
        die("No portal session. Run:  michlala.py login", 2)
    auth = json.loads(AUTH.read_text())
    body = {"entityTypeName": entity, "entityId": "", "actionTypeName": action, "data": None, "parameters": params}
    r = ctx.request.post(auth.get("api", MEYDA_API), headers=auth["headers"], data=json.dumps(body))
    if r.status in (401, 403):
        die("Portal session expired. Run:  michlala.py login", 2)
    j = r.json()
    if not j.get("isSuccess", True):
        return {"error": j.get("msgs")}
    return j.get("data")


def default_portal_calls(year):
    return [("GetCourses", {"iStudProgCode": None, "iStudiesYear": year, "iSemesterCode": -99}),
            ("GetSchedules", {"iStudProgCode": None, "iStudiesYear": year, "iSemesterCode": 1}),
            ("GetSchedules", {"iStudProgCode": None, "iStudiesYear": year, "iSemesterCode": 2})]


def run_portal(ctx, a):
    year = a.year or academic_year()
    calls = [(a.action, json.loads(a.params) if a.params else {"iStudProgCode": None, "iStudiesYear": year})] if a.action \
        else default_portal_calls(year)
    out = {}
    for action, params in calls:
        key = action if action not in out else f"{action}_{params.get('iSemesterCode')}"
        out[key] = meyda_call(ctx, action, params)
    return out


def cmd_portal(a):
    pw, ctx = browser()
    try:
        out = run_portal(ctx, a)
    finally:
        ctx.close(); pw.stop()
    text = json.dumps(out, ensure_ascii=False, indent=1)
    if a.out:
        Path(a.out).write_text(text, encoding="utf-8"); print(f"wrote {a.out}")
    else:
        print(text)


# ---------------------------------------------------------------- moodle scan
def run_scan(ctx):
    page = ctx.new_page()
    page.goto(MOODLE + "/my/", wait_until="domcontentloaded")
    if not moodle_logged_in(page):
        die("Moodle session expired or missing. Run:  michlala.py login", 2)
    js = SCANNER.read_text(encoding="utf-8").replace("\nawait (async () => {", "\nreturn await (async () => {", 1)
    digest = page.evaluate("async () => {\n" + js + "\n}")
    scan = page.evaluate("() => window.__moodleScan || null")
    if not scan:
        die("Scan failed: " + str(digest)[:400], 3)
    return scan, digest


def cmd_scan(a):
    pw, ctx = browser()
    try:
        scan, digest = run_scan(ctx)
    finally:
        ctx.close(); pw.stop()
    if a.out:
        Path(a.out).write_text(json.dumps(scan, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"wrote {a.out}")
    print(digest if not a.json else json.dumps(scan, ensure_ascii=False))


def cmd_report(a):
    out = Path(a.out).resolve()
    scan_p = out.with_suffix(".scan.json"); portal_p = out.with_suffix(".portal.json")
    pw, ctx = browser()
    try:
        scan, _ = run_scan(ctx)
        portal = {}
        if AUTH.exists():
            try:
                a.action = None; a.params = None
                portal = run_portal(ctx, a)
            except SystemExit:
                print("(portal session expired — report built from Moodle only)", file=sys.stderr)
    finally:
        ctx.close(); pw.stop()
    scan_p.write_text(json.dumps(scan, ensure_ascii=False), encoding="utf-8")
    portal_p.write_text(json.dumps(portal, ensure_ascii=False), encoding="utf-8")
    cmd = [sys.executable, str(BUILDER), str(scan_p), str(out), "--portal", str(portal_p)]
    if a.notes: cmd += ["--notes", a.notes]
    subprocess.run(cmd, check=True)
    if a.open: webbrowser.open(out.as_uri())


# ---------------------------------------------------------------- misc
def cmd_status(a):
    pw, ctx = browser()
    try:
        page = ctx.new_page(); page.goto(MOODLE + "/my/", wait_until="domcontentloaded")
        m = moodle_logged_in(page)
        p = False
        if AUTH.exists():
            try:
                d = meyda_call(ctx, "GetCourses", {"iStudProgCode": None, "iStudiesYear": academic_year(), "iSemesterCode": -99})
                p = isinstance(d, dict) and "error" not in d
            except SystemExit:
                p = False
    finally:
        ctx.close(); pw.stop()
    print(json.dumps({"moodle": m, "portal": p}))
    sys.exit(0 if (m and p) else 2)


def cmd_export_auth(a):
    if not AUTH.exists():
        die("No portal session. Run:  michlala.py login", 2)
    pw, ctx = browser()
    try:
        state = ctx.storage_state()
    finally:
        ctx.close(); pw.stop()
    auth = json.loads(AUTH.read_text())
    keep = [c for c in state.get("cookies", []) if "michlala.edu" in c.get("domain", "")]
    private_write(Path(a.out), json.dumps({"meyda": auth, "cookies": keep}, indent=1))
    print(f"wrote {a.out} (owner-only). It holds live session secrets: do not share or commit it.")


def cmd_logout(a):
    shutil.rmtree(HOME, ignore_errors=True)
    print(f"deleted {HOME}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("login").set_defaults(fn=cmd_login)
    sub.add_parser("status").set_defaults(fn=cmd_status)
    s = sub.add_parser("scan"); s.add_argument("--out"); s.add_argument("--json", action="store_true"); s.set_defaults(fn=cmd_scan)
    p = sub.add_parser("portal"); p.add_argument("--action"); p.add_argument("--params"); p.add_argument("--year", type=int); p.add_argument("--out"); p.set_defaults(fn=cmd_portal)
    r = sub.add_parser("report"); r.add_argument("--out", default="moodle-report.html"); r.add_argument("--notes"); r.add_argument("--open", action="store_true"); r.add_argument("--year", type=int); r.set_defaults(fn=cmd_report)
    e = sub.add_parser("export-auth"); e.add_argument("--out", default=str(HOME / "auth-export.json")); e.set_defaults(fn=cmd_export_auth)
    sub.add_parser("logout").set_defaults(fn=cmd_logout)
    a = ap.parse_args(); a.fn(a)


if __name__ == "__main__":
    main()
