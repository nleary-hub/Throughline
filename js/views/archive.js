/* Throughline — js/views/archive.js
   Screen 8: Archive & outcomes (§8 #8). */
window.Views = window.Views || {};
window.Views.archive = (() => {

  const ARCHIVE_STAGES = ["closed", "declined", "deferred"];

  function render(S, actions) {
    const wrap = UI.el("div", { class: "page-body" });
    wrap.appendChild(UI.el("h1", { class: "text-title" }, "Archive & outcomes"));

    const state = { year: "", type: "", outcome: "" };
    const listWrap = UI.el("div");

    function years() {
      const ys = new Set();
      for (const ini of S.initiatives) if (ARCHIVE_STAGES.includes(ini.stage)) ys.add((ini.closedOn || ini.submittedOn || "").slice(0, 4));
      return Array.from(ys).filter(Boolean).sort().reverse();
    }

    function drawFilters() {
      const bar = UI.el("div", { class: "filter-bar" });
      bar.appendChild(UI.select([{ value: "", label: "Any year" }, ...years().map(y => ({ value: y, label: y }))], { value: state.year, onChange: (e) => { state.year = e.target.value; drawList(); } }));
      bar.appendChild(UI.select([{ value: "", label: "Any type" }, ...Object.entries(Model.TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))], { value: state.type, onChange: (e) => { state.type = e.target.value; drawList(); } }));
      bar.appendChild(UI.select([{ value: "", label: "Any outcome" }, { value: "closed", label: "Completed" }, { value: "declined", label: "Declined" }, { value: "deferred", label: "Deferred" }], { value: state.outcome, onChange: (e) => { state.outcome = e.target.value; drawList(); } }));
      return bar;
    }

    function drawList() {
      UI.clear(listWrap);
      let list = S.initiatives.filter(ini => ARCHIVE_STAGES.includes(ini.stage));
      if (state.year) list = list.filter(ini => (ini.closedOn || ini.submittedOn || "").startsWith(state.year));
      if (state.type) list = list.filter(ini => ini.type === state.type);
      if (state.outcome) list = list.filter(ini => ini.stage === state.outcome);
      list.sort((a, b) => (b.closedOn || "").localeCompare(a.closedOn || ""));

      if (!list.length) { listWrap.appendChild(UI.emptyState("Nothing here yet", "Completed, declined and deferred initiatives will appear here.")); return; }

      for (const ini of list) {
        const stageTint = { closed: "beacon", declined: "ember", deferred: "neutral" }[ini.stage];
        const card = UI.el("div", { class: "card", style: { cursor: "pointer" }, onClick: () => actions.navigate(`#/i/${ini.id}`) }, [
          UI.el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" } }, [
            UI.el("div", {}, [
              UI.el("div", { class: "text-body", style: { fontWeight: 600 } }, ini.title),
              UI.el("div", { class: "text-meta", style: { marginTop: "3px" } }, `${ini.ref} · ${Model.TYPE_LABEL[ini.type]} · Closed ${UI.fmtDate(ini.closedOn)}`),
            ]),
            UI.chip(Model.STAGE_LABEL[ini.stage], stageTint),
          ]),
        ]);
        if (ini.outcome) {
          card.appendChild(UI.el("div", { class: "text-body", style: { marginTop: "8px", borderLeft: "2px solid var(--hairline-2)", paddingLeft: "8px" } }, ini.outcome.result));
        }
        listWrap.appendChild(card);
      }
    }

    wrap.appendChild(drawFilters());
    wrap.appendChild(UI.el("div", { class: "card-stack" }, [listWrap]));
    drawList();
    return wrap;
  }

  return { render };
})();
