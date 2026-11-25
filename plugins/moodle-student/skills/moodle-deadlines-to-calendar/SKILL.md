---
name: moodle-deadlines-to-calendar
description: Adds Moodle deadlines from a scan to Google Calendar, without duplicating events. Use when the user says "תכניס ליומן", "add the deadlines to my calendar", "sync Moodle to calendar", or accepts the calendar offer after a Moodle report.
---

# Moodle deadlines → Google Calendar

**Personal profile:** read `~/.moodle-student/profile.md` first if it exists (Windows: `%USERPROFILE%\.moodle-student\profile.md`). It holds this student's courses, known activity ids, preferences and notes. Rules for reading and updating it are in `../moodle-scan/references/personal-profile.md`.

## Preconditions
- A current scan (`moodle-scan`). Use the tasks with status `overdue`, `upcoming` or (on request) `open-nodate`.
- A Google Calendar connector. If none is connected, search the connector registry and suggest it. If that isn't possible, give the user an `.ics` file built with the format below.

## Steps
1. **Confirm before writing.** Show the list that will be added: name, course and lecturer, date and time. Ask once whether to add all, some, or also reminders. Creating events needs an explicit yes.
2. **Avoid duplicates.** For each task, search the calendar for the marker `moodle-cmid:<cmid>` (for example with `search_events` on the text, around the due date).
   - Found with the same time: skip it.
   - Found with a different time: update that event.
3. **Create the event** (timezone Asia/Jerusalem):
   - **Title:** `📚 <task name> – <course short name>`, for example `📚 משימה ג – הכנסת שינויים`.
   - **Time:** a 30-minute event **ending** at the effective deadline. Use the earlier time when the section heading and the system disagree.
   - **Description:**
     - the lecturer's name;
     - a link to the activity: `https://moodle4.michlala.edu/mod/<mod>/view.php?id=<cmid>`;
     - any blocker (group signup);
     - the line `moodle-cmid:<cmid>`.
   - **Reminders:** 2 days before and on the same morning (09:00), unless the user chose otherwise.
   - **Pair or group work:** also add a "רישום לקבוצה" event today or tomorrow if signup is missing.
4. **Work-plan milestones** from `moodle-assignment-brief`: add them as separate short events titled `✏️ <step> – <task>` with the same marker plus `-step<n>`.
5. **Report back** in one line: how many events were added, updated and skipped, with dates.

## Rules
- Never create events for tasks that are already submitted, and never delete events without asking.
- Do not schedule on Shabbat or holidays. If a deadline falls on one, keep the deadline as it is, but move any milestone you scheduled.
- `open-nodate` tasks get no event unless the user asks. Then use an all-day reminder event on a date the user picks.

## .ics fallback
For each task, write a `VEVENT` with `DTSTART;TZID=Asia/Jerusalem` (the deadline minus 30 minutes), `DTEND` (the deadline), `SUMMARY`, `DESCRIPTION` (including the `moodle-cmid` line), `UID:moodle-<cmid>@michlala` and `VALARM` blocks. Deliver it as a file the user can open.
