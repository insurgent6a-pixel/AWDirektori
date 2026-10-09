// npm run devlog: writes docs/devlog.csv, one row per change, newest first, read from the git history.
// Run it again after new work and the sheet is current. Opens in Excel and Google Sheets.
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 26 }).trim();

// Which pull request brought each commit in.
const pr = new Map();
for (const line of git("log", "--all", "--merges", "--pretty=%H %s").split("\n")) {
  const [, merge, number] = /^(\w+) Merge pull request #(\d+)/.exec(line) ?? [];
  if (!merge) continue;
  for (const hash of git("rev-list", "--no-merges", `${merge}^1..${merge}^2`).split("\n").filter(Boolean))
    if (!pr.has(hash)) pr.set(hash, `#${number}`);
}
const live = new Set(git("rev-list", "origin/main").split("\n"));

// ponytail: the area is guessed from words in the title. Add a line here when a new part of the site appears.
const AREAS = [
  [/staff|staf|moderasi|auto approve|audit/i, "Staff console"],
  [/map|pin|lokasi|peta/i, "Map and locations"],
  [/video/i, "Showcase video"],
  [/import|seed|migration|database|initial commit/i, "Data and setup"],
  [/home|direktori|directory|filter/i, "Home and directory"],
  [/hubungkan|profil|peluang|promo/i, "Members"],
  [/footer|look|font|inter\b|palette/i, "Design"],
];

const cell = (text) => `"${String(text).replace(/"/g, '""')}"`;
const rows = git("log", "--all", "--no-merges", "--date=short", "--pretty=%H%x1f%ad%x1f%s%x1f%b%x1e")
  .split("\x1e")
  .map((entry) => entry.trim().split("\x1f"))
  .filter(([hash]) => hash)
  .map(([hash, date, title, body = ""]) => [
    date,
    AREAS.find(([words]) => words.test(title))?.[1] ?? "General",
    title,
    body.replace(/^Co-Authored-By:.*$/gim, "").replace(/\s*\n\s*/g, " ").trim(),
    live.has(hash) ? "Live" : "Waiting for approval",
    pr.get(hash) ?? "",
    hash.slice(0, 7),
  ]);

const header = ["Date", "Area", "Change", "Details", "Status", "Pull request", "Commit"];
const numbered = rows.map((row, i) => [rows.length - i, ...row]);
fs.mkdirSync("docs", { recursive: true });
// The BOM and CRLF are for Excel, which otherwise misreads accents and line ends.
fs.writeFileSync("docs/devlog.csv", "﻿" + [["No", ...header], ...numbered].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n");
console.log(`docs/devlog.csv: ${rows.length} changes`);
