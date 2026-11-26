---
name: michlala-portal
description: Reads the Michlala Jerusalem student portal "אזור אישי" (meyda.michlala.edu) for course list, lecturers, credits, attendance percentage, final grades, weekly timetable, year calendar and exams. Use when the user asks "מה הציונים שלי", "אחוז נוכחות", "מערכת שעות", "מתי המבחנים", "כמה נקודות זכות", "לוח שנה של המכללה", or wants portal data combined with the Moodle report.
---

# Student portal (מידע)

**Connector first:** if tools named `michlala_…` are available in this chat, use the `michlala-assistant` skill instead. It needs no browser and no terminal.

**Personal profile:** read `~/.moodle-student/profile.md` first if it exists (Windows: `%USERPROFILE%\.moodle-student\profile.md`). It holds this student's courses, known activity ids, preferences and notes. Rules for reading and updating it are in `../moodle-scan/references/personal-profile.md`.

## Access paths
1. **CLI** (on the user's computer): `michlala.py portal --out portal.json`, or `--action <Name> --params '<json>'`. See `michlala-cli`.
2. **Chrome** (the user's logged-in tab): open `https://meyda.michlala.edu/student/`. If you're sent to the login screen (`/#/`), ask the user to log in. Never type their credentials. Then use the side menu:
   - קורסים
   - מערכת שעות
   - לוח שנה
   - תכניות לימוד
   - שאלונים
   - תשלומים
   - מבחנים
   - משובים
   - אישורים
   
   Read each screen with `get_page_text`. The courses screen has filters for year (`תשפ"ז`) and semester. Use "כל הסמסטרים" to see everything.
3. **Structured data from Chrome** (optional): hook `window.fetch` in the portal tab, click the screen you want, and read the captured `data`. Log the action name, parameter keys and data fields only. **Never output header values or cookies.** The Chrome tool blocks them anyway (`[BLOCKED: Cookie/query string data]`).

## What's where
- **`GetCourses`** returns, per course:
  - `sMainTeacherName` (lecturer);
  - `fStudCredits`, `fStudWeeklyHours`;
  - `fAttendancePercent`;
  - `fFinalGrade` with `sFinalGradeStatus`, and `iMinGrade` (the passing grade);
  - `sWebStudCourseStatus` (פעיל…), `sSemester`, `sCourseType` (שיעור/סמינריון), `bOkSyllabus`.
- **`GetSchedules`** returns, per semester (`iSemesterCode` 1/2): `sday`, `sStartHour`–`sEndHour`, `sRoom`, `sTeacherName`, `sGroupName`.
- **Exams, year calendar and approvals** come through the same API. Discover the action names by hooking fetch as described in `../moodle-scan/references/site-profile.md`.

## How to present
- Hebrew, with the lecturer next to each course.
- **Grades:** list the final grade against the minimum grade, and flag anything below the minimum or pending.
- **Attendance:** flag courses under 80%, or whatever threshold the college states, if it is visible. State the threshold you used.
- **Timetable:** a compact table by weekday, Sunday to Friday. Mention room changes if they are visible.
- **Joining with Moodle:** match on the 5-digit course code (e.g. 12345). In the Moodle report, the portal can fill in a missing lecturer name, and attendance or grade can be added as notes.
- **Payments and financial data:** show them only when the user asks, and never add them to a page that may be shared.
