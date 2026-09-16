/* Throughline — js/views/home.js
   Screen 1: role-tailored home (§7.1) built on the attention engine (§6). */
window.Views = window.Views || {};
window.Views.home = (() => {

  const BUCKET_TINT = { decide: "iris", unblock: "ember", respond: "amber", confirm: "beacon", overdue: "ember" };

  function attentionItemRow(S, actions, item) {
    const ini = S.initiatives.find(i => i.id === item.initiativeId);
    return UI.el("div", { class: "attn-item" }, [
      UI.el("div", { class: "bar", style: { background: `var(--${BUCKET_TINT[item.bucket]})` } }),
      UI.el("div", { class: "body" }, [
        UI.el("div", { class: "why" }, [ini ? UI.el("b", {}, ini.title + " — ") : null, item.why]),
        UI.el("div", { class: "meta" }, ini ? `${ini.ref} · ${Model.STAGE_LABEL[ini.stage]}` : ""),
      ]),
      UI.el("div", { class: "actions" }, [
        UI.button(item.actionLabel, { sm: true, onClick: () => actions.navigate(item.route) }),
        UI.button("Mute", { sm: true, variant: "ghost", onClick: () => openMuteModal(S, actions, item) }),
      ]),
    ]);
  }

  function openMuteModal(S, actions, item) {
    const reasonInput = UI.textArea({ placeholder: "Why mute this?" });
    const untilInput = UI.textInput({ type: "date", value: (() => { const d = new Date(); d.setDate(d.getDate() + 14); return UI.todayStr(d); })() });
    const m = UI.modal({
      title: "Mute this item",
      body: UI.el("div", { class: "card-stack" }, [UI.field("Reason", reasonInput), UI.field("Until", untilInput)]),
      footer: [
        UI.button("Cancel", { variant: "ghost", onClick: () => m.close() }),
        UI.button("Mute", { variant: "primary", onClick: async () => {
          if (!reasonInput.value.trim()) { UI.toast("A reason is required."); return; }
          const ini = S.initiatives.find(i => i.id === item.initiativeId);
          if (!ini) { m.close(); return; }
          const fresh = JSON.parse(JSON.stringify(ini));
          fresh.snoozes = fresh.snoozes || [];
          fresh.snoozes.push({ rule: item.ruleKey, untilOn: untilInput.value, reason: reasonInput.value.trim() });
          await Store.put("initiatives", fresh.id, fresh);
          m.close();
        }}),
      ],
    });
  }

  function attentionStream(S, actions, personId) {
    const items = Model.attention(S, personId, null);
    const muted = Model.mutedItems(S, personId, null);
    const wrap = UI.el("div", { class: "region-gap" });

    if (!items.length) {
      wrap.appendChild(UI.card([UI.emptyState("Nothing needs you right now", "New items will show up here the moment something starts waiting on you.")]));
    }

    for (const bucket of Model.BUCKET_ORDER) {
      const inBucket = items.filter(i => i.bucket === bucket);
      if (!inBucket.length) continue;
      const shown = inBucket.slice(0, 6);
      const bwrap = UI.el("div", { class: "attn-bucket" });
      bwrap.appendChild(UI.el("div", { class: "attn-bucket-title" }, [
        UI.chip(Model.BUCKET_LABEL[bucket], BUCKET_TINT[bucket]),
        UI.el("span", { class: "text-meta" }, `${inBucket.length}`),
      ]));
      for (const item of shown) bwrap.appendChild(attentionItemRow(S, actions, item));
      if (inBucket.length > 6) {
        bwrap.appendChild(UI.button(`Show all ${inBucket.length}`, { sm: true, variant: "ghost" }));
      }
      wrap.appendChild(bwrap);
    }

    if (muted.length) {
      const mwrap = UI.el("div", { class: "attn-bucket" });
      mwrap.appendChild(UI.el("div", { class: "attn-bucket-title" }, [UI.chip(`Muted — ${muted.length}`, "neutral")]));
      for (const mu of muted) {
        const ini = S.initiatives.find(i => i.id === mu.initiativeId);
        mwrap.appendChild(UI.el("div", { class: "attn-item" }, [
          UI.el("div", { class: "bar", style: { background: "var(--text-3)" } }),
          UI.el("div", { class: "body" }, [
            UI.el("div", { class: "why" }, `${ini ? ini.title : mu.initiativeId} — ${mu.reason}`),
            UI.el("div", { class: "meta" }, `Muted until ${UI.fmtDate(mu.untilOn)}`),
          ]),
          UI.button("Unmute", { sm: true, variant: "ghost", onClick: async () => {
            const fresh = JSON.parse(JSON.stringify(ini));
            fresh.snoozes = (fresh.snoozes || []).filter(s => !(s.rule === mu.rule && s.untilOn === mu.untilOn));
            await Store.put("initiatives", fresh.id, fresh);
          }}),
        ]));
      }
      wrap.appendChild(mwrap);
    }

    return wrap;
  }

  function nextReviewCard(S) {
    const upcoming = S.meetings.filter(m => m.status !== "closed").sort((a, b) => a.on.localeCompare(b.on))[0];
    if (!upcoming) return UI.card([UI.el("div", { class: "text-body muted" }, "No upcoming reviews scheduled.")]);
    return UI.card([
      UI.el("div", { class: "mono-label" }, "Next review"),
      UI.el("div", { class: "text-card", style: { marginTop: "4px" } }, upcoming.title),
      UI.el("div", { class: "text-meta", style: { marginTop: "2px" } }, UI.fmtDate(upcoming.on, { year: true })),
      UI.button("Open", { sm: true, variant: "ghost", style: { marginTop: "8px" }, onClick: () => window.location.hash = `#/reviews/${upcoming.id}` }),
    ], { class: "raised" });
  }

  function whereWorkSits(S) {
    const counts = {};
    for (const s of Model.STAGES) counts[s] = 0;
    for (const ini of S.initiatives) counts[ini.stage] = (counts[ini.stage] || 0) + 1;
    return UI.card([
      UI.el("div", { class: "text-section" }, "Where the work sits"),
      UI.el("div", { class: "status-row", style: { marginTop: "10px", gridTemplateColumns: "repeat(3, 1fr)" } },
        ["proposed", "evaluating", "prioritized", "clearing", "in_flight", "closing"].map(s => UI.statusBox(Model.STAGE_LABEL[s], String(counts[s] || 0)))),
    ]);
  }

  function whoIsCarrying(S) {
    const byOwner = {};
    for (const ini of S.initiatives) {
      if (!ini.ownerId || ["closed", "declined", "deferred"].includes(ini.stage)) continue;
      byOwner[ini.ownerId] = (byOwner[ini.ownerId] || 0) + 1;
    }
    const rows = Object.entries(byOwner).sort((a, b) => b[1] - a[1]).map(([pid, n]) => {
      const p = S.people.find(x => x.id === pid);
      return UI.el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, [
        p ? UI.personRow(p, { hideTitle: true }) : UI.el("span", {}, pid),
        UI.chip(String(n), n >= 3 ? "amber" : "neutral"),
      ]);
    });
    return UI.card([UI.el("div", { class: "text-section" }, "Who is carrying what"), UI.el("div", { class: "card-stack", style: { marginTop: "10px" } }, rows.length ? rows : [UI.el("div", { class: "text-body muted" }, "Nothing assigned yet.")])]);
  }

  function changedSinceLastReview(S) {
    const lastClosed = S.meetings.filter(m => m.status === "closed").sort((a, b) => b.on.localeCompare(a.on))[0];
    const since = lastClosed ? lastClosed.on : "2000-01-01";
    const events = [];
    for (const ini of S.initiatives) {
      for (const h of ini.history || []) {
        if (h.on.slice(0, 10) > since && ["stage_change", "priority_change", "decision", "outcome"].includes(h.kind)) {
          events.push({ ini, h });
        }
      }
    }
    events.sort((a, b) => b.h.on.localeCompare(a.h.on));
    return UI.card([
      UI.el("div", { class: "text-section" }, `Changed since ${lastClosed ? UI.fmtDate(lastClosed.on) : "last review"}`),
      UI.el("div", { class: "card-stack", style: { marginTop: "10px" } }, events.slice(0, 6).map(e => UI.el("div", { class: "text-body" }, [UI.el("b", {}, e.ini.title + ": "), e.h.summary]))
        .concat(events.length ? [] : [UI.el("div", { class: "text-body muted" }, "No governance-level changes yet.")])),
    ]);
  }

  // ---- senior director rollup ----
  function seniorDirectorHome(S, actions, person) {
    const wrap = UI.el("div", { class: "page-body" });
    wrap.appendChild(UI.el("h1", { class: "text-title" }, `Welcome back, ${person.name.split(" ")[0]}`));

    wrap.appendChild(UI.el("div", { class: "text-section" }, "Decisions awaiting me"));
    const awaiting = [];
    for (const ini of S.initiatives) {
      for (const req of ini.requirements || []) {
        if (req.key === "senior_director" && req.status === "awaiting_decision") awaiting.push({ ini, req });
      }
    }
    if (!awaiting.length) wrap.appendChild(UI.card([UI.el("div", { class: "text-body muted" }, "Nothing awaiting your decision.")]));
    for (const { ini, req } of awaiting) {
      wrap.appendChild(UI.el("div", { class: "attn-item" }, [
        UI.el("div", { class: "bar", style: { background: "var(--iris)" } }),
        UI.el("div", { class: "body" }, [
          UI.el("div", { class: "why" }, [UI.el("b", {}, ini.title + " — "), req.because]),
          UI.el("div", { class: "meta" }, ini.ref),
        ]),
        UI.button("Decide", { sm: true, onClick: () => actions.navigate(`#/i/${ini.id}`) }),
      ]));
    }

    wrap.appendChild(UI.el("div", { class: "text-section", style: { marginTop: "10px" } }, "Escalations & at-risk across all areas"));
    const atRisk = S.initiatives.filter(ini => { const h = Model.health(ini, null, S.config); return h && (h.value === "at_risk" || h.value === "stalled"); });
    wrap.appendChild(UI.card([atRisk.length ? UI.el("div", { class: "card-stack" }, atRisk.map(ini => UI.el("div", { style: { display: "flex", justifyContent: "space-between", cursor: "pointer" }, onClick: () => actions.navigate(`#/i/${ini.id}`) }, [
      UI.el("span", { class: "text-body" }, ini.title), window.Views.initiatives.healthChip(ini, S),
    ]))) : UI.el("div", { class: "text-body muted" }, "Nothing at risk right now.")]));

    wrap.appendChild(UI.el("div", { class: "text-section", style: { marginTop: "10px" } }, "Area rollup"));
    const areaRow = UI.el("div", { class: "status-row", style: { gridTemplateColumns: "repeat(3, 1fr)" } });
    for (const area of S.config.areas || []) {
      const deptIds = new Set((S.config.departments || []).filter(d => d.areaId === area.id).map(d => d.id));
      const inArea = S.initiatives.filter(ini => (ini.departments || []).some(d => deptIds.has(d)));
      const atRiskCount = inArea.filter(ini => { const h = Model.health(ini, null, S.config); return h && (h.value === "at_risk" || h.value === "stalled"); }).length;
      const blockedCount = inArea.filter(ini => Model.readiness(ini).value === "blocked").length;
      areaRow.appendChild(UI.statusBox(area.name, String(inArea.length), `${atRiskCount} at risk · ${blockedCount} blocked`));
    }
    wrap.appendChild(areaRow);

    wrap.appendChild(UI.el("div", { class: "text-section", style: { marginTop: "10px" } }, "Upcoming governance dates"));
    wrap.appendChild(UI.card([UI.el("div", { class: "card-stack" }, S.meetings.filter(m => m.status !== "closed").sort((a, b) => a.on.localeCompare(b.on)).map(m => UI.el("div", { style: { display: "flex", justifyContent: "space-between" } }, [UI.el("span", {}, m.title), UI.el("span", { class: "text-meta" }, UI.fmtDate(m.on, { year: true }))])))]));

    return wrap;
  }

  // ---- contributor home ----
  function contributorHome(S, actions, person) {
    const wrap = UI.el("div", { class: "page-body" });
    wrap.appendChild(UI.el("h1", { class: "text-title" }, `Welcome, ${person.name.split(" ")[0]}`));
    const mine = S.initiatives.filter(i => i.submittedBy && i.submittedBy.personId === person.id);
    wrap.appendChild(UI.el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, [
      UI.el("div", { class: "text-section" }, "My submissions"),
      UI.button("Propose an initiative", { variant: "primary", sm: true, onClick: () => actions.navigate("#/intake") }),
    ]));
    if (!mine.length) {
      wrap.appendChild(UI.card([UI.emptyState("Nothing submitted yet", "Have an idea for improving how we work? Propose it — a director reviews every submission.", UI.button("Propose an initiative", { variant: "primary", sm: true, onClick: () => actions.navigate("#/intake") }))]));
    }
    for (const ini of mine) {
      wrap.appendChild(UI.el("div", { class: "card", style: { cursor: "pointer" }, onClick: () => actions.navigate(`#/i/${ini.id}`) }, [
        UI.el("div", { style: { display: "flex", justifyContent: "space-between" } }, [UI.el("span", { class: "text-body", style: { fontWeight: 600 } }, ini.title), window.Views.initiatives.stageChip(ini)]),
        UI.el("div", { class: "text-meta", style: { marginTop: "4px" } }, ini.ref),
      ]));
    }
    return wrap;
  }

  function defaultHome(S, actions, person) {
    const wrap = UI.el("div", { class: "page-body" });
    wrap.appendChild(UI.el("h1", { class: "text-title" }, `Welcome back, ${person.name.split(" ")[0]}`));

    const grid = UI.el("div", { style: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px", alignItems: "start" } });
    if (window.innerWidth <= 900) grid.style.gridTemplateColumns = "1fr";
    const left = UI.el("div", { class: "region-gap" });
    left.appendChild(attentionStream(S, actions, person.id));
    const right = UI.el("div", { class: "region-gap" });
    right.appendChild(nextReviewCard(S));
    if (["director", "senior_director", "peer_director"].includes(person.role)) {
      right.appendChild(whereWorkSits(S));
      right.appendChild(whoIsCarrying(S));
      right.appendChild(changedSinceLastReview(S));
    }
    grid.appendChild(left);
    grid.appendChild(right);
    wrap.appendChild(grid);
    return wrap;
  }

  function render(S, actions) {
    const person = S.people.find(p => p.id === S.me);
    if (!person) return UI.emptyState("No identity selected");

    if (person.role === "senior_director") return seniorDirectorHome(S, actions, person);
    if (person.role === "contributor") return contributorHome(S, actions, person);
    return defaultHome(S, actions, person);
  }

  return { render };
})();
