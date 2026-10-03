import { demoPlan } from "./demo-data.mjs";

const SEARCH_TYPES = [
  "urn:entity:artist",
  "urn:entity:movie",
  "urn:entity:tv_show",
  "urn:entity:book",
  "urn:entity:brand",
  "urn:entity:place",
];

const TARGETS = [
  ["places", "urn:entity:place"],
  ["artists", "urn:entity:artist"],
  ["movies", "urn:entity:movie"],
];

function safeInterests(interests) {
  return [...new Set(interests.map((value) => String(value).trim().slice(0, 80)).filter(Boolean))].slice(0, 8);
}

const ALLOWED_TYPES = new Set(SEARCH_TYPES);
function safeInterestTypes(types, count) {
  return Array.from({ length: count }, (_, index) => ALLOWED_TYPES.has(types?.[index]) ? types[index] : null);
}

function safeFeedback(feedback) {
  const clean = (items) => (Array.isArray(items) ? items : [])
    .map((item) => ({
      id: String(item?.id ?? "").trim().slice(0, 180),
      name: String(item?.name ?? "").trim().slice(0, 100),
      type: String(item?.type ?? "urn:entity:unknown").trim().slice(0, 80),
    }))
    .filter((item) => item.id && item.name)
    .slice(0, 8);
  return { likes: clean(feedback?.likes), dislikes: clean(feedback?.dislikes) };
}

function topMatch(results, interest, expectedType, origin) {
  if (!results.length) return null;
  const canonical = (value) => String(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const query = canonical(interest);
  let exact = results.filter((item) => canonical(item.name) === query);
  if (expectedType) exact = exact.filter((item) => item.type === expectedType);
  if (exact.length > 1 && expectedType === "urn:entity:place" && origin) {
    const local = exact.filter((item) => canonical(item.city).includes(canonical(origin)));
    if (local.length === 1) exact = local;
  }
  if (exact.length === 1) return exact[0];
  return null;
}

function evidenceAnchors(entity, resolved) {
  if (!entity.explainability) return [];
  const evidence = JSON.stringify(entity.explainability).toLowerCase();
  const matched = resolved.filter((item) => (
    (item.id && evidence.includes(String(item.id).toLowerCase()))
    || evidence.includes(item.name.toLowerCase())
  ));
  return matched.slice(0, 2).map((item) => item.name);
}

function bridgeReason(entity, resolved, mode) {
  const anchors = evidenceAnchors(entity, resolved);
  const traits = (entity.tags ?? []).slice(0, 2);
  if (mode === "demo") return "Illustrative example; connect a Qloo key for a live, evidence-backed bridge.";
  const lead = anchors.length
    ? `Qloo's explanation references ${anchors.join(" and ")}`
    : "Qloo ranked this from your selected taste signals";
  return traits.length ? `${lead}. Catalog tags: ${traits.join(" · ")}.` : `${lead}.`;
}

function rankingLabel(mode) {
  return mode === "demo" ? "Illustrative" : "Qloo-ranked";
}

function isInDestination(place, destination) {
  const normalized = (value) => String(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const city = normalized(destination).replace(/city$/, "");
  return Boolean(city && normalized(place.location).includes(city));
}

function isVisitWorthwhile(place) {
  const category = `${place.name ?? ""} ${place.description ?? ""} ${(place.tags ?? []).join(" ")}`.toLowerCase();
  if (/electronics store|hardware store|car dealer|gas station|insurance agency|pharmacy|fashion retailer|clothing store/.test(category)) return false;
  if (!place.description && !(place.tags ?? []).length) return true;
  return /restaurant|eatery|dining|cafe|café|coffee|tea house|bakery|bistro|bar\b|pub\b|food|park\b|garden|museum|gallery|theat|cinema|bookstore|bookshop|library|live music|music venue|concert|cultural cent|community cent|market/.test(category);
}

function firstWeek(groups, pace) {
  const places = groups.places ?? [];
  const artists = groups.artists ?? [];
  const movies = groups.movies ?? [];
  if (pace === "comforting") return [
    places[0] && { day: "Day 1", action: `Take one easy outing to ${places[0].name}`, kind: "Settle" },
    movies[0] && { day: "Day 3", action: `Watch ${movies[0].name} from home`, kind: "Recharge" },
    artists[0] && { day: "Day 5", action: `Give ${artists[0].name} a listen on a familiar walk`, kind: "Sound" },
    places[1] && { day: "Weekend", action: `If you're ready, try ${places[1].name}`, kind: "Explore" },
  ].filter(Boolean);
  if (pace === "adventurous") return [
    places[0] && { day: "Day 1", action: `Start exploring at ${places[0].name}`, kind: "Explore" },
    places[1] && { day: "Day 2", action: `Try a different corner of the city at ${places[1].name}`, kind: "Discover" },
    artists[0] && { day: "Day 3", action: `Take ${artists[0].name} along on your next outing`, kind: "Sound" },
    movies[0] && { day: "Weekend", action: `Make a night of ${movies[0].name}`, kind: "Story" },
  ].filter(Boolean);
  return [
    places[0] && { day: "Day 1", action: `Start at ${places[0].name}`, kind: "Settle" },
    artists[0] && { day: "Day 3", action: `Listen to ${artists[0].name} on a new-city walk`, kind: "Sound" },
    movies[0] && { day: "Day 5", action: `Watch ${movies[0].name}`, kind: "Story" },
    places[1] && { day: "Weekend", action: `Explore ${places[1].name} and save one new ritual`, kind: "Belong" },
  ].filter(Boolean);
}

export class CulturalBridgeAgent {
  constructor({ qlooClient, allowDemoFallback = true } = {}) {
    this.qloo = qlooClient;
    this.allowDemoFallback = allowDemoFallback;
  }

  validate(input) {
    const origin = String(input?.origin ?? "").trim();
    const destination = String(input?.destination ?? "").trim();
    const interests = safeInterests(Array.isArray(input?.interests) ? input.interests : []);
    const interestTypes = safeInterestTypes(input?.interestTypes, interests.length);
    const suppliedBudget = Number(input?.budget ?? 2);
    const budget = Number.isFinite(suppliedBudget) ? suppliedBudget : 2;
    const pace = ["comforting", "balanced", "adventurous"].includes(input?.pace)
      ? input.pace
      : "balanced";
    const feedback = safeFeedback(input?.feedback);

    if (origin.length < 2 || destination.length < 2 || origin.length > 60 || destination.length > 60) {
      throw new Error("Origin and destination must each contain 2–60 characters.");
    }
    if (interests.length < 2) {
      throw new Error("Add at least two cultural favorites so the bridge has a meaningful signal.");
    }
    return { origin, destination, interests, interestTypes, budget: Math.min(4, Math.max(1, budget)), pace, feedback };
  }

  async resolveAnchors(interests, interestTypes, origin) {
    const resolved = [];
    const unresolved = [];
    for (const [index, interest] of interests.entries()) {
      const results = await this.qloo.search(interest, SEARCH_TYPES);
      const match = topMatch(results, interest, interestTypes[index], origin);
      if (match) resolved.push(match);
      else unresolved.push(interest);
    }
    return { resolved, unresolved };
  }

  async livePlan(input, trace) {
    trace.push({ step: "Resolve taste anchors", status: "running", detail: `${input.interests.length} favorites` });
    const { resolved, unresolved } = await this.resolveAnchors(input.interests, input.interestTypes, input.origin);
    trace.at(-1).status = "complete";
    trace.at(-1).detail = `${resolved.length} Qloo entities matched`;
    if (!resolved.length) throw new Error("None of the supplied favorites could be resolved by Qloo.");

    const likedSignals = input.feedback.likes.map((item) => item.id);
    const entityIds = [...new Set([...resolved.map((item) => item.id).filter(Boolean), ...likedSignals])];
    const excludeEntityIds = [...new Set([
      ...input.feedback.likes.map((item) => item.id),
      ...input.feedback.dislikes.map((item) => item.id),
    ])];
    if (excludeEntityIds.length) {
      trace.push({
        step: "Learn from feedback",
        status: "complete",
        detail: `${input.feedback.likes.length} positive · ${input.feedback.dislikes.length} excluded`,
      });
    }
    const groups = {};
    trace.push({ step: "Query cross-domain affinities", status: "running", detail: "Places, artists, and films" });
    const settled = await Promise.allSettled(TARGETS.map(async ([label, type]) => {
      const result = await this.qloo.insights({
        type,
        entityIds,
        excludeEntityIds,
        location: input.destination,
        priceMax: input.budget,
        take: label === "places" ? 10 : 4,
      });
      return [label, label === "places"
        ? result.entities.filter((place) => isInDestination(place, input.destination) && isVisitWorthwhile(place))
        : result.entities];
    }));
    for (const result of settled) {
      if (result.status === "fulfilled") groups[result.value[0]] = result.value[1];
    }
    trace.at(-1).status = "complete";
    trace.at(-1).detail = `${Object.values(groups).flat().length} candidates returned`;
    if (!Object.values(groups).flat().length) throw new Error("Qloo returned no usable candidates for this profile.");

    trace.push({ step: "Apply relocation constraints", status: "complete", detail: `City, venue suitability, eligible price ceiling ${input.budget}/4` });
    trace.push({ step: "Build belonging plan", status: "complete", detail: "Explainable bridges ready" });

    return { mode: "live", resolved, unresolved, groups, failedDomains: settled.filter((result) => result.status === "rejected").length };
  }

  decorate(plan, input, trace, warning = null) {
    const candidatesConsidered = Object.values(plan.groups).flat().length;
    const evidencePool = [...plan.resolved, ...input.feedback.likes];
    const groups = Object.fromEntries(Object.entries(plan.groups).map(([key, entities]) => [
      key,
      entities.slice(0, key === "places" ? 3 : 2).map((entity) => ({
        ...entity,
        confidence: rankingLabel(plan.mode),
        bridge: bridgeReason(entity, evidencePool, plan.mode),
        evidence: {
          source: plan.mode === "live"
            ? (evidenceAnchors(entity, evidencePool).length ? "Qloo explainability" : "Qloo affinity ranking")
            : "Illustrative demo fixture",
          anchors: plan.mode === "live" ? evidenceAnchors(entity, evidencePool) : [],
        },
      })),
    ]));

    const total = Object.values(groups).flat().length;
    return {
      product: "Home2Here",
      mode: plan.mode,
      warning: warning ?? (plan.failedDomains ? `${plan.failedDomains} Qloo domain request(s) failed; showing the available live results.` : null),
      unresolved: plan.unresolved ?? [],
      profile: input,
      tasteFingerprint: plan.resolved.map((entity) => ({
        id: entity.id,
        name: entity.name,
        type: entity.type.replace("urn:entity:", "").replaceAll("_", " "),
      })),
      headline: `A ${input.pace} cultural landing plan for ${input.destination}`,
      summary: plan.mode === "live"
        ? `Built from ${plan.resolved.length} resolved taste anchors. Eligible places are filtered for destination, visit suitability, and price; ${input.pace} pace shapes the week.`
        : `An illustrative ${input.pace} landing plan. Add a Qloo API key to generate live cultural bridges for ${input.destination}.`,
      groups,
      refinement: input.feedback.likes.length || input.feedback.dislikes.length ? {
        likes: input.feedback.likes,
        dislikes: input.feedback.dislikes,
        message: `Plan refined from ${input.feedback.likes.length} positive and ${input.feedback.dislikes.length} negative signal${input.feedback.dislikes.length === 1 ? "" : "s"}.`,
      } : null,
      firstWeek: firstWeek(groups, input.pace),
      trace,
      stats: {
        anchorsResolved: plan.resolved.length,
        recommendationsConsidered: candidatesConsidered,
        recommendationsShown: total,
        categoriesBridged: Object.values(groups).filter((items) => items.length).length,
      },
    };
  }

  async createPlan(rawInput) {
    const input = this.validate(rawInput);
    const trace = [{ step: "Understand relocation context", status: "complete", detail: `${input.origin} → ${input.destination}` }];

    if (this.qloo.isConfigured) {
      let live;
      try {
        live = await this.livePlan(input, trace);
      } catch (error) {
        if (!this.allowDemoFallback) throw error;
        trace.push({ step: "Recover with judge demo dataset", status: "complete", detail: "Live API temporarily unavailable" });
        return this.decorate(demoPlan(input), input, trace, "Live Qloo request failed, so the transparent demo dataset was used.");
      }
      return this.decorate(live, input, trace);
    }

    trace.push({ step: "Use transparent judge demo dataset", status: "complete", detail: "Add QLOO_API_KEY for live cultural intelligence" });
    return this.decorate(demoPlan(input), input, trace, "Demo mode is active. Configure QLOO_API_KEY to use live Qloo results.");
  }
}
