/* Throughline — js/views/governance.js
   Screen 6: Governance session (§8 #6). */
window.Views = window.Views || {};
window.Views.governance = (() => {

  function cloneMtg(m) { return JSON.parse(JSON.stringify(m)); }

  function ownerLoad(S, ini) {
    if (!ini.ownerId) return 0;
    return S.initiatives.filter(i => i.ownerId === ini.ownerId && !["closed", "declined", "deferred"].includes(i.stage)).length;
  }

  function render(S, actions, meetingId) {
    const mtg = S.meetings.find(m => m.id === meetingId);
    const wrap = UI.el("div", { class: "page-body" });
    if (!mtg) return UI.emptyState("Meeting not found");

    wrap.appendChild(UI.el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" } }, [
      UI.el("div", {}, [
        UI.el("h1", { class: "text-title" }, mtg.title),
        UI.el("div", { class: "text-meta", style: { marginTop: "4px" } }, `${UI.fmtDate(mtg.on, { year: true })} · ${mtg.status === "closed" ? "Closed" : "Draft"}`),
      ]),
      UI.button("Back to reviews", { variant: "ghost", sm: true, onClick: () => actions.navigate("#/reviews") }),
    ]));

    let slate = (mtg.agenda.slate || []).map(id => S.initiatives.find(i => i.id === id)).filter(Boolean);
    const scores = Object.assign({}, mtg.agenda.scores || {});
    const decisions = {}; // initiativeId -> {outcome, rationale, holdsUntil}

    const tableWrap = UI.el("div");
    const slateWrap = UI.el("div");

    function drawTable() {
      UI.clear(tableWrap);
      const table = UI.el("table", { class: "list-table stack-mobile" });
      table.appendChild(UI.el("thead", {}, [UI.el("tr", {}, ["Initiative", "Patient impact", "Access/volume", "Financial case", "Effort", "Readiness", "Owner load", ""].map(h => UI.el("th", {}, h)))]));
      const tbody = UI.el("tbody");
      for (const ini of slate) {
        const s = scores[ini.id] || {};
        const r = Model.readiness(ini);
        const load = ownerLoad(S, ini);
        tbody.appendChild(UI.el("tr", {}, [
          UI.el("td", {}, [UI.el("div", { style: { fontWeight: 600 } }, ini.title), UI.el("div", { class: "faint" }, ini.ref)]),
          UI.el("td", {}, scoreMeter(ini.id, "patientImpact", s.patientImpact)),
          UI.el("td", {}, scoreMeter(ini.id, "accessVolume", s.accessVolume)),
          UI.el("td", {}, scoreMeter(ini.id, "financialCase", s.financialCase)),
          UI.el("td", {}, scoreMeter(ini.id, "effort", s.effort)),
          UI.el("td", {}, window.Views.initiatives.readinessChip(ini)),
          UI.el("td", {}, UI.chip(String(load), load >= 3 ? "amber" : "neutral")),
          UI.el("td", {}, UI.button("Open", { sm: true, variant: "ghost", onClick: () => actions.navigate(`#/i/${ini.id}`) })),
        ]));
      }
      table.appendChild(tbody);
      tableWrap.appendChild(UI.el("div", { class: "table-scroll" }, table));
    }

    function scoreMeter(iniId, field, value) {
      const holder = UI.el("div", { style: { display: "flex", gap: "4px", cursor: "pointer" } });
      function draw() {
        UI.clear(holder);
        const cur = (scores[iniId] || {})[field];
        holder.appendChild(UI.meter(cur, 5));
      }
      draw();
      holder.addEventListener("click", (e) => {
        const rect = holder.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        const val = Math.max(1, Math.min(5, Math.ceil(pct * 5)));
        scores[iniId] = scores[iniId] || {};
        scores[iniId][field] = val;
        draw();
      });
      return holder;
    }

    function drawSlate() {
      UI.clear(slateWrap);
      slateWrap.appendChild(UI.el("div", { class: "text-section" }, "Rankable slate"));
      const list = UI.el("div", { class: "card-stack", style: { marginTop: "8px" } });
      slate.forEach((ini, idx) => {
        list.appendChild(UI.el("div", { class: "card", style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" } }, [
          UI.el("div", { style: { display: "flex", alignItems: "center", gap: "8px" } }, [
            UI.chip(`#${idx + 1}`, "iris"),
            UI.el("span", { class: "text-body" }, ini.title),
          ]),
          UI.el("div", { style: { display: "flex", gap: "4px" } }, [
            UI.button("↑", { sm: true, variant: "ghost", disabled: idx === 0, onClick: () => { [slate[idx - 1], slate[idx]] = [slate[idx], slate[idx - 1]]; drawSlate(); } }),
            UI.button("↓", { sm: true, variant: "ghost", disabled: idx === slate.length - 1, onClick: () => { [slate[idx + 1], slate[idx]] = [slate[idx], slate[idx + 1]]; drawSlate(); } }),
          ]),
        ]));
      });
      slateWrap.appendChild(list);
    }

    // decision panel
    const decisionWrap = UI.el("div");
    function drawDecisionPanel() {
      UI.clear(decisionWrap);
      const iniSel = UI.select(slate.map(i => ({ value: i.id, label: i.title })), {});
      const outcomeSel = UI.select([{ value: "approved", label: "Approved" }, { value: "ranked", label: "Ranked (slate order)" }, { value: "deferred", label: "Deferred" }, { value: "declined", label: "Declined" }], {});
      const rationaleInput = UI.textArea({ placeholder: "Rationale" });
      const dissentInput = UI.textInput({ placeholder: "Dissent, if any (optional)" });
      const holdsInput = UI.textInput({ type: "date" });

      decisionWrap.appendChild(UI.card([
        UI.el("div", { class: "text-section" }, "Record a decision"),
        UI.el("div", { class: "card-stack", style: { marginTop: "10px" } }, [
          UI.field("Initiative", iniSel), UI.field("Outcome", outcomeSel), UI.field("Rationale", rationaleInput),
          UI.field("Dissent", dissentInput), UI.field("Holds until", holdsInput),
        ]),
        UI.button("Add to decisions", { sm: true, variant: "primary", style: { marginTop: "10px" }, onClick: () => {
          if (!rationaleInput.value.trim()) { UI.toast("A rationale is required."); return; }
          decisions[iniSel.value] = { outcome: outcomeSel.value, rationale: rationaleInput.value.trim(), dissent: dissentInput.value.trim(), holdsUntil: holdsInput.value || null };
          UI.toast("Decision staged — publish to save.");
          drawDecisionsStaged();
        }}),
      ]));
    }

    const stagedWrap = UI.el("div");
    function drawDecisionsStaged() {
      UI.clear(stagedWrap);
      const entries = Object.entries(decisions);
      if (!entries.length) return;
      stagedWrap.appendChild(UI.el("div", { class: "mono-label", style: { margin: "10px 0 6px" } }, "Staged decisions"));
      for (const [iniId, d] of entries) {
        const ini = S.initiatives.find(i => i.id === iniId);
        stagedWrap.appendChild(UI.el("div", { class: "text-body" }, `${ini ? ini.title : iniId}: ${d.outcome} — ${d.rationale}`));
      }
    }

    const exemptCount = S.initiatives.filter(ini => {
      const applicable = Model.computeApplicableRequirements(ini, S.config);
      return !applicable.some(a => a.key === "physician_governance") && !["closed", "declined", "deferred"].includes(ini.stage);
    }).length;

    const rankedBlocked = S.initiatives.filter(ini => ini.priority && ini.priority.band === "committee" && Model.readiness(ini).value === "blocked");
    if (rankedBlocked.length) {
      wrap.appendChild(UI.card([
        UI.el("div", { style: { display: "flex", alignItems: "flex-start", gap: "8px" } }, [
          UI.chip(`${rankedBlocked.length} of ${S.initiatives.filter(i => i.priority && i.priority.band === "committee").length} ranked`, "ember"),
          UI.el("div", { class: "text-body" }, [
            "blocked by dependencies this committee doesn't control: ",
            ...rankedBlocked.map((ini, i) => [i > 0 ? ", " : "", UI.el("a", { href: `#/i/${ini.id}`, style: { textDecoration: "underline" } }, ini.title)]).flat(),
            ". Ranked priority is not the same claim as readiness to start.",
          ]),
        ]),
      ], { class: "raised" }));
    }

    wrap.appendChild(UI.card([tableWrap]));
    const bottomGrid = UI.el("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", alignItems: "start" } });
    if (window.innerWidth <= 900) bottomGrid.style.gridTemplateColumns = "1fr";
    bottomGrid.appendChild(UI.card([slateWrap]));
    const rightCol = UI.el("div", { class: "region-gap" });
    rightCol.appendChild(decisionWrap);
    rightCol.appendChild(stagedWrap);
    bottomGrid.appendChild(rightCol);
    wrap.appendChild(bottomGrid);

    wrap.appendChild(UI.card([
      UI.el("div", { class: "text-meta" }, [`${exemptCount} initiative${exemptCount === 1 ? "" : "s"} are exempt from this committee. `, UI.el("a", { href: "#/initiatives", style: { textDecoration: "underline" } }, "View them")]),
    ]));

    wrap.appendChild(UI.el("div", { style: { display: "flex", justifyContent: "flex-end", gap: "8px" } }, [
      UI.button("Publish decision", { variant: "primary", disabled: !Object.keys(decisions).length && mtg.status === "closed", onClick: async () => {
        const fresh = cloneMtg(mtg);
        fresh.agenda.scores = scores;
        fresh.agenda.slate = slate.map(i => i.id);
        fresh.decisions = fresh.decisions || [];
        for (const [iniId, d] of Object.entries(decisions)) {
          fresh.decisions.push({ id: Store.newId("dec_"), initiativeId: iniId, outcome: d.outcome, rationale: d.rationale, dissent: d.dissent, recordedById: S.me, recordedOn: UI.todayStr() });
        }
        fresh.status = "closed";
        await Store.put("meetings", fresh.id, fresh);

        // update each initiative: priority + history
        for (let idx = 0; idx < slate.length; idx++) {
          const ini = slate[idx];
          const d = decisions[ini.id];
          const iniFresh = JSON.parse(JSON.stringify(S.initiatives.find(i => i.id === ini.id)));
          if (d) {
            if (d.outcome === "approved" || d.outcome === "ranked") {
              iniFresh.priority = { band: "committee", rank: idx + 1, setOn: UI.todayStr(), setBy: S.me, holdsUntil: d.holdsUntil, rationale: d.rationale };
            } else if (d.outcome === "deferred") {
              iniFresh.stage = "deferred"; iniFresh.closedOn = UI.todayStr();
            } else if (d.outcome === "declined") {
              iniFresh.stage = "declined"; iniFresh.closedOn = UI.todayStr();
            }
            iniFresh.history = iniFresh.history || [];
            iniFresh.history.push({ id: Store.newId("ev_"), on: new Date().toISOString(), byId: S.me, kind: "decision", summary: `${mtg.title}: ${d.outcome} — ${d.rationale}`, detail: d.dissent || "", meta: {} });
          } else {
            // slate reorder without explicit decision still updates rank if already committee-banded
            if (iniFresh.priority && iniFresh.priority.band === "committee") {
              iniFresh.priority = { ...iniFresh.priority, rank: idx + 1 };
            }
          }
          await Store.put("initiatives", iniFresh.id, iniFresh);
        }
        UI.toast("Decisions published.");
        actions.navigate("#/reviews");
      }}),
    ]));

    drawTable();
    drawSlate();
    drawDecisionPanel();
    drawDecisionsStaged();

    return wrap;
  }

  return { render };
})();
