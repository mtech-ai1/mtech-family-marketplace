---
name: michlala-cli
description: Command-line access to Michlala Jerusalem's Moodle and student portal (מידע). The user logs in once in a real browser window; the session is saved locally, and later scans, portal queries (courses, grades, attendance, timetable) and HTML reports run headless. Use when working on the user's own computer with a terminal (Claude Code, or a Cowork session linked to the computer), when the user asks for "CLI", "לשלוף בלי דפדפן", "token", "session", or to automate or schedule the Moodle report.
---

# michlala CLI

**Connector first:** if tools named `michlala_…` are available in this chat, use the `michlala-assistant` skill instead. It needs no browser and no terminal.

Script: `scripts/michlala.py` (Python 3.9+, Playwright). It only reads: it never submits, posts, pays or changes anything.

## When to use it, and when not to

- **Use it** on the user's own computer: Claude Code in a terminal, a linked Cowork session whose shell runs on the computer, or scheduled local runs.
- **Don't use it** in a cloud sandbox. `login` needs a visible browser window that the user types into, and a sandbox has no screen for them. There, use the Chrome path in `moodle-scan` instead.

## Setup (once, on the user's computer)
```bash
pip install playwright && python3 -m playwright install chromium
```

## Commands
| Command | What it does |
|---|---|
| `login` | Opens a headed browser with two tabs: the portal (`meyda.michlala.edu/#/`) and Moodle (`moodle4.michlala.edu/my/`). **The user logs in to both themselves.** Moodle has its own login, separate from the portal. The command waits until both sessions work, captures the portal API session headers, and saves everything to `~/.michlala-cli/` (owner-only). |
| `status` | Prints `{"moodle":bool,"portal":bool}`. Exit code 2 means the user needs to run `login` again. |
| `scan --out scan.json` | Runs `moodle-scan.js` headless in the saved Moodle session and prints the digest. |
| `portal [--out f.json]` | Portal: `GetCourses` (lecturer, credits, attendance %, final grade) and `GetSchedules` for semesters 1 and 2 of the current academic year. |
| `portal --action <Name> --params '<json>'` | Any portal action, e.g. `GetPaymentsYears`. Payments are sensitive, so fetch them only when the user asks. |
| `report --out report.html [--notes notes.json] [--open]` | Scan + portal + `build_report.py` in one step. Writes `report.scan.json` and `report.portal.json` next to the page. |
| `export-auth --out auth.json` | Exports the portal headers and `*.michlala.edu` cookies for a raw HTTP client (curl, httpx). The file is owner-only. |
| `logout` | Deletes `~/.michlala-cli`, removing the browser profile and all session files. The personal profile in `~/.moodle-student/` is not touched. |

Set the environment variable `MICHLALA_HOME` to change the data folder.

## How authentication works (so you can debug it)
- **Moodle:** a normal cookie session (`MoodleSession`) lives in the persistent Chromium profile. API calls need `sesskey`, which is read from the logged-in page (`M.cfg.sesskey`). A session that expires sends you to `/login/index.php`.
- **Portal:** the SPA calls `POST https://api-meyda.michlala.edu/api/SendMessage` with cookies plus the headers `sid`, `clientsessiondata`, `role` and `culturecode`. There is no bearer JWT. `login` captures these headers from the SPA's own first API call. When a call returns 401/403 or `isSuccess:false` with a session message, run `login` again.
- The request body and the known actions are documented in `../moodle-scan/references/site-profile.md`.

## Safety rules for Claude
- Never type the user's password or a one-time code. Never ask them to paste either into the chat.
- Never print, log or paste the contents of `~/.michlala-cli/*`, `auth.json`, cookies or header values. Refer to the files by path only.
- Don't commit these files. If you're working in a git repo, add `.michlala-cli/` and `auth*.json` to `.gitignore`.
- If the shell can't open a window (headless server or VM), say so and fall back to the Chrome path.

## Scheduling (optional)
For a daily report, run `status`, then `report --out ~/Desktop/moodle-report.html` from cron or launchd on the user's computer. If `status` exits with 2, notify the user to run `login`. Do not try to refresh the login automatically.
