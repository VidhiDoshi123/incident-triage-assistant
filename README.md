# IncidentLens: AI Incident Triage Assistant for Developers

An AI-powered incident triage platform built for developers, DevOps, and Site Reliability Engineers (SREs). Users can paste application error logs or stack traces to diagnose failure modes, determine root causes with confidence ratings, and generate actionable troubleshooting runbooks and copyable diagnostic commands.

Built end-to-end on **Cloudflare's serverless edge platform**:
- **Backend Runtime:** Cloudflare Workers with TypeScript
- **Agent Runtime & Coordination:** Cloudflare Agents SDK (`agents-sdk`)
- **State & Storage Persistence:** Cloudflare Durable Objects (`ctx.storage`)
- **LLM Inference:** Cloudflare Workers AI (`@cf/meta/llama-3.3-70b-instruct`)
- **Frontend:** React 18, TypeScript, Tailwind CSS, Lucide icons, Vite

---

## Architecture Overview

```
+-------------------------------------------------------------------------+
|                               Frontend                                  |
|  React 18 + TypeScript + Tailwind CSS (Developer-focused Dark UI)       |
|  - Log & Stack Trace Console with Line Count & Presets                  |
|  - Multi-turn SRE Assistant Chat Timeline with Markdown & Code Copy     |
|  - Root Cause Hypotheses, Blast Radius & Confidence Meters              |
|  - Interactive Action Items Runbook (syncs state live with DO)          |
|  - One-click Diagnostic Terminal Commands (K8s, DB, Logs, Network)      |
|  - Markdown & JSON Post-Mortem Exporter                                 |
+------------------------------------+------------------------------------+
                                     |
                                     | HTTP / JSON REST APIs
                                     v
+-------------------------------------------------------------------------+
|                       Cloudflare Worker Router                          |
|  - Routes /api/incidents, /api/presets, /api/health                     |
|  - Serves static assets in production from dist/                        |
+------------------+----------------------------------+-------------------+
                   |                                  |
                   v                                  v
+------------------------------------+   +--------------------------------+
|     IncidentAgent (Durable Object) |   | IncidentIndex (Durable Object) |
|     (Cloudflare Agents SDK)        |   | - Global catalog of incidents  |
|  - Individual incident state       |   | - Search & filter index        |
|  - Conversation history            |   | - Real-time metadata sync      |
|  - Action items completion status  |   +--------------------------------+
|  - DO storage (ctx.storage)        |
+------------------+-----------------+
                   |
                   v
+-------------------------------------------------------------------------+
|                         Cloudflare Workers AI                           |
|  - Model: @cf/meta/llama-3.3-70b-instruct                              |
|  - Specialized SRE & Infrastructure root-cause prompt chains            |
|  - Structured JSON extraction + interactive follow-up chat              |
+-------------------------------------------------------------------------+
```

---

## Core Features

1. **Log & Stack Trace Triage:**
   - Supports Kubernetes events, Docker crashes, V8 Node.js memory dumps, PostgreSQL deadlock traces, Redis timeouts, and HTTP gateway failures.
   - Computes failure blast radius, error rate elevation, and estimated latency degradation.

2. **Root Cause Analysis (RCA):**
   - Produces clear root-cause hypotheses with confidence scores (0-100%).
   - Quotes direct evidence lines from submitted logs.
   - Lists secondary contributing factors (traffic spikes, pool limits, cache eviction).

3. **Actionable Remediation Runbook:**
   - Categorizes tasks into **Immediate Mitigation** (stop the bleeding), **Diagnostic Verification**, and **Permanent Fix**.
   - Checkboxes persist directly into Cloudflare Durable Objects storage.
   - Includes executable CLI commands (e.g. `kubectl set resources`, `psql pg_terminate_backend`) with one-click copy.

4. **Categorized Diagnostic Commands:**
   - Tailored bash, kubectl, psql, and journalctl commands organized by category (`kubernetes`, `database`, `network`, `logs`, `system`).
   - Detailed explanations of expected output and indicators to watch for.

5. **Multi-turn SRE Copilot Chat:**
   - Keeps log context in conversation memory.
   - Answer follow-up questions ("How do I roll back safely?", "Interpret this kubectl output", "How do I prevent this in CI?").

6. **Incident History & Catalog:**
   - Revisit previous incident investigations anytime.
   - Search by service name, error title, or blast radius.
   - Filter by severity (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) or status (`INVESTIGATING`, `IDENTIFIED`, `MITIGATED`, `RESOLVED`).

7. **Production Failure Presets:**
   - Includes realistic scenarios for immediate evaluation:
     - *Kubernetes Pod OOMKilled & CrashLoopBackOff*
     - *PostgreSQL Connection Starvation & Deadlock*
     - *Redis Cache Stampede & Cascading Upstream Timeout*
     - *Stripe Webhook Signature Verification Failure*

8. **Post-Mortem & Handoff Exporter:**
   - Generates formatted incident reports ready for Slack, GitHub Issues, PagerDuty, or Jira.
   - Export to Markdown (`.md`) or raw JSON (`.json`).

---

## Project Structure

```
incident-triage-assistant/
├── worker/                       # Cloudflare Workers backend
│   ├── index.ts                  # Worker router & asset dispatcher
│   ├── agent.ts                  # IncidentAgent Durable Object (Agents SDK)
│   ├── index-agent.ts            # IncidentIndex Durable Object for history
│   ├── prompts.ts                # SRE root cause & triage system prompts
│   ├── presets.ts                # Pre-configured production incident templates
│   └── types.ts                  # Backend TypeScript interfaces
├── src/                          # React + TypeScript frontend
│   ├── components/
│   │   ├── Header.tsx            # Navigation, status beacon & action buttons
│   │   ├── Sidebar.tsx           # Search, severity filters, incident history
│   │   ├── IncidentBanner.tsx    # Title, severity badge, live status selector
│   │   ├── ChatTimeline.tsx      # SRE Copilot chat with code highlighting
│   │   ├── TriageWorkbench.tsx   # RCA tabs, action runbook, diagnostic CLI
│   │   ├── NewIncidentModal.tsx  # Log paste console & scenario picker
│   │   ├── PresetsModal.tsx      # Scenario library with log preview
│   │   └── ExportModal.tsx       # Post-mortem report exporter
│   ├── services/
│   │   ├── api.ts                # Worker API client with local fallback
│   │   └── mockPresets.ts        # Built-in realistic production scenarios
│   ├── App.tsx                   # Main application layout
│   ├── main.tsx                  # React entry point
│   └── types.ts                  # Frontend shared types
├── wrangler.jsonc                # Cloudflare Workers configuration
├── vite.config.ts                # Vite build & API proxy setup
├── tailwind.config.js            # Developer dark theme tokens
├── package.json
└── tsconfig.json
```

---

## Getting Started

### Prerequisites
- Node.js 18+ (tested on Node 22)
- npm or pnpm
- Cloudflare account with Workers AI enabled (for deployment)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Locally in Development Mode
Start the Vite development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

To run the Cloudflare Worker with local Durable Objects and Workers AI:
```bash
npm run worker:dev
```

### 3. Build for Production
```bash
npm run build
```
This compiles TypeScript for both the Worker and the React client, then bundles assets into `./dist`.

### 4. Deploy to Cloudflare
```bash
npx wrangler deploy
```

---

## Cloudflare Services Configuration (`wrangler.jsonc`)

The application binds:
- **Workers AI:** `AI` binding for LLM inference with `@cf/meta/llama-3.3-70b-instruct`.
- **Durable Objects:**
  - `INCIDENT_AGENT` bound to `IncidentAgent`
  - `INCIDENT_INDEX` bound to `IncidentIndex`
- **Static Assets:** Serves `./dist` via Cloudflare's edge asset pipeline.

---

## License
MIT
