const DEFAULT_BASE_URL = "https://hackathon.api.qloo.com";

export class QlooApiError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = "QlooApiError";
    this.status = status;
    this.details = details;
  }
}

function compactParams(params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length) query.set(key, value.join(","));
    } else {
      query.set(key, String(value));
    }
  }
  return query;
}

function findImage(entity) {
  const properties = entity?.properties ?? {};
  const candidates = [
    properties.image?.url,
    properties.image,
    properties.images?.[0]?.url,
    entity?.image?.url,
    entity?.image,
  ];
  return candidates.find((value) => typeof value === "string" && value.startsWith("http")) ?? null;
}

function findLocation(entity) {
  const geocode = entity?.properties?.geocode ?? {};
  const address = entity?.properties?.address ?? entity?.address ?? "";
  return [address, geocode.name, geocode.city, geocode.admin1_region]
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
    .join(", ");
}

function findScore(entity) {
  const raw = entity?.query?.affinity
    ?? entity?.query?.affinity_score
    ?? entity?.affinity;
  if (raw === null || raw === undefined || raw === "") return null;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
}

export function normalizeEntity(entity, fallbackType = "urn:entity:unknown") {
  const id = entity?.entity_id ?? entity?.id ?? entity?.uuid ?? entity?.urn ?? "";
  const type = entity?.type ?? entity?.entity_type ?? entity?.types?.[0] ?? fallbackType;
  const tags = (entity?.tags ?? entity?.properties?.tags ?? [])
    .map((tag) => (typeof tag === "string" ? tag : tag?.name ?? tag?.id ?? tag?.tag_id))
    .filter(Boolean)
    .slice(0, 5);

  return {
    id: String(id),
    name: entity?.name ?? entity?.title ?? "Untitled",
    type,
    subtype: entity?.subtype ?? entity?.properties?.subtype ?? "",
    description: entity?.properties?.description ?? entity?.description ?? "",
    image: findImage(entity),
    location: findLocation(entity),
    city: entity?.properties?.geocode?.city ?? "",
    disambiguation: entity?.disambiguation ?? "",
    score: findScore(entity),
    tags,
    explainability: entity?.query?.explainability ?? null,
  };
}

export class QlooClient {
  constructor({ apiKey, baseUrl = DEFAULT_BASE_URL, fetchImpl = fetch, timeoutMs = 10000 } = {}) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.cache = new Map();
  }

  get isConfigured() {
    return Boolean(this.apiKey);
  }

  async request(path, params) {
    if (!this.apiKey) throw new QlooApiError("Qloo API key is not configured.", 503);

    const url = `${this.baseUrl}${path}?${compactParams(params).toString()}`;
    const cached = this.cache.get(url);
    if (cached && cached.expires > Date.now()) return cached.promise;
    if (cached) this.cache.delete(url);
    const promise = this.requestFresh(url);
    this.cache.set(url, { promise, expires: Date.now() + 5 * 60_000 });
    if (this.cache.size > 200) this.cache.delete(this.cache.keys().next().value);
    promise.catch(() => {
      if (this.cache.get(url)?.promise === promise) this.cache.delete(url);
    });
    return promise;
  }

  async requestFresh(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;
    try {
      response = await this.fetchImpl(url, {
        headers: { "X-Api-Key": this.apiKey, Accept: "application/json" },
        signal: controller.signal,
      });
    } catch (error) {
      const message = error?.name === "AbortError"
        ? "Qloo request timed out."
        : "Qloo service could not be reached.";
      throw new QlooApiError(message, 502, error?.message);
    } finally {
      clearTimeout(timer);
    }

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new QlooApiError(
        body?.message ?? body?.reason ?? `Qloo request failed with status ${response.status}.`,
        response.status,
        body,
      );
    }
    return body;
  }

  async search(query, types = []) {
    const body = await this.request("/search", { query, types, take: 8 });
    return (body?.results ?? []).map((entity) => normalizeEntity(entity));
  }

  async insights({ type, entityIds, excludeEntityIds = [], location, priceMax, take = 6 }) {
    const params = {
      "filter.type": type,
      "signal.interests.entities": entityIds,
      "feature.explainability": true,
      "bias.content_based": 0.35,
      "bias.trends": "low",
      sort_by: "affinity",
      take,
    };
    if (excludeEntityIds.length) params["filter.exclude.entities"] = excludeEntityIds;
    if (type === "urn:entity:place" && location) {
      params["filter.location.query"] = location;
      params["filter.location.radius"] = 12000;
      if (priceMax) params["filter.price_level.max"] = priceMax;
    }

    const body = await this.request("/v2/insights", params);
    const entities = body?.results?.entities ?? [];
    return {
      entities: entities.map((entity) => normalizeEntity(entity, type)),
      duration: body?.results?.duration ?? body?.duration ?? null,
      query: body?.query ?? null,
    };
  }
}
