/* Throughline — js/views/initiative.js
   Screen 3: full initiative record (§8 #3). */
window.Views = window.Views || {};
window.Views.initiative = (() => {

  function personName(S, id) { const p = S.people.find(x => x.id === id); return p ? p.name : null; }

  function cloneIni(ini) { return JSON.parse(JSON.stringify(ini)); }

  async function saveIni(ini, actions) {
    await Store.put("initiatives", ini.id, ini);
  }

  function pushHistory(ini, entry) {
    ini.history = (ini.history || []).slice();
    ini.history.push(Object.assign({ id: Store.newId("ev_"), on: new Date().toISOString() }, entry));
  }

  function healthLabel(h) {
    if (!h) return "—";
    return { on_track: "On track", attention: "Needs attention", at_risk: "At risk", stalled: "Stalled" }[h.value];
  }
  function readinessLabel(r) {
    return { ready: "Ready", not_ready: "Not ready", blocked: "Blocked" }[r.value];
  }

  function statusRow(S, ini) {
    const p = ini.priority || {};
    const priorityValue = p.band === "committee" ? `#${p.rank}` : p.band === "committed" ? "Committed" : p.band === "watchlist" ? "Watchlist" : "Unranked";
    const priorityLapsed = p.holdsUntil && p.holdsUntil < UI.todayStr();
    const r = Model.readiness(ini);
    const h = Model.health(ini, null, S.config);

    const readinessSub = r.value === "ready" ? "All requirements clear" :
      r.keys.map(k => Model.REQ_LABEL[k] || k).join(", ");

    const healthSub = h && h.override ? `Override: ${h.reason}` : (h && h.value === "stalled" ? "No update recently" : "");

    return UI.el("div", { class: "status-row" }, [
      UI.statusBox("Stage", Model.STAGE_LABEL[ini.stage], `Since ${UI.fmtDate(ini.stageEnteredOn)}`),
      UI.statusBox("Priority", priorityValue, priorityLapsed ? `Lapsed ${UI.fmtDate(p.holdsUntil)}` : (p.holdsUntil ? `Holds until ${UI.fmtDate(p.holdsUntil)}` : "")),
      UI.statusBox("Readiness", readinessLabel(r), readinessSub),
      UI.statusBox("Health", healthLabel(h), healthSub),
    ]);
  }

  function nextActionBanner(S, ini, actions, rerender) {
    const na = ini.nextAction || {};
    if (!na.text) {
      return UI.card([UI.el("div", { class: "text-body muted" }, "No next action set.")], { class: "raised" });
    }
    const owner = S.people.find(p => p.id === na.ownerId);
    const overdue = na.dueOn && na.dueOn < UI.todayStr();
    return UI.card([
      UI.el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" } }, [
        UI.el("div", {}, [
          UI.el("div", { class: "mono-label" }, "Next action"),
          UI.el("div", { class: "text-card", style: { marginTop: "3px" } }, na.text),
          UI.el("div", { class: "text-meta", style: { marginTop: "3px" } }, [
            owner ? `${owner.name} · ` : "Unassigned · ",
            na.dueOn ? UI.fmtDate(na.dueOn) : "no date",
            overdue ? " · overdue" : "",
          ].join("")),
        ]),
        UI.button("Edit", { sm: true, onClick: () => openNextActionModal(S, ini, actions) }),
      ]),
    ], { class: "raised" });
  }

  function openNextActionModal(S, ini, actions) {
    const na = ini.nextAction || {};
    const textInput = UI.textArea({ value: na.text || "" });
    const ownerSel = UI.select([{ value: "", label: "Unassigned" }, ...S.people.map(p => ({ value: p.id, label: p.name }))], { value: na.ownerId || "" });
    const dueInput = UI.textInput({ type: "date", value: na.dueOn || "" });
    const kindSel = UI.select([
      { value: "task", label: "Task" }, { value: "decision", label: "Decision" }, { value: "waiting_external", label: "Waiting on external" }, { value: "done", label: "Done / cleared" },
    ], { value: na.kind || "task" });

    const m = UI.modal({
      title: "Edit next action",
      body: UI.el("div", { class: "card-stack" }, [
        UI.field("What's next", textInput),
        UI.field("Owner", ownerSel),
        UI.field("Due", dueInput),
        UI.field("Kind", kindSel),
      ]),
      footer: [
        UI.button("Cancel", { variant: "ghost", onClick: () => m.close() }),
        UI.button("Save", { variant: "primary", onClick: async () => {
          const fresh = cloneIni(ini);
          fresh.nextAction = { text: textInput.value.trim(), ownerId: ownerSel.value || null, dueOn: dueInput.value || null, kind: kindSel.value };
          await saveIni(fresh, actions);
          m.close();
        }}),
      ],
    });
  }

  function reqStatusOptions() {
    return Object.entries(Model.REQ_STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }));
  }

  function requirementsSection(S, ini, actions) {
    const reqs = ini.requirements || [];
    const rows = reqs.map(req => {
      const responsible = S.people.find(p => p.id === req.responsibleId);
      const tint = { approved: "beacon", exempt: "beacon", not_required: "neutral", declined: "ember", blocked: "ember", awaiting_decision: "amber", in_review: "amber", not_started: "neutral" }[req.status] || "neutral";
      return UI.el("div", { class: "card", style: { opacity: req.status === "not_required" ? ".55" : "1" } }, [
        UI.el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", flexWrap: "wrap" } }, [
          UI.el("div", {}, [
            UI.el("div", { style: { display: "flex", gap: "8px", alignItems: "center" } }, [
              UI.el("span", { class: "text-card" }, Model.REQ_LABEL[req.key] || req.key),
              UI.chip(Model.REQ_STATUS_LABEL[req.status], tint),
            ]),
            UI.el("div", { class: "text-meta", style: { marginTop: "4px" } }, req.because || ""),
            responsible ? UI.el("div", { class: "text-meta", style: { marginTop: "4px" } }, `Responsible: ${responsible.name}`) : (req.externalContact ? UI.el("div", { class: "text-meta", style: { marginTop: "4px" } }, req.externalContact) : null),
            req.lastCheckedOn ? UI.el("div", { class: "faint", style: { marginTop: "2px" } }, `Last checked ${UI.fmtDate(req.lastCheckedOn)}`) : null,
            req.rationale ? UI.el("div", { class: "text-body", style: { marginTop: "6px", borderLeft: "2px solid var(--hairline-2)", paddingLeft: "8px" } }, req.rationale) : null,
          ]),
          UI.button("Update", { sm: true, onClick: () => openRequirementModal(S, ini, req, actions) }),
        ]),
      ]);
    });
    if (!rows.length) rows.push(UI.emptyState("No requirements yet", "Requirements generate automatically once type, size and intake answers are set."));
    return UI.card([
      UI.el("div", { class: "card-header" }, [
        UI.el("div", { class: "text-section" }, "Requirements & approvals"),
        UI.button("Add manual requirement", { sm: true, variant: "ghost", onClick: () => openManualRequirementModal(S, ini, actions) }),
      ]),
      UI.el("div", { class: "card-stack" }, rows),
    ]);
  }

  function openRequirementModal(S, ini, req, actions) {
    const statusSel = UI.select(reqStatusOptions(), { value: req.status });
    const respSel = UI.select([{ value: "", label: "Unassigned" }, ...S.people.map(p => ({ value: p.id, label: p.name }))], { value: req.responsibleId || "" });
    const contactInput = UI.textInput({ value: req.externalContact || "", placeholder: "External contact (optional)" });
    const lastCheckedInput = UI.textInput({ type: "date", value: req.lastCheckedOn || "" });
    const rationaleInput = UI.textArea({ value: req.rationale || "", placeholder: "Required for Approved, Declined, or Exempt." });

    const m = UI.modal({
      title: Model.REQ_LABEL[req.key] || req.key,
      body: UI.el("div", { class: "card-stack" }, [
        UI.field("Status", statusSel),
        UI.field("Responsible", respSel),
        UI.field("External contact", contactInput),
        UI.field("Last checked", lastCheckedInput),
        UI.field("Rationale", rationaleInput, "Required when marking Approved, Declined or Exempt."),
      ]),
      footer: [
        UI.button("Cancel", { variant: "ghost", onClick: () => m.close() }),
        UI.button("Save", { variant: "primary", onClick: async () => {
          const needsRationale = ["approved", "declined", "exempt"].includes(statusSel.value);
          if (needsRationale && !rationaleInput.value.trim()) {
            UI.toast("A rationale is required for that status.");
            return;
          }
          const fresh = cloneIni(ini);
          const idx = fresh.requirements.findIndex(r => r.key === req.key && r.addedManually === req.addedManually);
          const wasStatus = fresh.requirements[idx].status;
          fresh.requirements[idx] = {
            ...fresh.requirements[idx],
            status: statusSel.value, responsibleId: respSel.value || null, externalContact: contactInput.value.trim(),
            lastCheckedOn: lastCheckedInput.value || null, rationale: rationaleInput.value.trim(),
            decidedOn: ["approved", "declined", "exempt"].includes(statusSel.value) ? UI.todayStr() : fresh.requirements[idx].decidedOn,
            submittedOn: fresh.requirements[idx].submittedOn || (statusSel.value !== "not_started" ? UI.todayStr() : null),
          };
          if (wasStatus !== statusSel.value) {
            pushHistory(fresh, { byId: S.me, kind: "requirement_change", summary: `${Model.REQ_LABEL[req.key] || req.key} moved to ${Model.REQ_STATUS_LABEL[statusSel.value]}.`, detail: rationaleInput.value.trim() });
          }
          await saveIni(fresh, actions);
          m.close();
        }}),
      ],
    });
  }

  function openManualRequirementModal(S, ini, actions) {
    const keySel = UI.select([
      { value: "infection_prevention", label: "Infection Prevention" },
      { value: "pharmacy", label: "Pharmacy" },
      { value: "regulatory_accreditation", label: "Regulatory / Accreditation" },
      { value: "other", label: "Other" },
    ], {});
    const becauseInput = UI.textInput({ placeholder: "Why this applies" });
    const m = UI.modal({
      title: "Add a manual requirement",
      body: UI.el("div", { class: "card-stack" }, [UI.field("Requirement", keySel), UI.field("Why it applies", becauseInput)]),
      footer: [
        UI.button("Cancel", { variant: "ghost", onClick: () => m.close() }),
        UI.button("Add", { variant: "primary", onClick: async () => {
          const fresh = cloneIni(ini);
          fresh.requirements = fresh.requirements || [];
          fresh.requirements.push({ key: keySel.value, status: "not_started", responsibleId: null, externalContact: "", submittedOn: null, decidedOn: null, lastCheckedOn: null, because: becauseInput.value.trim() || "Added manually.", becauseCode: "manual", rationale: "", addedManually: true });
          pushHistory(fresh, { kind: "requirement_change", summary: `Added manual requirement: ${Model.REQ_LABEL[keySel.value]}.` });
          await saveIni(fresh, actions);
          m.close();
        }}),
      ],
    });
  }

  function milestonesSection(S, ini, actions) {
    const items = (ini.milestones || []).map(m => UI.el("div", { class: "card", style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" } }, [
      UI.el("div", {}, [
        UI.el("div", { class: "text-body", style: { fontWeight: 600, textDecoration: m.done ? "line-through" : "none", color: m.done ? "var(--text-2)" : "var(--text-1)" } }, m.title),
        UI.el("div", { class: "text-meta" }, m.done ? `Done ${UI.fmtDate(m.doneOn)}` : `Due ${UI.fmtDate(m.dueOn)}`),
      ]),
      UI.button(m.done ? "Reopen" : "Mark done", { sm: true, onClick: async () => {
        const fresh = cloneIni(ini);
        const idx = fresh.milestones.findIndex(x => x.id === m.id);
        fresh.milestones[idx].done = !fresh.milestones[idx].done;
        fresh.milestones[idx].doneOn = fresh.milestones[idx].done ? UI.todayStr() : null;
        pushHistory(fresh, { kind: "update", summary: `Milestone "${m.title}" marked ${fresh.milestones[idx].done ? "done" : "not done"}.` });
        await saveIni(fresh, actions);
      }}),
    ]));
    if (!items.length) items.push(UI.emptyState("No milestones yet"));
    return UI.card([
      UI.el("div", { class: "card-header" }, [
        UI.el("div", { class: "text-section" }, "Milestones"),
        UI.button("Add", { sm: true, variant: "ghost", onClick: () => openAddMilestoneModal(S, ini, actions) }),
      ]),
      UI.el("div", { class: "card-stack" }, items),
    ]);
  }

  function openAddMilestoneModal(S, ini, actions) {
    const titleInput = UI.textInput({ placeholder: "Milestone title" });
    const dueInput = UI.textInput({ type: "date" });
    const m = UI.modal({
      title: "Add milestone",
      body: UI.el("div", { class: "card-stack" }, [UI.field("Title", titleInput), UI.field("Due", dueInput)]),
      footer: [
        UI.button("Cancel", { variant: "ghost", onClick: () => m.close() }),
        UI.button("Add", { variant: "primary", onClick: async () => {
          if (!titleInput.value.trim()) { UI.toast("Give the milestone a title."); return; }
          const fresh = cloneIni(ini);
          fresh.milestones = fresh.milestones || [];
          fresh.milestones.push({ id: Store.newId("ms_"), title: titleInput.value.trim(), dueOn: dueInput.value || null, done: false, doneOn: null });
          await saveIni(fresh, actions);
          m.close();
        }}),
      ],
    });
  }

  function risksSection(S, ini, actions) {
    const risks = (ini.risks || []).map(r => UI.el("div", { class: "card" }, [
      UI.el("div", { style: { display: "flex", justifyContent: "space-between", gap: "8px" } }, [
        UI.chip(r.kind === "risk" ? "Risk" : "Issue", r.closedOn ? "neutral" : "amber"),
        r.closedOn ? UI.chip("Closed", "beacon") : UI.button("Close", { sm: true, variant: "ghost", onClick: async () => {
          const fresh = cloneIni(ini); const idx = fresh.risks.findIndex(x => x.id === r.id); fresh.risks[idx].closedOn = UI.todayStr(); await saveIni(fresh, actions);
        }}),
      ]),
      UI.el("div", { class: "text-body", style: { marginTop: "6px" } }, r.text),
      UI.el("div", { class: "faint", style: { marginTop: "4px" } }, `Opened ${UI.fmtDate(r.openedOn)}`),
    ]));
    const deps = (ini.dependencies || []).map(d => {
      const other = S.initiatives.find(i => i.id === d.initiativeId);
      const kindLabel = { depends_on: "Depends on", competes_with: "Competes with", blocks: "Blocks" }[d.kind];
      return UI.el("div", { class: "card", style: { cursor: other ? "pointer" : "default" }, onClick: other ? () => actions.navigate(`#/i/${other.id}`) : null }, [
        UI.el("div", { style: { display: "flex", gap: "8px", alignItems: "center" } }, [UI.chip(kindLabel, "steel"), UI.el("span", { class: "text-body", style: { fontWeight: 600 } }, other ? other.title : d.initiativeId)]),
        d.note ? UI.el("div", { class: "text-meta", style: { marginTop: "4px" } }, d.note) : null,
      ]);
    });
    const items = [...risks, ...deps];
    if (!items.length) items.push(UI.emptyState("No risks, issues or dependencies logged"));
    return UI.card([
      UI.el("div", { class: "card-header" }, [
        UI.el("div", { class: "text-section" }, "Risks, issues & dependencies"),
        UI.button("Add risk/issue", { sm: true, variant: "ghost", onClick: () => openAddRiskModal(S, ini, actions) }),
      ]),
      UI.el("div", { class: "card-stack" }, items),
    ]);
  }

  function openAddRiskModal(S, ini, actions) {
    const kindSel = UI.select([{ value: "risk", label: "Risk" }, { value: "issue", label: "Issue" }], {});
    const textInput = UI.textArea({ placeholder: "What's the risk or issue?" });
    const m = UI.modal({
      title: "Add risk or issue",
      body: UI.el("div", { class: "card-stack" }, [UI.field("Kind", kindSel), UI.field("Description", textInput)]),
      footer: [
        UI.button("Cancel", { variant: "ghost", onClick: () => m.close() }),
        UI.button("Add", { variant: "primary", onClick: async () => {
          if (!textInput.value.trim()) { UI.toast("Describe the risk or issue."); return; }
          const fresh = cloneIni(ini);
          fresh.risks = fresh.risks || [];
          fresh.risks.push({ id: Store.newId("rk_"), kind: kindSel.value, text: textInput.value.trim(), openedOn: UI.todayStr(), closedOn: null });
          await saveIni(fresh, actions);
          m.close();
        }}),
      ],
    });
  }

  const HIST_KIND_LABEL = {
    created: "Created", triaged: "Triaged", stage_change: "Stage change", priority_change: "Priority",
    requirement_change: "Requirement", decision: "Decision", update: "Update", outcome: "Outcome",
    note: "Note", question: "Question", answer: "Answer",
  };

  function historySection(S, ini, actions) {
    let filterKind = null;
    const wrap = UI.el("div");
    function draw() {
      UI.clear(wrap);
      const kinds = Array.from(new Set((ini.history || []).map(h => h.kind)));
      const filterBar = UI.el("div", { class: "filter-bar", style: { marginBottom: "10px" } }, [
        UI.el("div", { class: "saved-view-btn" + (!filterKind ? " active" : ""), onClick: () => { filterKind = null; draw(); } }, "All"),
        ...kinds.map(k => UI.el("div", { class: "saved-view-btn" + (filterKind === k ? " active" : ""), onClick: () => { filterKind = k; draw(); } }, HIST_KIND_LABEL[k] || k)),
      ]);
      wrap.appendChild(filterBar);
      const items = (ini.history || []).filter(h => !filterKind || h.kind === filterKind).slice().reverse();
      if (!items.length) { wrap.appendChild(UI.emptyState("No history yet")); return; }
      for (const h of items) {
        const by = personName(S, h.byId);
        wrap.appendChild(UI.el("div", { class: "hist-item" }, [
          UI.el("div", { class: "hdot" }),
          UI.el("div", { class: "hbody" }, [
            UI.el("div", { class: "hsummary" }, h.summary),
            h.detail ? UI.el("div", { class: "text-meta", style: { marginTop: "2px" } }, h.detail) : null,
            UI.el("div", { class: "hmeta" }, `${by ? by + " · " : ""}${UI.fmtDate(h.on.slice(0, 10), { year: true })}`),
          ]),
        ]));
      }
    }
    draw();
    return UI.card([UI.el("div", { class: "text-section", style: { marginBottom: "10px" } }, "Decisions & history"), wrap]);
  }

  function peopleCard(S, ini, actions) {
    const rows = [];
    const roleFields = [["Owner", "ownerId"], ["Sponsor", "sponsorId"], ["Exec sponsor", "execSponsorId"]];
    for (const [label, field] of roleFields) {
      const person = S.people.find(p => p.id === ini[field]);
      rows.push(UI.el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" } }, [
        UI.el("div", { class: "faint mono-label", style: { textTransform: "none", letterSpacing: 0, minWidth: "90px" } }, label),
        person ? UI.personRow(person, { hideTitle: true }) : UI.el("span", { class: "faint" }, "Unassigned"),
      ]));
    }
    if (ini.contributorIds && ini.contributorIds.length) {
      rows.push(UI.el("div", { class: "faint mono-label", style: { textTransform: "none", letterSpacing: 0, marginTop: "6px" } }, "Contributors"));
      for (const cid of ini.contributorIds) {
        const p = S.people.find(x => x.id === cid);
        if (p) rows.push(UI.personRow(p, { hideTitle: true }));
      }
    }
    return UI.card([
      UI.el("div", { class: "card-header" }, [UI.el("div", { class: "text-section" }, "People"), UI.button("Edit", { sm: true, variant: "ghost", onClick: () => openPeopleModal(S, ini, actions) })]),
      UI.el("div", { class: "card-stack" }, rows),
    ]);
  }

  function openPeopleModal(S, ini, actions) {
    const ownerSel = UI.select([{ value: "", label: "Unassigned" }, ...S.people.map(p => ({ value: p.id, label: p.name }))], { value: ini.ownerId || "" });
    const sponsorSel = UI.select([{ value: "", label: "None" }, ...S.people.map(p => ({ value: p.id, label: p.name }))], { value: ini.sponsorId || "" });
    const execSel = UI.select([{ value: "", label: "None" }, ...S.people.map(p => ({ value: p.id, label: p.name }))], { value: ini.execSponsorId || "" });
    const m = UI.modal({
      title: "Edit people",
      body: UI.el("div", { class: "card-stack" }, [UI.field("Owner", ownerSel), UI.field("Physician sponsor", sponsorSel), UI.field("Exec sponsor", execSel)]),
      footer: [
        UI.button("Cancel", { variant: "ghost", onClick: () => m.close() }),
        UI.button("Save", { variant: "primary", onClick: async () => {
          const fresh = cloneIni(ini);
          fresh.ownerId = ownerSel.value || null;
          fresh.sponsorId = sponsorSel.value || null;
          fresh.execSponsorId = execSel.value || null;
          await saveIni(fresh, actions);
          m.close();
        }}),
      ],
    });
  }

  function postUpdateCard(S, ini, actions) {
    const textArea = UI.textArea({ placeholder: "What changed since the last update?" });
    return UI.card([
      UI.el("div", { class: "text-section", style: { marginBottom: "8px" } }, "Post an update"),
      textArea,
      UI.el("div", { style: { display: "flex", justifyContent: "flex-end", marginTop: "8px" } }, [
        UI.button("Post", { variant: "primary", sm: true, onClick: async () => {
          if (!textArea.value.trim()) return;
          const fresh = cloneIni(ini);
          const person = S.people.find(p => p.id === S.me);
          pushHistory(fresh, { byId: S.me, kind: "update", summary: textArea.value.trim() });
          await saveIni(fresh, actions);
          textArea.value = "";
          UI.toast("Update posted.");
        }}),
      ]),
    ]);
  }

  function stageControls(S, ini, actions) {
    const idx = Model.STAGES.indexOf(ini.stage);
    const forwardStages = ["evaluating", "prioritized", "clearing", "in_flight", "closing", "closed"];
    const curForwardIdx = forwardStages.indexOf(ini.stage);
    const next = curForwardIdx >= 0 && curForwardIdx < forwardStages.length - 1 ? forwardStages[curForwardIdx + 1] : (ini.stage === "proposed" ? "evaluating" : null);
    if (!next) return null;
    const gate = Model.canAdvance(ini, next);
    return UI.el("div", { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } }, [
      UI.button(`Advance to ${Model.STAGE_LABEL[next]}`, { variant: "primary", sm: true, disabled: !gate.ok, onClick: async () => {
        const fresh = cloneIni(ini);
        fresh.stage = next;
        fresh.stageEnteredOn = UI.todayStr();
        pushHistory(fresh, { byId: S.me, kind: "stage_change", summary: `Moved to ${Model.STAGE_LABEL[next]}.`, meta: { from: ini.stage, to: next } });
        await saveIni(fresh, actions);
      }}),
      !gate.ok ? UI.el("span", { class: "text-meta" }, gate.reason) : null,
      ini.stage !== "declined" && ini.stage !== "deferred" && ini.stage !== "closed" ? UI.button("Decline", { sm: true, variant: "ghost", onClick: () => openDeclineModal(S, ini, actions, "declined") }) : null,
      ini.stage !== "declined" && ini.stage !== "deferred" && ini.stage !== "closed" ? UI.button("Defer", { sm: true, variant: "ghost", onClick: () => openDeclineModal(S, ini, actions, "deferred") }) : null,
    ]);
  }

  function openDeclineModal(S, ini, actions, toStage) {
    const reasonInput = UI.textArea({ placeholder: "Reason (required — kept in the archive)" });
    const m = UI.modal({
      title: toStage === "declined" ? "Decline this initiative" : "Defer this initiative",
      body: UI.field("Reason", reasonInput),
      footer: [
        UI.button("Cancel", { variant: "ghost", onClick: () => m.close() }),
        UI.button(toStage === "declined" ? "Decline" : "Defer", { variant: "danger", onClick: async () => {
          if (!reasonInput.value.trim()) { UI.toast("A reason is required."); return; }
          const fresh = cloneIni(ini);
          const from = fresh.stage;
          fresh.stage = toStage;
          fresh.closedOn = UI.todayStr();
          pushHistory(fresh, { byId: S.me, kind: "decision", summary: `${toStage === "declined" ? "Declined" : "Deferred"} — ${reasonInput.value.trim()}`, meta: { from, to: toStage } });
          await saveIni(fresh, actions);
          m.close();
        }}),
      ],
    });
  }

  function outcomeCard(S, ini, actions) {
    if (ini.stage !== "closing" && ini.stage !== "closed") return null;
    if (ini.outcome) {
      const o = ini.outcome;
      return UI.card([
        UI.el("div", { class: "text-section" }, "Outcome"),
        UI.el("div", { class: "card-stack", style: { marginTop: "8px" } }, [
          UI.el("div", { class: "text-body" }, o.summary),
          UI.el("div", { class: "text-meta" }, `Measured: ${o.measuredHow}`),
          UI.el("div", { class: "text-body", style: { fontWeight: 600 } }, o.result),
          o.lessons ? UI.el("div", { class: "text-meta" }, `Lessons: ${o.lessons}`) : null,
          o.benefitFollowUpOn ? UI.el("div", { class: "faint" }, `Benefit follow-up: ${UI.fmtDate(o.benefitFollowUpOn)}`) : null,
        ]),
      ], { class: "raised" });
    }
    return UI.card([
      UI.el("div", { class: "text-section" }, "Confirm outcome"),
      UI.el("div", { class: "text-body muted", style: { marginTop: "6px" } }, "This initiative is marked complete. Record the outcome to close it."),
      UI.el("div", { style: { marginTop: "10px" } }, [UI.button("Record outcome", { variant: "primary", sm: true, onClick: () => openOutcomeModal(S, ini, actions) })]),
    ], { class: "raised" });
  }

  function openOutcomeModal(S, ini, actions) {
    const summary = UI.textArea({ placeholder: "What was done" });
    const measuredHow = UI.textInput({ placeholder: "How it was measured" });
    const result = UI.textArea({ placeholder: "Aggregate result — no patient-identifiable data" });
    const lessons = UI.textArea({ placeholder: "Lessons learned (optional)" });
    const followUp = UI.textInput({ type: "date" });
    const m = UI.modal({
      title: "Record outcome",
      body: UI.el("div", { class: "card-stack" }, [
        UI.field("Summary", summary), UI.field("Measured how", measuredHow), UI.field("Result", result),
        UI.field("Lessons learned", lessons), UI.field("Benefit follow-up date", followUp),
      ]),
      footer: [
        UI.button("Cancel", { variant: "ghost", onClick: () => m.close() }),
        UI.button("Close with outcome", { variant: "primary", onClick: async () => {
          if (!summary.value.trim() || !result.value.trim()) { UI.toast("Summary and result are required."); return; }
          const fresh = cloneIni(ini);
          fresh.outcome = { summary: summary.value.trim(), measuredHow: measuredHow.value.trim(), result: result.value.trim(), lessons: lessons.value.trim(), benefitFollowUpOn: followUp.value || null, closedById: S.me };
          fresh.stage = "closed";
          fresh.closedOn = UI.todayStr();
          pushHistory(fresh, { byId: S.me, kind: "outcome", summary: "Closed with outcome recorded." });
          await saveIni(fresh, actions);
          m.close();
        }}),
      ],
    });
  }

  function render(S, actions, id) {
    const ini = S.initiatives.find(i => i.id === id);
    if (!ini) return UI.emptyState("Initiative not found", "It may have been removed, or the link is out of date.");

    const wrap = UI.el("div", { class: "page-body" });

    wrap.appendChild(UI.el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" } }, [
      UI.el("div", {}, [
        UI.el("div", { style: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" } }, [
          UI.el("span", { class: "mono-label" }, ini.ref),
          UI.chip(Model.TYPE_LABEL[ini.type] || "Type not set", "neutral"),
          ini.size ? UI.chip(ini.size, "steel") : null,
          ini.demo ? UI.chip("Demo", "iris") : null,
        ]),
        UI.el("h1", { class: "text-title" }, ini.title),
        UI.el("div", { class: "text-body muted", style: { marginTop: "6px", maxWidth: "640px" } }, ini.problem),
      ]),
      stageControls(S, ini, actions),
    ]));

    wrap.appendChild(statusRow(S, ini));
    wrap.appendChild(nextActionBanner(S, ini, actions));

    const outcome = outcomeCard(S, ini, actions);

    const grid = UI.el("div", { style: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px", alignItems: "start" } });
    if (window.innerWidth <= 900) grid.style.gridTemplateColumns = "1fr";

    const left = UI.el("div", { class: "region-gap" });
    if (outcome) left.appendChild(outcome);
    left.appendChild(requirementsSection(S, ini, actions));
    left.appendChild(milestonesSection(S, ini, actions));
    left.appendChild(risksSection(S, ini, actions));
    left.appendChild(historySection(S, ini, actions));

    const right = UI.el("div", { class: "region-gap" });
    right.appendChild(peopleCard(S, ini, actions));
    right.appendChild(postUpdateCard(S, ini, actions));

    grid.appendChild(left);
    grid.appendChild(right);
    wrap.appendChild(grid);

    return wrap;
  }

  return { render };
})();
