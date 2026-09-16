/* Throughline — js/views/settings.js
   Screen 9: Settings (§8 #9). */
window.Views = window.Views || {};
window.Views.settings = (() => {

  const ROLE_OPTIONS = [
    { value: "director", label: "Director" },
    { value: "senior_director", label: "Senior director" },
    { value: "peer_director", label: "Peer director" },
    { value: "manager", label: "Manager" },
    { value: "coordinator", label: "Coordinator" },
    { value: "physician", label: "Physician" },
    { value: "contributor", label: "Contributor" },
  ];

  function openAddPersonModal(S, actions) {
    const nameInput = UI.textInput({ placeholder: "Full name" });
    const titleInput = UI.textInput({ placeholder: "Title, e.g. Director, Medicine" });
    const roleSel = UI.select(ROLE_OPTIONS, { value: "contributor" });
    const areaSel = UI.select([{ value: "", label: "None" }, ...(S.config.areas || []).map(a => ({ value: a.id, label: a.name }))], {});
    let depts = [];
    const deptWrap = UI.el("div", { class: "check-row" });
    function drawDepts() {
      UI.clear(deptWrap);
      for (const d of S.config.departments || []) {
        deptWrap.appendChild(UI.pillOption(d.name, depts.includes(d.id), () => {
          depts = depts.includes(d.id) ? depts.filter((x) => x !== d.id) : [...depts, d.id];
          drawDepts();
        }));
      }
    }
    drawDepts();

    const m = UI.modal({
      title: "Add person",
      body: UI.el("div", { class: "card-stack" }, [
        UI.field("Name", nameInput),
        UI.field("Title", titleInput),
        UI.field("Role", roleSel),
        UI.field("Departments", deptWrap),
        UI.field("Area (for directors and peer directors)", areaSel),
      ]),
      footer: [
        UI.button("Cancel", { variant: "ghost", onClick: () => m.close() }),
        UI.button("Add", { variant: "primary", onClick: async () => {
          if (!nameInput.value.trim()) { UI.toast("Name is required."); return; }
          const id = Store.newId("ppl_");
          const person = {
            id, name: nameInput.value.trim(), title: titleInput.value.trim(),
            role: roleSel.value, departments: depts, areaId: areaSel.value || null,
          };
          await Store.put("people", id, person);
          m.close();
          UI.toast(`${person.name} added.`);
        }}),
      ],
    });
  }

  function peopleSection(S, actions) {
    const rows = S.people.map(p => UI.el("div", { class: "card", style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, [
      UI.personRow(p),
      UI.chip(p.role.replace("_", " "), "neutral"),
    ]));
    return UI.card([
      UI.el("div", { class: "card-header" }, [
        UI.el("div", { class: "text-section" }, "People and roles"),
        UI.button("Add person", { sm: true, variant: "ghost", onClick: () => openAddPersonModal(S, actions) }),
      ]),
      UI.el("div", { class: "text-meta", style: { margin: "4px 0 10px" } }, "Editing or removing an existing person isn't wired up yet — that would need to reassign or archive everything already attributed to them."),
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
