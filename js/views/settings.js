/* Throughline — js/views/settings.js
   Screen 9: Settings (§8 #9). */
window.Views = window.Views || {};
window.Views.settings = (() => {

  function peopleSection(S, actions) {
    const rows = S.people.map(p => UI.el("div", { class: "card", style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, [
      UI.personRow(p),
      UI.chip(p.role.replace("_", " "), "neutral"),
    ]));
    return UI.card([
      UI.el("div", { class: "text-section" }, "People and roles"),
      UI.el("div", { class: "text-meta", style: { margin: "4px 0 10px" } }, "Adding or removing people isn't wired up yet in Phase 1 — this lists who's seeded."),
      UI.el("div", { class: "card-stack" }, rows),
    ]);
  }

  function deptSection(S, actions) {
    const areaCards = (S.config.areas || []).map(area => {
      const depts = (S.config.departments || []).filter(d => d.areaId === area.id);
      const director = S.people.find(p => p.id === area.directorId);
      return UI.el("div", { class: "card" }, [
        UI.el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, [
          UI.el("div", { class: "text-card" }, area.name),
          director ? UI.chip(director.name, "steel") : null,
        ]),
        UI.el("div", { class: "text-meta", style: { marginTop: "6px" } }, depts.map(d => d.name).join(" · ")),
      ]);
    });
    return UI.card([
      UI.el("div", { class: "text-section" }, "Departments and areas"),
      UI.el("div", { class: "card-stack", style: { marginTop: "10px" } }, areaCards),
    ]);
  }

  function rulesSection(S, actions) {
    const rules = Object.assign({}, S.config.rules || Model.DEFAULT_RULES);
    const thresholdInput = UI.textInput({ type: "number", value: String(rules.seniorDirectorCapitalThreshold) });
    const preview = UI.el("div", { class: "text-meta", style: { marginTop: "6px" } }, `A senior director signs off when capital is at or above $${Number(thresholdInput.value || 0).toLocaleString()}.`);
    thresholdInput.addEventListener("input", () => { preview.textContent = `A senior director signs off when capital is at or above $${Number(thresholdInput.value || 0).toLocaleString()}.`; });

    return UI.card([
      UI.el("div", { class: "text-section" }, "Rule thresholds"),
      UI.el("div", { class: "text-meta", style: { margin: "4px 0 10px" } }, "These are Nick's proposals, built as editable config — not fixed policy."),
      UI.field("Senior director capital threshold ($)", thresholdInput),
      preview,
      UI.button("Save", { sm: true, variant: "primary", style: { marginTop: "10px" }, onClick: async () => {
        const cfg = JSON.parse(JSON.stringify(S.config));
        cfg.rules = cfg.rules || {};
        cfg.rules.seniorDirectorCapitalThreshold = Number(thresholdInput.value) || 250000;
        await Store.put("config", "app", cfg);
        UI.toast("Saved. New applicability applies going forward.");
      }}),
    ]);
  }

  function attentionSection(S, actions) {
    const attn = Object.assign({}, S.config.attention || Model.DEFAULT_ATTENTION);
    const staleUpdate = UI.textInput({ type: "number", value: String(attn.staleUpdateDays) });
    const staleReq = UI.textInput({ type: "number", value: String(attn.staleRequirementDays) });
    const triageTarget = UI.textInput({ type: "number", value: String(attn.triageTargetDays) });
    const msWarn = UI.textInput({ type: "number", value: String(attn.milestoneWarnDays) });
    return UI.card([
      UI.el("div", { class: "text-section" }, "Attention thresholds"),
      UI.el("div", { class: "card-stack", style: { marginTop: "10px" } }, [
        UI.field("Stale update (days)", staleUpdate, "No update in this many days marks an initiative stalled."),
        UI.field("Stale requirement check-in (days)", staleReq, "No check-in with an external gatekeeper in this many days surfaces as unblock."),
        UI.field("Triage target (business days)", triageTarget),
        UI.field("Milestone warning window (days)", msWarn, "Upcoming milestones inside this window mark an initiative as needing attention."),
      ]),
      UI.button("Save", { sm: true, variant: "primary", style: { marginTop: "10px" }, onClick: async () => {
        const cfg = JSON.parse(JSON.stringify(S.config));
        cfg.attention = {
          staleUpdateDays: Number(staleUpdate.value) || 21, staleRequirementDays: Number(staleReq.value) || 14,
          triageTargetDays: Number(triageTarget.value) || 3, milestoneWarnDays: Number(msWarn.value) || 7,
        };
        await Store.put("config", "app", cfg);
        UI.toast("Saved.");
      }}),
    ]);
  }

  function demoSection(S, actions) {
    return UI.card([
      UI.el("div", { class: "text-section" }, "Demo data"),
      UI.el("div", { class: "text-meta", style: { margin: "4px 0 10px" } }, "Everything seeded for Phase 1 review is flagged as demo data and can be removed once you're ready to run real initiatives."),
      UI.button("Remove demo data", { sm: true, variant: "danger", onClick: () => openConfirmModal(S, actions) }),
    ]);
  }

  function openConfirmModal(S, actions) {
    const m = UI.modal({
      title: "Remove demo data",
      body: UI.el("div", { class: "text-body" }, "This permanently deletes every demo-flagged initiative, meeting and action. People stay, since real work will need them. This can't be undone."),
      footer: [
        UI.button("Cancel", { variant: "ghost", onClick: () => m.close() }),
        UI.button("Remove demo data", { variant: "danger", onClick: async () => {
          for (const ini of S.initiatives) if (ini.demo) await Store.remove("initiatives", ini.id);
          for (const mtg of S.meetings) if (mtg.demo) await Store.remove("meetings", mtg.id);
          for (const act of S.actions) if (act.demo) await Store.remove("actions", act.id);
          m.close();
          UI.toast("Demo data removed.");
        }}),
      ],
    });
  }

  function render(S, actions) {
    const wrap = UI.el("div", { class: "page-body" });
    wrap.appendChild(UI.el("h1", { class: "text-title" }, "Settings"));
    wrap.appendChild(peopleSection(S, actions));
    wrap.appendChild(deptSection(S, actions));
    wrap.appendChild(rulesSection(S, actions));
    wrap.appendChild(attentionSection(S, actions));
    wrap.appendChild(demoSection(S, actions));
    return wrap;
  }

  return { render };
})();
