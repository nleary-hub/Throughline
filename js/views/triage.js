/* Throughline — js/views/triage.js
   Screen 5: Triage queue (§8 #5). Director-only. */
window.Views = window.Views || {};
window.Views.triage = (() => {

  function render(S, actions) {
    const person = S.people.find(p => p.id === S.me);
    const wrap = UI.el("div", { class: "page-body" });
    wrap.appendChild(UI.el("h1", { class: "text-title" }, "Triage queue"));

    if (!person || !["director", "senior_director", "peer_director"].includes(person.role)) {
      wrap.appendChild(UI.emptyState("Not available", "Triage is for directors."));
      return wrap;
    }

    const proposed = S.initiatives.filter(i => i.stage === "proposed").sort((a, b) => a.submittedOn.localeCompare(b.submittedOn));
    if (!proposed.length) {
      wrap.appendChild(UI.emptyState("Nothing waiting", "New proposals will show up here for triage."));
      return wrap;
    }

    const listCol = UI.el("div", { class: "card-stack", style: { width: "260px", flex: "0 0 260px" } });
    const detailCol = UI.el("div", { style: { flex: "1" } });
    const layout = UI.el("div", { style: { display: "flex", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" } }, [listCol, detailCol]);
    wrap.appendChild(layout);

    let selected = proposed[0];

    function selectItem(ini) { selected = ini; drawList(); drawDetail(); }

    function drawList() {
      UI.clear(listCol);
      for (const ini of proposed) {
        const days = UI.daysBetween(ini.submittedOn, UI.todayStr());
        const target = (S.config.attention || Model.DEFAULT_ATTENTION).triageTargetDays;
        listCol.appendChild(UI.el("div", {
          class: "card" + (selected.id === ini.id ? " raised" : ""),
          style: { cursor: "pointer", borderColor: days > target ? "rgba(230,140,116,.35)" : undefined },
          onClick: () => selectItem(ini),
        }, [
          UI.el("div", { class: "text-body", style: { fontWeight: 600 } }, ini.title),
          UI.el("div", { class: "text-meta", style: { marginTop: "3px" } }, `${days} day${days === 1 ? "" : "s"} waiting${days > target ? " · overdue" : ""}`),
        ]));
      }
    }

    function drawDetail() {
      UI.clear(detailCol);
      const ini = selected;
      const typeSel = UI.select(Object.entries(Model.TYPE_LABEL).map(([v, l]) => ({ value: v, label: l })), { value: ini.type });
      const trackSel = UI.select(Object.entries(Model.TRACK_LABEL).map(([v, l]) => ({ value: v, label: l })), { value: ini.track });
      const sizeSel = UI.select([{ value: "", label: "Not set" }, { value: "S", label: "S" }, { value: "M", label: "M" }, { value: "L", label: "L" }], { value: ini.size || "" });
      const ownerSel = UI.select([{ value: "", label: "Unassigned" }, ...S.people.map(p => ({ value: p.id, label: p.name }))], { value: ini.ownerId || "" });
      const sponsorSel = UI.select([{ value: "", label: "None" }, ...S.people.map(p => ({ value: p.id, label: p.name }))], { value: ini.sponsorId || "" });
      const deptWrap = UI.el("div", { class: "check-row" });
      let depts = (ini.departments || []).slice();
      for (const d of S.config.departments || []) {
        deptWrap.appendChild(UI.pillOption(d.name, depts.includes(d.id), () => {
          depts = depts.includes(d.id) ? depts.filter(x => x !== d.id) : [...depts, d.id];
          drawDetail();
        }));
      }
      const capitalInput = UI.textInput({ type: "number", min: "0", value: String(ini.estimates.capital || 0) });
      const fteInput = UI.textInput({ type: "number", min: "0", value: String(ini.estimates.fte || 0) });
      const crossesCheck = UI.pillOption("Crosses service lines", !!ini.estimates.crossesServiceLines, () => { ini.estimates.crossesServiceLines = !ini.estimates.crossesServiceLines; drawDetail(); });

      function currentDraft() {
        return {
          ...ini, type: typeSel.value, track: trackSel.value, size: sizeSel.value || null,
          ownerId: ownerSel.value || null, sponsorId: sponsorSel.value || null, departments: depts,
          estimates: { capital: Math.max(0, Number(capitalInput.value) || 0), fte: Math.max(0, Number(fteInput.value) || 0), crossesServiceLines: ini.estimates.crossesServiceLines },
        };
      }

      const reqPreviewWrap = UI.el("div", { class: "card-stack", style: { marginTop: "8px" } });
      function drawReqPreview() {
        UI.clear(reqPreviewWrap);
        const draft = currentDraft();
        const applicable = Model.computeApplicableRequirements(draft, S.config);
        if (!applicable.length) { reqPreviewWrap.appendChild(UI.el("div", { class: "text-body muted" }, "No requirements would apply as classified.")); return; }
        for (const a of applicable) {
          reqPreviewWrap.appendChild(UI.el("div", { class: "card", style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" } }, [
            UI.el("div", {}, [UI.el("div", { class: "text-body", style: { fontWeight: 600 } }, Model.REQ_LABEL[a.key]), UI.el("div", { class: "text-meta" }, a.because)]),
            UI.button("Waive", { sm: true, variant: "ghost", onClick: () => openWaiveModal(a) }),
          ]));
        }
      }
      const waived = new Map(); // key -> reason
      function openWaiveModal(a) {
        const reasonInput = UI.textArea({ placeholder: "Why doesn't this apply here?" });
        const m = UI.modal({
          title: `Waive ${Model.REQ_LABEL[a.key]}`, body: UI.field("Reason", reasonInput),
          footer: [UI.button("Cancel", { variant: "ghost", onClick: () => m.close() }), UI.button("Waive", { variant: "primary", onClick: () => {
            if (!reasonInput.value.trim()) { UI.toast("A reason is required."); return; }
            waived.set(a.key, reasonInput.value.trim());
            m.close();
            UI.toast(`${Model.REQ_LABEL[a.key]} will be marked exempt.`);
          }})],
        });
      }
      [typeSel, trackSel, sizeSel].forEach(sel => sel.addEventListener("change", drawReqPreview));
      capitalInput.addEventListener("input", drawReqPreview);
      fteInput.addEventListener("input", drawReqPreview);
      drawReqPreview();

      detailCol.appendChild(UI.card([
        UI.el("div", { class: "mono-label" }, ini.ref),
        UI.el("div", { class: "text-section", style: { marginTop: "4px" } }, ini.title),
        UI.el("div", { class: "text-body muted", style: { marginTop: "6px" } }, ini.problem),
        UI.el("div", { class: "text-meta", style: { marginTop: "8px" } }, `Submitted by ${ini.submittedBy.name} · ${UI.fmtDate(ini.submittedOn)}`),
        UI.el("div", { class: "card-stack", style: { marginTop: "14px" } }, [
          UI.field("Type", typeSel), UI.field("Track", trackSel), UI.field("Size", sizeSel),
          UI.field("Departments", deptWrap), UI.field("Owner", ownerSel), UI.field("Physician sponsor", sponsorSel),
          UI.el("div", { style: { display: "flex", gap: "10px" } }, [UI.field("Capital ($)", capitalInput), UI.field("FTE", fteInput)]),
          crossesCheck,
        ]),
        UI.el("div", { class: "mono-label", style: { marginTop: "14px" } }, "Requirements that will apply"),
        reqPreviewWrap,
        UI.el("div", { style: { display: "flex", gap: "8px", marginTop: "16px", flexWrap: "wrap" } }, [
          UI.button("Accept", { variant: "primary", onClick: async () => {
            const draft = currentDraft();
            let applicable = Model.reconcileRequirements(draft, S.config);
            applicable = applicable.map(r => waived.has(r.key) ? { ...r, status: "exempt", rationale: waived.get(r.key) } : r);
            draft.requirements = applicable;
            draft.stage = "evaluating"; draft.stageEnteredOn = UI.todayStr();
            draft.nextAction = { text: "Set size and complete evaluation", ownerId: draft.ownerId, dueOn: null, kind: "task" };
            draft.history = (draft.history || []).slice();
            draft.history.push({ id: Store.newId("ev_"), on: new Date().toISOString(), byId: S.me, kind: "triaged", summary: "Accepted into evaluation.", detail: "", meta: { from: "proposed", to: "evaluating" } });
            await Store.put("initiatives", draft.id, draft);
            UI.toast("Accepted.");
          }}),
          UI.button("Ask a question", { onClick: () => openQuestionModal(ini) }),
          UI.button("Decline", { variant: "danger", onClick: () => openDeclineModal(ini) }),
        ]),
      ]));
    }

    function openQuestionModal(ini) {
      const q = UI.textArea({ placeholder: "What do you need to know before deciding?" });
      const m = UI.modal({
        title: "Ask a question", body: UI.field("Question", q),
        footer: [UI.button("Cancel", { variant: "ghost", onClick: () => m.close() }), UI.button("Send", { variant: "primary", onClick: async () => {
          if (!q.value.trim()) return;
          const fresh = JSON.parse(JSON.stringify(ini));
          fresh.history.push({ id: Store.newId("ev_"), on: new Date().toISOString(), byId: S.me, kind: "question", summary: `Question from ${person.name}.`, detail: q.value.trim(), meta: { forId: fresh.submittedBy.personId } });
          await Store.put("initiatives", fresh.id, fresh);
          m.close();
          UI.toast("Question recorded.");
        }})],
      });
    }

    function openDeclineModal(ini) {
      const reason = UI.textArea({ placeholder: "Reason (kept in the archive)" });
      const m = UI.modal({
        title: "Decline this proposal", body: UI.field("Reason", reason),
        footer: [UI.button("Cancel", { variant: "ghost", onClick: () => m.close() }), UI.button("Decline", { variant: "danger", onClick: async () => {
          if (!reason.value.trim()) { UI.toast("A reason is required."); return; }
          const fresh = JSON.parse(JSON.stringify(ini));
          fresh.stage = "declined"; fresh.closedOn = UI.todayStr();
          fresh.history.push({ id: Store.newId("ev_"), on: new Date().toISOString(), byId: S.me, kind: "decision", summary: `Declined — ${reason.value.trim()}`, detail: "", meta: { from: "proposed", to: "declined" } });
          await Store.put("initiatives", fresh.id, fresh);
          m.close();
          UI.toast("Declined.");
        }})],
      });
    }

    drawList();
    drawDetail();
    return wrap;
  }

  return { render };
})();
