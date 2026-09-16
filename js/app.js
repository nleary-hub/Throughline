/* ===================================================================
   Throughline — js/app.js
   Boot, router, global state, identity, rail.
   =================================================================== */

const App = (() => {
  const S = {
    people: [], initiatives: [], meetings: [], actions: [], config: null,
    me: null, // person id
    scope: "my_departments", // 'my_departments' | 'my_area' | 'all_areas'
    route: "#/",
    storeMode: "offline",
  };

  const root = document.getElementById("root");

  const ROUTES = [
    { path: "home", label: "Home", icon: "home" },
    { path: "initiatives", label: "Initiatives", icon: "list" },
    { path: "intake", label: "Propose", icon: "plus" },
    { path: "triage", label: "Triage", icon: "inbox", role: ["director", "senior_director", "peer_director"] },
    { path: "reviews", label: "Reviews", icon: "cal" },
    { path: "archive", label: "Archive", icon: "archive" },
    { path: "settings", label: "Settings", icon: "gear", role: ["director", "senior_director"] },
  ];

  function lsGet(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { /* ignore */ }
  }

  function refreshState() {
    S.people = Store.all("people");
    S.initiatives = Store.all("initiatives");
    S.meetings = Store.all("meetings");
    S.actions = Store.all("actions");
    S.config = Store.get("config", "app") || { departments: [], areas: [], rules: {}, attention: Model.DEFAULT_ATTENTION, refCounter: {} };
  }

  function me() { return S.people.find(p => p.id === S.me) || null; }

  function buildAtmosphere() {
    if (!document.getElementById("atmosphere")) {
      document.body.insertBefore(UI.el("div", { id: "atmosphere" }), document.body.firstChild);
    }
  }

  function render() {
    UI.clear(root);
    buildAtmosphere();

    // The offline banner has to be reachable even before anyone signs in —
    // with no db capability there's also no people list to sign in with, so
    // this is the only explanation the viewer would otherwise ever see.
    if (S.storeMode === "offline") {
      root.appendChild(UI.el("div", { class: "offline-banner" }, "Not connected to storage — nothing on this page will be saved, and any data you'd normally see hasn't loaded."));
    }

    if (!S.me) {
      root.appendChild(window.Views.signin.render(S, actions));
      return;
    }

    root.appendChild(renderShell());
  }

  function renderShell() {
    const shell = UI.el("div", { class: "app-shell" });
    const rail = renderRail();
    shell.appendChild(rail);

    const main = UI.el("div", { class: "main" });
    main.appendChild(renderTopbar(rail));
    const page = UI.el("div", { class: "page" });
    page.appendChild(renderRoute());
    main.appendChild(page);
    shell.appendChild(main);
    return shell;
  }

  function currentPath() {
    const hash = S.route || "#/";
    const m = hash.match(/^#\/([a-z]+)/);
    return m ? m[1] : "home";
  }

  function pageTitle() {
    const path = currentPath();
    if (path === "" || S.route === "#/") return "Home";
    const found = ROUTES.find(r => r.path === path);
    if (found) return found.label;
    if (path === "i") return "Initiative";
    if (path === "governance") return "Governance session";
    return "Throughline";
  }

  function renderTopbar() {
    const bar = UI.el("div", { class: "topbar" });
    const left = UI.el("div", { style: { display: "flex", alignItems: "center", gap: "10px" } }, [
      UI.button("☰", { variant: "ghost", sm: true, onClick: toggleRail, }),
    ]);
    const railToggle = left.querySelector("button");
    railToggle.classList.add("rail-toggle");
    railToggle.setAttribute("aria-label", "Toggle navigation menu");
    left.appendChild(UI.el("div", { class: "page-title" }, pageTitle()));
    bar.appendChild(left);
    bar.appendChild(UI.el("div", { class: "topbar-actions" }));
    return bar;
  }

  function toggleRail() {
    const rail = document.querySelector(".rail");
    if (rail) rail.classList.toggle("open");
  }

  function renderRail() {
    const rail = UI.el("div", { class: "rail" });

    const brand = UI.el("div", { class: "rail-brand" }, [
      UI.el("span", { html: UI.markSvg(false) }),
      UI.el("span", { class: "wordmark" }, "Throughline"),
    ]);
    rail.appendChild(brand);

    // scope
    const person = me();
    const scopeWrap = UI.el("div", { class: "rail-scope" }, [
      UI.el("div", { class: "rail-label" }, "Scope"),
    ]);
    const scopeOptions = [{ value: "my_departments", label: "My departments" }];
    if (person && ["director", "peer_director"].includes(person.role)) scopeOptions.push({ value: "my_area", label: "My area" });
    scopeOptions.push({ value: "all_areas", label: person && person.role === "senior_director" ? "All areas, rolled up" : "All areas" });
    const sel = UI.select(scopeOptions, {
      value: S.scope,
      onChange: (e) => { S.scope = e.target.value; lsSet("tl_scope", S.scope); render(); },
    });
    sel.className = "scope-select";
    scopeWrap.appendChild(sel);
    rail.appendChild(scopeWrap);

    // nav
    const nav = UI.el("div", { class: "rail-nav" });
    const path = currentPath();
    for (const r of ROUTES) {
      if (r.role && person && !r.role.includes(person.role)) continue;
      if (r.role && !person) continue;
      const active = path === r.path || (r.path === "home" && (S.route === "#/" || S.route === ""));
      const link = UI.el("a", { class: "rail-link" + (active ? " active" : ""), href: `#/${r.path === "home" ? "" : r.path}` }, [
        UI.el("span", { class: "dot" }), r.label,
      ]);
      nav.appendChild(link);
    }
    rail.appendChild(nav);

    // identity
    const idWrap = UI.el("div", { class: "rail-identity" });
    idWrap.appendChild(UI.avatar(person));
    idWrap.appendChild(UI.el("div", { class: "who" }, [
      UI.el("div", { class: "name" }, person ? person.name : "—"),
      UI.el("div", { class: "title" }, person ? person.title : ""),
    ]));
    idWrap.appendChild(UI.el("button", { class: "rail-switch", onClick: () => { S.me = null; lsSet("tl_me", ""); render(); } }, "Switch"));
    rail.appendChild(idWrap);

    return rail;
  }

  function renderRoute() {
    const hash = S.route || "#/";
    if (hash === "#/" || hash === "" || hash === "#") return window.Views.home.render(S, actions);

    let m;
    if ((m = hash.match(/^#\/i\/([A-Za-z0-9_]+)/))) return window.Views.initiative.render(S, actions, m[1]);
    if ((m = hash.match(/^#\/governance\/([A-Za-z0-9_]+)/))) return window.Views.governance.render(S, actions, m[1]);
    if ((m = hash.match(/^#\/reviews\/([A-Za-z0-9_]+)/))) return window.Views.reviews.render(S, actions, m[1]);
    if (hash.startsWith("#/initiatives")) return window.Views.initiatives.render(S, actions);
    if (hash.startsWith("#/intake")) return window.Views.intake.render(S, actions);
    if (hash.startsWith("#/triage")) return window.Views.triage.render(S, actions);
    if (hash.startsWith("#/reviews")) return window.Views.reviews.render(S, actions);
    if (hash.startsWith("#/archive")) return window.Views.archive.render(S, actions);
    if (hash.startsWith("#/settings")) return window.Views.settings.render(S, actions);

    return UI.emptyState("Not found", "That route doesn't exist yet.");
  }

  // ---- actions object passed to views (keeps views decoupled from App internals) ----
  const actions = {
    navigate(hash) { window.location.hash = hash; },
    setMe(personId) {
      S.me = personId;
      lsSet("tl_me", personId);
      // Switching identity always lands on Home — carrying over whatever screen
      // the previous person was on (which may not even be visible to the new
      // role) would be confusing, since routes aren't permission-gated.
      S.route = "#/";
      lsSet("tl_route", S.route);
      window.location.hash = "#/";
      render();
    },
    getPerson(id) { return S.people.find(p => p.id === id) || null; },
    getInitiative(id) { return S.initiatives.find(i => i.id === id) || null; },
    async refreshAndRender() { refreshState(); render(); },
    toast: UI.toast,
  };

  function onHashChange() {
    S.route = window.location.hash || "#/";
    lsSet("tl_route", S.route);
    render();
  }

  async function boot() {
    const res = await Store.ready();
    S.storeMode = res.mode;
    refreshState();

    // Snapshots can arrive asynchronously after Store.ready() resolves (both in the
    // mock and, plausibly, for the real db capability), so the people list may still
    // be empty on this very first pass. Only ever clear a remembered identity once
    // we've actually seen a non-empty roster that confirms the person is gone —
    // never on a transient empty cache, or every reload would silently sign you out.
    Store.subscribe(() => {
      refreshState();
      if (S.me && S.people.length && !S.people.find(p => p.id === S.me)) {
        S.me = null;
        lsSet("tl_me", "");
      }
      render();
    });

    S.me = lsGet("tl_me", "") || null;
    S.scope = lsGet("tl_scope", "my_departments");
    S.route = window.location.hash || lsGet("tl_route", "#/") || "#/";
    if (!window.location.hash && S.route !== "#/") window.location.hash = S.route;

    window.addEventListener("hashchange", onHashChange);
    render();
  }

  return { boot, S, actions, refreshState };
})();

document.addEventListener("DOMContentLoaded", App.boot);
