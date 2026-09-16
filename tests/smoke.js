/* ===================================================================
   Throughline — tests/smoke.js
   End-to-end smoke test against the static app, headless. No framework:
   plain assertions, non-zero exit on failure. Run with `npm test`.

   Exercises the flows that actually depend on the store/render wiring
   (sign-in, role-based home, list/board, detail, intake, triage,
   governance, reviews, archive, settings) so a regression like the
   intake "Submitted" screen getting wiped by its own re-render — see
   js/views/intake.js — fails CI instead of shipping quietly.
   =================================================================== */
const path = require("node:path");
const { chromium } = require("playwright");
const { startServer } = require("../scripts/static-server");

function assert(cond, msg) {
  if (!cond) throw new Error("Assertion failed: " + msg);
}

async function withIdentity(page, baseUrl, personId, hash) {
  await page.goto(baseUrl + "/index.html");
  await page.evaluate((pid) => localStorage.setItem("tl_me", pid), personId);
  await page.goto(baseUrl + "/index.html" + (hash || ""));
  await page.reload();
  await page.waitForTimeout(250);
}

async function main() {
  const server = await startServer(path.join(__dirname, ".."));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM_PATH || undefined });
  const page = await browser.newPage();

  const problems = [];
  const IGNORED_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
  const isIgnoredUrl = (url) => IGNORED_HOSTS.some((h) => url.includes(h));

  page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
  page.on("requestfailed", (req) => {
    if (isIgnoredUrl(req.url())) return;
    problems.push(`requestfailed: ${req.url()} — ${req.failure() && req.failure().errorText}`);
  });
  page.on("response", (res) => {
    if (res.status() < 400 || isIgnoredUrl(res.url())) return;
    problems.push(`bad response ${res.status()}: ${res.url()}`);
  });
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // The browser's own "Failed to load resource" notices carry no URL and
    // are already captured precisely (and origin-filtered) via the
    // requestfailed/response listeners above — anything else here is a
    // real console.error from our own code.
    if (text.startsWith("Failed to load resource")) return;
    problems.push("console.error: " + text);
  });

  try {
    // --- sign-in screen ---
    await page.goto(baseUrl + "/index.html");
    await page.waitForTimeout(300);
    assert((await page.locator(".signin-title").textContent()) === "Throughline", "signin title renders");
    const peopleCount = await page.locator(".signin-person").count();
    assert(peopleCount >= 5, `signin shows seeded people (got ${peopleCount})`);

    // --- senior director home ---
    await page.locator(".signin-person", { hasText: "Dana Whitfield" }).click();
    await page.waitForTimeout(250);
    assert((await page.locator(".text-title").first().textContent()).includes("Dana"), "senior director home greets Dana");

    // --- director home + attention stream ---
    await withIdentity(page, baseUrl, "ppl_marcus", "#/");
    assert((await page.locator(".text-title").first().textContent()).includes("Marcus"), "director home greets Marcus");
    const attnItems = await page.locator(".attn-item").count();
    assert(attnItems > 0, "director home shows attention items");

    // --- initiatives list + board ---
    await page.goto(baseUrl + "/index.html#/initiatives");
    await page.waitForTimeout(250);
    const rowCount = await page.locator("table.list-table tbody tr").count();
    assert(rowCount > 0, "initiatives list renders rows");
    await page.locator('button:has-text("Board")').click();
    await page.waitForTimeout(200);
    const boardCols = await page.locator(".board-col").count();
    assert(boardCols === 7, `board shows 7 non-terminal stage columns (got ${boardCols})`);

    // --- initiative detail ---
    await page.goto(baseUrl + "/index.html#/i/ini_pci_discharge");
    await page.waitForTimeout(250);
    assert((await page.locator("h1.text-title").textContent()).includes("PCI"), "initiative detail renders title");
    assert((await page.locator(".status-box").count()) === 4, "initiative detail shows the 4 status boxes");

    // Regression guard: no horizontal scroll at phone width (a flex row here
    // once overflowed once "Edit classification" was added without wrapping).
    await page.setViewportSize({ width: 375, height: 700 });
    await page.waitForTimeout(100);
    const overflowsAtPhoneWidth = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    assert(!overflowsAtPhoneWidth, "initiative detail has no horizontal overflow at 375px width");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(100);

    // Regression guard: modal opens (Escape-to-close) and Edit classification exists.
    await page.locator('button:has-text("Edit classification")').click();
    await page.waitForTimeout(150);
    assert((await page.locator(".modal-backdrop").count()) === 1, "edit classification modal opens");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    assert((await page.locator(".modal-backdrop").count()) === 0, "Escape key closes the modal");

    // Regression guard: director override is reachable when readiness isn't ready.
    await withIdentity(page, baseUrl, "ppl_priya", "#/i/ini_or_block_time");
    const overrideBtn = page.locator('button:has-text("Override & advance")');
    assert((await overrideBtn.count()) > 0, "override control is offered when readiness blocks advancing");
    await overrideBtn.first().click();
    await page.waitForTimeout(150);
    await page.locator(".modal textarea").fill("CI: exercising the override path.");
    await page.locator('.modal button:has-text("Override & advance")').click();
    await page.waitForTimeout(300);
    assert((await page.locator(".status-box .value").first().textContent()) === "In flight", "override advances the stage");

    // Regression guard: editing classification re-runs the requirement rule engine.
    await page.goto(baseUrl + "/index.html#/i/ini_hybrid_or");
    await page.waitForTimeout(200);
    await page.locator('button:has-text("Edit classification")').click();
    await page.waitForTimeout(150);
    await page.locator(".modal select").first().selectOption("process_improvement");
    await page.locator('.modal button:has-text("Save")').click();
    await page.waitForTimeout(300);
    const classHistory = await page.locator(".hbody .hsummary").first().textContent();
    assert(classHistory.includes("Reclassified"), `classification edit re-evaluates requirements (got: ${classHistory})`);

    // --- triage ---
    await page.goto(baseUrl + "/index.html#/triage");
    await page.waitForTimeout(250);
    assert((await page.locator("h1.text-title").textContent()) === "Triage queue", "triage queue renders");

    // --- reviews list + closed meeting briefing ---
    await page.goto(baseUrl + "/index.html#/reviews");
    await page.waitForTimeout(250);
    assert((await page.locator("h1.text-title").textContent()) === "Reviews", "reviews list renders");
    await page.goto(baseUrl + "/index.html#/reviews/mtg_aug");
    await page.waitForTimeout(250);
    const briefing = await page.locator("pre").textContent();
    assert(briefing.startsWith("# Physician Governance Committee"), "closed meeting briefing generates");

    // Regression guard: the Export summary button must actually exist (its id
    // was silently dropped by UI.button for every option except a few) and
    // trigger a real download when the claude.ai downloads capability isn't present.
    assert((await page.locator("#export-btn").count()) === 1, "export-summary button carries its id");
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 5000 }),
      page.locator("#export-btn").click(),
    ]);
    assert(download.suggestedFilename() === "mtg_aug.md", `export produces the expected filename (got ${download.suggestedFilename()})`);

    // --- governance session ---
    await withIdentity(page, baseUrl, "ppl_dana", "#/governance/mtg_sep");
    assert((await page.locator("h1.text-title").textContent()).includes("September"), "governance session renders");

    // --- archive ---
    await page.goto(baseUrl + "/index.html#/archive");
    await page.waitForTimeout(250);
    assert((await page.locator("h1.text-title").textContent()) === "Archive & outcomes", "archive renders");

    // --- settings ---
    await page.goto(baseUrl + "/index.html#/settings");
    await page.waitForTimeout(250);
    assert((await page.locator("h1.text-title").textContent()) === "Settings", "settings renders");

    // Regression guard: adding a person actually persists and shows up.
    await page.locator('button:has-text("Add person")').click();
    await page.waitForTimeout(150);
    await page.locator(".modal input").first().fill("CI Test Person");
    await page.locator(".modal button:has-text(\"Add\")").click();
    await page.waitForTimeout(300);
    assert((await page.locator("text=CI Test Person").count()) > 0, "newly added person appears in Settings");

    // --- intake: full submit flow shows the confirmation (regression guard) ---
    await page.goto(baseUrl + "/index.html#/intake");
    await page.waitForTimeout(250);
    await page.locator('input[placeholder*="Same-day discharge"]').fill("Smoke test proposal");
    await page.locator('textarea[placeholder="What goes wrong today?"]').fill("Exercised by CI.");
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(200);
    await page.locator('input[placeholder="Your name"]').fill("CI Bot");
    await page.locator('button:has-text("Submit")').click();
    await page.waitForTimeout(400);
    const headline = await page.locator(".headline").textContent().catch(() => null);
    assert(headline && headline.startsWith("Submitted — TL-"), `intake shows the submitted confirmation (got ${headline})`);

    if (problems.length) {
      throw new Error("Unexpected console/page errors:\n" + problems.join("\n"));
    }

    console.log(`OK — smoke test passed (${peopleCount} people, ${rowCount} initiatives, ${attnItems} attention items).`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
