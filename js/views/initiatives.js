/* Throughline — js/views/initiatives.js
   Screen 2: filterable list + board toggle (§8 #2). */
window.Views = window.Views || {};
window.Views.initiatives = (() => {

  const SAVED_VIEWS = [
    { key: "everything", label: "Everything", filter: () => true },
    { key: "at_risk", label: "At risk", filter: (ini, S) => { const h = Model.health(ini, null, S.config); return h && (h.value === "at_risk" || h.value === "stalled"); } },
    { key: "blocked", label: "Blocked", filter: (ini) => Model.readiness(ini).value === "blocked" },
    { key: "mine", label: "Mine", filter: (ini, S) => ini.ownerId === S.me },
    { key: "unassigned", label: "Unassigned", filter: (ini) => !ini.ownerId },
  ];

  let state = { savedView: "everything", mode: "list", filters: {} };

  function inScope(ini, S) {
    const person = S.people.find(p => p.id === S.me);
    if (!person) return true;
    if (S.scope === "all_areas") return true;
    if (S.scope === "my_area") {
      const areaDepts = new Set((S.config.departments || []).filter(d => d.areaId === person.areaId).map(d => d.id));
      return (ini.departments || []).some(d => areaDepts.has(d));
    }
    // my_departments
    const my = new Set(person.departments || []);
    return (ini.departments || []).some(d => my.has(d));
  }

  function applyFilters(list, S) {
    const f = state.filters;
    return list.filter(ini => {
      if (f.department && !(ini.departments || []).includes(f.department)) return false;
      if (f.type && ini.type !== f.type) return false;
      if (f.track && ini.track !== f.track) return false;
      if (f.stage && ini.stage !== f.stage) return false;
      if (f.band && (ini.priority || {}).band !== f.band) return false;
      if (f.health) {
        const h = Model.health(ini, null, S.config);
        if (!h || h.value !== f.health) return false;
      }
      if (f.owner && ini.ownerId !== f.owner) return false;
      if (f.needsMe) {
        const attn = Model.attention(S, S.me, null);
        if (!attn.some(a => a.initiativeId === ini.id)) return false;
      }
      return true;
    });
  }

  function healthChip(ini, S) {
    const h = Model.health(ini, null, S.config);
    if (!h) return UI.chip("—", "neutral");
    const map = { on_track: ["On track", "beacon"], attention: ["Needs attention", "amber"], at_risk: ["At risk", "ember"], stalled: ["Stalled", "ember"] };
    const [label, tint] = map[h.value] || ["—", "neutral"];
    return UI.chip(h.override ? label + " (override)" : label, tint);
  }

  function readinessChip(ini) {
    const r = Model.readiness(ini);
    const map = { ready: ["Ready", "beacon"], not_ready: ["Not ready", "amber"], blocked: ["Blocked", "ember"] };
    const [label, tint] = map[r.value];
    return UI.chip(label, tint);
  }

  function priorityChip(ini) {
    const p = ini.priority || {};
    if (p.band === "committee") return UI.chip(`#${p.rank}`, "iris");
    if (p.band === "committed") return UI.chip("Committed", "steel");
    if (p.band === "watchlist") return UI.chip("Watchlist", "amber");
    return UI.chip("Unranked", "neutral");
  }

  function stageChip(ini) {
    const tint = { declined: "ember", deferred: "neutral", closed: "beacon" }[ini.stage] || "neutral";
    return UI.chip(Model.STAGE_LABEL[ini.stage], tint);
  }

  function renderFilterBar(S, actions, rerender) {
    const bar = UI.el("div", { class: "filter-bar" });
    const depts = S.config.departments || [];
    const f = state.filters;

    const selects = [
      { key: "department", label: "Department", options: depts.map(d => ({ value: d.id, label: d.name })) },
      { key: "type", label: "Type", options: Object.entries(Model.TYPE_LABEL).map(([v, l]) => ({ value: v, label: l })) },
      { key: "track", label: "Track", options: Object.entries(Model.TRACK_LABEL).map(([v, l]) => ({ value: v, label: l })) },
      { key: "stage", label: "Stage", options: Model.STAGES.map(v => ({ value: v, label: Model.STAGE_LABEL[v] })) },
      { key: "band", label: "Priority", options: [{ value: "committee", label: "Committee" }, { value: "committed", label: "Committed" }, { value: "watchlist", label: "Watchlist" }, { value: "unranked", label: "Unranked" }] },
      { key: "health", label: "Health", options: [{ value: "on_track", label: "On track" }, { value: "attention", label: "Needs attention" }, { value: "at_risk", label: "At risk" }, { value: "stalled", label: "Stalled" }] },
      { key: "owner", label: "Owner", options: S.people.map(p => ({ value: p.id, label: p.name })) },
    ];

    for (const s of selects) {
      const sel = UI.select([{ value: "", label: s.label }, ...s.options], {
        value: f[s.key] || "",
        onChange: (e) => { f[s.key] = e.target.value || null; rerender(); },
      });
      bar.appendChild(sel);
    }

    const needsMeBtn = UI.button("Needs me", { sm: true, variant: f.needsMe ? "primary" : null, onClick: () => { f.needsMe = !f.needsMe; rerender(); } });
    bar.appendChild(needsMeBtn);

    if (Object.values(f).some(Boolean)) {
      bar.appendChild(UI.button("Clear filters", { sm: true, variant: "ghost", onClick: () => { state.filters = {}; rerender(); } }));
    }

    return bar;
  }

  function renderTable(list, S, actions) {
    if (!list.length) return UI.emptyState("No initiatives match", "Try a different saved view or clear your filters.");
    const table = UI.el("table", { class: "list-table stack-mobile" });
    table.appendChild(UI.el("thead", {}, [UI.el("tr", {}, [
      "Initiative", "Stage", "Priority", "Readiness", "Health", "Owner", "Next action",
    ].map(h => UI.el("th", {}, h)))]));
    const tbody = UI.el("tbody");
    for (const ini of list) {
      const owner = S.people.find(p => p.id === ini.ownerId);
      const tr = UI.el("tr", { class: "row-link", onClick: () => actions.navigate(`#/i/${ini.id}`) }, [
        UI.el("td", {}, [
          UI.el("div", { style: { fontWeight: "600" } }, ini.title),
          UI.el("div", { class: "faint mono-label", style: { marginTop: "2px", textTransform: "none", letterSpacing: "0" } }, `${ini.ref} · ${Model.TYPE_LABEL[ini.type] || "—"}`),
        ]),
        UI.el("td", {}, stageChip(ini)),
        UI.el("td", {}, priorityChip(ini)),
        UI.el("td", {}, readinessChip(ini)),
        UI.el("td", {}, healthChip(ini, S)),
        UI.el("td", {}, owner ? UI.personRow(owner, { hideTitle: true }) : UI.el("span", { class: "faint" }, "Unassigned")),
        UI.el("td", {}, ini.nextAction && ini.nextAction.text ? UI.el("div", {}, [
          UI.el("div", { class: "text-body" }, ini.nextAction.text),
          UI.el("div", { class: "faint" }, ini.nextAction.dueOn ? UI.fmtDate(ini.nextAction.dueOn) : ""),
        ]) : UI.el("span", { class: "faint" }, "—")),
      ]);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return UI.el("div", { class: "table-scroll" }, table);
  }

  function renderBoard(list, S, actions) {
    const stages = Model.STAGES.filter(s => !["declined", "deferred"].includes(s));
    const tracks = ["governance", "departmental", "org_led", "capital"];
    const board = UI.el("div", { class: "board" });
    for (const stage of stages) {
      const col = UI.el("div", { class: "board-col" });
      const inStage = list.filter(i => i.stage === stage);
      const avgDays = inStage.length ? Math.round(inStage.reduce((sum, i) => sum + UI.daysBetween(i.stageEnteredOn || i.submittedOn, UI.todayStr()), 0) / inStage.length) : 0;
      col.appendChild(UI.el("div", { class: "board-col-header" }, [
        UI.el("div", { class: "title" }, Model.STAGE_LABEL[stage]),
        UI.el("div", { class: "meta" }, `${inStage.length} · avg ${avgDays}d`),
      ]));
      for (const track of tracks) {
        const inLane = inStage.filter(i => i.track === track);
        if (!inLane.length) continue;
        col.appendChild(UI.el("div", { class: "board-lane-label" }, Model.TRACK_LABEL[track]));
        for (const ini of inLane) {
          col.appendChild(UI.el("div", { class: "board-card", onClick: () => actions.navigate(`#/i/${ini.id}`) }, [
            UI.el("div", { class: "text-body", style: { fontWeight: "600" } }, ini.title),
            UI.el("div", { style: { display: "flex", gap: "5px", flexWrap: "wrap" } }, [priorityChip(ini), readinessChip(ini)]),
            UI.el("div", { class: "faint mono-label", style: { textTransform: "none", letterSpacing: "0" } }, ini.ref),
          ]));
        }
      }
      board.appendChild(col);
    }
    return UI.el("div", { class: "board-scroll" }, board);
  }

  function render(S, actions) {
    const wrap = UI.el("div", { class: "page-body" });

    function rerender() {
      const fresh = render(S, actions);
      const page = wrap.closest(".page");
      if (page) { UI.clear(page); page.appendChild(fresh); }
    }

    const savedViewsBar = UI.el("div", { class: "saved-views" });
    for (const v of SAVED_VIEWS) {
      savedViewsBar.appendChild(UI.el("div", {
        class: "saved-view-btn" + (state.savedView === v.key ? " active" : ""),
        onClick: () => { state.savedView = v.key; rerender(); },
      }, v.label));
    }

    const toggleWrap = UI.el("div", { style: { display: "flex", gap: "6px" } }, [
      UI.button("List", { sm: true, variant: state.mode === "list" ? "primary" : "ghost", onClick: () => { state.mode = "list"; rerender(); } }),
      UI.button("Board", { sm: true, variant: state.mode === "board" ? "primary" : "ghost", onClick: () => { state.mode = "board"; rerender(); } }),
    ]);

    const topRow = UI.el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" } }, [savedViewsBar, toggleWrap]);
    wrap.appendChild(topRow);
    wrap.appendChild(renderFilterBar(S, actions, rerender));

    let list = S.initiatives.filter(ini => inScope(ini, S));
    const sv = SAVED_VIEWS.find(v => v.key === state.savedView);
    if (sv) list = list.filter(ini => sv.filter(ini, S));
    list = applyFilters(list, S);
    list.sort((a, b) => (a.priority.rank || 99) - (b.priority.rank || 99) || a.title.localeCompare(b.title));

    wrap.appendChild(UI.card([state.mode === "list" ? renderTable(list, S, actions) : renderBoard(list, S, actions)]));

    return wrap;
  }

  return { render, inScope, healthChip, readinessChip, priorityChip, stageChip };
})();
