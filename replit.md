# LANDSAFE — Evidence-based Disaster Intelligence & Decision Support System

LANDSAFE adalah platform Disaster Intelligence dan Decision Support untuk pemantauan multi-hazard, analisis risiko berbasis evidence, serta manajemen tanggap darurat (Incident, Field Assessment, Resource & Evacuation Management).

> **Master PRD:** [docs/LANDSAFE-MASTER-PRD.md](file:///d:/landsafe-source'2/docs/LANDSAFE-MASTER-PRD.md)  
> *Versi 1.0 (23 November 2026) — Global BASIS Hackathon 2027*

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/landsafe run dev` — run the frontend development server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: Vite, React 19, Tailwind CSS v4, Lucide React, Wouter router, React Query
- API: Express 5 (ESM)
- DB: PostgreSQL + Drizzle ORM (`@workspace/db`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec `@workspace/api-spec`)
- Build: esbuild (CJS bundle for api-server, Vite for frontend)

## Where things live

- `docs/LANDSAFE-MASTER-PRD.md` — Canonical Master PRD v1.0
- `artifacts/landsafe/src/` — React frontend SPA:
  - `components/layout/AppShell.tsx` — 7 Navigation Groups & Shell
  - `pages/` — Page components for each module
- `artifacts/api-server/src/` — Express API server and route handlers
- `lib/db/src/` — Drizzle ORM schemas and database connection
- `lib/api-spec/` — OpenAPI 3.0 specification (`openapi.yaml`)
- `lib/api-client-react/` — Generated React Query hooks from OpenAPI spec
- `lib/api-zod/` — Generated Zod schemas

## Architecture Decisions (PRD Baseline)

- **Seven Navigation Groups:** Overview, Situational Awareness, Risk & Intelligence, Preparedness & Mitigation, Emergency Operations, Data & Infrastructure, Reporting & Administration.
- **Evidence First:** All alerts and model predictions display publisher, timestamps, versions, confidence, and authority class. Official agency alerts are never overridden.
- **Multi-Hazard Portfolio:** Expert-model portfolio per hazard (river flood, landslide nowcast, earthquake impact, wildfire), rather than a single monolithic AI model.
- **Human in the Loop:** AI and analytics advise and explain; commands, evacuations, and resource deployments require authorized human confirmation.
- **Strict UI/UX Preservation:** Visual design language, dark emerald rail, fonts, cards, badges, and layout aesthetics are preserved without modification.

## User Preferences

- Retain exact UI/UX design: no changes to colors, layout structure, themes, or visual styling.
- Brownfield refactor, additive migrations, no destructive database or routing changes.
