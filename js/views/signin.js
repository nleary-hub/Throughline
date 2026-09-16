/* Throughline — js/views/signin.js */
window.Views = window.Views || {};
window.Views.signin = (() => {
  function render(S, actions) {
    const wrap = UI.el("div", { class: "signin-wrap" });
    const card = UI.el("div", { class: "signin-card" });

    card.appendChild(UI.el("div", { class: "signin-mark", html: UI.markSvg(true) }));
    card.appendChild(UI.el("div", { class: "signin-title" }, "Throughline"));
    card.appendChild(UI.el("div", { class: "signin-tagline" }, "What's waiting, on whom, and why."));

    const list = UI.el("div", { class: "signin-list" });
    const people = (S.people || []).slice().sort((a, b) => {
      const order = { director: 0, senior_director: 1, peer_director: 2, manager: 3, coordinator: 4, physician: 5, contributor: 6 };
      return (order[a.role] ?? 9) - (order[b.role] ?? 9) || a.name.localeCompare(b.name);
    });
    if (!people.length) {
      const reason = S.storeMode === "offline"
        ? "Storage isn't connected right now (see the banner above), so no one can sign in yet."
        : "Seed data hasn't loaded. Run the seed step, then reload.";
      list.appendChild(UI.emptyState("No people yet", reason));
    }
    for (const p of people) {
      const row = UI.el("div", { class: "signin-person", onClick: () => actions.setMe(p.id) }, [
        UI.avatar(p),
        UI.el("div", { class: "meta" }, [
          UI.el("div", { class: "name" }, p.name),
          UI.el("div", { class: "role" }, p.title || ""),
        ]),
      ]);
      list.appendChild(row);
    }
    card.appendChild(list);

    card.appendChild(UI.el("div", { class: "signin-note" },
      "Throughline can't yet verify who you are — pick yourself from the list. Everyone who can open this page can see and change the same data."));

    wrap.appendChild(card);
    return wrap;
  }
  return { render };
})();
