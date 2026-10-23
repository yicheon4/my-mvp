// Local AI test server: the protected vite.config.ts as-is, plus POST /api/sophie-chat served by the dev server.
// Run with `npm run dev:ai`. Keys come from source/.env.local on the server side only (not VITE_-prefixed → never in
// the browser bundle). Production builds do not use this file; hosted previews use api/sophie-chat.mjs instead.
import { defineConfig, loadEnv, mergeConfig } from "vite";
import type { Plugin, UserConfig } from "vite";
import base from "./vite.config";
import { createSophieHandler } from "./server/sophie-chat-core.mjs";
import { loadSophiePrompts } from "./server/sophie-prompts.mjs";

function sophieChatDev(): Plugin {
  return {
    name: "sophie-chat-dev",
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), "");
      const handle = createSophieHandler({
        env: { GEMINI_API_KEY: env.GEMINI_API_KEY, GEMINI_MODEL: env.GEMINI_MODEL, SOPHIE_INVITE_CODE: env.SOPHIE_INVITE_CODE, SOPHIE_DAILY_LIMIT: env.SOPHIE_DAILY_LIMIT },
        prompts: loadSophiePrompts(new URL("./characters/", import.meta.url)),
        log: (...a: unknown[]) => console.log("[sophie]", ...a),
      });
      console.log(`[sophie] local AI chat: key ${env.GEMINI_API_KEY ? "set" : "MISSING"}, model ${env.GEMINI_MODEL || "MISSING"}`);
      server.middlewares.use("/api/sophie-chat", (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
        let raw = "";
        req.on("data", c => { raw += c; if (raw.length > 200_000) req.destroy(); });
        req.on("end", async () => {
          let body = null; try { body = JSON.parse(raw); } catch { /* invalid → 400 */ }
          const out = await handle({ body, headers: req.headers as Record<string, string> });
          res.statusCode = out.status; res.setHeader("content-type", "application/json"); res.setHeader("cache-control", "no-store");
          res.end(JSON.stringify(out.json));
        });
      });
    },
  };
}

export default defineConfig(env => mergeConfig(typeof base === "function" ? (base as (e: typeof env) => UserConfig)(env) : base, { plugins: [sophieChatDev()] }));
