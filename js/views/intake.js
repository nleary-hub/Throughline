/* Throughline — js/views/intake.js
   Screen 4: Propose (§8 #4). Two steps + live inference panel. */
window.Views = window.Views || {};
window.Views.intake = (() => {

  // Lives outside render() so it survives the re-render that Store.put
  // itself triggers (via the global change subscription) mid-submit —
  // a fresh `state` object per render() call would otherwise lose the
  // "just submitted" confirmation before anyone sees it.
  let justSubmittedRef = null;

  function inferType(answers) {
    if (answers.newProcedure) return "new_service";
    return "process_improvement";
  }

  // Rough, intake-only heuristic — the real size is a director's call made
  // during triage. This exists to give the submitter an honest preview, so
  // it has to actually be able to reach "L" from what intake collects: a
  // capital estimate (mirrors the senior-director sign-off threshold) or a
  // new procedure that also spans more than one department.
  function inferSize(answers, capital, departmentCount) {
    const crosses = (departmentCount || 0) > 1;
    if (capital >= 250000 || (answers.newProcedure && crosses)) return "L";
    if (capital >= 50000 || answers.needsSupplies === "yes" || answers.needsSoftware || crosses) return "M";
    return "S";
  }

  function livePreview(state, S) {
    const type = inferType(state.answers);
    const capital = Number(state.capital) || 0;
    const size = inferSize(state.answers, capital, state.departments.length);
    const fakeIni = {
      type, size, track: "departmental", estimates: { capital, fte: 0, crossesServiceLines: state.departments.length > 1 },
      intakeAnswers: state.answers,
    };
    const applicable = Model.computeApplicableRequirements(fakeIni, S.config);
    return UI.card([
      UI.el("div", { class: "text-section" }, "What this looks like so far"),
      UI.el("div", { class: "card-stack", style: { marginTop: "10px" } }, [
        UI.el("div", {}, [UI.el("span", { class: "faint mono-label" }, "Likely type: "), UI.chip(Model.TYPE_LABEL[type], "steel")]),
        UI.el("div", {}, [UI.el("span", { class: "faint mono-label" }, "Rough size: "), UI.chip(size, "neutral")]),
        UI.el("div", { class: "mono-label", style: { marginTop: "8px" } }, "Requirements that will likely apply"),
        ...(applicable.length ? applicable.map(a => UI.el("div", { class: "text-body" }, `• ${Model.REQ_LABEL[a.key]} — ${a.because}`)) : [UI.el("div", { class: "text-body muted" }, "None triggered yet — this may stay a lightweight departmental change.")]),
        UI.el("div", { class: "text-meta", style: { marginTop: "10px" } }, `A director will triage this within ${((S.config && S.config.attention) || Model.DEFAULT_ATTENTION).triageTargetDays} business days.`),
      ]),
    ], { class: "raised" });
  }

  function render(S, actions) {
    if (justSubmittedRef) {
      const wrap = UI.el("div", { class: "page-body" });
      wrap.appendChild(UI.el("h1", { class: "text-title" }, "Propose an initiative"));
      wrap.appendChild(UI.emptyState(`Submitted — ${justSubmittedRef}`,
        "A director will triage this within a few business days. You can track its status any time from your home screen.",
        UI.button("Propose another", { onClick: () => { justSubmittedRef = null; actions.refreshAndRender(); } })));
      return wrap;
    }

    const state = {
      step: 1,
      title: "", problem: "", departments: [], capital: "",
      answers: { needsSupplies: "unsure", needsSoftware: false, newProcedure: false, timing: "this_fiscal_year" },
      submitterName: "", submitterEmail: "", sponsorId: "", notes: "",
    };

    const wrap = UI.el("div", { class: "page-body" });
    const grid = UI.el("div", { class: "split-grid", style: { gridTemplateColumns: "1.4fr 1fr" } });
    const formCol = UI.el("div");
    const previewCol = UI.el("div");
    grid.appendChild(formCol);
    grid.appendChild(previewCol);
    wrap.appendChild(UI.el("h1", { class: "text-title" }, "Propose an initiative"));
    wrap.appendChild(grid);

    function redrawPreview() { UI.clear(previewCol); previewCol.appendChild(livePreview(state, S)); }

    function drawStep1() {
      UI.clear(formCol);
      const titleInput = UI.textInput({ value: state.title, placeholder: "e.g. Same-day discharge pathway for elective PCI", onInput: (e) => { state.title = e.target.value; } });
      const problemInput = UI.textArea({ value: state.problem, placeholder: "What goes wrong today?", onInput: (e) => { state.problem = e.target.value; } });
      const deptWrap = UI.el("div", { class: "check-row" });
      for (const d of S.config.departments || []) {
        const selected = state.departments.includes(d.id);
        deptWrap.appendChild(UI.pillOption(d.name, selected, () => {
          if (state.departments.includes(d.id)) state.departments = state.departments.filter(x => x !== d.id);
          else state.departments = [...state.departments, d.id];
          drawStep1();
        }));
      }
      const capitalInput = UI.textInput({ type: "number", min: "0", value: state.capital, placeholder: "Optional — only if you have a rough number", onInput: (e) => { state.capital = e.target.value; redrawPreview(); } });

      function pillGroup(field, options) {
        const row = UI.el("div", { class: "radio-row" });
        for (const opt of options) {
          row.appendChild(UI.pillOption(opt.label, state.answers[field] === opt.value, () => { state.answers[field] = opt.value; drawStep1(); redrawPreview(); }));
        }
        return row;
      }

      const aiWrap = UI.el("div", { style: { marginTop: "12px" } });
      function drawAiButton() {
        UI.clear(aiWrap);
        if (!AI.available()) return;
        aiWrap.appendChild(UI.button("✨ Get AI suggestions", { sm: true, variant: "ghost", onClick: () => getAiSuggestions(aiWrap) }));
      }
      async function getAiSuggestions(hostWrap) {
        if (!state.title.trim() || !state.problem.trim()) { UI.toast("Add a title and problem first."); return; }
        UI.clear(hostWrap);
        hostWrap.appendChild(UI.el("div", { class: "text-meta" }, "Asking AI for suggestions…"));
        const depts = S.config.departments || [];
        const prompt = `You help fill out an intake form for an internal hospital operations initiative tracker. Given the title and problem below, suggest form values. Respond with ONLY a JSON object (no prose, no markdown fences) matching exactly this shape:
{"type":"new_service|quality_improvement|process_improvement|capital_construction|practice_change|departmental|other","departmentIds":["..."],"needsSupplies":"no|unsure|yes","needsSoftware":true|false,"newProcedure":true|false,"tightenedProblem":"a tightened 1-2 sentence restatement, plain language","reasoning":"one sentence on why you picked this type"}

Departments (pick zero or more ids that seem involved):
${depts.map(d => `${d.id} — ${d.name}`).join("\n")}

Title: ${state.title.trim()}
Problem: ${state.problem.trim()}`;
        const suggestion = await AI.askJson(prompt, { modelTier: "quick" });
        UI.clear(hostWrap);
        if (!suggestion) {
          hostWrap.appendChild(UI.el("div", { class: "text-meta" }, "AI suggestions aren't available right now — check the API key in Settings, or continue filling this out yourself."));
          drawAiButton();
          return;
        }
        const validDeptIds = new Set(depts.map(d => d.id));
        const suggestedDeptNames = (suggestion.departmentIds || []).filter(id => validDeptIds.has(id)).map(id => depts.find(d => d.id === id).name);
        hostWrap.appendChild(UI.card([
          UI.el("div", { class: "mono-label" }, "AI suggestion"),
          UI.el("div", { class: "card-stack", style: { marginTop: "8px" } }, [
            UI.el("div", { class: "text-body" }, [UI.el("b", {}, "Type: "), Model.TYPE_LABEL[suggestion.type] || suggestion.type]),
            suggestedDeptNames.length ? UI.el("div", { class: "text-body" }, [UI.el("b", {}, "Departments: "), suggestedDeptNames.join(", ")]) : null,
            UI.el("div", { class: "text-body" }, [UI.el("b", {}, "Supplies/devices: "), String(suggestion.needsSupplies)]),
            UI.el("div", { class: "text-body" }, [UI.el("b", {}, "New software: "), suggestion.needsSoftware ? "Yes" : "No"]),
            UI.el("div", { class: "text-body" }, [UI.el("b", {}, "New procedure: "), suggestion.newProcedure ? "Yes" : "No"]),
            suggestion.tightenedProblem ? UI.el("div", { class: "text-body" }, [UI.el("b", {}, "Tightened problem: "), suggestion.tightenedProblem]) : null,
            suggestion.reasoning ? UI.el("div", { class: "text-meta" }, suggestion.reasoning) : null,
          ]),
          UI.el("div", { style: { display: "flex", gap: "8px", marginTop: "10px" } }, [
            UI.button("Apply", { sm: true, variant: "primary", onClick: () => {
              // Type itself isn't a free field here — it's always derived from
              // the newProcedure answer (see inferType) and confirmed by a
              // director at triage; the AI's type guess is informational,
              // shown above, not a field this form can independently set.
              if (suggestedDeptNames.length) state.departments = Array.from(new Set([...state.departments, ...suggestion.departmentIds.filter(id => validDeptIds.has(id))]));
              if (["no", "unsure", "yes"].includes(suggestion.needsSupplies)) state.answers.needsSupplies = suggestion.needsSupplies;
              state.answers.needsSoftware = !!suggestion.needsSoftware;
              state.answers.newProcedure = !!suggestion.newProcedure;
              if (suggestion.tightenedProblem) state.problem = suggestion.tightenedProblem;
              UI.toast("Suggestions applied — review before submitting.");
              drawStep1();
            }}),
            UI.button("Dismiss", { sm: true, variant: "ghost", onClick: () => drawAiButton() }),
          ]),
        ], { class: "raised" }));
      }
      drawAiButton();

      formCol.appendChild(UI.card([
        UI.el("div", { class: "card-stack" }, [
          UI.field("Title", titleInput),
          UI.field("Problem", problemInput, "What goes wrong today, in plain language."),
          UI.field("Departments involved", deptWrap),
          UI.field("Rough budget estimate, if known ($)", capitalInput),
          UI.field("Does this need new supplies or devices?", pillGroup("needsSupplies", [{ value: "no", label: "No" }, { value: "unsure", label: "Not sure" }, { value: "yes", label: "Yes" }])),
          UI.field("Does this need new software or a system interface?", pillGroup("needsSoftware", [{ value: false, label: "No" }, { value: true, label: "Yes" }])),
          UI.field("Does this introduce a new procedure?", pillGroup("newProcedure", [{ value: false, label: "No" }, { value: true, label: "Yes" }])),
          UI.field("Timing", pillGroup("timing", [{ value: "this_fiscal_year", label: "This fiscal year" }, { value: "next_fiscal_year", label: "Next fiscal year" }, { value: "unsure", label: "Not sure" }])),
        ]),
        aiWrap,
        UI.el("div", { style: { display: "flex", justifyContent: "flex-end", marginTop: "14px" } }, [
          UI.button("Next", { variant: "primary", onClick: () => {
            if (!state.title.trim() || !state.problem.trim()) { UI.toast("Title and problem are required."); return; }
            drawStep2();
          }}),
        ]),
      ]));
      redrawPreview();
    }

    function drawStep2() {
      UI.clear(formCol);
      const nameInput = UI.textInput({ value: state.submitterName, placeholder: "Your name", onInput: (e) => { state.submitterName = e.target.value; } });
      const emailInput = UI.textInput({ type: "email", value: state.submitterEmail, placeholder: "Your email", onInput: (e) => { state.submitterEmail = e.target.value; } });
      const sponsorSel = UI.select([{ value: "", label: "None yet" }, ...S.people.filter(p => p.role === "physician").map(p => ({ value: p.id, label: p.name }))], { value: state.sponsorId, onChange: (e) => { state.sponsorId = e.target.value; } });
      const notesInput = UI.textArea({ value: state.notes, placeholder: "Anything else we should know?", onInput: (e) => { state.notes = e.target.value; } });

      formCol.appendChild(UI.card([
        UI.el("div", { class: "card-stack" }, [
          UI.field("Your name", nameInput),
          UI.field("Your email", emailInput),
          UI.field("Physician sponsor, if known", sponsorSel),
          UI.field("Anything else", notesInput),
        ]),
        UI.el("div", { style: { display: "flex", justifyContent: "space-between", marginTop: "14px" } }, [
          UI.button("Back", { variant: "ghost", onClick: () => drawStep1() }),
          UI.button("Submit", { variant: "primary", onClick: submit }),
        ]),
      ]));
    }

    async function submit() {
      if (!state.submitterName.trim()) { UI.toast("Your name is required."); return; }
      const id = Store.newId("ini_");
      const year = String(new Date().getFullYear());
      const counter = ((S.config.refCounter || {})[year] || 0) + 1;
      const ref = `TL-${year}-${String(counter).padStart(3, "0")}`;
      const type = inferType(state.answers);
      const capital = Math.max(0, Number(state.capital) || 0);
      const ini = {
        id, ref, title: state.title.trim(), problem: state.problem.trim(),
        type, track: "departmental", departments: state.departments,
        size: inferSize(state.answers, capital, state.departments.length),
        stage: "proposed", stageEnteredOn: UI.todayStr(),
        priority: { band: "unranked", rank: null, setOn: null, setBy: null, holdsUntil: null, rationale: "" },
        healthOverride: null,
        ownerId: null, sponsorId: state.sponsorId || null, execSponsorId: null, contributorIds: [],
        nextAction: { text: "Director triage", ownerId: null, dueOn: null, kind: "decision" },
        requirements: [], milestones: [], risks: [], dependencies: [],
        estimates: { capital, fte: 0, crossesServiceLines: state.departments.length > 1 },
        intakeAnswers: state.answers,
        submittedBy: { name: state.submitterName.trim(), email: state.submitterEmail.trim(), personId: S.me || null },
        submittedOn: UI.todayStr(),
        history: [{ id: Store.newId("ev_"), on: new Date().toISOString(), byId: S.me || null, kind: "created", summary: "Submitted via intake.", detail: state.notes.trim(), meta: {} }],
        outcome: null, closedOn: null, snoozes: [],
      };
      // Set before the writes: Store.put's change notification re-renders the
      // whole app synchronously (in local-storage mode) or asynchronously (in
      // live mode) — either way, render() needs this flag already in place
      // to show the confirmation instead of a blank, reset form.
      justSubmittedRef = ref;
      await Store.put("initiatives", id, ini);
      const cfg = JSON.parse(JSON.stringify(S.config));
      cfg.refCounter = cfg.refCounter || {};
      cfg.refCounter[year] = counter;
      await Store.put("config", "app", cfg);
      actions.refreshAndRender();
    }

    drawStep1();
    return wrap;
  }

  return { render };
})();
