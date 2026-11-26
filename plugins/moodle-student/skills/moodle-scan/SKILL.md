---
name: moodle-scan
description: Scans the logged-in Moodle of מכללה ירושלים (moodle4.michlala.edu), or another Moodle site, for every course and returns what is overdue, due soon, open without a date, or submitted, with lecturers, grades and flags. Use when the user asks "מה יש להגיש", "מה באיחור במודל", "תעבור על הקורסים", "scan my Moodle", "what's due", or before building a Moodle report, calendar sync or assignment brief.
---

# Moodle scan

**Connector first:** if tools named `michlala_…` are available in this chat, use the `michlala-assistant` skill instead. It needs no browser and no terminal.

Collect the current state of every course in one pass. This scan is the data source for the other skills (`moodle-status-report`, `moodle-assignment-brief`, `moodle-deadlines-to-calendar`). Never submit, post, enroll or change anything on the site. This skill only reads.

Site facts and known quirks are in `references/site-profile.md`. Read it first. Generic Moodle endpoints and selectors are in `references/moodle-endpoints.md`.

**Personal profile:** read `~/.moodle-student/profile.md` first if it exists (Windows: `%USERPROFILE%\.moodle-student\profile.md`). It holds this student's courses, known activity ids, preferences and notes. Rules for reading and updating it are in `references/personal-profile.md`. Nothing personal is stored inside the plugin.

## Pick the access path

Use the first path that is available:

1. **Claude in Chrome** (the user's own logged-in Chrome). This is preferred and needs no setup.
2. **Local CLI** (`michlala-cli` skill). Use it when running on the user's computer with a terminal (Claude Code, or a Cowork session linked to the computer) and Playwright is installed or installable.
3. **Any other browser automation** that can run JavaScript in a page: a built-in browser, Playwright MCP, or computer use plus the DevTools console. Run the same script.

Never type the user's password or a one-time code. When the site shows the login page, ask the user to log in themselves, then continue.

## Path 1 — Claude in Chrome

1. Find a tab on `moodle4.michlala.edu`, or open one at `https://moodle4.michlala.edu/my/`. A new tab opens in the background, so tell the user its title.
2. Check the login state. The login page also defines `M.cfg.sesskey`, so check the page itself:
   `location.pathname + ' | ' + document.body.id` → if it shows `/login/` or `page-login-index`, ask the user to log in (Moodle has its **own** login, separate from the student portal מידע) and wait.
3. Read `scripts/moodle-scan.js` and run its full text with `javascript_tool` in that tab. It returns a compact digest:
   - `COURSES (id|code|semester|teachers|name)`
   - `TASKS (status|due|mod|cmid|courseid|name|grade|flags)`
4. If the digest says `TRUNCATED`, read the rest with `window.__moodleDigest.slice(3500, 7000)`, and so on.
5. For full detail (instructions, status table, files), read `window.__moodleScan` in chunks. Keep each output under about 3,500 characters:
   ```js
   JSON.stringify(window.__moodleScan.tasks.filter(t => t.status !== 'done')).slice(0, 3500)
   ```
   Or for one task: `JSON.stringify(window.__moodleScan.tasks.find(t => t.cmid === '<cmid>'))`.
6. To save the scan to a file (for `build_report.py`), page through `JSON.stringify(window.__moodleScan)` with `.slice(i, i+3500)`, concatenate the chunks, and write the file.

**Output pitfall:** the Chrome tool blocks any output that contains full URLs with query strings, or cookie/session-like data (`[BLOCKED: Cookie/query string data]`). The scanner stores ids only. Build links afterwards from the ids (`/mod/<mod>/view.php?id=<cmid>`, `/course/view.php?id=<courseid>`). If output is blocked, print fewer fields and strip `?`, `=` and URLs.

## Path 2 — CLI

`python3 <plugin>/skills/michlala-cli/scripts/michlala.py scan --out scan.json`

Exit code 2 means the session expired: ask the user to run `login` themselves, because it opens a window that only they can use. See the `michlala-cli` skill.

## Path 3 — other automation

- In Playwright: `page.evaluate("async () => {" + scriptText.replace("\nawait (async () => {", "\nreturn await (async () => {") + "}")`, then `page.evaluate("() => window.__moodleScan")`.
- In a DevTools console: paste the script as-is.

## Interpret the result (apply judgment; don't just relay the data)

Status values: `overdue`, `upcoming`, `open-nodate`, `unknown`, `done`. `effectiveDue` is Unix seconds in the browser's time zone (Asia/Jerusalem).

Always surface these to the user:

- **`group-signup-missing`**: "אינך חבר באף קבוצה". The user cannot submit until they join the group or pair signup, which usually sits above the assignment on the course page. Treat it as urgent even when the due date is far away.
- **`deadline-conflict`**: the section heading (e.g. "הגשה עד 24.11.26 בשעה 23:00") differs from the system date. Recommend the earlier one.
- **`zero-grade`** on a task marked done: it could be an ungraded activity, or a submission that wasn't received. Suggest checking with the lecturer.
- **Overdue but still open**: if there is no `cutoff`, the box usually still accepts late work. Suggest submitting today and sending the lecturer a short note. If `closed-cutoff-passed`, an extension is needed.
- **`open-nodate`**: no deadline in the system. Check `intro` and the section name for a date written in the text, and say when none exists.
- **`unknown`**: the scanner couldn't tell. Open that activity and check it manually before you report it.
- A quiz with `inProgress` means there is an attempt that was started and not finished.

The scan covers assignments, quizzes, questionnaires, workshops, lessons, feedback and the calendar. Tasks that appear only as text on a course page or in a forum are not covered. Say so in the report.

## Save what you learned

After every scan, create or update the personal profile as described in `references/personal-profile.md`: the course table (Moodle id, code, course, lecturers, semester) and any new activity ids. Tell the user in one line where the file is the first time you create it.

## Present

- Apply the preferences in the personal profile. They override the defaults below.

- Reply in the user's language (Hebrew by default for this site).
- **Show the lecturer's name next to every course.** The user remembers courses by lecturer.
- Group the tasks as 🔴 overdue → 🟠 due soon (with date and weekday) → 🟡 open without a date → ✅ submitted, then add a single line saying how many courses have nothing open.
- End by offering the HTML status page (`moodle-status-report`) or adding the deadlines to Google Calendar (`moodle-deadlines-to-calendar`).
