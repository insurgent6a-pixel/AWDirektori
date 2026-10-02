// node screenshot.mjs <url> [label] [--mobile] [--viewport] [--login=email:password] [--wait=ms] [--width=px]
// Saves ./temporary screenshots/screenshot-N[-label].png (auto-incremented, never overwritten).
// Full page by default; --viewport captures only the first screen. --mobile uses a 390px phone viewport.
// --login signs in at /masuk first (or /staff with --staff) so signed-in pages can be captured.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")).map(([k, v]) => [k, v ?? true]));
const [url, label] = args.filter((a) => !a.startsWith("--"));
if (!url) {
  console.error("Usage: node screenshot.mjs <url> [label] [--mobile] [--viewport] [--login=email:password] [--staff] [--wait=ms]");
  process.exit(1);
}

// No bundled Chrome: use the browser already on this machine.
const executablePath = [
  process.env.BROWSER_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].find((p) => p && fs.existsSync(p));
if (!executablePath) {
  console.error("No Chrome or Edge found. Set BROWSER_PATH to a Chromium-based browser.");
  process.exit(1);
}

const dir = path.join(process.cwd(), "temporary screenshots");
fs.mkdirSync(dir, { recursive: true });
const next = Math.max(0, ...fs.readdirSync(dir).map((f) => Number(/^screenshot-(\d+)/.exec(f)?.[1] ?? 0))) + 1;
const file = path.join(dir, `screenshot-${next}${label ? `-${label}` : ""}.png`);

// Edge re-launches itself on Windows, which makes puppeteer.launch() lose the process.
// Starting it with a debugging port and connecting works with both Edge and Chrome.
const port = 9400 + Math.floor(Math.random() * 500);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "aw-shot-"));
spawn(
  executablePath,
  ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "about:blank"],
  { detached: true, stdio: "ignore" },
).unref();
let browser;
for (let i = 0; i < 75 && !browser; i++) {
  browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` }).catch(() => null);
  if (!browser) await new Promise((r) => setTimeout(r, 200));
}
if (!browser) {
  console.error("The browser did not start.");
  process.exit(1);
}
try {
  const page = await browser.newPage();
  const mobile = !!flags.mobile;
  await page.setViewport(
    mobile
      ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
      : { width: Number(flags.width) || 1280, height: 900, deviceScaleFactor: 1 },
  );

  if (flags.login) {
    const [email, password] = String(flags.login).split(":");
    await page.goto(new URL(flags.staff ? "/staff" : "/masuk", url).href, { waitUntil: "networkidle2" });
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', password);
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}), page.click('button[type="submit"]')]);
  }

  await page.goto(url, { waitUntil: "networkidle2", timeout: 60_000 });
  // Scroll through once so lazy images load, then let entrance animations settle.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 80));
    }
    window.scrollTo(0, 0);
  });
  await new Promise((r) => setTimeout(r, Number(flags.wait) || 1200));
  // A full-page capture resizes the viewport, which would replay entrance animations mid-shot. Freeze them first.
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
  await page.screenshot({ path: file, fullPage: !flags.viewport });
  console.log(file);
} finally {
  await browser.close(); // also ends the browser process
  // The profile stays locked for a moment while the browser exits. A leftover temp folder is harmless.
  try {
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  } catch {}
}
