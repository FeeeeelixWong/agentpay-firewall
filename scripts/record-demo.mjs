import { mkdir, copyFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const outputDir = resolve("docs/media");
const tempVideoDir = resolve("tmp/demo-video");
const finalWebm = join(outputDir, "agentpay-firewall-demo.webm");

await mkdir(outputDir, { recursive: true });
await mkdir(tempVideoDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: tempVideoDir,
    size: { width: 1280, height: 720 },
  },
});

const page = await context.newPage();

const pause = (ms) => new Promise((resolvePause) => setTimeout(resolvePause, ms));

await page.goto("http://127.0.0.1:5176", { waitUntil: "networkidle" });
await page.addStyleTag({
  content: `
    #demo-caption {
      position: fixed;
      left: 32px;
      right: 32px;
      bottom: 24px;
      z-index: 99999;
      border: 1px solid rgba(215, 223, 217, 0.9);
      border-radius: 8px;
      background: rgba(19, 32, 27, 0.92);
      color: #e5fff3;
      font: 700 22px/1.35 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 14px 18px;
      box-shadow: 0 18px 44px rgba(41, 52, 47, 0.18);
    }
  `,
});

const caption = async (text) => {
  await page.evaluate((captionText) => {
    let element = document.getElementById("demo-caption");

    if (!element) {
      element = document.createElement("div");
      element.id = "demo-caption";
      document.body.appendChild(element);
    }

    element.textContent = captionText;
  }, text);
};

await caption("AgentPay Firewall: a policy wallet for AI agents using x402 payment flows.");
await pause(4500);

await caption("Users define the mandate: per-request cap, daily budget, approval threshold, and allowed services.");
await pause(5000);

await caption("Allowed flow: the agent requests a paid wallet-risk API.");
await page.getByRole("button", { name: /Allowed paid API/ }).click();
await pause(2200);

await caption("The resource returns HTTP 402 with PAYMENT-REQUIRED. The wallet evaluates policy before signing.");
await page.getByRole("button", { name: "Run x402 flow" }).click();
await page.locator(".status-card", { hasText: "Payment settled" }).waitFor({ timeout: 8000 });
await pause(3500);

await caption("Policy passed, so the wallet created PAYMENT-SIGNATURE and received PAYMENT-RESPONSE.");
await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
await pause(7000);

await caption("Blocked flow: the agent tries to buy a costly non-allowlisted data crawl.");
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
await pause(1200);
await page.getByRole("button", { name: /Blocked overspend/ }).click();
await pause(2500);

await caption("The wallet still sees the x402 challenge, but blocks before signing.");
await page.getByRole("button", { name: "Run x402 flow" }).click();
await page.locator(".status-card", { hasText: "Blocked before signing" }).waitFor({ timeout: 8000 });
await pause(4500);

await caption("No PAYMENT-SIGNATURE is generated. The audit log records exactly why it was blocked.");
await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
await pause(6500);

await caption("Manual review flow: allowed service, but the amount crosses the human approval threshold.");
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
await pause(1200);
await page.getByRole("button", { name: /Manual review/ }).click();
await pause(2400);

await caption("The policy engine routes this request to a human instead of silently signing.");
await page.getByRole("button", { name: "Run x402 flow" }).click();
await page.locator(".status-card", { hasText: "Waiting for human approval" }).waitFor({ timeout: 8000 });
await pause(5200);

await caption("AgentPay Firewall makes autonomous payments useful, constrained, and auditable.");
await pause(5200);

const video = page.video();
await context.close();
await browser.close();

if (!video) {
  throw new Error("Playwright video recording was not created.");
}

await copyFile(await video.path(), finalWebm);
console.log(finalWebm);
