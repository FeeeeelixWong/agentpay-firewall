import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir, copyFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const appUrl = "http://127.0.0.1:5176";
const directApiHealthUrl = "http://127.0.0.1:8787/api/health";
const proxiedApiHealthUrl = `${appUrl}/api/health`;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const outputDir = resolve("docs/media");
const publicDir = resolve("public");
const tempDir = resolve("tmp/demo-video");
const voiceoverDir = join(tempDir, "voiceover");
const edgeTtsVenv = resolve("tmp/edge-tts-venv");
const edgeTtsPython = join(edgeTtsVenv, "bin", "python");
const edgeTtsVoice = process.env.DEMO_TTS_VOICE ?? "en-US-JennyNeural";

const rawWebm = join(tempDir, "agentpay-firewall-demo.raw.webm");
const voiceoverAudio = join(tempDir, "agentpay-firewall-demo.wav");
const voiceoverConcatList = join(tempDir, "voiceover-list.txt");
const docsMp4 = join(outputDir, "agentpay-firewall-demo.mp4");
const docsWebm = join(outputDir, "agentpay-firewall-demo.webm");
const docsSrt = join(outputDir, "agentpay-firewall-demo.srt");
const publicMp4 = join(publicDir, "agentpay-firewall-demo.mp4");
const publicWebm = join(publicDir, "agentpay-firewall-demo.webm");
const publicSrt = join(publicDir, "agentpay-firewall-demo.srt");
const voiceoverFile = resolve("docs/demo-voiceover.txt");
const evidenceFile = resolve("docs/x402-settlement-evidence.json");

const segments = [
  {
    minDuration: 5.8,
    caption: "AgentPay Firewall: policy-controlled agent payments.",
    voiceover:
      "AgentPay Firewall turns autonomous agent payments into policy-controlled infrastructure.",
  },
  {
    minDuration: 7.0,
    caption: "Agents can pay. Wallets still need rules.",
    voiceover:
      "AI agents can call paid APIs, but they should not spend from a wallet without rules, budgets, and audit trails.",
  },
  {
    minDuration: 8.5,
    caption: "Mandate: caps, budgets, allowlists, risk, approval.",
    voiceover:
      "The user defines the mandate: request cap, daily budget, approved services, network, asset, risk score, and human approval threshold.",
  },
  {
    minDuration: 8.2,
    caption: "Allowed flow: paid wallet-risk API returns HTTP 402.",
    voiceover:
      "First, the agent calls a paid wallet-risk API. The server returns an HTTP 402 challenge with PAYMENT-REQUIRED.",
  },
  {
    minDuration: 8.5,
    caption: "Policy passed: sign, retry, receive PAYMENT-RESPONSE.",
    voiceover:
      "The firewall checks every gate. This request passes, so it signs, retries, and receives PAYMENT-RESPONSE.",
  },
  {
    minDuration: 9.0,
    caption: "Blocked flow: untrusted overspend stops before signing.",
    voiceover:
      "Now the unsafe path. A costly non-allowlisted crawl gets the same challenge, but policy fails before signing.",
  },
  {
    minDuration: 8.0,
    caption: "Manual review: allowed service, approval required.",
    voiceover:
      "A third request is allowed, but crosses the human approval threshold. The wallet pauses instead of silently spending.",
  },
  {
    minDuration: 9.0,
    caption: "Official path: OKX Wallet signs x402 typed data.",
    voiceover:
      "For the production path, the buyer key stays inside OKX Wallet. The app asks OKX to sign x402 typed data with eth_signTypedData_v4.",
  },
  {
    minDuration: 11.5,
    caption: "Verified settlement: 0.001 USDC on Base Sepolia.",
    voiceover:
      "We reproduced that path on Base Sepolia. The facilitator settled 0.001 USDC and returned an official x402 receipt with an explorer transaction.",
  },
  {
    minDuration: 7.4,
    caption: "Control layer for agentic payments.",
    voiceover:
      "So the project is not just another agent wallet. It is the control layer that decides when autonomous payments are safe to execute.",
  },
];

const pause = (ms) => new Promise((resolvePause) => setTimeout(resolvePause, ms));

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

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", rejectRun);
    child.on("close", (code) => {
      if (code === 0) {
        resolveRun({ stdout, stderr });
        return;
      }

      rejectRun(
        new Error(
          `${command} ${args.join(" ")} failed with code ${code}\n${stdout}\n${stderr}`,
        ),
      );
    });
  });

const probeDuration = async (filePath) => {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=nw=1:nk=1",
    filePath,
  ]);

  const duration = Number(stdout.trim());

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Could not read audio duration for ${filePath}`);
  }

  return duration;
};

const sayToFile = async (inputFile, outputFile) => {
  try {
    await run("say", ["-v", "Shelley (英语（美国）)", "-r", "165", "-f", inputFile, "-o", outputFile]);
  } catch {
    await run("say", ["-r", "165", "-f", inputFile, "-o", outputFile]);
  }
};

let edgeTtsReady;
const ensureEdgeTts = async () => {
  if (edgeTtsReady !== undefined) return edgeTtsReady;

  const hasEdgeTts = async () => {
    try {
      await run(edgeTtsPython, ["-c", "import edge_tts"]);
      return true;
    } catch {
      return false;
    }
  };

  if (await hasEdgeTts()) {
    edgeTtsReady = true;
    return edgeTtsReady;
  }

  try {
    await mkdir(resolve("tmp"), { recursive: true });
    await run("python3", ["-m", "venv", edgeTtsVenv]);
    await run(edgeTtsPython, ["-m", "pip", "install", "edge-tts==7.2.8"]);
    edgeTtsReady = await hasEdgeTts();
  } catch {
    edgeTtsReady = false;
  }

  return edgeTtsReady;
};

const synthesizeVoiceover = async ({ inputFile, edgeOutputFile, fallbackOutputFile }) => {
  if (await ensureEdgeTts()) {
    try {
      await run(edgeTtsPython, [
        "-m",
        "edge_tts",
        "--voice",
        edgeTtsVoice,
        "--rate",
        "-2%",
        "--file",
        inputFile,
        "--write-media",
        edgeOutputFile,
      ]);
      return edgeOutputFile;
    } catch (error) {
      console.warn(`edge-tts failed, falling back to macOS say: ${error.message}`);
    }
  }

  await sayToFile(inputFile, fallbackOutputFile);
  return fallbackOutputFile;
};

const toConcatFilePath = (filePath) => filePath.replaceAll("'", "'\\''");

const prepareTimedVoiceover = async () => {
  await mkdir(voiceoverDir, { recursive: true });
  await writeFile(voiceoverFile, `${segments.map((segment) => segment.voiceover).join("\n\n")}\n`);

  const timedSegments = [];

  for (const [index, segment] of segments.entries()) {
    const textPath = join(voiceoverDir, `segment-${String(index + 1).padStart(2, "0")}.txt`);
    const edgeAudioPath = join(voiceoverDir, `segment-${String(index + 1).padStart(2, "0")}.mp3`);
    const fallbackAudioPath = join(voiceoverDir, `segment-${String(index + 1).padStart(2, "0")}.aiff`);
    const paddedPath = join(voiceoverDir, `segment-${String(index + 1).padStart(2, "0")}.wav`);

    await writeFile(textPath, `${segment.voiceover}\n`);
    const audioPath = await synthesizeVoiceover({
      inputFile: textPath,
      edgeOutputFile: edgeAudioPath,
      fallbackOutputFile: fallbackAudioPath,
    });

    const audioDuration = await probeDuration(audioPath);
    const duration = Number(Math.max(segment.minDuration, audioDuration + 0.45).toFixed(3));

    await run("ffmpeg", [
      "-y",
      "-i",
      audioPath,
      "-af",
      `apad=pad_dur=${Math.max(0, duration - audioDuration).toFixed(3)},atrim=0:${duration},asetpts=N/SR/TB`,
      "-ar",
      "44100",
      "-ac",
      "1",
      paddedPath,
    ]);

    timedSegments.push({
      ...segment,
      duration,
      audioDuration,
      audioPath,
      paddedPath,
    });
  }

  await writeFile(
    voiceoverConcatList,
    `${timedSegments.map((segment) => `file '${toConcatFilePath(segment.paddedPath)}'`).join("\n")}\n`,
  );

  await run("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    voiceoverConcatList,
    "-c:a",
    "pcm_s16le",
    voiceoverAudio,
  ]);

  return timedSegments;
};

const reachable = async (url) => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1_500) });
    return response.ok;
  } catch {
    return false;
  }
};

const spawnDevProcess = (scriptName) => {
  const child = spawn(npmCommand, ["run", scriptName], {
    cwd: resolve("."),
    env: { ...process.env, BROWSER: "none" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const logs = [];

  const collect = (chunk) => {
    logs.push(chunk.toString());
    if (logs.length > 40) logs.shift();
  };

  child.stdout?.on("data", collect);
  child.stderr?.on("data", collect);

  return {
    child,
    logs,
    stop: () => {
      if (!child.killed) child.kill("SIGTERM");
    },
  };
};

const ensureLocalStack = async () => {
  const processes = [];

  if (!(await reachable(directApiHealthUrl))) {
    processes.push(spawnDevProcess("dev:api"));
  }

  if (!(await reachable(appUrl))) {
    processes.push(spawnDevProcess("dev:web"));
  }

  const deadline = Date.now() + 45_000;

  while (Date.now() < deadline) {
    if ((await reachable(appUrl)) && (await reachable(proxiedApiHealthUrl))) {
      return () => {
        for (const processInfo of processes) processInfo.stop();
      };
    }

    await pause(1_000);
  }

  for (const processInfo of processes) processInfo.stop();

  throw new Error(
    `Timed out waiting for local demo stack.\n${processes
      .map((processInfo) => processInfo.logs.join(""))
      .join("\n")}`,
  );
};

const formatSrtTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const wholeSeconds = Math.floor(seconds % 60);
  const milliseconds = Math.round((seconds - Math.floor(seconds)) * 1000);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
    wholeSeconds,
  ).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
};

const buildSrt = (timedSegments) => {
  let cursor = 0;

  return timedSegments
    .map((segment, index) => {
      const start = cursor;
      cursor += segment.duration;
      return `${index + 1}\n${formatSrtTime(start)} --> ${formatSrtTime(cursor)}\n${
        segment.voiceover
      }\n`;
    })
    .join("\n");
};

const shortHash = (hash, prefix = 14, suffix = 8) =>
  `${hash.slice(0, prefix)}...${hash.slice(-suffix)}`;

const installCaptionOverlay = async (page) => {
  await page.addStyleTag({
    content: `
      #demo-caption {
        position: fixed;
        left: 54px;
        right: 32px;
        bottom: 24px;
        z-index: 99999;
        border: 1px solid rgba(215, 223, 217, 0.76);
        border-radius: 8px;
        background: rgba(14, 25, 21, 0.9);
        color: #e5fff3;
        font: 700 21px/1.32 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        padding: 13px 16px;
        text-align: center;
        box-shadow: 0 18px 44px rgba(41, 52, 47, 0.18);
      }
      body.proof-scene-active #demo-caption {
        left: auto;
        right: 48px;
        top: 28px;
        bottom: auto;
        width: 420px;
        font-size: 15px;
        text-align: left;
        padding: 12px 14px;
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

const step = async (page, timedSegments, segmentIndex, action) => {
  const segment = timedSegments[segmentIndex];
  await caption(page, segment.voiceover);
  const startedAt = Date.now();

  if (action) await action();

  const remaining = segment.duration * 1_000 - (Date.now() - startedAt);
  if (remaining > 0) await pause(remaining);
};

const showProofScene = async (page, evidence) => {
  const proof = {
    status: evidence.status,
    amount: `${evidence.amountUsd} USDC`,
    network: evidence.networkName,
    payer: shortHash(evidence.payer, 12, 8),
    payTo: shortHash(evidence.payTo, 12, 8),
    tx: shortHash(evidence.transactionHash, 16, 10),
    txFull: evidence.transactionHash,
    block: String(evidence.blockNumber),
    explorerUrl: evidence.explorerUrl,
  };

  await page.evaluate((proofData) => {
    document.getElementById("proof-scene")?.remove();
    document.body.classList.add("proof-scene-active");

    const scene = document.createElement("section");
    scene.id = "proof-scene";
    scene.innerHTML = `
      <div class="proof-shell">
        <div class="proof-copy">
          <span class="proof-eyebrow">Official x402 + OKX Wallet proof</span>
          <h1>Real settlement, not a mock receipt</h1>
          <p>The buyer signed x402 EIP-712 typed data in OKX Wallet. The facilitator settled the request and returned an official receipt.</p>
        </div>
        <div class="proof-grid">
          <div class="proof-card"><span>Status</span><strong></strong></div>
          <div class="proof-card"><span>Amount</span><strong></strong></div>
          <div class="proof-card"><span>Network</span><strong></strong></div>
          <div class="proof-card"><span>Block</span><strong></strong></div>
        </div>
        <div class="proof-route">
          <div><span>Payer</span><code></code></div>
          <div class="proof-arrow">-></div>
          <div><span>Pay to</span><code></code></div>
        </div>
        <div class="proof-tx">
          <span>Explorer transaction</span>
          <code></code>
          <small></small>
        </div>
      </div>
    `;

    const style = document.createElement("style");
    style.textContent = `
      #proof-scene {
        position: fixed;
        inset: 0;
        z-index: 99998;
        padding: 48px 56px 120px;
        box-sizing: border-box;
        color: #f4fff8;
        background:
          radial-gradient(circle at 18% 16%, rgba(47, 83, 255, 0.32), transparent 34%),
          radial-gradient(circle at 82% 28%, rgba(26, 177, 106, 0.24), transparent 36%),
          linear-gradient(135deg, #101616 0%, #17231f 48%, #eef4ed 100%);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #proof-scene .proof-shell {
        display: flex;
        flex-direction: column;
        gap: 24px;
        height: 100%;
      }
      #proof-scene .proof-copy {
        max-width: 760px;
      }
      #proof-scene .proof-eyebrow {
        display: inline-flex;
        margin-bottom: 14px;
        color: #a4ffcf;
        font-size: 20px;
        font-weight: 800;
        letter-spacing: 0;
        text-transform: uppercase;
      }
      #proof-scene h1 {
        margin: 0;
        color: #ffffff;
        font-size: 54px;
        line-height: 1.02;
        letter-spacing: 0;
      }
      #proof-scene p {
        margin: 18px 0 0;
        max-width: 700px;
        color: rgba(244, 255, 248, 0.86);
        font-size: 24px;
        line-height: 1.35;
      }
      #proof-scene .proof-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 16px;
      }
      #proof-scene .proof-card,
      #proof-scene .proof-route,
      #proof-scene .proof-tx {
        border: 1px solid rgba(232, 244, 237, 0.58);
        border-radius: 8px;
        background: rgba(15, 28, 23, 0.76);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.22);
      }
      #proof-scene .proof-card {
        padding: 22px;
      }
      #proof-scene span {
        color: rgba(229, 255, 243, 0.72);
        font-size: 18px;
        font-weight: 700;
      }
      #proof-scene strong {
        display: block;
        margin-top: 10px;
        color: #ffffff;
        font-size: 28px;
        line-height: 1.05;
      }
      #proof-scene code {
        color: #dfffea;
        font: 700 26px/1.2 "SFMono-Regular", Consolas, "Liberation Mono", monospace;
        word-break: break-all;
      }
      #proof-scene .proof-route {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        gap: 24px;
        align-items: center;
        padding: 24px;
      }
      #proof-scene .proof-route span,
      #proof-scene .proof-route code {
        display: block;
      }
      #proof-scene .proof-arrow {
        color: #a4ffcf;
        font-size: 40px;
        font-weight: 900;
      }
      #proof-scene .proof-tx {
        margin-top: auto;
        padding: 24px;
      }
      #proof-scene .proof-tx span,
      #proof-scene .proof-tx code,
      #proof-scene .proof-tx small {
        display: block;
      }
      #proof-scene .proof-tx code {
        margin-top: 10px;
      }
      #proof-scene .proof-tx small {
        margin-top: 8px;
        color: rgba(229, 255, 243, 0.68);
        font-size: 18px;
      }
    `;
    scene.appendChild(style);
    document.body.appendChild(scene);

    const cards = scene.querySelectorAll(".proof-card strong");
    cards[0].textContent = proofData.status;
    cards[1].textContent = proofData.amount;
    cards[2].textContent = proofData.network;
    cards[3].textContent = proofData.block;
    scene.querySelector(".proof-route div:first-child code").textContent = proofData.payer;
    scene.querySelector(".proof-route div:last-child code").textContent = proofData.payTo;
    scene.querySelector(".proof-tx code").textContent = proofData.tx;
    scene.querySelector(".proof-tx small").textContent = proofData.explorerUrl;
  }, proof);
};

const recordBrowserDemo = async (evidence, timedSegments) => {
  const cleanup = await ensureLocalStack();
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
      recordVideo: {
        dir: tempDir,
        size: { width: 1280, height: 720 },
      },
    });

    const page = await context.newPage();

    await page.goto(appUrl, { waitUntil: "networkidle" });
    await installCaptionOverlay(page);

    await step(page, timedSegments, 0);
    await step(page, timedSegments, 1);
    await step(page, timedSegments, 2);

    await step(page, timedSegments, 3, async () => {
      await page.getByRole("button", { name: /Allowed paid API/ }).click();
      await page.getByRole("button", { name: "Run x402 flow" }).click();
      await page.locator(".status-card", { hasText: "Payment settled" }).waitFor({
        timeout: 10_000,
      });
    });

    await step(page, timedSegments, 4, async () => {
      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
      await pause(1_500);
    });

    await step(page, timedSegments, 5, async () => {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
      await pause(900);
      await page.getByRole("button", { name: /Blocked overspend/ }).click();
      await page.getByRole("button", { name: "Run x402 flow" }).click();
      await page.locator(".status-card", { hasText: "Blocked before signing" }).waitFor({
        timeout: 10_000,
      });
    });

    await step(page, timedSegments, 6, async () => {
      await page.getByRole("button", { name: /Manual review/ }).click();
      await page.getByRole("button", { name: "Run x402 flow" }).click();
      await page.locator(".status-card", { hasText: "Waiting for human approval" }).waitFor({
        timeout: 10_000,
      });
    });

    await step(page, timedSegments, 7, async () => {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
      await pause(1_500);
    });

    await step(page, timedSegments, 8, async () => {
      await showProofScene(page, evidence);
    });

    await step(page, timedSegments, 9);

    const video = page.video();
    await context.close();

    if (!video) {
      throw new Error("Playwright video recording was not created.");
    }

    await copyFile(await video.path(), rawWebm);
  } finally {
    await browser?.close();
    cleanup();
  }
};

await rm(tempDir, { recursive: true, force: true });
await mkdir(tempDir, { recursive: true });
await mkdir(voiceoverDir, { recursive: true });
await mkdir(outputDir, { recursive: true });
await mkdir(publicDir, { recursive: true });

const evidence = JSON.parse(await readFile(evidenceFile, "utf8"));
const timedSegments = await prepareTimedVoiceover();
const totalDuration = timedSegments.reduce((sum, segment) => sum + segment.duration, 0);
await writeFile(docsSrt, buildSrt(timedSegments));
await copyFile(docsSrt, publicSrt);

await recordBrowserDemo(evidence, timedSegments);

await run("ffmpeg", [
  "-y",
  "-i",
  rawWebm,
  "-i",
  voiceoverAudio,
  "-vf",
  "fps=30,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,tpad=stop_mode=clone:stop_duration=20",
  "-t",
  totalDuration.toFixed(3),
  "-map",
  "0:v:0",
  "-map",
  "1:a:0",
  "-af",
  "loudnorm=I=-16:TP=-1.5:LRA=11",
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-preset",
  "medium",
  "-crf",
  "18",
  "-c:a",
  "aac",
  "-b:a",
  "160k",
  docsMp4,
]);

await run("ffmpeg", [
  "-y",
  "-i",
  docsMp4,
  "-c:v",
  "libvpx-vp9",
  "-crf",
  "34",
  "-b:v",
  "0",
  "-deadline",
  "good",
  "-cpu-used",
  "4",
  "-row-mt",
  "1",
  "-c:a",
  "libopus",
  "-b:a",
  "96k",
  docsWebm,
]);

await copyFile(docsMp4, publicMp4);
await copyFile(docsWebm, publicWebm);

console.log(`Wrote ${docsMp4}`);
console.log(`Wrote ${docsWebm}`);
console.log(`Wrote ${docsSrt}`);
