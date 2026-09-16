/* ===================================================================
   Throughline — js/seed.js
   Demo data for standalone / local-storage mode. Only consulted by
   Store when neither claude.use("db") nor a saved local snapshot is
   available — see js/store.js. Everything here is flagged demo:true
   so Settings → "Remove demo data" can clear it in one step.
   =================================================================== */

const Seed = (() => {

  function iso(dateStr, hh, mm) {
    return `${dateStr}T${String(hh || 9).padStart(2, "0")}:${String(mm || 0).padStart(2, "0")}:00.000Z`;
  }

  function build() {
    const areas = [
      { id: "area_med", name: "Medicine", directorId: "ppl_marcus" },
      { id: "area_surg", name: "Surgical Services", directorId: "ppl_priya" },
    ];

    const departments = [
      { id: "dept_cards", name: "Cardiology", areaId: "area_med" },
      { id: "dept_ed", name: "Emergency Department", areaId: "area_med" },
      { id: "dept_or", name: "Operating Room", areaId: "area_surg" },
      { id: "dept_periop", name: "Perioperative Services", areaId: "area_surg" },
    ];

    const people = [
      { id: "ppl_dana", name: "Dana Whitfield", title: "Senior Director, Clinical Operations", role: "senior_director", departments: [], areaId: null },
      { id: "ppl_marcus", name: "Marcus Ibe", title: "Director, Medicine", role: "director", departments: ["dept_cards", "dept_ed"], areaId: "area_med" },
      { id: "ppl_priya", name: "Priya Anand", title: "Director, Surgical Services", role: "director", departments: ["dept_or", "dept_periop"], areaId: "area_surg" },
      { id: "ppl_sofia", name: "Sofia Reyes", title: "Peer Director, Medicine", role: "peer_director", departments: ["dept_cards", "dept_ed"], areaId: "area_med" },
      { id: "ppl_tom", name: "Tom Alvarez", title: "Manager, Emergency Department", role: "manager", departments: ["dept_ed"], areaId: "area_med" },
      { id: "ppl_renee", name: "Renee Park", title: "Coordinator, Operating Room", role: "coordinator", departments: ["dept_or"], areaId: "area_surg" },
      { id: "ppl_elena", name: "Dr. Elena Cho", title: "Interventional Cardiology", role: "physician", departments: ["dept_cards"], areaId: "area_med" },
      { id: "ppl_james", name: "Dr. James Whitaker", title: "Anesthesiology", role: "physician", departments: ["dept_or"], areaId: "area_surg" },
      { id: "ppl_jordan", name: "Jordan Blake", title: "Clinical Nurse, Cardiology", role: "contributor", departments: ["dept_cards"], areaId: "area_med" },
    ];

    const config = {
      id: "app",
      departments,
      areas,
      rules: { seniorDirectorCapitalThreshold: 250000 },
      attention: { staleUpdateDays: 21, staleRequirementDays: 14, triageTargetDays: 3, milestoneWarnDays: 7 },
      refCounter: { "2026": 10 },
    };

    function req(key, status, extra) {
      const applicableLabel = {
        physician_governance: "Physician Governance reviews this because it's a new service, practice change, a large initiative, or carries capital.",
        senior_director: "A senior director signs off because of size, capital, or scope.",
        value_analysis: "This needs new supplies or devices.",
        it_pmo: "This needs new software or a system interface.",
        capital: "This initiative requests capital funding.",
        privileging: "It introduces a new procedure requiring privileging.",
        facilities_construction: "This is a facilities / construction project.",
      };
      return Object.assign({
        key, status, responsibleId: null, externalContact: "", submittedOn: null, decidedOn: null,
        lastCheckedOn: null, because: applicableLabel[key] || "", becauseCode: "seed", rationale: "", addedManually: false,
      }, extra || {});
    }

    function hist(on, byId, kind, summary, detail, meta) {
      return { id: "ev_" + Math.random().toString(36).slice(2, 9), on: iso(on), byId: byId || null, kind, summary, detail: detail || "", meta: meta || {} };
    }

    const initiatives = [
      {
        id: "ini_pci_discharge", ref: "TL-2026-001",
        title: "Same-day discharge pathway for elective PCI",
        problem: "Elective PCI patients routinely stay overnight even when clinically eligible for same-day discharge, tying up beds and delaying next-day cases.",
        type: "new_service", track: "governance", departments: ["dept_cards"], size: "L",
        stage: "in_flight", stageEnteredOn: "2026-08-20",
        priority: { band: "committee", rank: 1, setOn: "2026-08-08", setBy: "ppl_dana", holdsUntil: "2027-02-08", rationale: "High patient impact, strong access case, ready to execute." },
        healthOverride: null,
        ownerId: "ppl_tom", sponsorId: "ppl_elena", execSponsorId: "ppl_marcus", contributorIds: ["ppl_jordan"],
        nextAction: { text: "Finalize discharge criteria order set with Pharmacy and Nursing", ownerId: "ppl_tom", dueOn: "2026-09-20", kind: "task" },
        requirements: [
          req("physician_governance", "approved", { responsibleId: "ppl_dana", submittedOn: "2026-07-10", decidedOn: "2026-08-08", rationale: "Approved at August committee — strong clinical case, low risk." }),
          req("senior_director", "approved", { responsibleId: "ppl_dana", submittedOn: "2026-07-10", decidedOn: "2026-08-01", rationale: "Capital and FTE ask approved." }),
          req("value_analysis", "approved", { responsibleId: "ppl_renee", submittedOn: "2026-07-15", decidedOn: "2026-07-29", rationale: "Standard supplies, no new vendor contract needed." }),
          req("it_pmo", "in_review", { responsibleId: "ppl_tom", externalContact: "IT PMO — order set build ticket #4471", submittedOn: "2026-07-20", lastCheckedOn: "2026-08-25" }),
          req("capital", "approved", { responsibleId: "ppl_marcus", submittedOn: "2026-07-10", decidedOn: "2026-08-01", rationale: "Within department capital envelope." }),
          req("privileging", "approved", { responsibleId: "ppl_elena", submittedOn: "2026-07-12", decidedOn: "2026-07-30", rationale: "No new privileges required, existing scope covers pathway." }),
        ],
        milestones: [
          { id: "ms_pci_1", title: "Order set drafted", dueOn: "2026-08-15", done: true, doneOn: "2026-08-14" },
          { id: "ms_pci_2", title: "Pilot on 10 patients", dueOn: "2026-09-20", done: false, doneOn: null },
        ],
        risks: [{ id: "rk_pci_1", kind: "risk", text: "Cath lab recovery bay capacity may not support same-day turnover during peak hours.", openedOn: "2026-08-05", closedOn: null }],
        dependencies: [],
        estimates: { capital: 320000, fte: 0.6, crossesServiceLines: false },
        intakeAnswers: { needsSupplies: "yes", needsSoftware: true, newProcedure: true, timing: "this_fiscal_year" },
        submittedBy: { name: "Elena Cho", email: "elena.cho@example.org", personId: "ppl_elena" },
        submittedOn: "2026-07-08",
        history: [
          hist("2026-07-08", "ppl_elena", "created", "Submitted via intake."),
          hist("2026-07-09", "ppl_marcus", "triaged", "Accepted into evaluation.", "", { from: "proposed", to: "evaluating" }),
          hist("2026-08-08", "ppl_dana", "decision", "Physician Governance Committee — August: approved — Strong clinical case, low risk."),
          hist("2026-08-20", "ppl_tom", "stage_change", "Moved to In flight.", "", { from: "clearing", to: "in_flight" }),
          hist("2026-08-25", "ppl_tom", "update", "Order set build with IT PMO is in progress; nursing education scheduled for next week."),
        ],
        outcome: null, closedOn: null, snoozes: [], demo: true,
      },
      {
        id: "ini_insulin_protocol", ref: "TL-2026-002",
        title: "Nurse-driven insulin protocol update",
        problem: "Current insulin titration protocol requires a physician order for every adjustment, slowing response times in the ED.",
        type: "process_improvement", track: "departmental", departments: ["dept_ed"], size: "S",
        stage: "in_flight", stageEnteredOn: "2026-08-10",
        priority: { band: "watchlist", rank: null, setOn: null, setBy: null, holdsUntil: null, rationale: "" },
        healthOverride: null,
        ownerId: "ppl_tom", sponsorId: null, execSponsorId: null, contributorIds: [],
        nextAction: { text: "Confirm updated protocol with Pharmacy and post to nursing", ownerId: "ppl_tom", dueOn: "2026-09-12", kind: "task" },
        requirements: [],
        milestones: [{ id: "ms_ins_1", title: "Protocol drafted and reviewed", dueOn: "2026-08-25", done: true, doneOn: "2026-08-24" }],
        risks: [], dependencies: [],
        estimates: { capital: 0, fte: 0, crossesServiceLines: false },
        intakeAnswers: { needsSupplies: "no", needsSoftware: false, newProcedure: false, timing: "this_fiscal_year" },
        submittedBy: { name: "Tom Alvarez", email: "tom.alvarez@example.org", personId: "ppl_tom" },
        submittedOn: "2026-08-01",
        history: [
          hist("2026-08-01", "ppl_tom", "created", "Submitted via intake."),
          hist("2026-08-02", "ppl_marcus", "triaged", "Accepted into evaluation — lightweight departmental change.", "", { from: "proposed", to: "evaluating" }),
          hist("2026-08-10", "ppl_tom", "stage_change", "Moved to In flight.", "", { from: "clearing", to: "in_flight" }),
          hist("2026-09-12", "ppl_marcus", "question", "Question from Marcus Ibe.", "Does the updated titration range need pharmacy sign-off before it goes live, or is nursing education enough on its own?", { forId: "ppl_tom" }),
        ],
        outcome: null, closedOn: null, snoozes: [], demo: true,
      },
      {
        id: "ini_or_block_time", ref: "TL-2026-003",
        title: "OR block time reallocation pilot",
        problem: "Block utilization varies widely by service line; underused blocks aren't being released early enough for other services to claim them.",
        type: "process_improvement", track: "departmental", departments: ["dept_or", "dept_periop"], size: "M",
        stage: "clearing", stageEnteredOn: "2026-09-01",
        priority: { band: "unranked", rank: null, setOn: null, setBy: null, holdsUntil: null, rationale: "" },
        healthOverride: null,
        ownerId: "ppl_priya", sponsorId: "ppl_james", execSponsorId: null, contributorIds: ["ppl_renee"],
        nextAction: { text: "Awaiting senior director sign-off — crosses service lines", ownerId: "ppl_dana", dueOn: null, kind: "decision" },
        requirements: [req("senior_director", "awaiting_decision", { responsibleId: "ppl_dana", submittedOn: "2026-09-05" })],
        milestones: [], risks: [],
        dependencies: [{ initiativeId: "ini_hybrid_or", kind: "competes_with", note: "Both draw on OR scheduling capacity during construction." }],
        estimates: { capital: 0, fte: 0, crossesServiceLines: true },
        intakeAnswers: { needsSupplies: "no", needsSoftware: false, newProcedure: false, timing: "this_fiscal_year" },
        submittedBy: { name: "Priya Anand", email: "priya.anand@example.org", personId: "ppl_priya" },
        submittedOn: "2026-08-18",
        history: [
          hist("2026-08-18", "ppl_priya", "created", "Submitted via intake."),
          hist("2026-08-19", "ppl_priya", "triaged", "Accepted into evaluation.", "", { from: "proposed", to: "evaluating" }),
          hist("2026-09-01", "ppl_priya", "stage_change", "Moved to Clearing requirements.", "", { from: "prioritized", to: "clearing" }),
          hist("2026-09-05", "ppl_priya", "requirement_change", "Senior director sign-off submitted for decision."),
        ],
        outcome: null, closedOn: null, snoozes: [], demo: true,
      },
      {
        id: "ini_hybrid_or", ref: "TL-2026-004",
        title: "New hybrid OR construction",
        problem: "No hybrid OR suite exists on-site; complex endovascular and structural heart cases are currently referred out.",
        type: "capital_construction", track: "capital", departments: ["dept_or"], size: "L",
        stage: "evaluating", stageEnteredOn: "2026-09-02",
        priority: { band: "unranked", rank: null, setOn: null, setBy: null, holdsUntil: null, rationale: "" },
        healthOverride: null,
        ownerId: "ppl_priya", sponsorId: "ppl_james", execSponsorId: "ppl_dana", contributorIds: [],
        nextAction: { text: "Complete evaluation and size the request", ownerId: "ppl_priya", dueOn: "2026-09-26", kind: "task" },
        requirements: [
          req("physician_governance", "not_started"),
          req("senior_director", "not_started"),
          req("capital", "not_started"),
          req("facilities_construction", "not_started"),
        ],
        milestones: [], risks: [], dependencies: [],
        estimates: { capital: 2500000, fte: 2, crossesServiceLines: false },
        intakeAnswers: { needsSupplies: "yes", needsSoftware: true, newProcedure: true, timing: "next_fiscal_year" },
        submittedBy: { name: "Priya Anand", email: "priya.anand@example.org", personId: "ppl_priya" },
        submittedOn: "2026-09-02",
        history: [hist("2026-09-02", "ppl_priya", "created", "Submitted via intake."), hist("2026-09-02", "ppl_priya", "triaged", "Accepted into evaluation.", "", { from: "proposed", to: "evaluating" })],
        outcome: null, closedOn: null, snoozes: [], demo: true,
      },
      {
        id: "ini_adc_refresh", ref: "TL-2026-005",
        title: "Automated dispensing cabinet refresh — Perioperative",
        problem: "Perioperative ADCs are past end-of-life and increasingly need manual overrides, creating medication safety risk.",
        type: "quality_improvement", track: "departmental", departments: ["dept_periop"], size: "M",
        stage: "prioritized", stageEnteredOn: "2026-08-28",
        priority: { band: "committed", rank: null, setOn: "2026-08-28", setBy: "ppl_priya", holdsUntil: null, rationale: "Patient safety issue, committed regardless of committee ranking." },
        healthOverride: null,
        ownerId: "ppl_renee", sponsorId: null, execSponsorId: null, contributorIds: [],
        nextAction: { text: "Complete Value Analysis intake for replacement cabinets", ownerId: "ppl_renee", dueOn: "2026-09-24", kind: "task" },
        requirements: [
          req("value_analysis", "approved", { responsibleId: "ppl_renee", submittedOn: "2026-08-05", decidedOn: "2026-08-20", rationale: "Like-for-like replacement, existing vendor contract." }),
          req("it_pmo", "not_started"),
        ],
        milestones: [], risks: [], dependencies: [],
        estimates: { capital: 180000, fte: 0, crossesServiceLines: false },
        intakeAnswers: { needsSupplies: "yes", needsSoftware: true, newProcedure: false, timing: "this_fiscal_year" },
        submittedBy: { name: "Renee Park", email: "renee.park@example.org", personId: "ppl_renee" },
        submittedOn: "2026-07-25",
        history: [
          hist("2026-07-25", "ppl_renee", "created", "Submitted via intake."),
          hist("2026-07-28", "ppl_priya", "triaged", "Accepted into evaluation.", "", { from: "proposed", to: "evaluating" }),
          hist("2026-08-08", "ppl_dana", "decision", "Physician Governance Committee — August: approved — Committed as a safety item."),
          hist("2026-08-28", "ppl_priya", "stage_change", "Moved to Prioritized.", "", { from: "clearing", to: "prioritized" }),
        ],
        outcome: null, closedOn: null, snoozes: [], demo: true,
      },
      {
        id: "ini_ed_ems_interface", ref: "TL-2026-006",
        title: "ED triage software interface with EMS",
        problem: "EMS handoff data is re-entered manually into triage, delaying door-to-provider time for incoming ambulance patients.",
        type: "process_improvement", track: "governance", departments: ["dept_ed"], size: "M",
        stage: "proposed", stageEnteredOn: "2026-09-14",
        priority: { band: "unranked", rank: null, setOn: null, setBy: null, holdsUntil: null, rationale: "" },
        healthOverride: null,
        ownerId: null, sponsorId: null, execSponsorId: null, contributorIds: [],
        nextAction: { text: "Director triage", ownerId: null, dueOn: null, kind: "decision" },
        requirements: [], milestones: [], risks: [], dependencies: [],
        estimates: { capital: 0, fte: 0, crossesServiceLines: false },
        intakeAnswers: { needsSupplies: "no", needsSoftware: true, newProcedure: false, timing: "this_fiscal_year" },
        submittedBy: { name: "Tom Alvarez", email: "tom.alvarez@example.org", personId: "ppl_tom" },
        submittedOn: "2026-09-14",
        history: [hist("2026-09-14", "ppl_tom", "created", "Submitted via intake.")],
        outcome: null, closedOn: null, snoozes: [], demo: true,
      },
      {
        id: "ini_pacu_redesign", ref: "TL-2026-007",
        title: "Post-anesthesia recovery redesign",
        problem: "PACU bay layout creates line-of-sight gaps for monitoring, and recovery times run longer than benchmark for comparable case mix.",
        type: "practice_change", track: "departmental", departments: ["dept_or"], size: "M",
        stage: "proposed", stageEnteredOn: "2026-09-08",
        priority: { band: "unranked", rank: null, setOn: null, setBy: null, holdsUntil: null, rationale: "" },
        healthOverride: null,
        ownerId: null, sponsorId: "ppl_james", execSponsorId: null, contributorIds: [],
        nextAction: { text: "Director triage", ownerId: null, dueOn: null, kind: "decision" },
        requirements: [], milestones: [], risks: [], dependencies: [],
        estimates: { capital: 0, fte: 0, crossesServiceLines: false },
        intakeAnswers: { needsSupplies: "unsure", needsSoftware: false, newProcedure: false, timing: "unsure" },
        submittedBy: { name: "James Whitaker", email: "james.whitaker@example.org", personId: "ppl_james" },
        submittedOn: "2026-09-08",
        history: [hist("2026-09-08", "ppl_james", "created", "Submitted via intake.")],
        outcome: null, closedOn: null, snoozes: [], demo: true,
      },
      {
        id: "ini_echo_scheduling", ref: "TL-2026-008",
        title: "Same-day echo scheduling improvement",
        problem: "Outpatients referred for echo from clinic often wait 2-3 weeks; same-day slots go unused because of manual scheduling.",
        type: "quality_improvement", track: "departmental", departments: ["dept_cards"], size: "S",
        stage: "closing", stageEnteredOn: "2026-09-10",
        priority: { band: "watchlist", rank: null, setOn: null, setBy: null, holdsUntil: null, rationale: "" },
        healthOverride: null,
        ownerId: "ppl_tom", sponsorId: null, execSponsorId: null, contributorIds: [],
        nextAction: { text: "Pilot complete", ownerId: "ppl_tom", dueOn: null, kind: "done" },
        requirements: [], milestones: [{ id: "ms_echo_1", title: "4-week pilot", dueOn: "2026-09-09", done: true, doneOn: "2026-09-09" }],
        risks: [], dependencies: [],
        estimates: { capital: 0, fte: 0, crossesServiceLines: false },
        intakeAnswers: { needsSupplies: "no", needsSoftware: false, newProcedure: false, timing: "this_fiscal_year" },
        submittedBy: { name: "Tom Alvarez", email: "tom.alvarez@example.org", personId: "ppl_tom" },
        submittedOn: "2026-07-20",
        history: [
          hist("2026-07-20", "ppl_tom", "created", "Submitted via intake."),
          hist("2026-07-21", "ppl_marcus", "triaged", "Accepted into evaluation.", "", { from: "proposed", to: "evaluating" }),
          hist("2026-09-10", "ppl_tom", "stage_change", "Moved to Closing.", "", { from: "in_flight", to: "closing" }),
        ],
        outcome: null, closedOn: null, snoozes: [], demo: true,
      },
      {
        id: "ini_cathlab_staffing", ref: "TL-2026-009",
        title: "Cath lab staffing model redesign",
        problem: "Fixed shift staffing didn't match case volume variability, causing overtime spikes and idle capacity on alternating days.",
        type: "practice_change", track: "governance", departments: ["dept_cards"], size: "L",
        stage: "closed", stageEnteredOn: "2026-06-15",
        priority: { band: "committee", rank: 1, setOn: "2026-04-11", setBy: "ppl_dana", holdsUntil: "2026-10-11", rationale: "High operational impact." },
        healthOverride: null,
        ownerId: "ppl_marcus", sponsorId: "ppl_elena", execSponsorId: "ppl_dana", contributorIds: [],
        nextAction: { text: "Closed", ownerId: null, dueOn: null, kind: "done" },
        requirements: [
          req("physician_governance", "approved", { responsibleId: "ppl_dana", decidedOn: "2026-04-11", rationale: "Approved — practice change with clear operational upside." }),
          req("senior_director", "approved", { responsibleId: "ppl_dana", decidedOn: "2026-04-05", rationale: "No capital ask, staffing model only." }),
        ],
        milestones: [{ id: "ms_cath_1", title: "New shift model live", dueOn: "2026-06-01", done: true, doneOn: "2026-06-01" }],
        risks: [], dependencies: [],
        estimates: { capital: 0, fte: 0, crossesServiceLines: false },
        intakeAnswers: { needsSupplies: "no", needsSoftware: false, newProcedure: false, timing: "this_fiscal_year" },
        submittedBy: { name: "Marcus Ibe", email: "marcus.ibe@example.org", personId: "ppl_marcus" },
        submittedOn: "2026-03-10",
        history: [
          hist("2026-03-10", "ppl_marcus", "created", "Submitted via intake."),
          hist("2026-03-12", "ppl_marcus", "triaged", "Accepted into evaluation.", "", { from: "proposed", to: "evaluating" }),
          hist("2026-04-11", "ppl_dana", "decision", "Physician Governance Committee — April: approved."),
          hist("2026-06-01", "ppl_marcus", "update", "New shift model went live on schedule."),
          hist("2026-06-15", "ppl_marcus", "outcome", "Closed with outcome recorded."),
        ],
        outcome: {
          summary: "Moved from fixed 3-shift staffing to a demand-based rotation across the cath lab.",
          measuredHow: "Overtime hours and case start delays, 8 weeks pre/post.",
          result: "Overtime hours down 34% aggregate; on-time case starts up from 71% to 89%.",
          lessons: "Earlier nurse input on rotation design would have shortened the ramp-up period.",
          benefitFollowUpOn: null, closedById: "ppl_marcus",
        },
        closedOn: "2026-06-15", snoozes: [], demo: true,
      },
      {
        id: "ini_bariatric_expansion", ref: "TL-2026-010",
        title: "Elective bariatric surgery program expansion",
        problem: "Current bariatric program is capacity-constrained; referrals are being redirected to other facilities.",
        type: "new_service", track: "governance", departments: ["dept_or"], size: "L",
        stage: "declined", stageEnteredOn: "2026-07-20",
        priority: { band: "unranked", rank: null, setOn: null, setBy: null, holdsUntil: null, rationale: "" },
        healthOverride: null,
        ownerId: "ppl_priya", sponsorId: "ppl_james", execSponsorId: null, contributorIds: [],
        nextAction: { text: "Declined", ownerId: null, dueOn: null, kind: "done" },
        requirements: [req("physician_governance", "declined", { responsibleId: "ppl_dana", decidedOn: "2026-07-20", rationale: "Declined — facility lacks post-op capacity to support expansion this cycle; revisit after hybrid OR project completes." })],
        milestones: [], risks: [], dependencies: [],
        estimates: { capital: 900000, fte: 1.5, crossesServiceLines: false },
        intakeAnswers: { needsSupplies: "yes", needsSoftware: false, newProcedure: true, timing: "next_fiscal_year" },
        submittedBy: { name: "Priya Anand", email: "priya.anand@example.org", personId: "ppl_priya" },
        submittedOn: "2026-06-20",
        history: [
          hist("2026-06-20", "ppl_priya", "created", "Submitted via intake."),
          hist("2026-06-22", "ppl_priya", "triaged", "Accepted into evaluation.", "", { from: "proposed", to: "evaluating" }),
          hist("2026-07-20", "ppl_dana", "decision", "Declined — facility lacks post-op capacity to support expansion this cycle; revisit after hybrid OR project completes.", "", { from: "evaluating", to: "declined" }),
        ],
        outcome: null, closedOn: "2026-07-20", snoozes: [], demo: true,
      },
    ];

    const meetings = [
      {
        id: "mtg_aug", title: "Physician Governance Committee — August", on: "2026-08-08", status: "closed",
        agenda: {
          slate: ["ini_pci_discharge", "ini_adc_refresh"],
          scores: {
            ini_pci_discharge: { patientImpact: 5, accessVolume: 4, financialCase: 3, effort: 3 },
            ini_adc_refresh: { patientImpact: 4, accessVolume: 2, financialCase: 3, effort: 2 },
          },
          decisions: ["ini_pci_discharge", "ini_adc_refresh"],
          completions: [],
        },
        decisions: [
          { id: "dec_aug_1", initiativeId: "ini_pci_discharge", outcome: "approved", rationale: "Strong clinical case, low risk.", dissent: "", recordedById: "ppl_dana", recordedOn: "2026-08-08" },
          { id: "dec_aug_2", initiativeId: "ini_adc_refresh", outcome: "approved", rationale: "Committed as a safety item.", dissent: "", recordedById: "ppl_dana", recordedOn: "2026-08-08" },
        ],
        demo: true,
      },
      {
        id: "mtg_sep", title: "Physician Governance Committee — September", on: "2026-09-30", status: "draft",
        agenda: { slate: ["ini_or_block_time", "ini_hybrid_or"], scores: {}, decisions: [], completions: [] },
        decisions: [], demo: true,
      },
    ];

    const actions = [
      { id: "act_insulin_pharmacy", text: "Confirm updated insulin titration ranges with Pharmacy", ownerId: "ppl_tom", dueOn: "2026-09-11", status: "open", initiativeId: "ini_insulin_protocol", demo: true },
      { id: "act_hybrid_finance", text: "Send hybrid OR business case to Finance for capital review", ownerId: "ppl_priya", dueOn: "2026-09-26", status: "open", initiativeId: "ini_hybrid_or", demo: true },
      { id: "act_charter_refresh", text: "Draft governance committee charter refresh for FY27", ownerId: "ppl_dana", dueOn: "2026-09-14", status: "open", initiativeId: null, demo: true },
    ];

    return { people, initiatives, meetings, actions, config: [config] };
  }

  return { build };
})();
