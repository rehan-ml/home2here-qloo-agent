import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { CulturalBridgeAgent } from "./lib/bridge-agent.mjs";
import { DEMO_PERSONAS } from "./lib/demo-data.mjs";
import { QlooClient, QlooApiError } from "./lib/qloo-client.mjs";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC = join(ROOT, "public");
const PORT = Number(process.env.PORT ?? 8080);
const allowDemoFallback = String(process.env.DEMO_FALLBACK ?? "false").toLowerCase() === "true";

const qloo = new QlooClient({
  apiKey: process.env.QLOO_API_KEY,
  baseUrl: process.env.QLOO_BASE_URL,
});
const agent = new CulturalBridgeAgent({ qlooClient: qloo, allowDemoFallback });
const requestCounts = new Map();

function withinApiBudget(req) {
  const address = req.socket.remoteAddress ?? "unknown";
  const now = Date.now();
  const window = requestCounts.get(address);
  if (!window || window.expires <= now) {
    if (requestCounts.size > 1000) {
      for (const [key, value] of requestCounts) if (value.expires <= now) requestCounts.delete(key);
    }
    requestCounts.set(address, { count: 1, expires: now + 10 * 60_000 });
    return true;
  }
  window.count += 1;
  return window.count <= 40;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'",
  });
  res.end(JSON.stringify(body));
}

async function parseBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32_768) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

async function serveStatic(pathname, res) {
  const requested = pathname === "/" ? "index.html" : decodeURIComponent(pathname);
  const safe = normalize(requested)
    .replace(/^[/\\]+/, "")
    .replace(/^(\.\.[/\\])+/, "");
  const file = join(PUBLIC, safe);
  if (file !== PUBLIC && !file.startsWith(`${PUBLIC}\\`) && !file.startsWith(`${PUBLIC}/`)) return false;
  try {
    const info = await stat(file);
    if (!info.isFile()) return false;
    const content = await readFile(file);
    res.writeHead(200, {
      "Content-Type": MIME[extname(file)] ?? "application/octet-stream",
      "Cache-Control": extname(file) === ".html" ? "no-cache" : "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

export function createAppServer() {
  return createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
    try {
      if (req.method === "GET" && url.pathname === "/api/health") {
        return json(res, 200, {
          ok: true,
          qloo: qloo.isConfigured ? "configured" : "demo",
          service: "Home2Here Cultural Bridge Agent",
        });
      }

      if (req.method === "GET" && url.pathname === "/api/personas") {
        return json(res, 200, { personas: Object.values(DEMO_PERSONAS) });
      }

      if (req.method === "GET" && url.pathname === "/api/search") {
        if (!withinApiBudget(req)) return json(res, 429, { error: "Too many requests. Try again in a few minutes." });
        const query = url.searchParams.get("q")?.trim();
        if (!query || query.length < 2 || query.length > 80) return json(res, 400, { error: "Search requires 2–80 characters." });
        if (!qloo.isConfigured) return json(res, 200, { mode: "demo", results: [] });
        const results = await qloo.search(query, [
          "urn:entity:artist",
          "urn:entity:movie",
          "urn:entity:tv_show",
          "urn:entity:book",
          "urn:entity:brand",
          "urn:entity:place",
        ]);
        return json(res, 200, { mode: "live", results });
      }

      if (req.method === "POST" && url.pathname === "/api/plan") {
        if (!withinApiBudget(req)) return json(res, 429, { error: "Too many requests. Try again in a few minutes." });
        const body = await parseBody(req);
        const plan = await agent.createPlan(body);
        return json(res, 200, plan);
      }

      if (req.method === "GET" && await serveStatic(url.pathname, res)) return;
      return json(res, 404, { error: "Not found." });
    } catch (error) {
      const status = error instanceof QlooApiError ? Math.min(error.status, 599) : 400;
      return json(res, status, { error: error instanceof QlooApiError && status >= 500
        ? "The cultural data service is temporarily unavailable. Please try again."
        : error.message });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createAppServer().listen(PORT, "0.0.0.0", () => {
    console.log(`Home2Here is running on http://localhost:${PORT}`);
    console.log(`Qloo mode: ${qloo.isConfigured ? "live" : "transparent demo"}`);
  });
}
