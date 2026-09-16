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
