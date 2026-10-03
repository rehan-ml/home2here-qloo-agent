# Architecture and product decisions

## System boundary

Home2Here has one server-side trust boundary. The browser never receives the Qloo key. It submits a small relocation profile to `POST /api/plan`; the server resolves entities, calls Qloo, applies policy, and returns a display-ready plan.

## Agent loop

1. **Understand** — validate origin, destination, 2–8 anchors, budget, and pace.
2. **Resolve** — call `GET /search` for each free-text favorite; use category hints to separate same-name films and places, accept exact normalized names only, and leave ambiguous names unresolved.
3. **Retrieve** — call `GET /v2/insights` in parallel for places, artists, and movies using the same resolved entity IDs.
4. **Constrain** — add destination radius and eligible price ceiling for places, then exclude out-of-city results and obvious non-ritual venues; use exploration pace to change the first-week sequence.
5. **Explain** — match Qloo's explainability payload back to resolved anchors only when it actually references them. Otherwise label the result as Qloo-ranked, without fabricating a causal explanation.
6. **Act** — turn top results into an ordered Day 1, Day 3, Day 5, and Weekend plan.
7. **Learn** — on a live result, “more like this” becomes a new positive entity signal while liked/disliked results are added to `filter.exclude.entities`; the next turn must discover something new.

This is an agent because it resolves ambiguous inputs, invokes multiple tools, handles partial failures, applies stateful user constraints, and produces an ordered action plan with a trace. It is not a chat wrapper.

## Qloo request contract

The integration uses only the hackathon base URL and documented routes:

- Base URL: `https://hackathon.api.qloo.com`
- Authentication: `X-Api-Key`
- Entity resolution: `GET /search`
- Recommendations: `GET /v2/insights`
- Signals: `signal.interests.entities`
- Output domain: `filter.type`
- Place constraints: `filter.location.query`, `filter.location.radius`, and `filter.price_level.max`
- Evidence: `feature.explainability=true`
- Ranking: `sort_by=affinity`
- Second-turn novelty: `filter.exclude.entities`

The tests assert this contract so an accidental switch to an undocumented endpoint fails visibly.

Identical Qloo requests are cached for five minutes to conserve the event allowance. `/api/search` and `/api/plan` share a bounded per-client request budget. The browser receives no raw upstream error payload.

## Partial failure behavior

The three insight domains run concurrently with `Promise.allSettled`. A temporary failure in one domain does not erase valid results from the others, and the response warns the user. If the live workflow fails completely and `DEMO_FALLBACK=true`, the response contains an explicit warning and changes its mode to `demo` for a supported illustrative destination; otherwise it returns a clear error.

## Deliberate non-features

- No generative-model dependency: it would add cost, latency, and ungrounded prose without improving the core cultural translation.
- No authentication or database: the MVP does not need identity persistence and avoids collecting sensitive relocation histories.
- No invented quantitative impact claim: product impact is evaluated with a documented protocol before any public metric is stated.
- No scraped review scores: the experience is based on Qloo affinity, not a disguised popularity ranking.

## Production extensions

- Saving plans and preferences across sessions.
- Accessibility and dietary constraints.
- University and employer relocation cohorts with aggregated, non-identifying trend views.
- Calendar export and trusted local community partners.
- Multilingual explanations generated only from retrieved Qloo evidence.
