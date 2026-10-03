# Evaluation protocol

Home2Here avoids unverifiable claims. This protocol produces evidence a judge can reproduce.

## Automated checks

Run `npm test`. The suite covers:

- normalization across observed Qloo response shapes, including search `types` arrays;
- `X-Api-Key` authentication without browser exposure;
- documented `/search` and `/v2/insights` usage;
- entity signals, destination, price, affinity sort, and explainability parameters;
- parallel retrieval across place, artist, and movie domains;
- category-aware anchor resolution, out-of-city place filtering, weak-input rejection, and transparent fallback;
- the complete HTTP product flow.

## Canonical profile evaluation

Run `npm run evaluate` for the three built-in relocation profiles. With `QLOO_API_KEY` configured, add `-- --require-live`.

The harness reports, per profile:

- percentage of supplied anchors resolved;
- number of cultural domains with results;
- candidates considered and recommendations shown;
- first-week plan completeness;
- whether the run used live or demo data;
- total orchestration time.

These are system-quality measurements, not claims that a user will feel a specific percentage more at home.

## Human relevance study

For a post-hackathon pilot, recruit at least five people who have moved cities. For each participant:

1. Collect 3–5 genuine cultural favorites and a real destination.
2. Generate a generic destination “top picks” baseline and a Home2Here plan.
3. Blind the ordering.
4. Ask the participant to rate each set from 1–5 on personal relevance, novelty, explanation clarity, and likelihood to act.
5. Report the raw sample size, median, and distribution—not only the best examples.

Success criterion for the MVP: Home2Here wins on personal relevance and explanation clarity without losing actionability.

## Judge reproduction path

1. Open the Mumbai → London persona and build the plan.
2. Inspect the Taste DNA, cultural translations, and evidence labels.
3. Inspect the agent trace and source-boundaries panel. Do not call this a measured LLM baseline.
4. Switch to Delhi → New York to prove the result is profile-dependent.
5. Enter a custom profile to prove the UI is not a static mockup.
