# Throughline

What's waiting, on whom, and why.

Throughline tracks operational and clinical initiatives through intake,
triage, requirements/approvals, execution, governance review, and
outcomes. It's built for a hospital-style governance structure — Physician
Governance Committee sign-off, senior director approval thresholds, Value
Analysis, IT PMO, Capital Committee, Privileging, Facilities & Construction
— but the rule thresholds and department/area structure are editable, not
hardcoded policy.

## Running it

No build step, no dependencies. Serve the directory with any static file
server and open it:

```
python3 -m http.server 8000
# then open http://localhost:8000
```

or `npx serve`, or drop the folder onto any static host (GitHub Pages,
Netlify, S3, etc.) as-is.

On first load it seeds itself with a realistic demo dataset — nine people
across every role (senior director, director, peer director, manager,
coordinator, physician, contributor), a set of departments and areas, and
about ten initiatives spanning every stage from proposed through closed —
so every screen has something real to show. Sign in as anyone from the
list; there's no auth, this is a shared internal tool.

Demo data is flagged and can be cleared once you're ready to run real
initiatives: **Settings → Demo data → Remove demo data**. People stay,
since real work needs them.

## Architecture

Plain JS, no framework, no bundler:

- `js/model.js` — enums, the requirement rule engine, and the
  readiness/health/attention derivations. Pure functions, no DOM or I/O.
- `js/store.js` — the only file that touches persistence. It reads and
  writes through one small API (`get`/`all`/`put`/`patch`/`remove`/
  `subscribe`) backed by whichever of three layers is available, checked
  in order:
  1. **live** — `window.claude.use("db")`, when running as a Claude
     Artifact.
  2. **local** — `localStorage`, when running standalone (this is what
     makes the app fully functional outside claude.ai). Seeded from
     `js/seed.js` on first run.
  3. **offline** — no persistence at all (e.g. storage blocked by the
     browser). The UI shows a banner and every write is a no-op.
- `js/seed.js` — demo dataset for local mode, computed through the same
  requirement rule engine as real data so it stays consistent with the
  rules in Settings.
- `js/ui.js` — DOM-building primitives (`el`, `card`, `chip`, `modal`,
  `toast`, formatting helpers). No store access, no routing.
- `js/app.js` — boot, hash router, global state, the nav rail.
- `js/views/*.js` — one file per screen (home, initiatives, initiative
  detail, intake, triage, governance session, reviews, archive,
  settings).

Any store write triggers a full re-render of the current view via
`Store.subscribe`, so views are written to be safely rebuilt from
scratch on every change rather than patched in place.

## Screens

- **Home** — role-tailored: an attention stream of what's waiting on you
  (decide / unblock / respond / confirm / overdue) for most roles, a
  cross-area rollup for the senior director, "my submissions" for
  contributors.
- **Initiatives** — filterable list or Kanban board, saved views (at
  risk, blocked, mine, unassigned).
- **Initiative detail** — requirements & approvals, milestones, risks &
  dependencies, decision history, next action, people, outcome.
- **Propose** — two-step intake with a live preview of the requirements
  it will likely trigger.
- **Triage** — director queue for incoming proposals: classify, accept,
  ask a question, or decline.
- **Governance session** — score and rank a committee slate, record
  decisions, publish.
- **Reviews** — upcoming/past meetings and a generated briefing.
- **Archive** — closed, declined, and deferred initiatives with outcomes.
- **Settings** — people/roles, departments/areas, rule thresholds,
  attention thresholds, demo data.
