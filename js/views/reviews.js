/* Throughline — js/views/reviews.js
   Screen 7: Reviews — meeting list + generated briefing (§8 #7). */
window.Views = window.Views || {};
window.Views.reviews = (() => {

  function briefingMarkdown(S, mtg) {
    const lines = [];
    lines.push(`# ${mtg.title} — ${UI.fmtDate(mtg.on, { year: true })}`);
    lines.push("");
    const slate = (mtg.agenda.slate || []).map(id => S.initiatives.find(i => i.id === id)).filter(Boolean);
    const decisionIds = new Set((mtg.agenda.decisions || []));
    const decisionInis = (mtg.agenda.decisions || []).map(id => S.initiatives.find(i => i.id === id)).filter(Boolean);

    if (decisionInis.length || (mtg.decisions || []).length) {
      lines.push("## Decisions requested");
      for (const ini of decisionInis) lines.push(`- **${ini.title}** (${ini.ref}) — ${Model.STAGE_LABEL[ini.stage]}`);
      for (const d of mtg.decisions || []) {
        const ini = S.initiatives.find(i => i.id === d.initiativeId);
        lines.push(`- ${ini ? ini.title : d.initiativeId}: **${d.outcome}** — ${d.rationale}`);
      }
      lines.push("");
    }

    if (slate.length) {
      lines.push("## Priority slate");
      slate.forEach((ini, idx) => lines.push(`${idx + 1}. ${ini.title} (${ini.ref}) — ${Model.readiness(ini).value}`));
      lines.push("");
    }

    const priorClosed = S.meetings
      .filter(m => m.status === "closed" && m.id !== mtg.id && m.on < mtg.on)
      .sort((a, b) => b.on.localeCompare(a.on))[0];
    const since = priorClosed ? priorClosed.on : "2000-01-01";
    const changed = [];
    for (const ini of S.initiatives) {
      for (const h of ini.history || []) {
        if (h.on.slice(0, 10) > since && ["stage_change", "priority_change", "decision", "outcome"].includes(h.kind)) changed.push({ ini, h });
      }
    }
    if (changed.length) {
      lines.push("## Since last meeting");
      changed.sort((a, b) => a.h.on.localeCompare(b.h.on));
      for (const c of changed.slice(0, 20)) lines.push(`- ${c.ini.title}: ${c.h.summary}`);
      lines.push("");
    }

    const atRisk = S.initiatives.filter(ini => { const h = Model.health(ini, null, S.config); return h && (h.value === "at_risk" || h.value === "stalled"); });
    if (atRisk.length) {
      lines.push("## At risk");
      for (const ini of atRisk) lines.push(`- ${ini.title} (${ini.ref})`);
      lines.push("");
    }

    const completions = (mtg.agenda.completions || []).map(id => S.initiatives.find(i => i.id === id)).filter(Boolean);
    if (completions.length) {
      lines.push("## Completed");
      for (const ini of completions) lines.push(`- ${ini.title}${ini.outcome ? ` — ${ini.outcome.result}` : ""}`);
      lines.push("");
    }

    const actionsCarried = S.actions.filter(a => a.status === "open");
    if (actionsCarried.length) {
      lines.push("## Carried-forward action items");
      for (const a of actionsCarried) {
        const owner = S.people.find(p => p.id === a.ownerId);
        lines.push(`- ${a.text} — ${owner ? owner.name : "unassigned"} — due ${UI.fmtDate(a.dueOn)}${a.dueOn < UI.todayStr() ? " (overdue)" : ""}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  function meetingCard(S, actions, m) {
    return UI.el("div", { class: "card", style: { cursor: "pointer" }, onClick: () => actions.navigate(m.status === "draft" ? `#/governance/${m.id}` : `#/reviews/${m.id}`) }, [
      UI.el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, [
        UI.el("div", {}, [
          UI.el("div", { class: "text-body", style: { fontWeight: 600 } }, m.title),
          UI.el("div", { class: "text-meta", style: { marginTop: "3px" } }, UI.fmtDate(m.on, { year: true })),
        ]),
        UI.chip(m.status === "closed" ? "Closed" : "Draft", m.status === "closed" ? "beacon" : "amber"),
      ]),
    ]);
  }

  function renderList(S, actions) {
    const wrap = UI.el("div", { class: "page-body" });
    wrap.appendChild(UI.el("h1", { class: "text-title" }, "Reviews"));
    const upcoming = S.meetings.filter(m => m.status !== "closed").sort((a, b) => a.on.localeCompare(b.on));
    const past = S.meetings.filter(m => m.status === "closed").sort((a, b) => b.on.localeCompare(a.on));
    wrap.appendChild(UI.el("div", { class: "text-section" }, "Upcoming"));
    wrap.appendChild(UI.el("div", { class: "card-stack" }, upcoming.length ? upcoming.map(m => meetingCard(S, actions, m)) : [UI.emptyState("Nothing scheduled")]));
    wrap.appendChild(UI.el("div", { class: "text-section", style: { marginTop: "10px" } }, "Past"));
    wrap.appendChild(UI.el("div", { class: "card-stack" }, past.length ? past.map(m => meetingCard(S, actions, m)) : [UI.emptyState("No past reviews yet")]));
    return wrap;
  }

  function renderMeeting(S, actions, mtg) {
    const wrap = UI.el("div", { class: "page-body" });
    wrap.appendChild(UI.el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" } }, [
      UI.el("div", {}, [
        UI.el("h1", { class: "text-title" }, mtg.title),
        UI.el("div", { class: "text-meta", style: { marginTop: "4px" } }, UI.fmtDate(mtg.on, { year: true })),
      ]),
      UI.el("div", { style: { display: "flex", gap: "8px" } }, [
        mtg.status === "draft" ? UI.button("Open governance session", { variant: "primary", sm: true, onClick: () => actions.navigate(`#/governance/${mtg.id}`) }) : null,
        UI.button("Export summary", { sm: true, id: "export-btn" }),
      ]),
    ]));

    const md = briefingMarkdown(S, mtg);
    const pre = UI.el("pre", { style: { whiteSpace: "pre-wrap", fontFamily: "var(--font-mono)", fontSize: "11.5px", lineHeight: "1.7" } }, md);
    wrap.appendChild(UI.card([pre]));

    function downloadViaBlob() {
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${mtg.id}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    setTimeout(async () => {
      const btn = wrap.querySelector("#export-btn");
      if (!btn) return;
      const downloads = (window.claude && typeof window.claude.use === "function") ? await window.claude.use("downloads") : null;
      btn.addEventListener("click", async () => {
        if (!downloads) {
          downloadViaBlob();
          UI.toast("Summary downloaded.");
          return;
        }
        try {
          await downloads.save({ filename: `${mtg.id}.md`, data: md });
          UI.toast("Summary saved.");
        } catch (e) {
          UI.toast("Save was cancelled or failed.");
        }
      });
    }, 0);

    return wrap;
  }

  function render(S, actions, id) {
    if (id) {
      const mtg = S.meetings.find(m => m.id === id);
      if (!mtg) return UI.emptyState("Meeting not found");
      return renderMeeting(S, actions, mtg);
    }
    return renderList(S, actions);
  }

  return { render };
})();
