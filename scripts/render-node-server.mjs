import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = process.cwd();
const prodServerPath = path.join(
  projectRoot,
  "node_modules",
  "vinext",
  "dist",
  "server",
  "prod-server.js",
);
// Apply pending migrations before reporting the HTTP server ready.
await import("./cloudflare-workers-shim.mjs");
const { startProdServer } = await import(pathToFileURL(prodServerPath).href);
await startProdServer({
  host: "0.0.0.0",
  port: Number(process.env.PORT || 10000),
  outDir: path.join(projectRoot, "dist"),
});
