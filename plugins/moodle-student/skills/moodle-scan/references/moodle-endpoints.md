# Moodle endpoints and selectors (generic, Moodle 4.x)

All requests run **inside a logged-in page of the site** (same origin), so the session cookie applies. Use `fetch(path, {credentials:'same-origin'})` and parse the HTML with `DOMParser`.

## AJAX web services (POST JSON)
`/lib/ajax/service.php?sesskey=${M.cfg.sesskey}&info=<method>`, with body `[{"index":0,"methodname":"<method>","args":{...}}]`

| Method | Args | Use |
|---|---|---|
| `core_course_get_enrolled_courses_by_timeline_classification` | `classification: all|inprogress|future|past, limit:0, offset:0, sort:'fullname'` | course list (id, fullname, shortname, progress, enddate) |
| `core_calendar_get_action_events_by_timesort` | `timesortfrom, timesortto, limitnum:50, limittononsuspendedevents:true` | pending actions only (not yet submitted/attempted); `overdue`, `action.name`, `url` (contains cmid) |

Many other methods are disabled for students on some sites (`servicenotavailable`). Fall back to HTML pages.

## HTML pages
| Page | What to read |
|---|---|
| `/course/info.php?id=C` | `.teachers li` (lecturers, "<role>: <name>") |
| `/course/view.php?id=C` | `li.activity` / `[data-for="cmitem"]` (class `modtype_<mod>`, `data-id` = cmid), `[data-region="activity-dates"]`, completion info, section names |
| `/mod/<mod>/index.php?id=C` | `table.generaltable` with one row per activity: section, name link, due date, submission status, grade |
| `/mod/assign/view.php?id=CMID` | `[data-region="activity-dates"]` (נפתח/מסתיים/Opened/Due/Cut-off), `.submissionstatustable tr` (th→td: מצב ההגשה, מצב מתן הציון, הזמן שנותר, קבוצה), `.activity-description` (instructions + attached files `a[href*=pluginfile.php]`), feedback table |
| `/mod/quiz/view.php?id=CMID` | dates, `table.quizattemptsummary` (attempts), start/continue button text, `#feedback` (grade) |
| `/mod/questionnaire/view.php?id=CMID` | dates, "already responded" text |
| `/grade/report/overview/index.php` | grade per course |
| `/grade/report/user/index.php?id=C` | grade items for one course |
| `/calendar/view.php?view=upcoming` | upcoming events (HTML) |
| `/mod/forum/index.php?id=C` | forums, unread counts |

## Hebrew UI strings (for parsing)
- Submitted: "הוגש למתן ציון". Not submitted: "טרם הוגש", "לא הוגש שום דבר", "אין עדיין הגשות לבדיקה".
- Graded: "נבדק". Not graded: "לא ניתן ציון".
- Late: "המטלה באיחור של: X". Early: "המטלה הוגשה X לפני תאריך ההגשה הסופי".
- Group missing: "אינך חבר באף קבוצה".
- Dates: "יום רביעי, 11 נובמבר 2026, 12:00 AM". Month names: ינואר … דצמבר.

## Reading attached files
Instruction files are linked as `/pluginfile.php/...`.
- In Chrome, open the link in a tab: a PDF renders and `get_page_text` can read it.
- For a .docx, downloading needs the user's permission. Ask first, naming the file.
- With the CLI or Playwright, `context.request.get(url)` returns the bytes using the session.
