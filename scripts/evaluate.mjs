import { performance } from "node:perf_hooks";
import { CulturalBridgeAgent } from "../lib/bridge-agent.mjs";
import { DEMO_PERSONAS } from "../lib/demo-data.mjs";
import { QlooClient } from "../lib/qloo-client.mjs";

const requireLive = process.argv.includes("--require-live");
const qloo = new QlooClient({
  apiKey: process.env.QLOO_API_KEY,
  baseUrl: process.env.QLOO_BASE_URL,
});

if (requireLive && !qloo.isConfigured) {
  console.error("Live evaluation requires QLOO_API_KEY.");
  process.exitCode = 1;
} else {
  const agent = new CulturalBridgeAgent({ qlooClient: qloo, allowDemoFallback: !requireLive });
  const rows = [];

  for (const persona of Object.values(DEMO_PERSONAS)) {
    const started = performance.now();
    const result = await agent.createPlan(persona);
    const shown = Object.values(result.groups).flat().length;
    rows.push({
      profile: persona.label,
      mode: result.mode,
      anchorResolution: `${result.stats.anchorsResolved}/${persona.interests.length}`,
      domains: `${result.stats.categoriesBridged}/3`,
      candidates: result.stats.recommendationsConsidered,
      shown,
      weekActions: `${result.firstWeek.length}/4`,
      elapsedMs: Math.round(performance.now() - started),
    });
  }

  console.table(rows);
  if (rows.some((row) => row.mode !== "live")) {
    console.log("Demo fixtures were used. Re-run with QLOO_API_KEY and --require-live for submission evidence.");
  }
}
