/* ===================================================================
   Throughline — js/ui.js
   Render primitives. Pure DOM helpers, no store access, no routing.
   =================================================================== */

const UI = (() => {

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    attrs = attrs || {};
    for (const k in attrs) {
      if (k === "class") node.className = attrs[k];
      else if (k === "html") node.innerHTML = attrs[k];
      else if (k.startsWith("on") && typeof attrs[k] === "function") {
        node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      } else if (k === "style" && typeof attrs[k] === "object") {
        Object.assign(node.style, attrs[k]);
      } else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) {
        node.setAttribute(k, attrs[k]);
      }
    }
    children = children || [];
    if (!Array.isArray(children)) children = [children];
    for (const c of children) {
      if (c === null || c === undefined || c === false) continue;
      if (typeof c === "string" || typeof c === "number") node.appendChild(document.createTextNode(String(c)));
      else node.appendChild(c);
    }
    return node;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // ---- formatting ----
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  function parseDate(s) {
    if (!s) return null;
    // 'YYYY-MM-DD' -> local date, no TZ surprises
    const parts = String(s).split("-").map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
    const [y, m, d] = parts;
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  function fmtDate(s, opts) {
    if (!s) return "—";
    const d = parseDate(s);
    if (!d) return "—";
    const withYear = opts && opts.year;
    const today = new Date();
    const str = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
    if (withYear || d.getFullYear() !== today.getFullYear()) return `${str}, ${d.getFullYear()}`;
    return str;
  }

  function daysBetween(a, b) {
    const da = typeof a === "string" ? parseDate(a) : a;
    const db_ = typeof b === "string" ? parseDate(b) : b;
    if (!da || !db_ || Number.isNaN(da.getTime && da.getTime()) || Number.isNaN(db_.getTime && db_.getTime())) return 0;
    // Diff whole UTC day numbers rather than raw Date objects so a DST
    // transition between the two dates can't shift the result by an hour
    // and round to the wrong day count.
    const utcA = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
    const utcB = Date.UTC(db_.getFullYear(), db_.getMonth(), db_.getDate());
    return Math.round((utcB - utcA) / 86400000);
  }

  function fmtDuration(days) {
    if (days === null || days === undefined) return "—";
    const n = Math.abs(Math.round(days));
    return `${n} day${n === 1 ? "" : "s"}`;
  }

  function todayStr(d) {
    d = d || new Date();
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function money(n) {
    if (n === null || n === undefined) return "—";
    return "$" + Number(n).toLocaleString("en-US");
  }

  // ---- mark ----
  function markSvg(compact) {
    if (compact) {
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M2 12h20"/><path d="M7 8v8"/><path d="M17 8v8"/><circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/></svg>`;
    }
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M2 12h20"/><path d="M7 7v10"/><path d="M12 7v10"/><path d="M17 7v10"/><circle cx="12" cy="12" r="3" fill="var(--ink-900)" stroke="currentColor" stroke-width="1.7"/></svg>`;
  }

  // ---- chips ----
  const TINTS = { beacon: "tint-beacon", iris: "tint-iris", amber: "tint-amber", ember: "tint-ember", steel: "tint-steel", neutral: "tint-neutral" };

  function chip(label, tint, opts) {
    tint = tint || "neutral";
    const cls = "chip " + (TINTS[tint] || TINTS.neutral);
    const dotColor = { beacon: "var(--beacon)", iris: "var(--iris)", amber: "var(--amber)", ember: "var(--ember)", steel: "var(--steel)", neutral: "var(--text-3)" }[tint];
    const children = [];
    if (!opts || opts.dot !== false) {
      children.push(el("span", { class: "sw", style: { background: dotColor } }));
    }
    children.push(document.createTextNode(label));
    return el("span", { class: cls }, children);
  }

  function button(label, opts) {
    opts = opts || {};
    const cls = ["btn", opts.variant, opts.sm ? "sm" : ""].filter(Boolean).join(" ");
    const b = el("button", { class: cls, onClick: opts.onClick, disabled: opts.disabled, title: opts.title, id: opts.id }, [label]);
    return b;
  }

  function card(children, opts) {
    opts = opts || {};
    return el("div", { class: "card" + (opts.raised ? " raised" : "") + (opts.class ? " " + opts.class : "") }, children);
  }

  function statusBox(label, value, sub) {
    const children = [
      el("div", { class: "label" }, label),
      el("div", { class: "value" }, value),
    ];
    if (sub) children.push(el("div", { class: "sub" }, sub));
    return el("div", { class: "status-box" }, children);
  }

  function avatar(person, opts) {
    opts = opts || {};
    const initials = person ? (person.initials || (person.name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()) : "?";
    return el("div", { class: "avatar" + (opts.lg ? " lg" : "") }, initials);
  }

  function personRow(person, opts) {
    opts = opts || {};
    if (!person) return el("div", { class: "person-row" }, [avatar(null), el("div", { class: "meta" }, [el("div", { class: "name faint" }, "Unassigned")])]);
    return el("div", { class: "person-row" }, [
      avatar(person, opts),
      el("div", { class: "meta" }, [
        el("div", { class: "name" }, person.name),
        opts.hideTitle ? null : el("div", { class: "role" }, person.title || ""),
      ]),
    ]);
  }

  function meter(score, max) {
    max = max || 5;
    const segs = [];
    const unscored = score === null || score === undefined;
    for (let i = 0; i < max; i++) {
      segs.push(el("span", { class: "seg" + (!unscored && i < score ? " on" : "") }));
    }
    return el("div", { class: "meter" + (unscored ? " unscored" : "") }, segs);
  }

  function emptyState(headline, body, actionNode) {
    const children = [el("div", { class: "headline" }, headline)];
    if (body) children.push(el("div", { class: "text-body muted" }, body));
    if (actionNode) children.push(actionNode);
    return el("div", { class: "empty-state" }, children);
  }

  // ---- modal ----
  function modal(opts) {
    opts = opts || {};
    const backdrop = el("div", { class: "modal-backdrop" });
    const box = el("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": opts.title || "Dialog", tabindex: "-1" });
    const closeBtn = button("✕", { variant: "ghost", sm: true, onClick: () => close() });
    closeBtn.setAttribute("aria-label", "Close dialog");
    const header = el("div", { class: "modal-header" }, [
      el("div", { class: "text-section" }, opts.title || ""),
      closeBtn,
    ]);
    box.appendChild(header);
    const body = el("div", { class: "modal-body" });
    if (opts.body) body.appendChild(opts.body);
    box.appendChild(body);
    if (opts.footer) {
      const footer = el("div", { class: "modal-footer" }, opts.footer);
      box.appendChild(footer);
    }
    backdrop.appendChild(box);
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
    function onKeydown(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKeydown);
    function close() {
      document.removeEventListener("keydown", onKeydown);
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      if (opts.onClose) opts.onClose();
    }
    document.body.appendChild(backdrop);
    const firstField = box.querySelector("input, textarea, select");
    (firstField || box).focus({ preventScroll: true });
    return { close, box, body };
  }

  // ---- toast ----
  let toastWrap = null;
  function toast(msg, opts) {
    opts = opts || {};
    if (!toastWrap) {
      toastWrap = el("div", { class: "toast-wrap" });
      document.body.appendChild(toastWrap);
    }
    const t = el("div", { class: "toast" }, msg);
    toastWrap.appendChild(t);
    setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, opts.duration || 3400);
  }

  function field(labelText, inputNode, hint) {
    const children = [el("label", {}, labelText), inputNode];
    if (hint) children.push(el("div", { class: "hint" }, hint));
    return el("div", { class: "field" }, children);
  }

  function textInput(opts) {
    opts = opts || {};
    return el("input", { type: opts.type || "text", value: opts.value || "", placeholder: opts.placeholder || "", id: opts.id, onInput: opts.onInput, min: opts.min, max: opts.max });
  }

  function textArea(opts) {
    opts = opts || {};
    const t = el("textarea", { placeholder: opts.placeholder || "", id: opts.id, onInput: opts.onInput });
    if (opts.value) t.value = opts.value;
    return t;
  }

  function select(options, opts) {
    opts = opts || {};
    const s = el("select", { id: opts.id, onChange: opts.onChange });
    for (const o of options) {
      const optEl = el("option", { value: o.value }, o.label);
      if (o.value === opts.value) optEl.selected = true;
      s.appendChild(optEl);
    }
    return s;
  }

  function pillOption(label, selected, onClick) {
    return el("div", { class: "pill-option" + (selected ? " selected" : ""), onClick }, label);
  }

  return {
    el, clear, parseDate, fmtDate, daysBetween, fmtDuration, todayStr, money, markSvg,
    chip, button, card, statusBox, avatar, personRow, meter, emptyState,
    modal, toast, field, textInput, textArea, select, pillOption,
  };
})();
