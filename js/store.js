/* ===================================================================
   Throughline — js/store.js
   The ONLY file that touches claude.use("db"). Every read and write in
   the app goes through the Store API below. If this app is ever moved
   off the Artifact platform, this is the only file that changes.
   =================================================================== */

const Store = (() => {
  const COLLECTIONS = ["initiatives", "people", "meetings", "actions", "config"];
  const LS_KEY = "throughline_db_v1";

  let db = null;
  let mode = "offline"; // 'live' (claude.use db) | 'local' (localStorage) | 'offline' (no persistence at all)
  let readyPromise = null;

  // in-memory cache, mirrors live snapshots (or is the whole world, offline)
  const cache = {
    initiatives: new Map(),
    people: new Map(),
    meetings: new Map(),
    actions: new Map(),
    config: new Map(), // single doc "app"
  };

  const listeners = new Set();
  function notify() {
    for (const fn of listeners) {
      try { fn(); } catch (e) { console.error("Store listener error", e); }
    }
  }

  function subscribe(onChange) {
    listeners.add(onChange);
    return () => listeners.delete(onChange);
  }

  function all(collection) {
    const m = cache[collection];
    if (!m) return [];
    return Array.from(m.values());
  }

  function get(collection, id) {
    const m = cache[collection];
    if (!m) return null;
    return m.get(id) || null;
  }

  function newId(prefix) {
    const t = Date.now().toString(36);
    const r = Math.random().toString(36).slice(2, 7);
    return `${prefix}${t}${r}`;
  }

  async function put(collection, id, doc) {
    if (mode === "offline") {
      // True offline (no db capability and no localStorage) is a real no-op:
      // the persistent banner already told the user nothing here saves, so
      // we never pretend a write succeeded.
      return;
    }
    if (mode === "local") {
      cache[collection].set(id, doc);
      persistLocal();
      notify();
      return;
    }
    await db.doc(`${collection}/${id}`).set(doc);
    // live cache updates via onSnapshot
  }

  async function patch(collection, id, fields) {
    if (mode === "offline") {
      return;
    }
    if (mode === "local") {
      const cur = cache[collection].get(id) || {};
      cache[collection].set(id, { ...cur, ...fields });
      persistLocal();
      notify();
      return;
    }
    await db.doc(`${collection}/${id}`).update(fields);
  }

  async function remove(collection, id) {
    if (mode === "offline") {
      return;
    }
    if (mode === "local") {
      cache[collection].delete(id);
      persistLocal();
      notify();
      return;
    }
    await db.doc(`${collection}/${id}`).delete();
  }

  // read-modify-write an array field on a document, from the LIVE cache
  async function append(collection, id, arrayField, entry) {
    const cur = get(collection, id);
    if (!cur) throw new Error(`Store.append: ${collection}/${id} not found`);
    const arr = Array.isArray(cur[arrayField]) ? cur[arrayField].slice() : [];
    arr.push(entry);
    await patch(collection, id, { [arrayField]: arr });
    return arr;
  }

  function loadIntoCache(data) {
    for (const col of COLLECTIONS) {
      cache[col].clear();
      const docs = (data && data[col]) || [];
      if (col === "config") {
        for (const d of docs) cache.config.set(d.id, d);
      } else {
        for (const d of docs) cache[col].set(d.id, d);
      }
    }
  }

  function persistLocal() {
    try {
      const out = {};
      for (const col of COLLECTIONS) out[col] = Array.from(cache[col].values());
      localStorage.setItem(LS_KEY, JSON.stringify(out));
    } catch (e) {
      console.error("Store: failed to persist to localStorage", e);
    }
  }

  function setupLocalStore() {
    let saved = null;
    try {
      const raw = localStorage.getItem(LS_KEY);
      saved = raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error("Store: failed to read localStorage", e);
      saved = null;
    }

    if (saved && Array.isArray(saved.people) && saved.people.length) {
      loadIntoCache(saved);
    } else if (typeof Seed !== "undefined" && typeof Seed.build === "function") {
      loadIntoCache(Seed.build());
      persistLocal();
    } else {
      cache.config.set("app", {
        id: "app",
        departments: [],
        areas: [],
        rules: {},
        attention: { staleUpdateDays: 21, staleRequirementDays: 14, triageTargetDays: 3, milestoneWarnDays: 7 },
        refCounter: {},
      });
    }
  }

  function localStorageAvailable() {
    try {
      const k = "__tl_probe__";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  function setupOfflineSeed() {
    // No persistence at all (private browsing with storage blocked, etc.) —
    // minimal so screens don't crash.
    if (!cache.config.get("app")) {
      cache.config.set("app", {
        id: "app",
        departments: [],
        areas: [],
        rules: {},
        attention: { staleUpdateDays: 21, staleRequirementDays: 14, triageTargetDays: 3, milestoneWarnDays: 7 },
        refCounter: {},
      });
    }
  }

  async function ready() {
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      try {
        const capPromise = (window.claude && typeof window.claude.use === "function")
          ? window.claude.use("db")
          : Promise.resolve(null);
        const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 10000));
        db = await Promise.race([capPromise, timeout]);
      } catch (e) {
        console.error("Store: claude.use('db') failed", e);
        db = null;
      }

      if (db) {
        mode = "live";
        // subscribe to the 5 collections, once, at boot
        for (const col of COLLECTIONS) {
          db.collection(col).onSnapshot((snap) => {
            const m = cache[col];
            m.clear();
            for (const d of snap.docs) {
              m.set(d.id, d.data());
            }
            notify();
          });
        }
        return { ok: true, mode: "live" };
      }

      if (localStorageAvailable()) {
        mode = "local";
        setupLocalStore();
        return { ok: true, mode: "local" };
      }

      mode = "offline";
      setupOfflineSeed();
      return { ok: false, mode: "offline" };
    })();
    return readyPromise;
  }

  function getMode() { return mode; }
  function getDb() { return db; }

  return {
    ready,
    subscribe,
    all,
    get,
    put,
    patch,
    remove,
    newId,
    append,
    getMode,
    getDb,
  };
})();
