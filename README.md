# STACKUP SOLVER

Poker intelligence, analysis and training in one integrated application.

## Modules

1. Discover Profile — progressive Player DNA from varied spots.
2. AI Hand Analysis — structured review of played hands.
3. Ask AI — general poker questions, rules and session situations.
4. Poker Mathematics — concepts, practice and hand-specific math questions.

## Architecture principles

- One application shell, not a collection of disconnected apps.
- Shared poker-table UI across modules.
- Shared player profile and reusable explanation/feedback patterns.
- Deterministic calculations for exact poker math; AI reserved for interpretation and natural-language analysis.
- Explicit distinction between exact data, estimates and insufficient information.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.
