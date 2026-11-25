# Site profile — מכללה ירושלים (Michlala Jerusalem)

This file holds facts about the **site** only, the same for every student. Anything about one student (their courses, lecturers, activity ids, preferences, notes) lives in the personal profile on their computer. See `personal-profile.md`.

## Systems

| System | URL | Login | Notes |
|---|---|---|---|
| Moodle 4.5 | https://moodle4.michlala.edu | Its own login page (`/login/index.php`): email + password, or "כניסה עם קוד חד פעמי" | **Not** single-sign-on from the portal. Logging in to מידע does not log in to Moodle. |
| Student portal "אזור אישי" (מידע) | https://meyda.michlala.edu/student/ (login at `/#/`) | Its own login | Quasar/Vue SPA. Shows courses, lecturer, attendance %, final grade, timetable, year calendar, exams, payments, approvals. |
| Portal API | `POST https://api-meyda.michlala.edu/api/SendMessage` | Session cookies + request headers `sid`, `clientsessiondata`, `role`, `culturecode` (set by the SPA) | One RPC endpoint. There is no bearer JWT and nothing in localStorage or sessionStorage. |

Support (shown on the Moodle login page): help@michlalah.edu, WhatsApp 053-4965431.

## Portal API (observed November 2026)

Request body:
```json
{"entityTypeName":"Student","entityId":"","actionTypeName":"<Action>","data":null,"parameters":{...}}
```
Response: `{"isSuccess":bool,"msgs":[...],"data":{...}}`

| actionTypeName | parameters | data |
|---|---|---|
| `GetCourses` | `iStudProgCode:null, iStudiesYear:2027, iSemesterCode:-99` (-99 = all) | `courses[]`: `iStudCourseCode, sMainTeacherName, sTeacherName, sWebStudCourseStatus, fStudWeeklyHours, fStudCredits, iMinGrade, fFinalGrade, sFinalGradeStatus, fAttendancePercent, sSemester, iSemesterCode, sGroupName, sCourseType, bOkSyllabus` |
| `GetSchedules` | `iStudProgCode:null, iStudiesYear, iSemesterCode:1/2` | `schedules[]`: `sday, sStartHour, sEndHour, sRoom, sTeacherName, sGroupName, iStudCourseCode`; `unSchedules[]` |
| `GetPaymentsYears` / `GetPayments` | year | payments page (sensitive; fetch only when the user asks) |

Other screens (exams, approvals, year calendar) use the same endpoint with other action names. To discover a name, hook `window.fetch` in the portal tab, click the screen, and log `JSON.parse(init.body).actionTypeName` plus the parameter **keys**. Never log header values.

`iStudiesYear` is the academic year as the portal numbers it. September 2026 to August 2027 is **2027** (תשפ"ז). The rule is `year+1` if the month is September or later.

In Chrome you don't need the API at all. Navigate the portal pages and read them with `get_page_text`. To join Moodle courses to the portal, use the 5-digit course code (e.g. `12345`), which appears in both systems.

## Moodle quirks on this site

- Course full names look like `<name> <track> - 12345.13.1 - סמסטר שנתי, <track>`. The code is the first 5 digits, then the semester. The short words around it are program/track labels, **not** the lecturer.
- The course title can name different people than the real lecturer (the title may list coordinators or track names while the lecturer is someone else). Always take the lecturer from `/course/info.php?id=<id>` → `.teachers li` (prefix "מורה: ").
- `core_course_get_courses_by_field` and `core_comment_get_comments` return `servicenotavailable`. Don't use them. These do work: `core_course_get_enrolled_courses_by_timeline_classification`, `core_calendar_get_action_events_by_timesort`.
- Section headings often carry the real deadline ("יחידה ב : הגשה עד 24.11.26 בשעה 23:00"). It can differ from the system date (23:00 vs 23:59). Recommend the earlier one.
- Assignment boxes often stay open after the due date (no cut-off), so late submission is usually still possible.
- Pair or group assignments show "אינך חבר באף קבוצה, אנא פנה למורה" until the student joins a pairing/group activity.
- Some lecturers set AI rules in the instructions. Example: a course may require submitting both the pre-AI draft and the post-AI version, and treat a direct AI answer as disqualifying. Always quote such rules in briefs.
- `zoom` calendar events are class meetings. Exclude them from task lists.
- Times shown are Asia/Jerusalem.
- On quiz pages, a finished attempt shows `table.quizreviewsummary` and `#feedback` "ציונך הסופי…". `div.quizattempt` also wraps the start button, so it is not a sign of an attempt.
