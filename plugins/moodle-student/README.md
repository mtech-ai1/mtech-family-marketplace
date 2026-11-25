# moodle-student

A student assistant for **מכללה ירושלים**. It works with Moodle (moodle4.michlala.edu) and the student portal (meyda.michlala.edu). Everything is read-only: it never submits, posts or pays.

## Skills
| Skill | Use it for |
|---|---|
| `moodle-scan` | Scan every course for what's overdue, due, open or submitted, plus lecturers, grades and flags (group signup missing, conflicting deadlines, a 0 grade). The core data source. |
| `moodle-status-report` | Hebrew RTL web page: tasks by urgency with live countdowns, links to every course and activity, the lecturer next to each course. |
| `moodle-assignment-brief` | Deep dive into one assignment: requirements, rubric, the lecturer's AI rules, blockers, a back-scheduled work plan, and feedback on your own drafts. |
| `moodle-deadlines-to-calendar` | Add deadlines and milestones to Google Calendar, with no duplicates (or an .ics file). |
| `michlala-portal` | Portal data: courses, credits, attendance %, final grades, timetable, exams. |
| `michlala-cli` | Local CLI: log in once in a real browser, then scan, query the portal and build the report headless. |

## Two ways to access the sites
1. **Claude in Chrome** (default, no setup). Claude works in your logged-in Chrome tab and runs `skills/moodle-scan/scripts/moodle-scan.js` inside the Moodle page.
2. **Local CLI** (your computer, with a terminal):
   ```bash
   pip install playwright && python3 -m playwright install chromium
   python3 skills/michlala-cli/scripts/michlala.py login     # you log in to the portal and to Moodle yourself
   python3 skills/michlala-cli/scripts/michlala.py report --out moodle-report.html --open
   ```
   Sessions are kept in `~/.michlala-cli` with owner-only permissions. `logout` deletes them.

Moodle and the portal have **separate logins**. Logging in to one does not log you in to the other.

## Your personal data stays on your computer
Your course list, lecturers, activity ids, preferences and notes are saved in one file outside the plugin, so updates never erase them and nothing personal is shared:

- Mac: `~/.moodle-student/profile.md`
- Windows: `C:\Users\<you>\.moodle-student\profile.md`

Claude creates and updates it after each scan. To move to another computer, copy the file to the same place there, or attach it in a chat and say "שמור את זה כפרופיל שלי".

## Example prompts
- "דוח קורסים במודל" / "מה יש להגיש השבוע?"
- "תעדכן את דף המטלות"
- "תסביר לי את המטלה המסכמת בהכנסת שינויים ותן תכנית עבודה"
- "תכניס את הדדליינים ליומן"
- "מה אחוז הנוכחות שלי ומה הציונים?"

## Files
- `skills/moodle-scan/scripts/moodle-scan.js` is the browser-side scanner.
- `skills/moodle-scan/references/site-profile.md` holds site facts, the portal API and quirks. It is the same for every student.
- `skills/moodle-scan/references/personal-profile.md` explains the personal profile file.
- `skills/moodle-scan/references/moodle-endpoints.md` lists generic Moodle endpoints and Hebrew UI strings.
- `skills/moodle-status-report/assets/report-template.html` and `scripts/build_report.py` are the page template and the builder (standard-library Python).
- `skills/michlala-cli/scripts/michlala.py` is the CLI.

## Limits
- Tasks that appear only as text on a course page or in a forum are not detected.
- Portal action names beyond `GetCourses`, `GetSchedules` and `GetPayments*` are discovered on demand.
- Site markup can change after a Moodle upgrade. If counts look wrong, rerun the scan and check one activity by hand.
