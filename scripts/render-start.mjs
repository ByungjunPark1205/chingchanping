import { spawn } from "node:child_process";
import path from "node:path";

const projectRoot = process.cwd();
const port = String(process.env.PORT || "10000");
const persistRoot = process.env.RENDER_DISK_PATH
  ? path.resolve(process.env.RENDER_DISK_PATH)
  : path.join(projectRoot, ".wrangler", "state");

const child = spawn(
  process.execPath,
  [
    "--import",
    "./scripts/sites-env.mjs",
    "./node_modules/wrangler/bin/wrangler.js",
    "dev",
    "--config",
    "dist/server/wrangler.json",
    "--local",
    "--persist-to",
    persistRoot,
    "--ip",
    "0.0.0.0",
    "--port",
    port,
    "--inspector-port",
    "0",
  ],
  { cwd: projectRoot, stdio: "inherit", env: process.env },
);

const forwardSignal = (signal) => {
  if (!child.killed) child.kill(signal);
};
process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
