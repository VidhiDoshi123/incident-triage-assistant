# IncidentLens: AI-Powered Developer Incident Triage Assistant

An enterprise-grade, edge-native incident triage assistant designed for SREs, DevOps engineers, and on-call developers. Users can paste raw application logs or describe operational errors to receive an automated, **4-stage structured diagnosis**, **cross-incident correlation**, and **prioritized troubleshooting runbooks**.

Built natively on **Cloudflare Workers**, **Cloudflare Agents SDK**, **Durable Objects with SQLite**, and **Workers AI**.

---

## Technical Interview Overview

| Component | Technology | Architectural Role |
|---|---|---|
| **Frontend** | React 18, TypeScript, Tailwind CSS, Lucide | High-density developer dark mode UI with interactive triage workbench |
| **Edge Router** | Cloudflare Workers (TypeScript) | Sub-millisecond global ingress, REST routing, and static asset delivery |
| **Agent Runtime** | Cloudflare Agents SDK (`agents-sdk`) | Stateful actor runtime extending `Agent` with DO lifecycle coordination |
| **State & Persistence** | Cloudflare Durable Objects + SQLite | Relational SQLite storage (`ctx.storage.sql`) per incident session & global index |
| **LLM Inference** | Cloudflare Workers AI (`@cf/meta/llama-3.3-70b-instruct`) | Edge-hosted 70B parameter model specialized in root cause analysis & SRE runbooks |

---

## Architecture & System Design

```
                                    [ Browser Client ]
                                            │
                             HTTP Requests  │  Static Assets
                             (REST / JSON)  │  (SPA Bundle)
                                            ▼
                        ┌───────────────────────────────────────┐
                        │       Cloudflare Worker Router        │
                        │  - /api/incidents, /api/presets, etc. │
                        │  - ASSETS Binding (serves dist/)      │
                        └───────┬───────────────────────┬───────┘
                                │                       │
            Route by IncidentID │                       │ Catalog & Recall
                                ▼                       ▼
        ┌──────────────────────────────┐     ┌──────────────────────────────┐
        │   IncidentAgent (DurableObj) │     │   IncidentIndex (DurableObj) │
        │   (Cloudflare Agents SDK)    │     │   - Global incident index    │
        │                              │     │   - Cross-incident memory    │
        │   SQLite Storage (Relational)│     │   - Search & filter catalog  │
        │   - incident_details         │◄────┤                              │
        │   - conversation_messages    │     │   SQLite Storage (Relational)│
        │   - action_items             │     │   - incidents_index table    │
        └──────────────┬───────────────┘     └──────────────────────────────┘
                       │
       Prompt Chain &  │ Cross-Incident
       Context Ingest  │ Knowledge Base
                       ▼
        ┌──────────────────────────────┐
        │    Cloudflare Workers AI     │
        │  @cf/meta/llama-3.3-70b-inst │
        │  - Failure extraction        │
        │  - Severity rating & blast   │
        │  - RCA with confidence check │
        │  - P1/P2/P3 runbook creation │
        └──────────────────────────────┘
```

---

## Key Architectural Decisions

### 1. Why Cloudflare Agents SDK & Durable Objects?
- **Actor Model Isolation:** Each incident investigation runs inside its own isolated Durable Object (`IncidentAgent`). Incidents do not contend for memory, lock state, or cross-pollute active triage sessions.
- **True Edge Persistence:** Instead of ephemeral in-memory state that vanishes during worker hibernation or container recycles, state is persisted locally at the Cloudflare point-of-presence (PoP) nearest to the engineer.
- **Dual-Layer Resilience:** Data is written to Durable Objects SQLite relational tables and synchronized with transactional KV storage (`ctx.storage`).

### 2. Why SQLite inside Durable Objects?
- **Relational Integrity:** Incident records involve relational child entities: multi-turn chat messages, action items with mutable completion states, diagnostic CLI commands, and cross-incident reference links.
- **Fast Parameterized Queries:** Querying message timelines (`ORDER BY timestamp ASC`) or fetching recent incident context (`ORDER BY created_at DESC LIMIT 10`) runs in sub-millisecond local SQLite queries without external database roundtrips.

### 3. Why Cloudflare Workers AI?
- **Zero API Key Management:** Native Workers binding `env.AI` eliminates third-party token leaks, egress bandwidth costs, and external network latency.
- **70B Parameter Model Quality:** `@cf/meta/llama-3.3-70b-instruct` provides superior reasoning on complex multi-threaded stack traces, mutual exclusion deadlocks, and V8 memory heap allocation failures.

---

## The 4-Stage Structured Triage Process

When an engineer submits an error or paste logs, the assistant does not generate generic advice; it executes a strict 4-stage pipeline:

```
[ Stage 1: Understand Error ]
  ├── Extract Failure Mechanism (e.g. Kernel OOMKilled SIGKILL 137, Mutex Lock Inversion)
  ├── Isolate Subsystem / Component (e.g. SessionCache.bulkInsert(), PostgreSQL relation 16402)
  ├── Extract Specific Error Codes (e.g. [Exit Code 137, 502 Bad Gateway, Deadlock Detected])
  └── Construct Chronological Failure Timeline from log timestamps
        │
        ▼
[ Stage 2: Categorize Severity & Blast Radius ]
  ├── Classify Severity: CRITICAL | HIGH | MEDIUM | LOW
  ├── Provide Rigorous Severity Justification based on customer impact
  ├── Compute Blast Radius (Affected replicas, error rate spikes, p99 latency degradation)
  └── Identify Impacted Audience (e.g. unauthenticated logins, payment checkout ledger)
        │
        ▼
[ Stage 3: Root Cause Analysis (RCA) & Confidence Guard ]
  ├── Ranked Hypotheses with Confidence Scores (0–100%)
  ├── Direct Quoted Supporting Evidence Lines from logs
  ├── Secondary Contributing Factors (e.g. lack of LRU bounds, connection pool size)
  └── AMBIGUITY & CONFIDENCE SAFEGUARD:
        • If logs are truncated or confidence < 60%: sets isConfident = false
        • Surfaces amber "Inconclusive Diagnosis" warning in the UI
        • Generates a Missing Telemetry Checklist (e.g. thread dumps, trace IDs, tcpdump)
        │
        ▼
[ Stage 4: Prioritized Troubleshooting Plan ]
  ├── Tier P1: Immediate Containment (Stop bleeding: scale limits, restart pods, terminate locks)
  ├── Tier P2: Diagnostic Verification (Safe, non-destructive CLI checks to confirm hypothesis)
  └── Tier P3: Permanent Remediation (Architectural prevention: LRU bounds, sorted locks, CI checks)
```

---

## Cross-Incident Memory & Contextual Recall

The system solves the problem of "isolated investigations":
1. **Global SQLite Catalog:** Every triaged incident is indexed in the `IncidentIndex` Durable Object.
2. **Context Injection:** When triaging or chatting, the agent retrieves a rolling context of previous investigations.
3. **Similarity Detection:** If an active incident shares failure patterns or services with a past incident (e.g. recurring OOM crashes on `auth-session-worker`), the agent notes this in `crossIncidentReferences`.
4. **Historical Comparisons in Chat:** Engineers can directly ask:
   - *"How does this crash compare to our previous incident?"*
   - *"Did we encounter this deadlock in our billing service earlier?"*
   - *"Compare the blast radius with our last critical outage."*

---

## Production Failure Presets Included

The application includes 4 ready-to-test real-world production scenarios:
1. **Kubernetes Pod OOMKilled & CrashLoopBackOff:** V8 heap allocation failure under load resulting in Linux kernel SIGKILL 137.
2. **PostgreSQL Connection Exhaustion & Deadlock:** Mutual `ExclusiveLock` contention on `account_balances` causing 100% pool starvation.
3. **Redis Cache Stampede & Cascading Timeout:** Eviction policy dogpiling 4,200 concurrent queries directly to MySQL, tripping circuit breakers.
4. **Ambiguous Microservice Timeout (Low Confidence Test):** Sparse 3-line socket timeout log demonstrating the ambiguity guard, low confidence warning, and missing telemetry checklist.

---

## Local Development & Setup Instructions

### Prerequisites
- Node.js 18+ (tested on Node 22)
- npm or pnpm

### 1. Installation
```bash
git clone <repository-url>
cd incident-triage-assistant
npm install
```

### 2. Run Automated Verification Tests
Executes the comprehensive end-to-end test suite verifying the 4-stage pipeline, low-confidence guard, action items completion status, and cross-incident memory:
```bash
npm test
```

### 3. Start Frontend Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000). The frontend runs with hot reloading and proxies `/api` calls to the worker.

### 4. Run the Cloudflare Worker Locally
Starts `wrangler dev` simulating Cloudflare Workers, Durable Objects, and Workers AI locally:
```bash
npm run worker:dev
```

### 5. Production Build
Compiles TypeScript for both frontend and worker, then generates the optimized static bundle in `./dist`:
```bash
npm run build
```

---

## Cloudflare Deployment

Deploy the entire full-stack application (APIs, Durable Objects, Workers AI bindings, and static assets) in a single command:

```bash
# 1. Login to Cloudflare
npx wrangler login

# 2. Deploy Worker & Static Assets
npm run worker:deploy
```

`wrangler.jsonc` automatically configures:
- `AI` binding for Workers AI inference.
- `INCIDENT_AGENT` Durable Object binding for per-incident agent instances.
- `INCIDENT_INDEX` Durable Object binding for the global SQLite catalog.
- `ASSETS` binding mapping to `./dist` for serving the React frontend.

---

## Assumptions & Production Considerations

1. **Log Truncation & Token Windows:**
   - *Current Implementation:* Accepts up to 50KB of raw logs per submission; truncates display preview at 1,000 characters in the initial chat bubble to prevent UI bloat while feeding the complete context to Workers AI.
   - *Enterprise Extension:* For multi-megabyte log dumps, integrate Cloudflare R2 object storage with vector embeddings (Cloudflare Vectorize) to perform semantic search over high-volume logs.

2. **Network Sandbox & Offline Resilience:**
   - In environments where Workers AI or network access is restricted, the frontend automatically falls back to client-side heuristic inference and local storage caching, ensuring that all UI flows, action item toggles, and post-mortem exports remain fully functional.

3. **Data Privacy & PII Redaction:**
   - In enterprise production environments, log pipelines should pass through a regex/scrubber step (e.g. redacting bearer tokens, credit card numbers, passwords) prior to LLM submission.

---

## License
MIT
# incident-triage-assistant
