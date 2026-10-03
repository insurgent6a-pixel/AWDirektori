// node video/capture.mjs [flow ...]   (run from the project root, with the app on http://localhost:3000)
// Walks through the app as the demo member on a phone-sized screen and saves what the video shows:
// public/<name>.png for every state, and src/taps.json with the spot of each tap (in 390 x 844 screen points).
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = "http://localhost:3000";
const BUSINESS = "Jelajah Dewata Trip"; // a demo business the demo member does not own
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const shots = path.join(here, "public"); // flat: Remotion cannot link sub-folders of public on Windows
fs.mkdirSync(shots, { recursive: true });
const tapsFile = path.join(here, "src", "taps.json");
const taps = fs.existsSync(tapsFile) ? JSON.parse(fs.readFileSync(tapsFile, "utf8")) : {};

const executablePath = [
  process.env.BROWSER_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find((p) => p && fs.existsSync(p));

// Same start as screenshot.mjs: Edge re-launches itself, so start it with a debugging port and connect.
const port = 9400 + Math.floor(Math.random() * 500);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "aw-video-"));
spawn(executablePath, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "about:blank"], { detached: true, stdio: "ignore" }).unref();
let browser;
for (let i = 0; i < 75 && !browser; i++) {
  browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` }).catch(() => null);
  if (!browser) await new Promise((r) => setTimeout(r, 200));
}
if (!browser) throw new Error("The browser did not start.");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
await page.emulateTimezone("Asia/Jakarta");
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

const go = async (url) => {
  await page.goto(BASE + url, { waitUntil: "networkidle2", timeout: 60_000 });
  await sleep(1500);
};
const shot = async (name) => {
  await page.screenshot({ path: path.join(shots, `${name}.png`) });
  console.log(name);
};
// The first visible element with this text (exact wins over "contains"), or a CSS selector when `what` starts with "css:".
const find = (what, nth = 0) =>
  page.evaluateHandle(
    (what, nth) => {
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
      };
      if (what.startsWith("css:")) return [...document.querySelectorAll(what.slice(4))].filter(visible)[nth] ?? null;
      const all = [...document.querySelectorAll("button, a, [role=tab], [role=button], label")].filter(visible);
      const text = (el) => el.textContent.replace(/\s+/g, " ").trim();
      const exact = all.filter((el) => text(el) === what);
      return (exact.length ? exact : all.filter((el) => text(el).includes(what)))[nth] ?? null;
    },
    what,
    nth,
  );
// Scrolls the element into view, saves "<name>-a" (before), remembers where the tap lands, taps, saves "<name>-b" (after).
const tap = async (what, name, { nth = 0, wait = 1400, block = "center" } = {}) => {
  const el = (await find(what, nth)).asElement();
  if (!el) throw new Error(`Not on the page: ${what}`);
  await el.evaluate((e, block) => e.scrollIntoView({ block, behavior: "instant" }), block);
  await sleep(700);
  const box = await el.boundingBox();
  taps[name] = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
  await shot(`${name}-a`);
  await el.click();
  await sleep(wait);
  await shot(`${name}-b`);
};
const type = async (text) => {
  await page.keyboard.type(text, { delay: 40 });
  await sleep(500);
};

// A tap that is not part of the video.
const press = async (what, nth = 0) => {
  const el = (await find(what, nth)).asElement();
  if (!el) throw new Error(`Not on the page: ${what}`);
  await el.click();
  await sleep(1200);
};

const flows = {
  async cari() {
    await go("/");
    await tap("css:input[placeholder^='Cari bisnis']", "cari-1");
    await type("trip");
    await shot("cari-2");
    await tap("Cari", "cari-3", { wait: 2000 });
    await tap("Peta", "cari-4", { wait: 3500 });
  },
  // Sends a real Hubungkan request from the demo member to the owner of BUSINESS.
  async hubungkan() {
    await go("/lulusan");
    await tap(BUSINESS, "bisnis-1", { wait: 3000 });
    await tap("Made", "bisnis-2", { wait: 1800 });
    await page.keyboard.press("Escape");
    await sleep(900);
    await tap("Hubungkan", "hub-1", { wait: 1500 });
    await type("Halo Made, saya mau ajak tim 12 orang trip ke Nusa Penida bulan depan. Bisa ngobrol?");
    await shot("hub-2");
    await tap("Kirim permintaan", "hub-3", { wait: 2500 });
  },
  async peluang() {
    await go("/peluang");
    await tap("Saya berminat", "peluang-1");
    await go("/akun?tab=peluang&baru=1");
    await tap("css:input[name='title']", "buka-1", { wait: 600 });
    await type("Cari supplier kemasan kopi");
    await page.keyboard.press("Tab");
    await type("Butuh 2.000 kemasan per bulan untuk tiga gerai, mulai November.");
    await shot("buka-2");
  },
  // Sends a real RSVP as the demo member.
  async acara() {
    await go("/acara");
    await tap("RSVP", "acara-1", { wait: 2500 });
  },
  // Accepts a real Hubungkan request that was waiting for the demo member.
  async koneksi() {
    await go("/akun?tab=koneksi");
    await shot("koneksi-0");
    await tap("Terima", "koneksi-1", { wait: 2500 });
  },
};

try {
  await go("/masuk");
  await page.type('input[type="email"]', "lulusan@demo.awdirektori.test");
  await page.type('input[type="password"]', "asiaworks123");
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}), page.click('button[type="submit"]')]);
  const names = process.argv.slice(2);
  for (const name of names.length ? names : Object.keys(flows)) {
    try {
      await flows[name]();
    } catch (e) {
      console.error(`${name}: ${e.message}`);
      await shot(`${name}-error`);
    }
  }
} finally {
  fs.writeFileSync(tapsFile, JSON.stringify(taps, null, 2) + "\n");
  await browser.close();
  try {
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  } catch {}
}
