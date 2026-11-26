---
name: moodle-status-report
description: Builds the Hebrew RTL web page "מטלות מודל – מכללה ירושלים" from a Moodle scan. It shows tasks grouped as overdue, due soon, no date and submitted, with live countdowns, links to every course and activity, and the lecturer next to each course. Use when the user asks for "דוח קורסים במודל", "תכין דף/דוח עם לינקים", "status page", "refresh the Moodle page", or "עדכן את הדוח".
---

# Moodle status report page

**Connector first:** if tools named `michlala_…` are available in this chat, use the `michlala-assistant` skill instead. It needs no browser and no terminal.

**Personal profile:** read `~/.moodle-student/profile.md` first if it exists (Windows: `%USERPROFILE%\.moodle-student\profile.md`). It holds this student's courses, known activity ids, preferences and notes. Rules for reading and updating it are in `../moodle-scan/references/personal-profile.md`.

Build the page from a scan. Never hand-write the page: fill the template so every report looks the same.

## Steps

1. **Get a fresh scan.** Run the `moodle-scan` skill. You need the scan JSON (`window.__moodleScan`, or `scan.json` from the CLI). In Chrome, save it to a file by reading `JSON.stringify(window.__moodleScan)` in chunks. To keep the chunks small, drop the bulky fields first:
   ```js
   const S = window.__moodleScan; window.__compact = JSON.stringify({meta:S.meta, courses:S.courses.map(c=>({id:c.id,name:c.name,code:c.code,semester:c.semester,teachers:c.teachers})), tasks:S.tasks.map(t=>({cmid:t.cmid,courseid:t.courseid,mod:t.mod,name:t.name,status:t.status,due:t.due,effectiveDue:t.effectiveDue,open:t.open,grade:t.grade,flags:t.flags||[],cutoff:t.cutoff}))}); window.__compact.length
   ```
   Then read `window.__compact.slice(i, i+900)` in a `browser_batch`. The tool's visible output is about 1,000 characters per call, so keep chunks at 900 or less. Concatenate the chunks exactly and write `scan.json`.
2. **Review before you render.** Read the open tasks' `intro`, `statusTable` and `flags` from the scan. Write `notes.json`, keyed by cmid:
   ```json
   {"<cmid>": {"tags": ["בזוגות · מצגת"], "note": "one practical sentence", "alerts": ["..."], "replaceAlerts": true},
    "123456": {"status": "done", "statusLabel": "הוגש בכיתה"},
    "999999": {"hidden": true}}
   ```
   - `note` is one useful sentence: what the task actually requires, an AI rule, a deadline written in the text, or a new box since the last scan.
   - `alerts` are things that block submission or put a grade at risk. Without `replaceAlerts`, standard alerts are generated automatically from the flags (group signup, deadline conflict, zero grade, cut-off passed).
   - Correct a status when you have verified it is wrong, and mention the correction to the user.
3. **Render:**
   ```bash
   python3 <plugin>/skills/moodle-status-report/scripts/build_report.py scan.json OUT.html --notes notes.json [--fragment] [--portal portal.json]
   ```
   - When publishing with the **Artifact tool**, use `--fragment`: it outputs the page body without `<html>`/`<head>`, because the tool adds those itself. Without `--fragment` you get a standalone HTML file that opens in any browser.
   - `--portal` takes `michlala.py portal --out` output. It fills in a missing lecturer name from the student portal.
   - With no Python available, copy `assets/report-template.html` and replace the literal `/*REPORT_DATA*/` with the JSON `{"title","site","scannedAt","courses":[...],"tasks":[...]}`. Each task needs `cmid, mod, courseid, name, status, due, open, grade, tags, note, alerts`.
4. **Deliver:**
   - If the Artifact tool exists and a page was already published, republish to the **same file path or URL** so the link stays the same. Otherwise publish a new one with the icon `checklist`.
   - Otherwise send the standalone HTML file, or save it to the user's folder.
   - If the CLI is available, `michlala.py report --out report.html --open` does scan, portal and render in one step. Review the result and rerun with `--notes`.
5. **Reply** in two or three lines: what changed since the last report (newly overdue, new boxes, new grades) and the single most urgent action. Then offer to sync the deadlines to Google Calendar.

## Page rules (already built into the template; keep them if you edit it)

- RTL and Hebrew, light and dark themes, readable at phone width.
- Sections appear in this order: באיחור → עם תאריך הגשה → פתוחות בלי תאריך → סטטוס לא ידוע → הוגש → כל הקורסים.
- Every task row shows a date block (or the grade, for submitted work), a link to the activity, the course link with **the lecturer's name**, status tags and a live countdown.
- The course grid is sorted by open work and shows the course number, semester, lecturer and open count.
- The footer states the snapshot time and that forum-only or text-only tasks are not included.
