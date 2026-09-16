/* ===================================================================
   Throughline — js/model.js
   Enums, requirement rule engine, derivations (readiness/health),
   attention generators. Pure functions — no DOM, no I/O.
   =================================================================== */

const Model = (() => {

  const STAGES = ["proposed", "evaluating", "prioritized", "clearing", "in_flight", "closing", "closed", "declined", "deferred"];
  const STAGE_LABEL = {
    proposed: "Proposed", evaluating: "Evaluating", prioritized: "Prioritized",
    clearing: "Clearing requirements", in_flight: "In flight", closing: "Closing",
    closed: "Closed", declined: "Declined", deferred: "Deferred",
  };
  const TYPE_LABEL = {
    new_service: "New service", quality_improvement: "Quality improvement",
    process_improvement: "Process improvement", capital_construction: "Capital / construction",
    practice_change: "Practice change", departmental: "Departmental", other: "Other",
  };
  const TRACK_LABEL = { governance: "Governance", departmental: "Departmental", org_led: "Org-led", capital: "Capital" };
  const REQ_LABEL = {
    physician_governance: "Physician Governance Committee",
    senior_director: "Senior director sign-off",
    value_analysis: "Value Analysis",
    it_pmo: "IT PMO",
    capital: "Capital Committee",
    privileging: "Privileging",
    facilities_construction: "Facilities & Construction",
    infection_prevention: "Infection Prevention",
    pharmacy: "Pharmacy",
    regulatory_accreditation: "Regulatory / Accreditation",
    other: "Other",
  };
  const REQ_STATUS_LABEL = {
    not_started: "Not started", in_review: "In review", awaiting_decision: "Awaiting decision",
    approved: "Approved", declined: "Declined", exempt: "Exempt", not_required: "Not required", blocked: "Blocked",
  };

  const DEFAULT_RULES = {
    seniorDirectorCapitalThreshold: 250000,
  };
  const DEFAULT_ATTENTION = { staleUpdateDays: 21, staleRequirementDays: 14, triageTargetDays: 3, milestoneWarnDays: 7 };

  function today() { return UI.todayStr(); }

  // ---------------- Requirement rule engine (§5) ----------------
  // Returns array of { key, because, becauseCode, responsibleRole }
  function computeApplicableRequirements(ini, config) {
    const out = [];
    const est = ini.estimates || {};
    const intake = ini.intakeAnswers || {};
    const size = ini.size;
    const track = ini.track;

    // physician_governance
    let pgApplies = (ini.type === "new_service" || ini.type === "practice_change" || size === "L" || (est.capital || 0) > 0);
    if (track === "org_led") pgApplies = false;
    if (track === "departmental" && (size === "S" || size === "M")) pgApplies = false;
    if (pgApplies) {
      out.push({
        key: "physician_governance",
        because: "Physician Governance reviews this because it's a new service, practice change, a large initiative, or carries capital.",
        becauseCode: "pg_default", responsibleRole: "director",
      });
    }

    // senior_director
    const sdThreshold = (config && config.rules && config.rules.seniorDirectorCapitalThreshold) || DEFAULT_RULES.seniorDirectorCapitalThreshold;
    const sdApplies = (
      ini.type === "new_service" ||
      (est.capital || 0) >= sdThreshold ||
      !!est.crossesServiceLines ||
      size === "L" ||
      (est.fte || 0) > 0
    );
    if (sdApplies) {
      let because = "A senior director signs off because ";
      if (ini.type === "new_service") because += "this is a new clinical service.";
      else if ((est.capital || 0) >= sdThreshold) because += `capital is at or above $${sdThreshold.toLocaleString()}.`;
      else if (est.crossesServiceLines) because += "it crosses service lines.";
      else if (size === "L") because += "it's sized Large.";
      else because += "it adds dedicated FTE.";
      out.push({ key: "senior_director", because, becauseCode: "sd_default", responsibleRole: "senior_director" });
    }

    // value_analysis
    if (intake.needsSupplies !== "no") {
      out.push({
        key: "value_analysis",
        because: intake.needsSupplies === "unsure" ? "You weren't sure about supplies, so Value Analysis needs to weigh in." : "This needs new supplies or devices.",
        becauseCode: "supplies_unknown", responsibleRole: "owner",
      });
    }

    // it_pmo
    if (intake.needsSoftware === true) {
      out.push({ key: "it_pmo", because: "This needs new software or a system interface.", becauseCode: "software_needed", responsibleRole: "owner" });
    }

    // capital
    if ((est.capital || 0) > 0) {
      out.push({ key: "capital", because: "This initiative requests capital funding.", becauseCode: "capital_requested", responsibleRole: "director" });
    }

    // privileging
    if (ini.type === "new_service" && intake.newProcedure) {
      out.push({ key: "privileging", because: "It introduces a new procedure requiring privileging.", becauseCode: "new_procedure", responsibleRole: "owner" });
    }

    // facilities_construction
    if (ini.type === "capital_construction") {
      out.push({ key: "facilities_construction", because: "This is a facilities / construction project.", becauseCode: "construction", responsibleRole: "owner" });
    }

    return out;
  }

  // Reconcile computed applicability with existing requirements array,
  // preserving status/history for ones already tracked; muting ones no
  // longer applicable (never deleting).
  function reconcileRequirements(ini, config) {
    const applicable = computeApplicableRequirements(ini, config);
    const applicableKeys = new Set(applicable.map(a => a.key));
    const existing = (ini.requirements || []).slice();
    const existingByKey = new Map(existing.filter(r => !r.addedManually).map(r => [r.key, r]));

    const result = [];
    // keep manually-added requirements as-is
    for (const r of existing) {
      if (r.addedManually) result.push(r);
    }
    for (const a of applicable) {
      const cur = existingByKey.get(a.key);
      if (cur) {
        result.push({ ...cur, because: a.because, becauseCode: a.becauseCode });
      } else {
        result.push({
          key: a.key, status: "not_started",
          responsibleId: null, externalContact: "", submittedOn: null, decidedOn: null,
          lastCheckedOn: null, because: a.because, becauseCode: a.becauseCode, rationale: "", addedManually: false,
        });
      }
    }
    // requirements that no longer apply: mute
    for (const r of existing) {
      if (r.addedManually) continue;
      if (!applicableKeys.has(r.key) && r.status !== "not_required") {
        result.push({ ...r, status: "not_required" });
      } else if (!applicableKeys.has(r.key)) {
        result.push(r);
      }
    }
    // de-dupe by key (manual entries use their own key namespace already)
    const seen = new Set();
    return result.filter(r => {
      const k = r.addedManually ? `m:${r.key}:${r.rationale}` : r.key;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  // ---------------- Readiness (§4) ----------------
  function readiness(ini) {
    const reqs = ini.requirements || [];
    const blocking = reqs.filter(r => r.status === "blocked");
    if (blocking.length) return { value: "blocked", keys: blocking.map(r => r.key) };
    const notReady = reqs.filter(r => !["approved", "exempt", "not_required"].includes(r.status));
    if (notReady.length) return { value: "not_ready", keys: notReady.map(r => r.key) };
    return { value: "ready", keys: [] };
  }

  // ---------------- Health (§4) ----------------
  function health(ini, todayStr, config) {
    todayStr = todayStr || today();
    if (["closed", "declined", "deferred"].includes(ini.stage)) return null;

    if (ini.healthOverride && (!ini.healthOverride.expiresOn || ini.healthOverride.expiresOn >= todayStr)) {
      return { value: ini.healthOverride.value, override: true, reason: ini.healthOverride.reason, setBy: ini.healthOverride.setBy, setOn: ini.healthOverride.setOn };
    }

    const attnCfg = (config && config.attention) || DEFAULT_ATTENTION;
    const hist = ini.history || [];
    const updates = hist.filter(h => h.kind === "update");
    const lastUpdate = updates.length ? updates[updates.length - 1] : null;
    const daysSinceUpdate = lastUpdate ? UI.daysBetween(lastUpdate.on.slice(0, 10), todayStr) : UI.daysBetween(ini.submittedOn || todayStr, todayStr);

    if (daysSinceUpdate > attnCfg.staleUpdateDays) return { value: "stalled" };

    const r = readiness(ini);
    if (r.value === "blocked") return { value: "at_risk" };

    const overdueMilestone = (ini.milestones || []).some(m => !m.done && m.dueOn && m.dueOn < todayStr);
    if (overdueMilestone) return { value: "at_risk" };

    if (ini.nextAction && ini.nextAction.dueOn && ini.nextAction.dueOn < todayStr) return { value: "at_risk" };

    const soonMilestone = (ini.milestones || []).some(m => !m.done && m.dueOn && UI.daysBetween(todayStr, m.dueOn) <= attnCfg.milestoneWarnDays && UI.daysBetween(todayStr, m.dueOn) >= 0);
    const staleReq = (ini.requirements || []).some(r2 => r2.status === "in_review" && r2.lastCheckedOn && UI.daysBetween(r2.lastCheckedOn, todayStr) > attnCfg.staleRequirementDays);
    if (soonMilestone || staleReq) return { value: "attention" };

    return { value: "on_track" };
  }

  // ---------------- Stage gate rules ----------------
  function canAdvance(ini, toStage) {
    switch (toStage) {
      case "evaluating":
        if (!ini.ownerId) return { ok: false, reason: "Assign an owner before moving to Evaluating." };
        if (!ini.type) return { ok: false, reason: "Set the initiative type before moving to Evaluating." };
        return { ok: true };
      case "prioritized":
        if (!ini.size) return { ok: false, reason: "Set a T-shirt size before moving to Prioritized." };
        if (!(ini.requirements || []).length) return { ok: false, reason: "Generate the requirements list before moving to Prioritized." };
        return { ok: true };
      case "clearing":
        if (!(ini.requirements || []).some(r => r.status !== "not_required")) {
          return { ok: false, reason: "At least one applicable requirement is needed before Clearing." };
        }
        return { ok: true };
      case "in_flight": {
        const r = readiness(ini);
        if (r.value !== "ready" && !ini.readinessOverride) {
          return { ok: false, reason: "Readiness must be Ready before In flight — or record a director override with a reason.", needsOverride: true };
        }
        return { ok: true };
      }
      case "closing":
        if (ini.nextAction && ini.nextAction.text && ini.nextAction.kind !== "done") {
          return { ok: false, reason: "Clear or complete the next action before Closing." };
        }
        return { ok: true };
      case "closed":
        if (!ini.outcome) return { ok: false, reason: "Record an outcome before Closing." };
        return { ok: true };
      default:
        return { ok: true };
    }
  }

  // ---------------- Attention engine (§6) ----------------
  const BUCKET_ORDER = ["decide", "unblock", "respond", "confirm", "overdue"];
  const BUCKET_LABEL = { decide: "Decide", unblock: "Unblock", respond: "Respond", confirm: "Confirm", overdue: "Overdue" };

  function isMuted(ini, ruleKey, todayStr) {
    return (ini.snoozes || []).some(s => s.rule === ruleKey && s.untilOn >= todayStr);
  }

  function attention(state, personId, todayStr) {
    todayStr = todayStr || today();
    const person = state.people.find(p => p.id === personId);
    if (!person) return [];
    const items = [];
    const attnCfg = (state.config && state.config.attention) || DEFAULT_ATTENTION;
    const myDepts = new Set(person.departments || []);
    const isDirectorLike = ["director", "senior_director", "peer_director"].includes(person.role);

    for (const ini of state.initiatives) {
      if (["closed", "declined", "deferred"].includes(ini.stage) && ini.stage !== "closing") {
        // still allow confirm_outcome via closing; skip fully archived
      }
      const inMyDept = (ini.departments || []).some(d => myDepts.has(d));
      const h = health(ini, todayStr, state.config);

      // awaiting_your_decision — requirement awaiting_decision matching viewer role
      for (const req of ini.requirements || []) {
        if (req.status === "awaiting_decision") {
          const applicable = computeApplicableRequirements(ini, state.config).find(a => a.key === req.key);
          const role = applicable ? applicable.responsibleRole : null;
          const matches = role === person.role || (role === "director" && person.role === "director" && inMyDept) || (role === "senior_director" && person.role === "senior_director");
          if (matches && !isMuted(ini, "awaiting_your_decision:" + req.key, todayStr)) {
            const waitingDays = req.submittedOn ? UI.daysBetween(req.submittedOn, todayStr) : 0;
            items.push({
              bucket: "decide", initiativeId: ini.id,
              why: `${REQ_LABEL[req.key] || req.key} won't move until you decide · waiting ${waitingDays} days`,
              waitingDays, ownerId: req.responsibleId, actionLabel: "Decide", route: `#/i/${ini.id}`, ruleKey: "awaiting_your_decision:" + req.key,
            });
          }
        }
      }

      // triage_queue
      if (ini.stage === "proposed" && person.role === "director" && inMyDept) {
        const waitingDays = UI.daysBetween(ini.submittedOn, todayStr);
        if (!isMuted(ini, "triage_queue", todayStr)) {
          items.push({
            bucket: "decide", initiativeId: ini.id,
            why: `Submitted ${waitingDays} days ago — target is ${attnCfg.triageTargetDays} business days`,
            waitingDays, ownerId: person.id, actionLabel: "Triage", route: `#/triage`, ruleKey: "triage_queue",
          });
        }
      }

      // blocker_unowned / blocker_stale
      for (const req of ini.requirements || []) {
        if ((req.status === "blocked" || req.status === "in_review") && !req.responsibleId) {
          if (!isMuted(ini, "blocker_unowned:" + req.key, todayStr) && (person.role !== "contributor")) {
            items.push({
              bucket: "unblock", initiativeId: ini.id,
              why: `Blocked · ${REQ_LABEL[req.key] || req.key} has no named owner — nobody can move it`,
              waitingDays: 0, ownerId: null, actionLabel: "Assign owner", route: `#/i/${ini.id}`, ruleKey: "blocker_unowned:" + req.key,
            });
          }
        }
        if (req.status === "in_review" && req.lastCheckedOn && UI.daysBetween(req.lastCheckedOn, todayStr) > attnCfg.staleRequirementDays) {
          if (req.responsibleId === person.id || (isDirectorLike && inMyDept)) {
            if (!isMuted(ini, "blocker_stale:" + req.key, todayStr)) {
              items.push({
                bucket: "unblock", initiativeId: ini.id,
                why: `No one has checked with ${req.externalContact || (REQ_LABEL[req.key] || req.key)} in ${UI.daysBetween(req.lastCheckedOn, todayStr)} days`,
                waitingDays: UI.daysBetween(req.lastCheckedOn, todayStr), ownerId: req.responsibleId, actionLabel: "Check in", route: `#/i/${ini.id}`, ruleKey: "blocker_stale:" + req.key,
              });
            }
          }
        }
      }

      // stale_update
      if (h && h.value === "stalled" && (ini.ownerId === person.id || (isDirectorLike && inMyDept))) {
        if (!isMuted(ini, "stale_update", todayStr)) {
          const hist = ini.history || [];
          const updates = hist.filter(x => x.kind === "update");
          const last = updates.length ? updates[updates.length - 1] : null;
          const days = last ? UI.daysBetween(last.on.slice(0, 10), todayStr) : UI.daysBetween(ini.submittedOn, todayStr);
          const nextMs = (ini.milestones || []).filter(m => !m.done && m.dueOn).sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0];
          items.push({
            bucket: "unblock", initiativeId: ini.id,
            why: `Going quiet · no update in ${days} days${nextMs ? `, next milestone due ${UI.fmtDate(nextMs.dueOn)}` : ""}`,
            waitingDays: days, ownerId: ini.ownerId, actionLabel: "Post update", route: `#/i/${ini.id}`, ruleKey: "stale_update",
          });
        }
      }

      // milestone_slipping
      for (const m of ini.milestones || []) {
        if (!m.done && m.dueOn && m.dueOn < todayStr) {
          if ((ini.ownerId === person.id || (isDirectorLike && inMyDept)) && !isMuted(ini, "milestone_slipping:" + m.id, todayStr)) {
            items.push({
              bucket: "unblock", initiativeId: ini.id,
              why: `Milestone was due ${UI.fmtDate(m.dueOn)} and isn't marked done`,
              waitingDays: UI.daysBetween(m.dueOn, todayStr), ownerId: ini.ownerId, actionLabel: "Update", route: `#/i/${ini.id}`, ruleKey: "milestone_slipping:" + m.id,
            });
          }
        }
      }

      // question_for_you
      const hist = ini.history || [];
      for (let i = hist.length - 1; i >= 0; i--) {
        const h2 = hist[i];
        if (h2.kind === "question" && (h2.meta || {}).forId === person.id) {
          const answered = hist.some(x => x.kind === "answer" && x.on > h2.on);
          if (!answered && !isMuted(ini, "question_for_you:" + h2.id, todayStr)) {
            items.push({
              bucket: "respond", initiativeId: ini.id,
              why: `${h2.summary} · ${UI.daysBetween(h2.on.slice(0, 10), todayStr)} days`,
              waitingDays: UI.daysBetween(h2.on.slice(0, 10), todayStr), ownerId: person.id, actionLabel: "Answer", route: `#/i/${ini.id}`, ruleKey: "question_for_you:" + h2.id,
            });
          }
          break;
        }
      }

      // external_commitment
      if (ini.track === "org_led" && ini.nextAction && ini.nextAction.kind === "waiting_external" && ini.nextAction.dueOn) {
        const daysUntil = UI.daysBetween(todayStr, ini.nextAction.dueOn);
        if (daysUntil <= 7 && daysUntil >= 0 && (ini.ownerId === person.id || (isDirectorLike && inMyDept)) && !isMuted(ini, "external_commitment", todayStr)) {
          items.push({
            bucket: "respond", initiativeId: ini.id,
            why: `${ini.nextAction.text} · ${daysUntil} days`,
            waitingDays: -daysUntil, ownerId: ini.ownerId, actionLabel: "View", route: `#/i/${ini.id}`, ruleKey: "external_commitment",
          });
        }
      }

      // confirm_outcome
      if (ini.stage === "closing" && !ini.outcome && (ini.ownerId === person.id || (isDirectorLike && inMyDept)) && !isMuted(ini, "confirm_outcome", todayStr)) {
        items.push({
          bucket: "confirm", initiativeId: ini.id,
          why: `Marked complete — confirm the outcome and close it`,
          waitingDays: UI.daysBetween(ini.stageEnteredOn || ini.submittedOn, todayStr), ownerId: ini.ownerId, actionLabel: "Confirm outcome", route: `#/i/${ini.id}`, ruleKey: "confirm_outcome",
        });
      }

      // benefit follow-up past due (surfaces under confirm too, per §8 archive note)
      if (ini.outcome && ini.outcome.benefitFollowUpOn && ini.outcome.benefitFollowUpOn < todayStr && (ini.ownerId === person.id || (isDirectorLike && inMyDept)) && !isMuted(ini, "benefit_followup", todayStr)) {
        items.push({
          bucket: "confirm", initiativeId: ini.id,
          why: `Benefit follow-up was due ${UI.fmtDate(ini.outcome.benefitFollowUpOn)}`,
          waitingDays: UI.daysBetween(ini.outcome.benefitFollowUpOn, todayStr), ownerId: ini.ownerId, actionLabel: "Review", route: `#/i/${ini.id}`, ruleKey: "benefit_followup",
        });
      }
    }

    // action_overdue
    for (const act of state.actions || []) {
      if (act.status === "open" && act.ownerId === person.id && act.dueOn && act.dueOn < todayStr) {
        items.push({
          bucket: "overdue", initiativeId: act.initiativeId, why: `${act.text} · ${UI.daysBetween(act.dueOn, todayStr)} days overdue`,
          waitingDays: UI.daysBetween(act.dueOn, todayStr), ownerId: person.id, actionLabel: "Complete", route: act.initiativeId ? `#/i/${act.initiativeId}` : "#/reviews", ruleKey: "action_overdue:" + act.id,
        });
      }
    }

    items.sort((a, b) => b.waitingDays - a.waitingDays);
    return items;
  }

  function mutedItems(state, personId, todayStr) {
    todayStr = todayStr || today();
    const out = [];
    for (const ini of state.initiatives) {
      for (const s of ini.snoozes || []) {
        if (s.untilOn >= todayStr) out.push({ initiativeId: ini.id, rule: s.rule, reason: s.reason, untilOn: s.untilOn });
      }
    }
    return out;
  }

  return {
    STAGES, STAGE_LABEL, TYPE_LABEL, TRACK_LABEL, REQ_LABEL, REQ_STATUS_LABEL,
    DEFAULT_RULES, DEFAULT_ATTENTION,
    computeApplicableRequirements, reconcileRequirements,
    readiness, health, canAdvance,
    BUCKET_ORDER, BUCKET_LABEL, attention, mutedItems, isMuted,
    today,
  };
})();
