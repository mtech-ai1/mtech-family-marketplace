// moodle-scan.js — scan every course of the logged-in Moodle user and collect task status.
//
// HOW TO RUN
//   Claude in Chrome (javascript_tool): paste the whole file as-is. It ends with an awaited
//   expression, and the tool returns that expression's value (the digest).
//   Playwright / Puppeteer: page.evaluate(`(async()=>{ ${fileText.replace(/^await /m,'return await ')} })()`)
//   DevTools console: paste as-is (top-level await works in the console).
//
// WHAT IT DOES
//   Runs inside a page of the Moodle site (same origin, so the session cookie is used).
//   Uses only GET page fetches + two AJAX web-service calls that work for regular students.
//   Never submits, posts or changes anything.
//
// OUTPUT
//   window.__moodleScan   -> full JSON object (courses, tasks, meta)
//   window.__moodleDigest -> compact one-line-per-item text, ids only, no URLs
//   Return value          -> the digest (or its first part + reading instructions when long)
//
// Output rule for agent tools: the Chrome tool blocks output containing URLs with query
// strings, so the scan stores ids, never full links. Build links from ids afterwards.

await (async () => {
  // ---------- CONFIG ----------
  const CFG = {
    classification: 'all',     // 'all' | 'inprogress' | 'future' | 'past'
    daysBack: 365,             // calendar window back (catch overdue)
    daysAhead: 180,            // calendar window ahead
    modules: ['assign', 'quiz', 'questionnaire', 'workshop', 'lesson', 'feedback'],
    sweepCoursePages: true,    // also read each course page for activities + dated items
    detailFor: ['assign', 'quiz'], // fetch the activity page for these module types
    concurrency: 6,            // parallel requests; keep modest to be polite to the server
    introChars: 900,           // characters of instructions kept per activity
    digestMax: 3500,           // characters returned directly by this script
  };

  // Note: the login page also defines M.cfg.sesskey, so check the page itself, not just M.
  if (typeof M === 'undefined' || !M.cfg || !M.cfg.sesskey || document.body.id === 'page-login-index' ||
      document.querySelector('form#login, form[action*="login/index.php"]')) {
    return 'NOT_LOGGED_IN: this page is the Moodle login page (or not a Moodle page). Ask the user to log in, open /my/, then run again.';
  }
  const ORIGIN = location.origin;
  const now = Math.floor(Date.now() / 1000);
  const T = s => (s || '').replace(/\s+/g, ' ').trim();
  const noUrls = s => T(s).replace(/https?:\/\/\S+/g, '[link]');
  const idOf = href => { try { return new URL(href, ORIGIN).searchParams.get('id'); } catch (e) { return null; } };
  const modOf = href => { const m = (href || '').match(/\/mod\/(\w+)\//); return m ? m[1] : null; };
  const errors = [];

  // ---------- helpers ----------
  async function call(methodname, args) {
    const r = await fetch(`/lib/ajax/service.php?sesskey=${M.cfg.sesskey}&info=${methodname}`, {
      method: 'POST', credentials: 'same-origin', body: JSON.stringify([{ index: 0, methodname, args }]),
    });
    const j = (await r.json())[0];
    if (j.error) throw new Error(`${methodname}: ${j.exception && j.exception.errorcode}`);
    return j.data;
  }
  async function page(path) {
    const r = await fetch(path, { credentials: 'same-origin' });
    const html = await r.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (/login\/index\.php/.test(r.url) || doc.querySelector('form#login, form[action*="login/index.php"]')) {
      throw new Error('SESSION_EXPIRED');
    }
    return doc;
  }
  async function pool(items, fn) {
    const out = new Array(items.length); let i = 0;
    const worker = async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k], k); } catch (e) { out[k] = null; errors.push(String(e.message || e).slice(0, 120)); } } };
    await Promise.all(Array.from({ length: Math.min(CFG.concurrency, items.length) }, worker));
    return out;
  }

  // Parse Moodle date text in Hebrew or English, e.g.
  // "יום רביעי, 11 נובמבר 2026, 12:00 AM" / "Wednesday, 11 November 2026, 11:59 PM" / "24 נובמבר 2026, 23:59"
  const MONTHS = {
    'ינואר': 0, 'פברואר': 1, 'מרץ': 2, 'מרס': 2, 'אפריל': 3, 'מאי': 4, 'יוני': 5, 'יולי': 6, 'אוגוסט': 7, 'ספטמבר': 8, 'אוקטובר': 9, 'נובמבר': 10, 'דצמבר': 11,
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };
  function parseDate(text) {
    const s = T(text); if (!s) return null;
    const m = s.match(/(\d{1,2})\s+([A-Za-z֐-׿]+)\s+(\d{4})(?:,?\s+(\d{1,2}):(\d{2})\s*(AM|PM|לפנה"צ|אחה"צ)?)?/i);
    if (!m) return null;
    const mon = MONTHS[m[2].toLowerCase()]; if (mon === undefined) return null;
    let h = m[4] ? parseInt(m[4], 10) : 23, min = m[5] ? parseInt(m[5], 10) : 59;
    const ap = (m[6] || '').toUpperCase();
    if ((ap === 'PM' || ap === 'אחה"צ') && h < 12) h += 12;
    if ((ap === 'AM' || ap === 'לפנה"צ') && h === 12) h = 0;
    return Math.floor(new Date(parseInt(m[3], 10), mon, parseInt(m[1], 10), h, min).getTime() / 1000); // browser local time
  }
  // Deadline written in a section/heading, e.g. "הגשה עד 24.11.26 בשעה 23:00"
  function hintFrom(text) {
    const m = T(text).match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})(?:[^\d]{0,15}(\d{1,2}):(\d{2}))?/);
    if (!m) return null;
    let y = parseInt(m[3], 10); if (y < 100) y += 2000;
    const ts = Math.floor(new Date(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10), m[4] ? +m[4] : 23, m[5] ? +m[5] : 59).getTime() / 1000);
    return { ts, text: m[0] };
  }
  // Activity dates block: lines like "נפתח: ..." "מסתיים: ..." / "Opened: ..." "Due: ..." "Closes: ..."
  function readDates(root) {
    const el = root.querySelector('[data-region="activity-dates"]'); if (!el) return {};
    const out = {}; const raw = T(el.textContent); out.raw = raw;
    const parts = [...el.querySelectorAll('div')].map(d => T(d.textContent)).filter(Boolean);
    const lines = parts.length ? parts : raw.split(/(?=נפתח|נסגר|מסתיים|תאריך|Opened|Opens|Due|Closes|Closed|Cut-off)/);
    for (const line of lines) {
      const ts = parseDate(line); if (!ts) continue;
      if (/נפתח|נפתחת|Open/i.test(line)) out.open = out.open || ts;
      else if (/נעילה|Cut-off|cutoff/i.test(line)) out.cutoff = ts;
      else if (/מסתיים|נסגר|נסגרת|הגשה|Due|Close/i.test(line)) out.due = ts;
    }
    return out;
  }
  const SUBMITTED_RE = /הוגש למתן ציון|הוגש|Submitted for grading|Submitted/i;
  const NOT_SUBMITTED_RE = /טרם הוגש|לא הוגש|אין עדיין הגשות|No submission|Not submitted|No attempt|Nothing has been submitted/i;

  // ---------- 1. courses ----------
  let cdata;
  try {
    cdata = await call('core_course_get_enrolled_courses_by_timeline_classification',
      { classification: CFG.classification, limit: 0, offset: 0, sort: 'fullname' });
  } catch (e) {
    return 'NOT_LOGGED_IN_OR_BLOCKED: ' + e.message + ' — ask the user to log in to Moodle, then rerun.';
  }
  const courses = cdata.courses.map(c => ({
    id: c.id,
    name: T(c.fullname),
    shortname: c.shortname,
    code: (c.fullname.match(/(\d{5})\.\d+\.\d+/) || [])[1] || '',
    semester: T((c.fullname.match(/סמסטר\s+([^,]+)/) || [])[1] || ''),
    progress: c.progress ?? null,
    teachers: [],
  }));
  const courseById = Object.fromEntries(courses.map(c => [c.id, c]));

  // ---------- 2. calendar action events (pending work only) ----------
  let events = [];
  try {
    const ev = await call('core_calendar_get_action_events_by_timesort', {
      timesortfrom: now - 86400 * CFG.daysBack, timesortto: now + 86400 * CFG.daysAhead, limitnum: 50, limittononsuspendedevents: true,
    });
    events = (ev.events || []).filter(e => e.modulename && e.modulename !== 'zoom').map(e => ({
      cmid: idOf(e.url), courseid: e.course && e.course.id, mod: e.modulename, name: T(e.name), ts: e.timesort,
      overdue: !!e.overdue, action: e.action ? T(e.action.name) : '', actionable: e.action ? !!e.action.actionable : null,
    }));
  } catch (e) { errors.push('calendar: ' + e.message); }

  // ---------- 3. per course: teachers, module indexes, course page sweep ----------
  const tasks = new Map(); // key cmid
  const upsert = (cmid, patch) => { if (!cmid) return; const cur = tasks.get(cmid) || { cmid, sources: [] }; for (const [k, v] of Object.entries(patch)) { if (k === 'sources') cur.sources.push(...v); else if (v !== undefined && v !== null && v !== '' && (cur[k] === undefined || cur[k] === null || cur[k] === '')) cur[k] = v; } tasks.set(cmid, cur); };

  const jobs = [];
  for (const c of courses) {
    jobs.push(async () => {
      const d = await page(`/course/info.php?id=${c.id}`);
      c.teachers = [...d.querySelectorAll('.teachers li, ul.teachers li')]
        .map(li => T(li.textContent).replace(/^[^:]{1,20}:\s*/, '')).filter(Boolean);
    });
    for (const mod of CFG.modules) {
      jobs.push(async () => {
        const d = await page(`/mod/${mod}/index.php?id=${c.id}`);
        const table = d.querySelector('table.generaltable'); if (!table) return;
        const heads = [...table.querySelectorAll('thead th')].map(th => T(th.textContent));
        let section = '';
        for (const tr of table.querySelectorAll('tbody tr')) {
          const cells = [...tr.querySelectorAll('td,th')].map(td => T(td.textContent));
          const a = tr.querySelector(`a[href*="/mod/${mod}/view.php"]`);
          if (cells[0]) section = cells[0];
          if (!a) continue;
          const row = {};
          heads.forEach((h, i) => { if (h && cells[i] !== undefined) row[h] = cells[i]; });
          const rest = cells.filter(x => x && x !== T(a.textContent) && x !== cells[0]);
          const dateCell = rest.find(x => parseDate(x));
          const statusCell = rest.find(x => SUBMITTED_RE.test(x) || NOT_SUBMITTED_RE.test(x)) || '';
          const gradeCell = rest.find(x => /^-?\d+([.,]\d+)?(\s*\/\s*\d+([.,]\d+)?)?$/.test(x)) || '';
          upsert(idOf(a.href), {
            courseid: c.id, mod, name: T(a.textContent), section, sectionHint: hintFrom(section),
            due: dateCell ? parseDate(dateCell) : null, indexStatus: statusCell, grade: gradeCell, indexRow: row, sources: ['index'],
          });
        }
      });
    }
    if (CFG.sweepCoursePages) {
      jobs.push(async () => {
        const d = await page(`/course/view.php?id=${c.id}`);
        const items = d.querySelectorAll('li.activity, [data-for="cmitem"], .activity-item');
        const seen = new Set();
        for (const li of items) {
          const a = li.querySelector('a[href*="/mod/"]'); if (!a) continue;
          const mod = (li.className.match(/modtype_(\w+)/) || [])[1] || modOf(a.href);
          const cmid = li.getAttribute('data-id') || (li.id || '').replace(/^module-/, '') || idOf(a.href);
          if (!cmid || seen.has(cmid) || !mod || ['label', 'url', 'resource', 'folder', 'page', 'zoom'].includes(mod)) continue;
          seen.add(cmid);
          const sec = li.closest('li.section, [data-for="section"], section');
          const secName = sec ? T((sec.querySelector('.sectionname, h3, [data-for="section_title"]') || {}).textContent) : '';
          const dates = readDates(li);
          const compl = T((li.querySelector('[data-region="completionrequirements"], .activity-completion, .completion-info') || {}).textContent);
          const name = T((li.querySelector('.instancename') || a).childNodes[0]?.textContent || a.textContent);
          if (!dates.due && !['assign', 'quiz', 'questionnaire', 'workshop', 'lesson', 'feedback'].includes(mod)) continue;
          upsert(cmid, { courseid: c.id, mod, name, section: secName, sectionHint: hintFrom(secName), due: dates.due, open: dates.open, completion: compl, sources: ['course'] });
        }
        c.sweep = items.length ? 'ok' : 'empty';
      });
    }
  }
  await pool(jobs, fn => fn());
  if (errors.includes('SESSION_EXPIRED')) return 'SESSION_EXPIRED: the Moodle session ended during the scan. Ask the user to log in again, then rerun.';

  for (const e of events) upsert(e.cmid, { courseid: e.courseid, mod: e.mod, name: e.name, due: e.ts, eventOverdue: e.overdue, eventAction: e.action, sources: ['calendar'] });

  // ---------- 4. activity details ----------
  const detailTargets = [...tasks.values()].filter(t => CFG.detailFor.includes(t.mod));
  await pool(detailTargets, async t => {
    const d = await page(`/mod/${t.mod}/view.php?id=${t.cmid}`);
    const dates = readDates(d);
    t.open = t.open || dates.open; t.cutoff = dates.cutoff || null; if (dates.due) t.due = dates.due; t.datesText = dates.raw || '';
    const intro = d.querySelector('.activity-description, #intro, .box.generalbox');
    t.intro = intro ? noUrls(intro.textContent).slice(0, CFG.introChars) : '';
    t.files = [...d.querySelectorAll('.activity-description a[href*="pluginfile.php"], #intro a[href*="pluginfile.php"], .fileuploadsubmission a')]
      .map(a => T(a.textContent)).filter(Boolean).slice(0, 10);
    if (t.mod === 'assign') {
      const st = {};
      for (const tr of d.querySelectorAll('.submissionstatustable tr, table.generaltable.submissionsummarytable tr')) {
        const k = T((tr.querySelector('th') || {}).textContent); const v = T((tr.querySelector('td') || {}).textContent);
        if (k && v && !v.includes('___')) st[k] = v.slice(0, 200);
      }
      t.statusTable = st;
      const all = T(d.body.textContent);
      t.groupMissing = /אינך חבר באף קבוצה|not a member of any group/i.test(all);
      const subVal = Object.entries(st).find(([k]) => /מצב ההגשה|Submission status/i.test(k));
      t.submitted = subVal ? (SUBMITTED_RE.test(subVal[1]) && !NOT_SUBMITTED_RE.test(subVal[1])) : null;
      const gradeVal = Object.entries(st).find(([k]) => /מצב מתן הציון|Grading status/i.test(k));
      t.graded = gradeVal ? /נבדק|^Graded/i.test(gradeVal[1]) : null;
      const left = Object.entries(st).find(([k]) => /הזמן שנותר|Time remaining/i.test(k));
      t.timeRemainingText = left ? left[1] : '';
      const fb = d.querySelector('.feedback, .gradingtable, [class*="feedback"] table');
      if (fb) t.feedback = noUrls(fb.textContent).slice(0, 300);
      t.canSubmit = !!d.querySelector('form[action*="assign/view.php"] button, a[href*="action=editsubmission"]');
    }
    if (t.mod === 'quiz') {
      // Attempts appear either as a summary table or (after a finished attempt) as a review summary.
      const summary = d.querySelector('table.quizattemptsummary');
      const review = d.querySelector('table.quizreviewsummary'); // note: div.quizattempt also wraps the start button, so don't use it
      t.attempts = summary ? summary.querySelectorAll('tbody tr').length : (review ? 1 : 0);
      const btnText = T([...d.querySelectorAll('.quizstartbuttondiv button, .quizstartbuttondiv input[type=submit], .singlebutton button')].map(b => b.textContent || b.value).join(' '));
      t.quizButton = btnText.slice(0, 60);
      t.inProgress = /המשך|Continue/i.test(btnText);
      const g = d.querySelector('#feedback');
      const gText = g ? T(g.textContent) : '';
      const gm = gText.match(/(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/);
      if (gm) t.grade = `${parseFloat(gm[1])}/${parseFloat(gm[2])}`;
      else if (gText) t.grade = t.grade || gText.slice(0, 60);
      // Final grade text ("ציונך הסופי" / "Your final grade") or a finished attempt means it was done.
      t.submitted = !t.inProgress && (t.attempts > 0 || /ציונך הסופי|final grade/i.test(gText));
      t.closedForStudent = /הבוחן נסגר|This quiz closed|No more attempts|אין ניסיונות נוספים/i.test(T(d.body.textContent));
    }
  });

  // ---------- 5. classify ----------
  const out = [];
  for (const t of tasks.values()) {
    if (!t.courseid || !courseById[t.courseid]) continue;
    if (t.submitted === undefined || t.submitted === null) {
      if (t.indexStatus) t.submitted = SUBMITTED_RE.test(t.indexStatus) && !NOT_SUBMITTED_RE.test(t.indexStatus);
      else if (t.sources.includes('calendar')) t.submitted = false;
      else if (/הושלם|Done|Completed/i.test(t.completion || '')) t.submitted = true;
      else if (t.mod === 'quiz' && t.grade) t.submitted = true;
    }
    const due = t.due || (t.sectionHint && t.sectionHint.ts) || null;
    // Prefer the earlier deadline when the section heading states a different one.
    t.effectiveDue = (t.sectionHint && t.due && Math.abs(t.sectionHint.ts - t.due) < 86400 * 2) ? Math.min(t.sectionHint.ts, t.due) : due;
    t.deadlineConflict = !!(t.sectionHint && t.due && t.sectionHint.ts !== t.due && Math.abs(t.sectionHint.ts - t.due) < 86400 * 2);
    if (t.submitted === true) t.status = 'done';
    else if (t.effectiveDue && t.effectiveDue < now) t.status = 'overdue';
    else if (t.effectiveDue) t.status = 'upcoming';
    else if (t.submitted === false) t.status = 'open-nodate';
    else t.status = 'unknown';
    if (t.groupMissing) (t.flags = t.flags || []).push('group-signup-missing');
    if (t.deadlineConflict) (t.flags = t.flags || []).push('deadline-conflict');
    if (t.status === 'done' && /^0([.,]0+)?(\s*\/|$)/.test(t.grade || '') ) (t.flags = t.flags || []).push('zero-grade');
    if (t.status === 'overdue' && t.cutoff && t.cutoff < now) (t.flags = t.flags || []).push('closed-cutoff-passed');
    out.push(t);
  }
  const order = { overdue: 0, upcoming: 1, 'open-nodate': 2, unknown: 3, done: 4 };
  out.sort((a, b) => order[a.status] - order[b.status] || (a.effectiveDue || 9e12) - (b.effectiveDue || 9e12));

  const scan = {
    meta: { site: ORIGIN, scannedAt: new Date().toISOString(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone, courseCount: courses.length, taskCount: out.length, errors: errors.slice(0, 20) },
    courses, tasks: out,
  };
  window.__moodleScan = scan;
  try { sessionStorage.setItem('__moodleScan', JSON.stringify(scan)); } catch (e) {}

  // ---------- 6. digest ----------
  const fmt = ts => ts ? new Date(ts * 1000).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : '-';
  const cname = id => { const c = courseById[id]; return c ? `${c.code || c.id} ${c.name.replace(/\s*-\s*\d{5}\..*$/, '').slice(0, 40)}` : id; };
  const lines = [];
  lines.push(`SCAN ${scan.meta.scannedAt} tz=${scan.meta.tz} courses=${courses.length} tasks=${out.length} errors=${errors.length}`);
  lines.push('COURSES (id|code|semester|teachers|name):');
  for (const c of courses) lines.push(`${c.id}|${c.code}|${c.semester}|${c.teachers.join(', ')}|${c.name.replace(/\s*-\s*\d{5}\..*$/, '')}`);
  lines.push('TASKS (status|due|mod|cmid|courseid|name|grade|flags):');
  for (const t of out) lines.push(`${t.status}|${fmt(t.effectiveDue)}|${t.mod}|${t.cmid}|${t.courseid}|${(t.name || '').slice(0, 60)}|${t.grade || ''}|${(t.flags || []).join(',')}`);
  const digest = lines.join('\n');
  window.__moodleDigest = digest;
  return digest.length <= CFG.digestMax ? digest
    : digest.slice(0, CFG.digestMax) + `\n...[TRUNCATED ${digest.length} chars total. Read the rest with: window.__moodleDigest.slice(${CFG.digestMax}, ${CFG.digestMax * 2})]`;
})();
