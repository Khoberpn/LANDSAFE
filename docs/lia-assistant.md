# LIA — LANDSAFE Intelligence Assistant

LIA is the disaster-intelligence assistant for LANDSAFE. It has two server-resolved modes:

| Mode | Who | Capabilities |
|---|---|---|
| `public` | Anonymous visitors and users with the `public` role | Public preparedness guidance, published mitigation plans, verified evacuation routes, public hazard overview, emergency contacts |
| `bpbd_copilot` | `operator` and `admin` users | All public capabilities plus operational dashboards, sensor telemetry, XGBoost model output, scenario analysis, risk assessments, and draft reports |

The client cannot choose its mode. The API derives it from the authenticated role; anonymous requests always run in `public` mode.

## Endpoints

All endpoints are mounted under `/api/ai`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/chat` | Optional | SSE stream by default; `stream: false` returns JSON |
| `GET` | `/conversations` | Optional | List conversations for the current user or anonymous session |
| `GET` | `/conversations/:id` | Optional | Conversation with messages, citations, and tool traces |
| `DELETE` | `/conversations/:id` | Optional | Delete a conversation and its messages |
| `GET` | `/suggestions?module=` | Optional | Mode- and context-aware suggested prompts |
| `GET` | `/usage` | Optional | Token usage and current rate-limit configuration |
| `GET` | `/health` | Public | Provider/model configuration status (no secrets) |

Anonymous requests must send a `sessionId` (8–128 characters, `A-Z a-z 0-9 _ -`) when creating or reading conversations. The browser panel stores this in `localStorage` under `landsafe_lia_session`.

## Architecture

- `artifacts/api-server/src/lib/lia/orchestrator.ts` — conversation persistence, RAG, tool loop, usage logging.
- `artifacts/api-server/src/lib/lia/cloudflare-client.ts` — provider adapter with SSE streaming, tool-call deltas, timeouts, and usage.
- `artifacts/api-server/src/lib/lia/provider.ts` — provider-neutral chat interface.
- `artifacts/api-server/src/lib/lia/knowledge-base.ts` — curated Indonesian disaster regulations, SOPs, and guidelines with deterministic retrieval.
- `artifacts/api-server/src/lib/lia/tools.ts` — allow-listed function-calling tools, filtered by mode.
- `artifacts/api-server/src/lib/lia/prompts.ts` — system safety rules, context hints, and suggestions.
- `artifacts/api-server/src/routes/lia.ts` — HTTP/SSE endpoints.
- `artifacts/landsafe/src/components/lia/LiaPanel.tsx` — floating, responsive chat panel.
- `artifacts/landsafe/src/lib/lia-client.ts` — SSE parser and typed API client.

## Safety controls

- The system prompt forbids official warnings, evacuation orders, fabricated numbers/locations, and claims that a simulation is a prediction.
- Every response distinguishes verified data, sensor telemetry, model output, simulations, and AI interpretation.
- Recommendations and reports are drafts requiring human approval.
- Public mode never exposes staff tools or internal model documentation.
- Tool arguments are validated and region-filtered; there is no unrestricted SQL tool.
- Provider keys stay in server environment variables. `/health` returns only provider/model metadata.
- Anonymous access is rate-limited more strictly than staff access; usage is logged per user/session.
- Emergency questions direct users to 112 and the local BPBD Pusdalops.

## Configuration

Copy `artifacts/api-server/.env.example` to `artifacts/api-server/.env` and fill in the Cloudflare credentials. The server reads:

- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_AI_MODEL`
- Optional tuning: `LIA_REASONING_EFFORT` (`low` default), `LIA_MAX_OUTPUT_TOKENS`, timeouts, history/tool-round limits, context size, and rate limits.

`LIA_REASONING_EFFORT=low` is recommended for interactive use. Qwen 3.8 defaults to `xhigh`, which is significantly slower.

## Database

The LIA tables are defined in `lib/db/src/schema/lia.ts` and created by the idempotent migration `lib/db/migrations/0001_lia.sql`:

- `lia_conversations`
- `lia_messages`
- `lia_usage_logs`

Run the migration before starting the API server if the tables do not exist.

## Security note

A Cloudflare API token was previously hard-coded in the repository. It has been removed from the configuration path, but the exposed token should be rotated in the Cloudflare dashboard and replaced in the server-side `.env` file. Never commit `.env` or put provider tokens in frontend code.
