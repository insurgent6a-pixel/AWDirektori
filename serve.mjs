// Dev server on http://localhost:3000 (the Next.js app). Run: node serve.mjs
import { spawn } from "node:child_process";

spawn("npx next dev -p 3000", { stdio: "inherit", shell: true }).on("exit", (code) => process.exit(code ?? 0));
