# Personal profile

Everything about one student is kept in one file on that student's computer, never inside the plugin. Plugin updates replace the plugin folder, so anything stored there would be lost, and the plugin itself is shared with other people.

## Where the file is

| System | Path |
|---|---|
| macOS / Linux | `~/.moodle-student/profile.md` |
| Windows | `%USERPROFILE%\.moodle-student\profile.md` (e.g. `C:\Users\<name>\.moodle-student\profile.md`) |

This folder is separate from `~/.michlala-cli` (the CLI's login session), so `logout` does not delete the profile.

## When to read it

Read it at the start of every skill in this plugin, before scanning or reporting. If it does not exist, carry on without it. It only saves time and keeps the student's preferences.

If you cannot reach the student's home folder (a cloud session with no access to their computer), work without the profile and say so once. Do not store personal details anywhere else.

## When to write it

- **After a scan:** create the file if it is missing, or update the course table and the known activity ids. Change only what the scan shows is different, and update the "Last updated" date.
- **When the student states a preference** ("always show X", "don't offer the calendar"): add it under Preferences.
- **When you learn something personal that will matter again** (a lecturer's rule for one course, a pair partner, an agreed extension): add it under Notes.
- **When the student hands you a profile file** (attached, or a path): copy it to the path above. If a profile already exists there, show what differs and ask before replacing it.

Create the folder if needed. Write UTF-8.

Never write passwords, one-time codes, cookies, session headers, ID numbers or payment details to this file.

## Format

```markdown
# moodle-student personal profile

Last updated: <date>

## Preferences
- <one preference per line>

## Courses (<academic year>)
| Moodle id | Code | Course | Lecturer(s) | Semester |
|---|---|---|---|---|

## Known activity ids (cmid)
- <cmid>: <activity name> (<course code>)

## Notes
- <course labels, lecturer rules, anything personal worth remembering>
```

The course table is a cache. The live scan always wins: if the two disagree, trust the scan and fix the file.

## Moving to another computer

Copy `profile.md` to the same path on the other computer, or attach it in a chat there and ask Claude to save it as the profile.
