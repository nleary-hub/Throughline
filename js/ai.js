/* ===================================================================
   Throughline — js/ai.js
   The ONLY file that calls out to an LLM. Mirrors js/store.js's
   live/standalone split: when run as a Claude Artifact, uses the real
   claude.use("sample") capability; when self-hosted (this app's actual
   GitHub Pages deployment), falls back to a bring-your-own-key call to
   the Anthropic API directly from the browser.

   Every call here is a SUGGESTION a human reviews and explicitly
   accepts — nothing in this file writes to the Store on its own.
   Fails soft: any error or missing key returns null, never throws.
   =================================================================== */

const AI = (() => {
  const LS_KEY = "throughline_ai_key";
  const MODEL = "claude-haiku-4-5-20251001";

  function getKey() {
    try { return localStorage.getItem(LS_KEY) || ""; } catch (e) { return ""; }
  }

  function setKey(key) {
    try {
      if (key) localStorage.setItem(LS_KEY, key);
      else localStorage.removeItem(LS_KEY);
      return true;
    } catch (e) {
      console.error("AI: failed to store key", e);
      return false;
    }
  }

  function hasLiveCapability() {
    return !!(window.claude && typeof window.claude.use === "function");
  }

  // True once we know AI assist could plausibly work — doesn't guarantee a
  // call will succeed (the live capability may resolve null, a BYOK key may
  // be invalid), just that it's worth showing the affordance.
  function available() {
    return hasLiveCapability() || !!getKey();
  }

  async function askViaCapability(prompt, opts) {
    try {
      const sample = await window.claude.use("sample");
      if (!sample) return null;
      const res = await sample(prompt, { modelTier: opts.modelTier || "quick" });
      return res && res.text ? res.text.trim() : null;
    } catch (e) {
      console.error("AI: sample capability call failed", e);
      return null;
    }
  }

  async function askViaByok(prompt, opts) {
    const key = getKey();
    if (!key) return null;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: opts.maxTokens || 500,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error("AI: request failed", res.status, body);
        return null;
      }
      const data = await res.json();
      const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
      return text || null;
    } catch (e) {
      console.error("AI: BYOK request failed", e);
      return null;
    }
  }

  // Returns the model's raw text, or null on any failure/absence — callers
  // show their own "AI suggestion unavailable" state on null, never fabricate.
  async function ask(prompt, opts) {
    opts = opts || {};
    if (hasLiveCapability()) {
      const viaCapability = await askViaCapability(prompt, opts);
      if (viaCapability !== null) return viaCapability;
      // A live claude.ai session without the capability granted, or a call
      // that failed, still falls through to a configured BYOK key if present.
    }
    return askViaByok(prompt, opts);
  }

  // Best-effort JSON extraction: asks for JSON, tolerates a model wrapping
  // it in prose or a ```json fence, returns null (never throws) if it can't
  // find valid JSON in the response.
  async function askJson(prompt, opts) {
    const text = await ask(prompt, opts);
    if (!text) return null;
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (e) {
      console.error("AI: could not parse JSON from response", e, text);
      return null;
    }
  }

  return { available, hasLiveCapability, getKey, setKey, ask, askJson };
})();
