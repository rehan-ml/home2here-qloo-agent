import test from "node:test";
import assert from "node:assert/strict";
import { CulturalBridgeAgent } from "../lib/bridge-agent.mjs";

const INPUT = {
  origin: "Mumbai",
  destination: "London",
  interests: ["A. R. Rahman", "The Lunchbox"],
  budget: 2,
  pace: "balanced",
};

test("creates a complete and clearly labelled judge-demo plan without a key", async () => {
  const agent = new CulturalBridgeAgent({ qlooClient: { isConfigured: false } });
  const plan = await agent.createPlan(INPUT);

  assert.equal(plan.mode, "demo");
  assert.match(plan.warning, /Demo mode is active/);
  assert.equal(plan.tasteFingerprint.length, 2);
  assert.equal(plan.groups.places.length, 3);
  assert.ok(plan.firstWeek.length >= 3);
  assert.ok(plan.trace.some((step) => step.step.includes("transparent judge demo")));
  assert.equal(plan.groups.places[0].evidence.source, "Illustrative demo fixture");
  assert.equal(plan.groups.places[0].confidence, "Illustrative");
  assert.deepEqual(plan.groups.places[0].evidence.anchors, []);
});

test("orchestrates entity resolution and three Qloo insight domains", async () => {
  const searches = [];
  const insights = [];
  const fakeQloo = {
    isConfigured: true,
    async search(query) {
      searches.push(query);
      return [{ id: `anchor-${searches.length}`, name: query, type: "urn:entity:artist", tags: [] }];
    },
    async insights(options) {
      insights.push(options);
      const label = options.type.split(":").at(-1);
      return {
        entities: [{
          id: `${label}-1`, name: `Local ${label}`, type: options.type, tags: ["local"], score: 0.88,
          location: "London, England",
          description: "A neighborhood restaurant and cultural meeting place",
          explainability: { signals: ["anchor-1"] },
        }],
      };
    },
  };
  const agent = new CulturalBridgeAgent({ qlooClient: fakeQloo });
  const plan = await agent.createPlan(INPUT);

  assert.equal(plan.mode, "live");
  assert.deepEqual(searches, INPUT.interests);
  assert.equal(insights.length, 3);
  assert.ok(insights.every((call) => call.entityIds.length === 2));
  assert.equal(insights.find((call) => call.type === "urn:entity:place").location, "London");
  assert.deepEqual(plan.groups.places[0].evidence.anchors, ["A. R. Rahman"]);
  assert.equal(plan.stats.categoriesBridged, 3);
});

test("uses a second-turn preference as a positive signal and output exclusion", async () => {
  const insights = [];
  const fakeQloo = {
    isConfigured: true,
    async search(query) {
      return [{ id: `anchor-${query}`, name: query, type: "urn:entity:artist", tags: [] }];
    },
    async insights(options) {
      insights.push(options);
      return { entities: [{
          id: `fresh-${options.type}`, name: "Fresh result", type: options.type, tags: [], score: 0.8, location: "London, England",
        explainability: { signals: ["liked-1"] },
      }] };
    },
  };
  const agent = new CulturalBridgeAgent({ qlooClient: fakeQloo });
  const plan = await agent.createPlan({
    ...INPUT,
    feedback: {
      likes: [{ id: "liked-1", name: "A liked place", type: "urn:entity:place" }],
      dislikes: [{ id: "blocked-1", name: "Not for me", type: "urn:entity:place" }],
    },
  });

  assert.ok(insights.every((call) => call.entityIds.includes("liked-1")));
  assert.ok(insights.every((call) => call.excludeEntityIds.includes("liked-1")));
  assert.ok(insights.every((call) => call.excludeEntityIds.includes("blocked-1")));
  assert.equal(plan.refinement.likes.length, 1);
  assert.ok(plan.trace.some((step) => step.step === "Learn from feedback"));
  assert.deepEqual(plan.groups.places[0].evidence.anchors, ["A liked place"]);
});

test("rejects weak profiles before making any Qloo request", async () => {
  const agent = new CulturalBridgeAgent({ qlooClient: { isConfigured: false } });
  await assert.rejects(
    () => agent.createPlan({ origin: "A", destination: "London", interests: ["Only one"] }),
    /Origin and destination/,
  );
  await assert.rejects(
    () => agent.createPlan({ origin: "Mumbai", destination: "London", interests: ["Only one"] }),
    /at least two cultural favorites/,
  );
});

test("does not silently show London fixtures for an unsupported demo destination", async () => {
  const agent = new CulturalBridgeAgent({ qlooClient: { isConfigured: false } });
  await assert.rejects(
    () => agent.createPlan({ ...INPUT, destination: "Paris" }),
    /Illustrative mode supports/,
  );
});

test("paces the first week differently for comfort and adventure", async () => {
  const agent = new CulturalBridgeAgent({ qlooClient: { isConfigured: false } });
  const comfort = await agent.createPlan({ ...INPUT, pace: "comforting" });
  const adventure = await agent.createPlan({ ...INPUT, pace: "adventurous" });
  assert.equal(comfort.firstWeek[1].kind, "Recharge");
  assert.equal(adventure.firstWeek[1].day, "Day 2");
});

test("leaves ambiguous anchors unresolved instead of guessing", async () => {
  const fakeQloo = {
    isConfigured: true,
    async search(query) {
      return query === "Ambiguous"
        ? [{ id: "a", name: "Ambiguous Artist", type: "urn:entity:artist" }, { id: "b", name: "Ambiguous Film", type: "urn:entity:movie" }]
        : [{ id: "exact", name: query, type: "urn:entity:movie" }];
    },
    async insights(options) {
      return { entities: [{ id: options.type, name: "A result", type: options.type, tags: [], score: null, location: "London, England" }] };
    },
  };
  const plan = await new CulturalBridgeAgent({ qlooClient: fakeQloo }).createPlan({
    ...INPUT, interests: ["Ambiguous", "The Lunchbox"],
  });
  assert.deepEqual(plan.unresolved, ["Ambiguous"]);
  assert.equal(plan.stats.anchorsResolved, 1);
});

test("discloses a partial live Qloo failure without presenting fixtures as live", async () => {
  const fakeQloo = {
    isConfigured: true,
    async search(query) {
      return [{ id: `anchor-${query}`, name: query, type: "urn:entity:movie" }];
    },
    async insights(options) {
      if (options.type === "urn:entity:artist") throw new Error("Transient upstream failure");
      return { entities: [{
        id: options.type, name: "Live result", type: options.type, tags: [], explainability: null, location: "London, England",
      }] };
    },
  };
  const plan = await new CulturalBridgeAgent({ qlooClient: fakeQloo }).createPlan(INPUT);
  assert.equal(plan.mode, "live");
  assert.match(plan.warning, /1 Qloo domain request/);
  assert.equal(plan.groups.artists, undefined);
  assert.equal(plan.groups.places[0].evidence.source, "Qloo affinity ranking");
  assert.deepEqual(plan.groups.places[0].evidence.anchors, []);
});

test("uses a category hint to resolve an exact same-name film without choosing a restaurant", async () => {
  const fakeQloo = {
    isConfigured: true,
    async search(query) {
      if (query === "The Lunchbox") return [
        { id: "restaurant", name: query, type: "urn:entity:place", location: "Phoenix" },
        { id: "film", name: query, type: "urn:entity:movie" },
      ];
      return [{ id: "artist", name: query, type: "urn:entity:artist" }];
    },
    async insights(options) {
      return { entities: [{ id: options.type, name: "Result", type: options.type, location: "London" }] };
    },
  };
  const plan = await new CulturalBridgeAgent({ qlooClient: fakeQloo }).createPlan({
    ...INPUT,
    interestTypes: ["urn:entity:artist", "urn:entity:movie"],
  });
  assert.equal(plan.stats.anchorsResolved, 2);
  assert.equal(plan.tasteFingerprint[1].id, "film");
});

test("removes nearby out-of-city places from a destination plan", async () => {
  const fakeQloo = {
    isConfigured: true,
    async search(query) { return [{ id: query, name: query, type: "urn:entity:artist" }]; },
    async insights(options) {
      return { entities: options.type === "urn:entity:place" ? [
        { id: "nearby", name: "Nearby", location: "Iselin, New Jersey" },
        { id: "shop", name: "Camera Shop", location: "New York", tags: ["Electronics store"], description: "Retailer selling camera equipment" },
        { id: "local", name: "Local", location: "Midtown, New York" },
      ] : [{ id: options.type, name: "Result" }] };
    },
  };
  const plan = await new CulturalBridgeAgent({ qlooClient: fakeQloo }).createPlan({
    ...INPUT, destination: "New York City",
  });
  assert.deepEqual(plan.groups.places.map((place) => place.name), ["Local"]);
});
