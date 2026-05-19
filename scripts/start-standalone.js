const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");
const serverPath = path.join(standaloneDir, "server.js");

function copyIfExists(from, to) {
  if (!fs.existsSync(from)) return;
  fs.cpSync(from, to, { recursive: true, force: true });
}

if (!fs.existsSync(serverPath)) {
  console.error("Missing .next/standalone/server.js. Run `npm run build` first.");
  process.exit(1);
}

copyIfExists(path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static"));
copyIfExists(path.join(root, "public"), path.join(standaloneDir, "public"));

const child = spawn(process.execPath, [serverPath], {
  cwd: standaloneDir,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
