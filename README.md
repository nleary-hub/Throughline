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
- `js/ai.js` — the only file that calls an LLM. Mirrors `js/store.js`'s
  live/standalone split: `window.claude.use("sample")` when running as a
  Claude Artifact, otherwise a bring-your-own-key call straight to the
  Anthropic API (key entered in Settings, stored only in that browser's
  `localStorage`, never synced to the shared app data). Every call is a
  suggestion a person reviews and explicitly applies — nothing here
  writes to the Store on its own, and every call site degrades to "AI
  suggestions aren't available" on any failure or missing key.
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
- **Initiative detail** — requirements & approvals (editable classification
  that re-evaluates them), priority, milestones, risks & dependencies
  (including linking another initiative as a blocker/competitor, with an
  optional AI pass over the other open initiatives to suggest likely
  matches), decision history, next action, people, outcome, and an
  open-question / answer thread visible to anyone viewing the page —
  directors can also edit the core intake fields (title, problem,
  departments, sponsor) here. "Edit classification" re-runs the
  requirement rule engine and reports what newly applies or no longer
  does.
- **Propose** — two-step intake with a live preview of the requirements
  and rough size it will likely trigger, plus an optional AI pass that
  reads the free-text problem and suggests type/departments/answers to
  review before applying.
- **Triage** — director queue for incoming proposals: classify, accept,
  ask a question (optionally AI-drafted), or decline.
- **Governance session** — score and rank a committee slate, record
  decisions, publish.
- **Reviews** — upcoming/past meetings and a generated briefing.
- **Archive** — closed, declined, and deferred initiatives with outcomes.
- **Settings** — people/roles (adding a person is wired up; editing or
  removing an existing one isn't, since that would need to reassign or
  archive everything already attributed to them), departments/areas, rule
  thresholds, attention thresholds, AI assist (Anthropic API key), demo
  data.
