import { register } from "node:module";

// Render terminates TLS at its proxy; preserve HTTPS for origin checks and cookies.
if (process.env.RENDER === "true") process.env.VINEXT_TRUST_PROXY = "1";
register("./cloudflare-loader.mjs", import.meta.url);
await import("./render-node-server.mjs");
