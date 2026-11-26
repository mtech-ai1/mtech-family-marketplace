---
name: moodle-assignment-brief
description: Opens a single Moodle assignment or quiz and turns it into a practical brief. The brief covers what exactly is required, how it is graded, the lecturer's rules (AI use, pairs, length, format), real deadlines, blockers, a work plan back-scheduled from the deadline, and questions worth asking the lecturer. Use when the user asks "מה צריך לעשות במטלה X", "תסביר לי את המטלה", "איך להתחיל", "תן לי תכנית עבודה", "advice on this assignment", or picks a task from the Moodle report.
---

# Assignment brief

**Connector first:** if tools named `michlala_…` are available in this chat, use the `michlala-assistant` skill instead. It needs no browser and no terminal.

**Personal profile:** read `~/.moodle-student/profile.md` first if it exists (Windows: `%USERPROFILE%\.moodle-student\profile.md`). It holds this student's courses, known activity ids, preferences and notes. Rules for reading and updating it are in `../moodle-scan/references/personal-profile.md`.

The goal is to help the student understand and plan the work: requirements, a plan, structure and feedback on their own drafts. **Do not write a submission for them to hand in as their own.** Many lecturers forbid it, and some require the pre-AI draft to be submitted. Respect the lecturer's stated AI policy above everything else.

## 1. Locate the activity
- From a scan: take the `cmid` and `mod` (`window.__moodleScan.tasks`, or `scan.json`).
- From a name or course: run `moodle-scan` first, or search the course page `/course/view.php?id=<courseid>`.
- From a link the user pasted: the `id=` value is the cmid.

## 2. Read everything about it (in the logged-in browser, or via the CLI session)
- `/mod/<mod>/view.php?id=<cmid>`: read the full page text with `get_page_text`. Capture:
  - dates: open, due, cut-off;
  - the submission status table;
  - the group line ("אינך חבר באף קבוצה" means signup is needed);
  - grading status;
  - the full instructions, word or page limits, submission format and file types.
- **The section heading** on the course page that the activity sits in. It often holds the real deadline or extra rules.
- **Attached instruction files** (`pluginfile.php` links), such as the rubric, guidelines or templates:
  - a PDF opens in a tab and can be read with `get_page_text`;
  - a .docx needs a download. Ask the user first, naming the file;
  - from the CLI, `context.request.get(url)` returns the bytes.
- **Related items in the same section**: a pairing or group-choice activity, an example, a forum with lecturer clarifications. Read that forum's latest posts too.
- **Past feedback** in the same course (`/grade/report/user/index.php?id=<courseid>` and feedback on earlier assignments). It shows what this lecturer values.
- The lecturer comes from `/course/info.php?id=<courseid>`.

## 3. Write the brief (Hebrew by default, short and direct)

```
## <שם המטלה> — <קורס> (<מרצה>)
**הגשה:** <יום ותאריך, שעה> · <נשארו X ימים / באיחור X>   **סטטוס:** <...>
**חוסמים:** <הרשמה לקבוצה / חסר קובץ / תאריך סותר — או "אין">

### מה בדיוק נדרש
- deliverables, length/format, individual/pair, file type
### איך זה ייבדק
- rubric / weights / what the lecturer emphasized (quote briefly)
### כללים של המרצה
- AI policy (quote it), citations, originality, late policy
### תכנית עבודה
- 3–6 steps back-scheduled from the deadline, each with a date and a size estimate (e.g. "45 דק׳")
- put a buffer day before the deadline, and avoid Shabbat and holidays (check the portal year calendar when relevant)
### שאלות לשאול את המרצה (רק אם באמת לא ברור)
### טיוטת מבנה (אופציונלי, אם המשתמש/ת מבקש/ת)
- an outline of headings with what each section should answer. This is not finished text.
```

## 4. Advice rules
- Lead with blockers. A missing group signup or a 0 grade on earlier work outranks everything else.
- When the text and the system disagree (e.g. a 23:00 vs 23:59 deadline, or a page count), state both and recommend the stricter one.
- When the lecturer asks for "deep, non-superficial" thinking, give 2–3 angles or questions to explore, not ready-made answers.
- When the user shares their own draft, give concrete feedback against the requirements and rubric: what is missing, what is weak, and what to cut.
- Offer to add the work-plan milestones to Google Calendar (`moodle-deadlines-to-calendar`).
