import test from "node:test";
import assert from "node:assert/strict";
import { QlooClient, QlooApiError, normalizeEntity } from "../lib/qloo-client.mjs";

test("normalizes Qloo entities into a stable UI shape", () => {
  const entity = normalizeEntity({
    entity_id: "urn:test:1",
    name: "Example Place",
    type: "urn:entity:place",
    properties: {
      image: { url: "https://images.example/place.jpg" },
      address: "12 Culture Street",
      geocode: { city: "London" },
    },
    tags: [{ name: "Live music" }, "Cafe"],
    query: { affinity: 0.91, explainability: { signals: ["urn:anchor:1"] } },
  });

  assert.equal(entity.id, "urn:test:1");
  assert.equal(entity.location, "12 Culture Street, London");
  assert.deepEqual(entity.tags, ["Live music", "Cafe"]);
  assert.equal(entity.score, 0.91);
  assert.deepEqual(entity.explainability, { signals: ["urn:anchor:1"] });
});

test("uses the hackathon API contract for cross-domain insights", async () => {
  let captured;
  const client = new QlooClient({
    apiKey: "test-key",
    fetchImpl: async (url, options) => {
      captured = { url: new URL(url), options };
      return new Response(JSON.stringify({
        results: { entities: [{ entity_id: "place-1", name: "A Place" }], duration: 23 },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });

  const result = await client.insights({
    type: "urn:entity:place",
    entityIds: ["anchor-1", "anchor-2"],
    excludeEntityIds: ["seen-1"],
    location: "London",
    priceMax: 2,
  });

  assert.equal(captured.url.origin, "https://hackathon.api.qloo.com");
  assert.equal(captured.url.pathname, "/v2/insights");
  assert.equal(captured.url.searchParams.get("signal.interests.entities"), "anchor-1,anchor-2");
  assert.equal(captured.url.searchParams.get("filter.location.query"), "London");
  assert.equal(captured.url.searchParams.get("filter.price_level.max"), "2");
  assert.equal(captured.url.searchParams.get("filter.exclude.entities"), "seen-1");
  assert.equal(captured.url.searchParams.get("feature.explainability"), "true");
  assert.equal(captured.url.searchParams.has("signal.interests.entities.weight"), false);
  assert.equal(captured.options.headers["X-Api-Key"], "test-key");
  assert.equal(result.entities[0].id, "place-1");
  assert.equal(result.duration, 23);
});

test("does not relabel popularity as Qloo affinity", () => {
  assert.equal(normalizeEntity({ name: "Popular", popularity: 98 }).score, null);
});

test("reads the live search type array so category hints can disambiguate", () => {
  const entity = normalizeEntity({ entity_id: "film", name: "The Lunchbox", types: ["urn:entity:movie"] });
  assert.equal(entity.type, "urn:entity:movie");
});

test("deduplicates identical requests to conserve the event API allowance", async () => {
  let calls = 0;
  const client = new QlooClient({
    apiKey: "test-key",
    fetchImpl: async () => {
      calls += 1;
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    },
  });
  await Promise.all([client.search("Koshy's"), client.search("Koshy's")]);
  await client.search("Koshy's");
  assert.equal(calls, 1);
});

test("surfaces Qloo API failures without leaking the key", async () => {
  const client = new QlooClient({
    apiKey: "secret-key",
    fetchImpl: async () => new Response(JSON.stringify({ message: "Bad request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    }),
  });

  await assert.rejects(() => client.search("test"), (error) => {
    assert.ok(error instanceof QlooApiError);
    assert.equal(error.status, 400);
    assert.equal(error.message, "Bad request");
    assert.ok(!JSON.stringify(error).includes("secret-key"));
    return true;
  });
});
