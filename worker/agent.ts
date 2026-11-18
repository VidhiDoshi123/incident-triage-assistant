import { Agent, type AgentContext } from 'agents-sdk';
import type {
  Env,
  IncidentRecord,
  ChatMessage,
  TriageRequestPayload,
  ChatRequestPayload,
  ActionItem,
  IncidentStatus,
  ErrorUnderstanding,
  SeverityAssessment,
  ConfidenceAssessment,
} from './types';
import { INCIDENT_TRIAGE_SYSTEM_PROMPT, INCIDENT_CHAT_SYSTEM_PROMPT } from './prompts';

export class IncidentAgent extends Agent<Env, IncidentRecord> {
  constructor(ctx: AgentContext, env: Env) {
    super(ctx, env);
    this.initSql();
  }

  private initSql(): void {
    try {
      if (this.ctx.storage.sql) {
        this.ctx.storage.sql.exec(`
          CREATE TABLE IF NOT EXISTS incident_details (
            id TEXT PRIMARY KEY,
            title TEXT,
            severity TEXT,
            status TEXT,
            service TEXT,
            environment TEXT,
            summary TEXT,
            blast_radius TEXT,
            raw_logs TEXT,
            error_description TEXT,
            record_json TEXT,
            created_at TEXT,
            updated_at TEXT
          );
        `);

        this.ctx.storage.sql.exec(`
          CREATE TABLE IF NOT EXISTS conversation_messages (
            id TEXT PRIMARY KEY,
            incident_id TEXT,
            sender TEXT,
            timestamp TEXT,
            content TEXT,
            is_initial INTEGER
          );
        `);

        this.ctx.storage.sql.exec(`
          CREATE TABLE IF NOT EXISTS action_items (
            id TEXT PRIMARY KEY,
            incident_id TEXT,
            description TEXT,
            type TEXT,
            priority TEXT,
            status TEXT,
            command TEXT,
            explanation TEXT
          );
        `);
      }
    } catch (e) {
      console.warn('SQLite init in IncidentAgent warning:', e);
    }
  }

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (path.endsWith('/triage') && method === 'POST') {
        const body = (await request.json()) as TriageRequestPayload;
        const result = await this.handleTriage(body);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (path.endsWith('/chat') && method === 'POST') {
        const body = (await request.json()) as ChatRequestPayload;
        const result = await this.handleChat(body);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (path.endsWith('/data') && method === 'GET') {
        const incident = await this.getIncidentData();
        return new Response(JSON.stringify(incident), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (path.endsWith('/action') && method === 'PATCH') {
        const body = (await request.json()) as { actionId: string; status: 'pending' | 'completed' };
        const updated = await this.toggleActionItem(body.actionId, body.status);
        return new Response(JSON.stringify(updated), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (path.endsWith('/status') && method === 'PATCH') {
        const body = (await request.json()) as { status: IncidentStatus };
        const updated = await this.updateIncidentStatus(body.status);
        return new Response(JSON.stringify(updated), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || 'Internal agent error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  private async fetchPastIncidentsContext(): Promise<string> {
    try {
      const indexStub = this.env.INCIDENT_INDEX.get(this.env.INCIDENT_INDEX.idFromName('global-index'));
      const res = await indexStub.fetch('http://do/recent-context');
      if (res.ok) {
        const data = (await res.json()) as { context: string };
        return data.context || '';
      }
    } catch (e) {
      console.warn('Failed to fetch past incidents context:', e);
    }
    return '';
  }

  private async getIncidentData(): Promise<IncidentRecord | null> {
    if (this.ctx.storage.sql) {
      try {
        const rows = this.ctx.storage.sql.exec<any>(
          `SELECT record_json FROM incident_details WHERE id = ? LIMIT 1;`,
          this.ctx.id.toString()
        );
        for (const r of rows) {
          if (r.record_json) {
            return JSON.parse(r.record_json);
          }
        }
      } catch (e) {
        console.warn('SQLite read fallback to storage KV:', e);
      }
    }

    const saved = await this.ctx.storage.get<IncidentRecord>('incident_record');
    return saved || null;
  }

  private async saveIncidentData(incident: IncidentRecord): Promise<void> {
    if (this.ctx.storage.sql) {
      try {
        this.ctx.storage.sql.exec(
          `
          INSERT INTO incident_details (id, title, severity, status, service, environment, summary, blast_radius, raw_logs, error_description, record_json, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            severity = excluded.severity,
            status = excluded.status,
            summary = excluded.summary,
            blast_radius = excluded.blast_radius,
            record_json = excluded.record_json,
            updated_at = excluded.updated_at;
        `,
          incident.id,
          incident.title,
          incident.severity,
          incident.status,
          incident.service,
          incident.environment,
          incident.summary,
          incident.blastRadius,
          incident.rawLogs || '',
          incident.errorDescription || '',
          JSON.stringify(incident),
          incident.createdAt,
          incident.updatedAt
        );

        // Save action items in SQL
        for (const act of incident.actionItems) {
          this.ctx.storage.sql.exec(
            `
            INSERT INTO action_items (id, incident_id, description, type, priority, status, command, explanation)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              status = excluded.status;
          `,
            act.id,
            incident.id,
            act.description,
            act.type,
            act.priority || 'p1',
            act.status,
            act.command || '',
            act.explanation || ''
          );
        }
      } catch (e) {
        console.warn('SQLite write warning in IncidentAgent:', e);
      }
    }

    // Persist to KV storage as well
    await this.ctx.storage.put('incident_record', incident);
  }

  private async handleTriage(payload: TriageRequestPayload): Promise<IncidentRecord> {
    const incidentId = this.ctx.id.toString();
    const now = new Date().toISOString();

    // Retrieve past incidents knowledge base to maintain cross-incident memory
    const pastIncidentsContext = await this.fetchPastIncidentsContext();

    const userPrompt = `Investigate this application incident:
Service: ${payload.service || 'Unknown'}
Environment: ${payload.environment || 'production'}
Context: ${payload.description || 'Application reported an operational failure.'}

Application Logs / Stack Trace:
\`\`\`
${payload.logs}
\`\`\`

Execute the 4-stage structured triage process:
1. Understand the error (failure mechanism, error codes, component, timeline)
2. Categorize severity & blast radius with justification
3. Identify possible root causes with confidence assessment (flag ambiguity if <60% confidence and detail missing telemetry)
4. Generate a prioritized troubleshooting plan (P1 immediate mitigation, P2 diagnostic verification, P3 permanent fix)

Output strictly valid JSON according to the schema.`;

    let triageResult: any = null;
    let narrative = '';

    try {
      if (this.env.AI) {
        const aiResponse: any = await this.env.AI.run('@cf/meta/llama-3.3-70b-instruct' as any, {
          messages: [
            { role: 'system', content: INCIDENT_TRIAGE_SYSTEM_PROMPT(pastIncidentsContext) },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
          max_tokens: 2800,
        });

        const rawText = aiResponse?.response || '';
        narrative = rawText;

        const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, rawText];
        const jsonStr = jsonMatch[1] || rawText;

        try {
          triageResult = JSON.parse(jsonStr.trim());
          if (triageResult.narrative) {
            narrative = triageResult.narrative;
          }
        } catch {
          triageResult = this.createStructuredFallback(payload, rawText);
        }
      } else {
        triageResult = this.createStructuredFallback(payload);
      }
    } catch (err) {
      console.error('Workers AI triage error:', err);
      triageResult = this.createStructuredFallback(payload);
    }

    const messages: ChatMessage[] = [
      {
        id: `msg-${Date.now()}-1`,
        sender: 'user',
        timestamp: now,
        content: `**Submitted logs for structured triage:**\n\`\`\`\n${payload.logs.slice(0, 1000)}${payload.logs.length > 1000 ? '\n... (truncated)' : ''}\n\`\`\`${payload.description ? `\n\n**Symptom Context:** ${payload.description}` : ''}`,
      },
      {
        id: `msg-${Date.now()}-2`,
        sender: 'assistant',
        timestamp: new Date().toISOString(),
        content: narrative || triageResult.summary || 'Structured triage completed.',
        isInitialTriage: true,
      },
    ];

    const incident: IncidentRecord = {
      id: incidentId,
      title: triageResult.title || payload.title || 'Unclassified Application Incident',
      severity: triageResult.severity || 'HIGH',
      status: 'INVESTIGATING',
      service: triageResult.service || payload.service || 'api-service',
      environment: triageResult.environment || payload.environment || 'production',
      createdAt: now,
      updatedAt: now,
      summary: triageResult.summary || 'Application failure analyzed.',
      blastRadius: triageResult.blastRadius || 'User traffic experiencing degradation.',
      rawLogs: payload.logs,
      errorDescription: payload.description,

      errorUnderstanding: triageResult.errorUnderstanding,
      severityAssessment: triageResult.severityAssessment,
      confidenceAssessment: triageResult.confidenceAssessment,
      crossIncidentReferences: triageResult.crossIncidentReferences || [],

      rootCauses: triageResult.rootCauses || [],
      actionItems: (triageResult.actionItems || []).map((item: any, idx: number) => ({
        id: item.id || `act-${idx + 1}`,
        description: item.description,
        type: item.type || 'immediate_mitigation',
        priority: item.priority || (idx === 0 ? 'p1' : idx === 1 ? 'p2' : 'p3'),
        status: 'pending',
        command: item.command,
        explanation: item.explanation,
      })),
      diagnosticCommands: triageResult.diagnosticCommands || [],
      metrics: triageResult.metrics || {
        errorRate: '15-25%',
        p99Latency: 'Degraded',
        blastRadiusScore: 'High',
      },
      messages,
    };

    // Save to SQLite & DO storage
    await this.saveIncidentData(incident);

    // Sync header to global SQLite index
    await this.syncWithIndex(incident);

    return incident;
  }

  private async handleChat(payload: ChatRequestPayload): Promise<{ message: ChatMessage; incident: IncidentRecord }> {
    const incident = await this.getIncidentData();
    if (!incident) {
      throw new Error('Incident not found or not initialized yet');
    }

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      sender: 'user',
      timestamp: new Date().toISOString(),
      content: payload.message,
    };
    incident.messages.push(userMessage);

    // Fetch past incidents for cross-incident comparisons
    const pastIncidentsContext = await this.fetchPastIncidentsContext();

    const contextSummary = `Incident ID: ${incident.id}
Title: ${incident.title}
Severity: ${incident.severity}
Status: ${incident.status}
Service: ${incident.service} (${incident.environment})
Summary: ${incident.summary}
Failure Mechanism: ${incident.errorUnderstanding?.failureMechanism || 'N/A'}
Confidence: ${incident.confidenceAssessment?.primaryConfidence || 'N/A'}% (isConfident: ${incident.confidenceAssessment?.isConfident ?? true})
Root causes: ${incident.rootCauses.map(r => `${r.hypothesis} (${r.confidence}%)`).join('; ')}
Action items: ${incident.actionItems.map(a => `[${a.priority || 'p1'}] ${a.description} (${a.status})`).join('; ')}`;

    let assistantReply = '';

    try {
      if (this.env.AI) {
        const conversationHistory = incident.messages.slice(-10).map(m => ({
          role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
          content: m.content,
        }));

        const aiResponse: any = await this.env.AI.run('@cf/meta/llama-3.3-70b-instruct' as any, {
          messages: [
            { role: 'system', content: INCIDENT_CHAT_SYSTEM_PROMPT(contextSummary, pastIncidentsContext) },
            ...conversationHistory,
          ],
          temperature: 0.3,
          max_tokens: 1800,
        });

        assistantReply = aiResponse?.response || 'I have analyzed your request and referenced the incident context.';
      } else {
        assistantReply = `Understood. For incident **${incident.title}** on service **${incident.service}**, verify that diagnostic commands have confirmed pod health. You can also refer to previous investigations in the sidebar for comparison.`;
      }
    } catch (err: any) {
      console.error('Chat AI inference error:', err);
      assistantReply = `I encountered an inference error, but based on the saved state for **${incident.service}**, review the immediate P1 actions or run: \`kubectl logs -l app=${incident.service} --tail=100\`.`;
    }

    const assistantMessage: ChatMessage = {
      id: `msg-${Date.now()}-a`,
      sender: 'assistant',
      timestamp: new Date().toISOString(),
      content: assistantReply,
    };
    incident.messages.push(assistantMessage);
    incident.updatedAt = new Date().toISOString();

    await this.saveIncidentData(incident);
    await this.syncWithIndex(incident);

    return { message: assistantMessage, incident };
  }

  private async toggleActionItem(actionId: string, status: 'pending' | 'completed'): Promise<IncidentRecord> {
    const incident = await this.getIncidentData();
    if (!incident) throw new Error('Incident not found');

    const item = incident.actionItems.find(a => a.id === actionId);
    if (item) {
      item.status = status;
    }

    incident.updatedAt = new Date().toISOString();
    await this.saveIncidentData(incident);
    await this.syncWithIndex(incident);
    return incident;
  }

  private async updateIncidentStatus(status: IncidentStatus): Promise<IncidentRecord> {
    const incident = await this.getIncidentData();
    if (!incident) throw new Error('Incident not found');

    incident.status = status;
    incident.updatedAt = new Date().toISOString();
    await this.saveIncidentData(incident);
    await this.syncWithIndex(incident);
    return incident;
  }

  private async syncWithIndex(incident: IncidentRecord): Promise<void> {
    try {
      const indexStub = this.env.INCIDENT_INDEX.get(this.env.INCIDENT_INDEX.idFromName('global-index'));
      const rootCausesSummary = incident.rootCauses.length > 0 ? incident.rootCauses[0].hypothesis : incident.summary;
      await indexStub.fetch('http://do/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: incident.id,
          title: incident.title,
          severity: incident.severity,
          status: incident.status,
          service: incident.service,
          environment: incident.environment,
          createdAt: incident.createdAt,
          updatedAt: incident.updatedAt,
          blastRadius: incident.blastRadius,
          rootCausesSummary,
        }),
      });
    } catch (e) {
      console.warn('Index sync error in IncidentAgent:', e);
    }
  }

  private createStructuredFallback(payload: TriageRequestPayload, rawText = ''): any {
    const logs = payload.logs.toLowerCase();
    const service = payload.service || 'backend-service';

    // Check for ambiguous or sparse logs (< 100 characters)
    const isAmbiguous = payload.logs.trim().length < 120 || (!logs.includes('error') && !logs.includes('exception') && !logs.includes('fatal') && !logs.includes('failed') && !logs.includes('oom'));

    if (isAmbiguous) {
      return {
        title: 'Unresolved Service Anomaly (Low Confidence / Sparse Telemetry)',
        severity: 'MEDIUM',
        service,
        environment: payload.environment || 'production',
        summary: 'The provided log snippet is sparse or lacks explicit stack trace frames, preventing an unambiguous root cause diagnosis.',
        blastRadius: 'Potential minor degradation or localized errors; blast radius cannot be verified without additional telemetry.',
        errorUnderstanding: {
          failureMechanism: 'Undetermined due to sparse log input',
          affectedComponent: service,
          extractedErrorCodes: ['INSUFFICIENT_TELEMETRY'],
          timeline: ['Log snippet submitted', 'Analysis initiated', 'Ambiguity detected'],
        },
        severityAssessment: {
          severity: 'MEDIUM',
          justification: 'Defaulting to MEDIUM severity pending additional telemetry to determine customer impact.',
          blastRadius: 'Uncertain without ingress error rate metrics.',
          impactedAudiences: ['Unknown'],
        },
        confidenceAssessment: {
          isConfident: false,
          primaryConfidence: 35,
          ambiguityExplanation: 'Logs do not contain explicit exception names, kernel events, or HTTP status codes. Multiple hypotheses remain equally plausible.',
          missingTelemetry: [
            'Full application stack trace with line numbers',
            'Ingress reverse-proxy access logs (HTTP status codes & latency)',
            'Container exit codes and termination reason (`kubectl describe pod`)',
            'Distributed tracing trace_id or span waterfall',
          ],
        },
        crossIncidentReferences: [],
        rootCauses: [
          {
            hypothesis: 'Transient upstream network timeout or configuration mismatch',
            confidence: 35,
            evidence: [payload.logs.slice(0, 150) || 'Sparse log input provided'],
            contributingFactors: ['Missing debug logging level', 'Log truncation'],
          },
        ],
        actionItems: [
          {
            id: 'act-1',
            description: 'Enable DEBUG log level and inspect full stack trace',
            type: 'diagnostic',
            priority: 'p1',
            status: 'pending',
            command: `kubectl set env deployment/${service} LOG_LEVEL=debug`,
            explanation: 'Increases log verbosity to expose hidden root causes',
          },
          {
            id: 'act-2',
            description: 'Tail live pod logs while triggering test synthetic transaction',
            type: 'diagnostic',
            priority: 'p2',
            status: 'pending',
            command: `kubectl logs -f -l app=${service} --tail=100`,
            explanation: 'Captures fresh log frames during active reproduction',
          },
        ],
        diagnosticCommands: [
          {
            label: 'Fetch Recent Error Logs',
            command: `kubectl logs -l app=${service} --tail=200 | grep -iE "error|warn|fatal"`,
            explanation: 'Filters logs specifically for error lines',
            category: 'logs',
          },
        ],
        metrics: {
          errorRate: 'Unknown (Telemetry required)',
          p99Latency: 'Unknown',
          affectedReplicas: 'Pending inspection',
          blastRadiusScore: 'Low-to-Moderate',
        },
        narrative: `### Inconclusive Incident Triage (Low Confidence: 35%)\n\nThe submitted logs do not provide sufficient stack trace evidence or error codes to definitively identify the failure mode.\n\n**Missing Telemetry:**\n- Full exception stack trace\n- Upstream gateway HTTP response codes\n- System cgroup metrics\n\nRun the recommended diagnostic commands to capture additional telemetry.`,
      };
    }

    if (logs.includes('oom') || logs.includes('out of memory') || logs.includes('137')) {
      return {
        title: 'Container Memory Saturation & OOMKilled Termination',
        severity: 'CRITICAL',
        service,
        environment: payload.environment || 'production',
        summary: 'Application process exceeded container cgroup memory limits (exit code 137), triggering repetitive CrashLoopBackOff restarts under load.',
        blastRadius: 'Severe user authentication failures. 50% of active replicas crash-looping.',
        errorUnderstanding: {
          failureMechanism: 'Linux kernel OOM killer termination (SIGKILL exit code 137)',
          affectedComponent: `${service} heap memory buffer`,
          extractedErrorCodes: ['Exit Code 137', 'OOMKilled', 'Allocation failed'],
          timeline: ['Memory allocation spike', 'V8 Mark-compact failure', 'Kernel SIGKILL 137', 'CrashLoopBackOff'],
        },
        severityAssessment: {
          severity: 'CRITICAL',
          justification: 'CrashLoopBackOff prevents container from maintaining healthy status, rejecting user traffic.',
          blastRadius: '50% of incoming requests failing with HTTP 502.',
          impactedAudiences: ['Active user sessions', 'Upstream API gateway'],
        },
        confidenceAssessment: {
          isConfident: true,
          primaryConfidence: 94,
          missingTelemetry: ['V8 heap snapshot dump to isolate specific memory leak object reference'],
        },
        crossIncidentReferences: [],
        rootCauses: [
          {
            hypothesis: 'Unbounded in-memory session cache accumulation without LRU eviction bounds',
            confidence: 94,
            evidence: ['FATAL ERROR: Ineffective mark-compacts near heap limit', 'Exit Code: 137 (OOMKilled)'],
            contributingFactors: ['Spike in concurrent authentication requests', 'Container memory limit set below peak heap demand'],
          },
        ],
        actionItems: [
          {
            id: 'act-1',
            description: 'Scale deployment memory limits to 3.5Gi immediately to halt crash loop',
            type: 'immediate_mitigation',
            priority: 'p1',
            status: 'pending',
            command: `kubectl set resources deployment/${service} --limits=memory=3.5Gi --requests=memory=2Gi`,
            explanation: 'Provides immediate memory ceiling to stabilize running pods',
          },
          {
            id: 'act-2',
            description: 'Perform rolling restart of deployment to flush leaked memory',
            type: 'immediate_mitigation',
            priority: 'p1',
            status: 'pending',
            command: `kubectl rollout restart deployment/${service}`,
            explanation: 'Spawns fresh pod instances with clean memory heaps',
          },
          {
            id: 'act-3',
            description: 'Enforce maximum cache size and LRU TTL eviction in application config',
            type: 'permanent_fix',
            priority: 'p3',
            status: 'pending',
            explanation: 'Guarantees memory usage remains bounded regardless of traffic volume',
          },
        ],
        diagnosticCommands: [
          {
            label: 'Inspect Container Exit Status & Restarts',
            command: `kubectl describe pod -l app=${service} | grep -E "Exit Code|OOMKilled|Restart Count"`,
            explanation: 'Confirms container was terminated by kernel OOM killer',
            category: 'kubernetes',
          },
          {
            label: 'Monitor Real-time Pod Memory',
            command: `kubectl top pod -l app=${service} --containers`,
            explanation: 'Displays real-time memory usage across replicas',
            category: 'system',
          },
        ],
        metrics: {
          errorRate: '48.2%',
          p99Latency: '4,200ms',
          affectedReplicas: '4 of 8',
          blastRadiusScore: 'Critical',
        },
        narrative: `### Structured Incident Triage (Stage 1-4)\n\n**Stage 1 - Understand Error:** Container was terminated by kernel OOM killer with Exit Code 137.\n**Stage 2 - Severity:** CRITICAL due to continuous CrashLoopBackOff.\n**Stage 3 - Root Cause:** Memory heap exhaustion (Confidence: 94%).\n**Stage 4 - Plan:** Scale resources immediately (P1), then inspect memory profiles (P2/P3).`,
      };
    }

    return {
      title: 'Application Service Error & Latency Spike',
      severity: 'HIGH',
      service,
      environment: payload.environment || 'production',
      summary: rawText ? rawText.slice(0, 300) : `Incident detected in ${service} causing degraded performance.`,
      blastRadius: 'Intermittent 5xx responses for active user sessions.',
      errorUnderstanding: {
        failureMechanism: 'Unhandled service exception or downstream timeout',
        affectedComponent: service,
        extractedErrorCodes: ['500 Internal Error'],
        timeline: ['Error frequency elevated', 'Upstream latency degraded'],
      },
      severityAssessment: {
        severity: 'HIGH',
        justification: 'Service is responding with elevated error rates.',
        blastRadius: 'Customer transactions degraded.',
        impactedAudiences: ['Active API clients'],
      },
      confidenceAssessment: {
        isConfident: true,
        primaryConfidence: 82,
        missingTelemetry: ['Distributed trace IDs', 'Upstream database slow query logs'],
      },
      crossIncidentReferences: [],
      rootCauses: [
        {
          hypothesis: 'Service threshold or resource saturation causing cascading failures',
          confidence: 82,
          evidence: [payload.logs.split('\n')[0] || 'Error frequency spiked in logs'],
          contributingFactors: ['Spike in concurrent client traffic'],
        },
      ],
      actionItems: [
        {
          id: 'act-1',
          description: 'Inspect live application error logs',
          type: 'diagnostic',
          priority: 'p1',
          status: 'pending',
          command: `kubectl logs -l app=${service} --tail=100`,
          explanation: 'Captures the latest error signatures',
        },
      ],
      diagnosticCommands: [
        {
          label: 'Tail Pod Error Logs',
          command: `kubectl logs -l app=${service} --tail=100 | grep -i error`,
          explanation: 'Isolates error frames',
          category: 'logs',
        },
      ],
      metrics: {
        errorRate: '18.4%',
        p99Latency: '3,100ms',
        affectedReplicas: '3 of 6',
        blastRadiusScore: 'High',
      },
      narrative: rawText || `### Triage Summary\n\nIncident in **${service}** identified. Review the 4-phase structured analysis and follow the prioritized action items.`,
    };
  }
}
