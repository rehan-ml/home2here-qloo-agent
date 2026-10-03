# Hackathon requirements and win strategy — 2 October 2026

This is a requirements audit, not a claim that the project is submitted or likely to win. Re-check pages before final submission because organizers may update them.

## Qloo Agentic Hackathon — primary

Official pages: [overview](https://qloo.devpost.com/), [rules](https://qloo.devpost.com/rules), [resources](https://qloo.devpost.com/resources), [updates](https://qloo.devpost.com/updates), [developer guide](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide), [official starter kit](https://github.com/qloo/qloo-hackathon-kit).

- Deadline: 30 October 2026, 11:45 pm EDT (31 October, 9:15 am IST).
- A working, externally hosted software app is mandatory; a local-only repo does not qualify. The app must be freely testable through the judging period.
- Submit a public GitHub/GitLab/Bitbucket repo with all source and setup instructions, plus an open-source license detectable in the repository About area. Submit a text description. Video is optional.
- Qloo must be indispensable to an agentic tool or agent-powered app. Stage one is pass/fail for theme/API use. Stage two weighs technological implementation, design, potential impact, and idea quality equally.
- The official starter kit is optional. The direct documented `/search` and `/v2/insights` integration is valid. Keep the event key server-side and on the hackathon API host.
- Qloo output represents aggregate taste affinities, not an individual preference probability or causal proof. Do not infer sensitive traits or send personal identifiers to Qloo solely for a demo.
- The updates page had no published updates when checked. The project gallery did not provide a reliable overlap audit yet. We cannot honestly claim no other participant has a similar idea.

### Why Home2Here can stand apart

The core question is not “What should a tourist see?” but “How can someone preserve cultural continuity during a move?” The output is a paced first-week ritual plan, not a destination leaderboard. A single taste signal crosses places, music, and film; user feedback triggers a new Qloo retrieval turn; each card separates Qloo evidence from Home2Here's editorial action. This is a stronger use case than a generic itinerary, but originality must be demonstrated in the live app, not asserted in prose.

### Explicitly avoid

- Fabricated affinity percentages or fake baseline comparisons.
- Saying an artist or film is local unless its metadata proves it; only the place query has a destination filter.
- Calling a tag or action a Qloo causal explanation when the explainability payload does not name the relevant anchor.
- Quietly using London demo fixtures for an unrelated destination.
- Treating fixture-mode screenshots as evidence of a live Qloo integration.

### Final Qloo gates

1. Done locally: the event key is stored only in ignored `.env`; live evaluation succeeded on 3 October 2026. Add it as a host secret only when deploying, and never commit it.
2. Done for all three canonical routes: each resolved 3/3 anchors and 3/3 recommendation domains against the real API. A custom city/profile still needs end-to-end manual QA before submission.
3. Deploy on a verified no-cost host, keep it accessible through 16 November 2026, and test from a private browser.
4. Publish the standalone project as a public, licensed repo with no secret and confirm license detection.
5. Add the live and repo URLs to the submission, capture live screenshots, and re-check the final Devpost form.

## Build, Ship, Shape: Amazon Developer Hackathon — secondary

Official pages: [overview](https://amazonappdev2026.devpost.com/), [rules](https://amazonappdev2026.devpost.com/rules), [resources](https://amazonappdev2026.devpost.com/resources), [updates](https://amazonappdev2026.devpost.com/updates), [FAQs](https://amazonappdev2026.devpost.com/details/faqs).

- Deadline: 23 October 2026, noon PDT (24 October, 12:30 am IST).
- For a software-only, zero-hardware approach, Alexa+ is the best fit: build a self-hosted Streamable HTTP MCP server (spec 2025-11-25 or later), an Agent Skill, or a simulated Alexa+ experience in a web app. The gated Alexa+ Category SDK, MCP Toolkit, CLI, and Web Simulator are **not** available to hackathon participants; use your own simulator if needed.
- The repo must be on GitHub, with source that actually implements the chosen track. A public repo needs a license; a private repo needs reviewer access.
- A public English YouTube/Vimeo demo video under three minutes is required, plus text description, product feedback for each tool, track selection, and any mini-challenge fields. A live hosted Alexa+ app is not necessarily required, but the working demo must be reproducible.
- AWS credits are optional, and usage can still create costs. The zero-spend plan should avoid paid AWS services and the AWS Builder mini-challenge unless a genuinely free path is confirmed.
- The Open Source mini-challenge needs a separate new contribution/project URL and description beyond the primary submission.

Amazon is a separate deliverable. Do not relabel Home2Here as an Alexa+ project without a real Alexa+-track integration. Qloo remains the active build until live API verification and deployment are secured.
