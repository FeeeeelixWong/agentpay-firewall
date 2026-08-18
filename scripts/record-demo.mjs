import { spawn } from "node:child_process";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const appUrl = process.env.DEMO_APP_URL ?? "https://agentpay-firewall.vercel.app";
const publicDir = resolve("public");
const tempDir = resolve("tmp/demo-video");
const voiceoverDir = join(tempDir, "voiceover");
const edgeTtsVenv = resolve("tmp/edge-tts-venv");
const edgeTtsPython = join(edgeTtsVenv, "bin", "python");
const edgeTtsVoice = process.env.DEMO_TTS_VOICE ?? "en-US-AvaMultilingualNeural";
const rawWebm = join(tempDir, "agentpay-firewall-demo.raw.webm");
const voiceoverAudio = join(tempDir, "agentpay-firewall-demo.wav");
const voiceoverConcatList = join(tempDir, "voiceover-list.txt");
const publicMp4 = join(publicDir, "agentpay-firewall-demo.mp4");
const publicWebm = join(publicDir, "agentpay-firewall-demo.webm");
const publicSrt = join(publicDir, "agentpay-firewall-demo.srt");
const voiceoverFile = resolve("docs/demo-voiceover.txt");
const evidenceFile = resolve("docs/algorand-x402-settlement-evidence.json");

const segments = [
  {
    minDuration: 6.2,
    voiceover:
      "AgentPay Firewall turns x402 into a payment product that sellers and buyers can actually use.",
  },
  {
    minDuration: 10.0,
    voiceover:
      "The seller starts by naming the payment, setting the USDC amount, and choosing the Algorand address that should receive settlement.",
  },
  {
    minDuration: 9.0,
    voiceover:
      "One click creates a protected checkout link. The amount and recipient are signed by the server, so editing the URL invalidates the request.",
  },
  {
    minDuration: 9.0,
    voiceover:
      "The buyer opens a separate checkout page and sees exactly who will be paid, how much is due, the network, and when the link expires.",
  },
  {
    minDuration: 10.0,
    voiceover:
      "Behind this page, the dynamic resource returns a real x402 version two PAYMENT-REQUIRED challenge with the same signed amount and recipient.",
  },
  {
    minDuration: 9.0,
    voiceover:
      "Before Pera Wallet opens, AgentPay compares the challenge with the seller request. The buyer keeps custody and gives the final approval.",
  },
  {
    minDuration: 12.5,
    voiceover:
      "The official AVM settlement path has already settled on Algorand Testnet. GoPlausible processed 0.001 USDC and returned a transaction receipt that anyone can verify in Lora.",
  },
  {
    minDuration: 8.0,
    voiceover:
      "AgentPay Firewall: seller-created payment links, buyer-owned authorization, official x402 settlement, and verifiable onchain receipts.",
  },
];

const pause = (milliseconds) => new Promise((resolvePause) => setTimeout(resolvePause, milliseconds));

const run = (command, args, options = {}) =>
  new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: resolve("."),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", rejectRun);
    child.on("close", (code) => {
      if (code === 0) resolveRun({ stdout, stderr });
      else rejectRun(new Error(`${command} ${args.join(" ")} failed with code ${code}\n${stdout}\n${stderr}`));
    });
  });

const probeDuration = async (filePath) => {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", filePath,
  ]);
  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Could not read duration for ${filePath}`);
  return duration;
};

let edgeTtsReady;
const ensureEdgeTts = async () => {
  if (edgeTtsReady !== undefined) return edgeTtsReady;
  const canImport = async () => {
    try {
      await run(edgeTtsPython, ["-c", "import edge_tts"]);
      return true;
    } catch {
      return false;
    }
  };
  if (await canImport()) return (edgeTtsReady = true);
  try {
    await mkdir(resolve("tmp"), { recursive: true });
    await run("python3", ["-m", "venv", edgeTtsVenv]);
    await run(edgeTtsPython, ["-m", "pip", "install", "edge-tts==7.2.8"]);
    return (edgeTtsReady = await canImport());
  } catch {
    return (edgeTtsReady = false);
  }
};

const synthesizeVoiceover = async (inputFile, edgeOutputFile, fallbackOutputFile) => {
  if (await ensureEdgeTts()) {
    let lastError;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        await run(edgeTtsPython, [
          "-m", "edge_tts", "--voice", edgeTtsVoice, "--rate", "-3%", "--file", inputFile,
          "--write-media", edgeOutputFile,
        ]);
        return edgeOutputFile;
      } catch (error) {
        lastError = error;
        if (attempt < 4) await pause(attempt * 1500);
      }
    }
    if (process.env.DEMO_ALLOW_FALLBACK_VOICE !== "1") {
      throw new Error(`edge-tts failed after four attempts; refusing to mix demo voices. ${lastError?.message ?? ""}`);
    }
    console.warn(`edge-tts failed, using macOS voice: ${lastError?.message ?? "unknown error"}`);
  }
  try {
    await run("say", ["-v", "Shelley (英语（美国）)", "-r", "165", "-f", inputFile, "-o", fallbackOutputFile]);
  } catch {
    await run("say", ["-r", "165", "-f", inputFile, "-o", fallbackOutputFile]);
  }
  return fallbackOutputFile;
};

const toConcatFilePath = (filePath) => filePath.replaceAll("'", "'\\''");

const prepareTimedVoiceover = async () => {
  await mkdir(voiceoverDir, { recursive: true });
  await writeFile(voiceoverFile, `${segments.map((segment) => segment.voiceover).join("\n\n")}\n`);
  const timedSegments = [];

  for (const [index, segment] of segments.entries()) {
    const stem = `segment-${String(index + 1).padStart(2, "0")}`;
    const textPath = join(voiceoverDir, `${stem}.txt`);
    const edgePath = join(voiceoverDir, `${stem}.mp3`);
    const fallbackPath = join(voiceoverDir, `${stem}.aiff`);
    const paddedPath = join(voiceoverDir, `${stem}.wav`);
    await writeFile(textPath, `${segment.voiceover}\n`);
    const audioPath = await synthesizeVoiceover(textPath, edgePath, fallbackPath);
    const audioDuration = await probeDuration(audioPath);
    const duration = Number(Math.max(segment.minDuration, audioDuration + 0.5).toFixed(3));

    await run("ffmpeg", [
      "-y", "-i", audioPath,
      "-af", `apad=pad_dur=${Math.max(0, duration - audioDuration).toFixed(3)},atrim=0:${duration},asetpts=N/SR/TB`,
      "-ar", "44100", "-ac", "1", paddedPath,
    ]);
    timedSegments.push({ ...segment, duration, audioDuration, paddedPath });
  }

  await writeFile(
    voiceoverConcatList,
    `${timedSegments.map((segment) => `file '${toConcatFilePath(segment.paddedPath)}'`).join("\n")}\n`,
  );
  await run("ffmpeg", [
    "-y", "-f", "concat", "-safe", "0", "-i", voiceoverConcatList,
    "-c:a", "pcm_s16le", voiceoverAudio,
  ]);
  return timedSegments;
};

const formatSrtTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const wholeSeconds = Math.floor(seconds % 60);
  const milliseconds = Math.round((seconds - Math.floor(seconds)) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
};

const buildSrt = (timedSegments) => {
  let cursor = 0;
  return timedSegments.map((segment, index) => {
    const start = cursor;
    cursor += segment.duration;
    return `${index + 1}\n${formatSrtTime(start)} --> ${formatSrtTime(cursor)}\n${segment.voiceover}\n`;
  }).join("\n");
};

const installCaptionOverlay = async (page) => {
  await page.addStyleTag({
    content: `
      #demo-caption {
        position: fixed; left: 48px; right: 48px; bottom: 24px; z-index: 100000;
        border: 1px solid rgba(225, 239, 232, .35); border-radius: 8px;
        background: rgba(13, 29, 24, .92); color: #f1fff8;
        font: 700 21px/1.32 "DM Sans", system-ui, sans-serif;
        padding: 13px 18px; text-align: center; box-shadow: 0 16px 42px rgba(9, 24, 19, .2);
      }
    `,
  });
};

const caption = async (page, text) => {
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

const step = async (page, timedSegments, index, action) => {
  const segment = timedSegments[index];
  await caption(page, segment.voiceover);
  const startedAt = Date.now();
  if (action) await action();
  // A navigation replaces the document and removes the caption node.
  // Reattach it so the burned-in copy always matches the audio and SRT.
  await caption(page, segment.voiceover);
  const remaining = segment.duration * 1000 - (Date.now() - startedAt);
  if (remaining > 0) await pause(remaining);
};

const shortHash = (hash, prefix = 14, suffix = 8) => `${hash.slice(0, prefix)}...${hash.slice(-suffix)}`;

const showChallengeScene = async (page, payment) => {
  await page.evaluate((request) => {
    document.getElementById("demo-scene")?.remove();
    const scene = document.createElement("section");
    scene.id = "demo-scene";
    scene.innerHTML = `
      <div class="scene-shell">
        <div class="scene-kicker">LIVE PROTOCOL CHECK</div>
        <h1>Signed terms become a real 402 challenge</h1>
        <div class="challenge-line"><strong>HTTP 402</strong><span>PAYMENT-REQUIRED</span></div>
        <div class="challenge-grid">
          <div><small>Protocol</small><strong>x402 v2 · exact</strong></div>
          <div><small>Amount</small><strong></strong></div>
          <div><small>Network</small><strong>Algorand Testnet</strong></div>
          <div><small>Asset</small><strong>USDC · ASA 10458941</strong></div>
        </div>
        <div class="signed-row"><small>Signed recipient</small><code></code></div>
        <p>The Buyer UI rejects the request if this challenge differs from the seller-signed checkout.</p>
      </div>
    `;
    const style = document.createElement("style");
    style.textContent = `
      #demo-scene { position: fixed; inset: 0; z-index: 99998; padding: 54px 64px 122px; box-sizing: border-box; color: #f4fff9; background: #0d211b; font-family: "DM Sans", system-ui, sans-serif; }
      #demo-scene .scene-shell { max-width: 1110px; margin: 0 auto; }
      #demo-scene .scene-kicker { color: #78e4bd; font-size: 17px; font-weight: 800; }
      #demo-scene h1 { max-width: 820px; margin: 12px 0 26px; color: white; font-size: 52px; line-height: 1.04; }
      #demo-scene .challenge-line { display: flex; align-items: center; gap: 18px; padding: 17px 20px; border-left: 5px solid #35d49d; background: #17382e; }
      #demo-scene .challenge-line strong { color: #86f0c9; font-size: 26px; }
      #demo-scene .challenge-line span { font: 700 22px/1.2 "IBM Plex Mono", monospace; }
      #demo-scene .challenge-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; margin-top: 20px; background: rgba(255,255,255,.2); border: 1px solid rgba(255,255,255,.2); }
      #demo-scene .challenge-grid > div { padding: 20px; background: #112a22; }
      #demo-scene small { display: block; color: rgba(238,255,247,.62); font-size: 14px; }
      #demo-scene .challenge-grid strong { display: block; margin-top: 7px; color: white; font-size: 19px; }
      #demo-scene .signed-row { margin-top: 20px; padding: 18px 20px; border: 1px solid rgba(255,255,255,.22); }
      #demo-scene code { display: block; margin-top: 7px; color: #baf7dc; font: 700 19px/1.3 "IBM Plex Mono", monospace; }
      #demo-scene p { max-width: 760px; margin-top: 18px; color: rgba(238,255,247,.72); font-size: 18px; line-height: 1.45; }
    `;
    scene.appendChild(style);
    document.body.appendChild(scene);
    const amountValue = Number(request.amountUsd).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 6 });
    scene.querySelectorAll(".challenge-grid strong")[1].textContent = `$${amountValue} USDC`;
    scene.querySelector(".signed-row code").textContent = request.payTo;
  }, payment);
};

const showSettlementScene = async (page, evidence) => {
  const proof = {
    status: evidence.status,
    amount: evidence.amountDisplay,
    payer: shortHash(evidence.buyer, 12, 8),
    payTo: shortHash(evidence.seller, 12, 8),
    tx: shortHash(evidence.transactionId, 18, 10),
    block: String(evidence.confirmedRound),
    explorerUrl: evidence.explorerUrl,
  };
  await page.evaluate((data) => {
    document.getElementById("demo-scene")?.remove();
    const scene = document.createElement("section");
    scene.id = "demo-scene";
    scene.innerHTML = `
      <div class="settlement-shell">
        <div class="settlement-copy">
          <span>CONFIRMED ON ALGORAND TESTNET</span>
          <h1>Official settlement.<br />Verifiable receipt.</h1>
          <p>This receipt confirms live GoPlausible settlement for the same network, asset, amount, and recipient.</p>
        </div>
        <div class="amount-proof"><small>Settled</small><strong></strong><span>USDC</span></div>
        <div class="route-proof"><code></code><b>→</b><code></code></div>
        <div class="tx-proof"><small>Transaction · Round <em></em></small><strong></strong><span></span></div>
      </div>
    `;
    const style = document.createElement("style");
    style.textContent = `
      #demo-scene { position: fixed; inset: 0; z-index: 99998; padding: 48px 62px 122px; box-sizing: border-box; color: #f4fff9; background: #0c1d18; font-family: "DM Sans", system-ui, sans-serif; }
      #demo-scene .settlement-shell { height: 100%; display: grid; grid-template-columns: 1.25fr .75fr; grid-template-rows: auto auto 1fr; gap: 20px 38px; max-width: 1130px; margin: 0 auto; }
      #demo-scene .settlement-copy span { color: #78e4bd; font-size: 16px; font-weight: 800; }
      #demo-scene .settlement-copy h1 { margin: 10px 0 15px; color: white; font-size: 51px; line-height: 1.02; }
      #demo-scene .settlement-copy p { max-width: 690px; color: rgba(238,255,247,.72); font-size: 19px; line-height: 1.45; }
      #demo-scene .amount-proof { padding: 25px; align-self: end; border: 1px solid #42b78e; background: #12352a; }
      #demo-scene .amount-proof small, #demo-scene .amount-proof span { display: block; color: #9fe8cb; font-size: 15px; }
      #demo-scene .amount-proof strong { display: block; margin: 5px 0; color: white; font-size: 52px; }
      #demo-scene .route-proof { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 18px; padding: 18px 22px; border: 1px solid rgba(255,255,255,.22); background: #10271f; }
      #demo-scene .route-proof code { color: #d9ffed; font: 700 19px/1.3 "IBM Plex Mono", monospace; }
      #demo-scene .route-proof code:last-child { text-align: right; }
      #demo-scene .route-proof b { color: #78e4bd; font-size: 30px; }
      #demo-scene .tx-proof { grid-column: 1 / -1; align-self: end; padding: 18px 22px; border-left: 5px solid #35d49d; background: #17382e; }
      #demo-scene .tx-proof small, #demo-scene .tx-proof strong, #demo-scene .tx-proof span { display: block; }
      #demo-scene .tx-proof small { color: rgba(238,255,247,.62); font-size: 14px; }
      #demo-scene .tx-proof em { color: #baf7dc; font-style: normal; }
      #demo-scene .tx-proof strong { margin: 7px 0; color: white; font: 700 21px/1.2 "IBM Plex Mono", monospace; }
      #demo-scene .tx-proof span { color: rgba(238,255,247,.58); font-size: 13px; }
    `;
    scene.appendChild(style);
    document.body.appendChild(scene);
    scene.querySelector(".amount-proof strong").textContent = data.amount.replace(" USDC", "");
    const routeCodes = scene.querySelectorAll(".route-proof code");
    routeCodes[0].textContent = `Buyer  ${data.payer}`;
    routeCodes[1].textContent = `Seller  ${data.payTo}`;
    scene.querySelector(".tx-proof em").textContent = data.block;
    scene.querySelector(".tx-proof strong").textContent = data.tx;
    scene.querySelector(".tx-proof span").textContent = data.explorerUrl;
  }, proof);
};

const showEndScene = async (page) => {
  await page.evaluate((url) => {
    document.getElementById("demo-scene")?.remove();
    const scene = document.createElement("section");
    scene.id = "demo-scene";
    scene.innerHTML = `
      <div class="end-mark">✓</div>
      <h1>AgentPay Firewall</h1>
      <p>One link from seller intent to onchain settlement.</p>
      <strong></strong>
      <div class="end-proof">Seller links · Buyer custody · x402 v2 · Algorand receipts</div>
    `;
    const style = document.createElement("style");
    style.textContent = `
      #demo-scene { position: fixed; inset: 0; z-index: 99998; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 40px 116px; box-sizing: border-box; text-align: center; color: #14201c; background: #eef5f1; font-family: "DM Sans", system-ui, sans-serif; }
      #demo-scene .end-mark { width: 68px; height: 68px; display: grid; place-items: center; border-radius: 12px; color: white; background: #08785d; font-size: 38px; font-weight: 900; }
      #demo-scene h1 { margin: 22px 0 8px; font-size: 60px; line-height: 1; }
      #demo-scene p { margin: 0; color: #5d6d66; font-size: 23px; }
      #demo-scene > strong { margin-top: 30px; padding: 12px 18px; border: 1px solid #a8cfc0; color: #05634d; background: white; font: 700 20px/1.2 "IBM Plex Mono", monospace; }
      #demo-scene .end-proof { margin-top: 24px; color: #66736d; font-size: 15px; font-weight: 700; }
    `;
    scene.appendChild(style);
    document.body.appendChild(scene);
    scene.querySelector(":scope > strong").textContent = url;
  }, appUrl);
};

const recordBrowserDemo = async (evidence, timedSegments) => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
      recordVideo: { dir: tempDir, size: { width: 1280, height: 720 } },
    });
    const page = await context.newPage();
    await page.goto(appUrl, { waitUntil: "networkidle" });
    await installCaptionOverlay(page);

    let checkoutUrl = "";
    let paymentRequest;

    await step(page, timedSegments, 0);
    await step(page, timedSegments, 1, async () => {
      await page.locator(".seller-workspace").scrollIntoViewIfNeeded();
      await page.getByLabel("Payment title").fill("AI research report");
      await page.getByLabel("Amount").fill("0.001");
      await page.getByLabel("Description Optional").fill("Payment for a completed agent research task.");
      await pause(1_200);
    });
    await step(page, timedSegments, 2, async () => {
      await page.getByRole("button", { name: "Create payment link" }).click();
      await page.getByText("Link ready").waitFor({ timeout: 15_000 });
      checkoutUrl = await page.getByRole("link", { name: "Open checkout" }).getAttribute("href");
      if (!checkoutUrl) throw new Error("Generated checkout URL was not found.");
      paymentRequest = await page.evaluate(async (url) => {
        const token = new URL(url).searchParams.get("request");
        const response = await fetch(`/api/payment-links?request=${encodeURIComponent(token)}`);
        if (!response.ok) throw new Error("Payment link could not be verified.");
        return (await response.json()).request;
      }, checkoutUrl);
      await page.locator(".link-output").scrollIntoViewIfNeeded();
    });
    await step(page, timedSegments, 3, async () => {
      await page.goto(checkoutUrl, { waitUntil: "networkidle" });
      await installCaptionOverlay(page);
      await page.locator(".checkout-shell").scrollIntoViewIfNeeded();
    });
    await step(page, timedSegments, 4, async () => {
      const token = new URL(checkoutUrl).searchParams.get("request");
      const challenge = await page.evaluate(async (requestToken) => {
        const response = await fetch(`/api/x402/pay?request=${encodeURIComponent(requestToken)}`, {
          headers: { Accept: "application/json" },
        });
        return { status: response.status, header: response.headers.get("PAYMENT-REQUIRED") };
      }, token);
      if (challenge.status !== 402 || !challenge.header) throw new Error("Dynamic x402 challenge was not available.");
      await showChallengeScene(page, paymentRequest);
    });
    await step(page, timedSegments, 5, async () => {
      await page.goto(checkoutUrl, { waitUntil: "networkidle" });
      await installCaptionOverlay(page);
      await page.getByRole("button", { name: "Connect Pera Wallet" }).scrollIntoViewIfNeeded();
    });
    await step(page, timedSegments, 6, async () => {
      await showSettlementScene(page, evidence);
    });
    await step(page, timedSegments, 7, async () => {
      await showEndScene(page);
    });

    const video = page.video();
    await context.close();
    if (!video) throw new Error("Playwright video recording was not created.");
    await copyFile(await video.path(), rawWebm);
  } finally {
    await browser.close();
  }
};

await rm(tempDir, { recursive: true, force: true });
await mkdir(tempDir, { recursive: true });
await mkdir(voiceoverDir, { recursive: true });
await mkdir(publicDir, { recursive: true });

const evidence = JSON.parse(await readFile(evidenceFile, "utf8"));
const timedSegments = await prepareTimedVoiceover();
const totalDuration = timedSegments.reduce((sum, segment) => sum + segment.duration, 0);
await writeFile(publicSrt, buildSrt(timedSegments));
await recordBrowserDemo(evidence, timedSegments);

await run("ffmpeg", [
  "-y", "-i", rawWebm, "-i", voiceoverAudio,
  "-vf", "fps=30,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,tpad=stop_mode=clone:stop_duration=20",
  "-t", totalDuration.toFixed(3), "-map", "0:v:0", "-map", "1:a:0",
  "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "18",
  "-c:a", "aac", "-b:a", "160k", publicMp4,
]);

await run("ffmpeg", [
  "-y", "-i", publicMp4, "-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0",
  "-deadline", "good", "-cpu-used", "4", "-row-mt", "1", "-c:a", "libopus", "-b:a", "96k", publicWebm,
]);

console.log(`Wrote ${publicMp4}`);
console.log(`Wrote ${publicWebm}`);
console.log(`Wrote ${publicSrt}`);
