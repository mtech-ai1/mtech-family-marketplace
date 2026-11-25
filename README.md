# mtech-family-marketplace

Everyday Claude skills for family and friends. Connect once, then install what you want and get new versions as they come out.

כישורים (skills) ל-Claude לשימוש יומיומי, למשפחה ולחברים. מתחברים פעם אחת, מתקינים מה שרוצים ומקבלים גרסאות חדשות.

## התקנה ב-Claude Desktop

צריך מנוי Claude בתשלום (Pro ומעלה).

1. פותחים את Claude Desktop ועוברים ל-**Cowork**.
2. **Customize** ← **Plugins** ← **Add** ← **Add marketplace** ← **Add from a repository**.
3. מקלידים: `mtech-ai1/mtech-family-marketplace`
4. בוחרים תוסף מהרשימה ולוחצים **Install**.

לעדכון: באותו מסך Plugins, מרעננים את ה-marketplace ומעדכנים את התוסף.

## Install in Claude Desktop

You need a paid Claude plan (Pro or above).

1. Open Claude Desktop and switch to **Cowork**.
2. **Customize** → **Plugins** → **Add** → **Add marketplace** → **Add from a repository**.
3. Enter: `mtech-ai1/mtech-family-marketplace`
4. Pick a plugin from the list and click **Install**.

To update: on the same Plugins screen, refresh the marketplace and update the plugin.

In Claude Code: `/plugin marketplace add mtech-ai1/mtech-family-marketplace`, then `/plugin install moodle-student@mtech-family`.

## Plugins

| Plugin | What it does |
|---|---|
| [`moodle-student`](plugins/moodle-student) | Student assistant for מכללה ירושלים: what's due in Moodle, a Hebrew status page, assignment briefs, calendar sync, grades and attendance. |

## Your data

Plugins here never contain anyone's personal details. A plugin that needs to remember things about you keeps them in a file on your own computer, and its README says where.

## For maintainers

- Each plugin lives in `plugins/<name>/` with `.claude-plugin/plugin.json` and `skills/<skill>/SKILL.md`.
- To add a skill: create `plugins/<plugin>/skills/<skill>/SKILL.md`. To add a plugin: create its folder and add an entry to `.claude-plugin/marketplace.json`.
- **Bump `version` in the plugin's `plugin.json` on every change.** People only receive an update when the version string changes.
- Before pushing: `python3 scripts/check.py --base origin/main` and `claude plugin validate .`
- This repository is public. Never commit names, course lists, tokens or any other personal data.
