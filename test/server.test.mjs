import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createAppServer } from "../server.mjs";

async function withServer(run) {
  const server = createAppServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("serves the product shell and health state", async () => {
  await withServer(async (base) => {
    const healthResponse = await fetch(`${base}/api/health`);
    const health = await healthResponse.json();
    assert.equal(healthResponse.status, 200);
    assert.equal(health.ok, true);
    assert.ok(["configured", "demo"].includes(health.qloo));

    const pageResponse = await fetch(base);
    const page = await pageResponse.text();
    assert.equal(pageResponse.status, 200);
    assert.match(page, /Home2Here/);
    assert.match(page, /Build my belonging plan/);
  });
});

test("builds a complete plan through the public API", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: "Delhi",
        destination: "New York City",
        interests: ["Prateek Kuhad", "The Lunchbox", "Blue Tokai Coffee"],
        budget: 2,
        pace: "adventurous",
      }),
    });
    const plan = await response.json();
    assert.equal(response.status, 200);
    assert.equal(plan.product, "Home2Here");
    assert.ok(plan.groups.places.length > 0);
    assert.ok(plan.firstWeek.length > 0);
    assert.ok(plan.trace.length >= 2);
  });
});

test("rejects malformed requests", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /valid JSON/);
  });
});
