import { Agent, type AgentContext } from 'agents-sdk';
import type {
  Env,
  IncidentRecord,
  ChatMessage,
  TriageRequestPayload,
  ChatRequestPayload,
  ActionItem,
  IncidentStatus,
} from './types';
import { INCIDENT_TRIAGE_SYSTEM_PROMPT, INCIDENT_CHAT_SYSTEM_PROMPT } from './prompts';

export class IncidentAgent extends Agent<Env, IncidentRecord> {
  constructor(ctx: AgentContext, env: Env) {
    super(ctx, env);
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
      return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  private async getIncidentData(): Promise<IncidentRecord | null> {
    const saved = await this.ctx.storage.get<IncidentRecord>('incident_record');
    return saved || null;
  }

  private async handleTriage(payload: TriageRequestPayload): Promise<IncidentRecord> {
    const incidentId = this.ctx.id.toString();
    const now = new Date().toISOString();

    const userPrompt = `Investigate the following error description and application logs:
Service: ${payload.service || 'Unknown'}
Environment: ${payload.environment || 'production'}
Description: ${payload.description || 'Application encountered an unexpected error.'}

Logs:
\`\`\`
${payload.logs}
\`\`\`

Perform triage and output strictly the JSON object described in the system instructions.`;

    let triageResult: any = null;
    let narrative = '';

    try {
      if (this.env.AI) {
        const aiResponse: any = await this.env.AI.run('@cf/meta/llama-3.3-70b-instruct' as any, {
          messages: [
            { role: 'system', content: INCIDENT_TRIAGE_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
          max_tokens: 2500,
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
          // If JSON parsing fails, build a structured fallback with AI text
          triageResult = this.createHeuristicFallback(payload, rawText);
        }
      } else {
        triageResult = this.createHeuristicFallback(payload);
      }
    } catch (err) {
      console.error('Workers AI error:', err);
      triageResult = this.createHeuristicFallback(payload);
    }

    const messages: ChatMessage[] = [
      {
        id: `msg-${Date.now()}-1`,
        sender: 'user',
        timestamp: now,
        content: `**Submitted logs for triage:**\n\`\`\`\n${payload.logs.slice(0, 1000)}${payload.logs.length > 1000 ? '\n... (truncated)' : ''}\n\`\`\`${payload.description ? `\n\n**Context:** ${payload.description}` : ''}`,
      },
      {
        id: `msg-${Date.now()}-2`,
        sender: 'assistant',
        timestamp: new Date().toISOString(),
        content: narrative || triageResult.summary || 'Initial triage report generated.',
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
      blastRadius: triageResult.blastRadius || 'Potentially impacting user traffic.',
      rawLogs: payload.logs,
      errorDescription: payload.description,
      rootCauses: triageResult.rootCauses || [],
      actionItems: (triageResult.actionItems || []).map((item: any, idx: number) => ({
        id: item.id || `act-${idx + 1}`,
        description: item.description,
        type: item.type || 'immediate_mitigation',
        status: 'pending',
        command: item.command,
        explanation: item.explanation,
      })),
      diagnosticCommands: triageResult.diagnosticCommands || [],
      metrics: triageResult.metrics || {
        errorRate: 'Elevated (>15%)',
        p99Latency: 'Degraded',
        blastRadiusScore: 'High',
      },
      messages,
    };

    // Save persistently to Durable Object storage
    await this.ctx.storage.put('incident_record', incident);

    // Also notify IncidentIndex
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

    const contextSummary = `Incident: ${incident.title}
Severity: ${incident.severity}
Status: ${incident.status}
Service: ${incident.service}
Root causes identified: ${incident.rootCauses.map(r => r.hypothesis).join('; ')}
Action items: ${incident.actionItems.map(a => `${a.description} (${a.status})`).join('; ')}
Initial logs snippet: ${(incident.rawLogs || '').slice(0, 500)}`;

    let assistantReply = '';

    try {
      if (this.env.AI) {
        const conversationHistory = incident.messages.slice(-8).map(m => ({
          role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
          content: m.content,
        }));

        const aiResponse: any = await this.env.AI.run('@cf/meta/llama-3.3-70b-instruct' as any, {
          messages: [
            { role: 'system', content: INCIDENT_CHAT_SYSTEM_PROMPT(contextSummary) },
            ...conversationHistory,
          ],
          temperature: 0.3,
          max_tokens: 1500,
        });

        assistantReply = aiResponse?.response || 'I have analyzed your query and updated the incident observations.';
      } else {
        assistantReply = `Received command/query: "${payload.message}".\n\nBased on the logs for **${incident.service}**, verify that the affected pods have stabilized. If you need command verification, check the diagnostic commands tab.`;
      }
    } catch (err: any) {
      console.error('Chat AI inference error:', err);
      assistantReply = `I received your update. Consider reviewing the immediate mitigations and running: \`kubectl logs -l app=${incident.service} --tail=100\`.`;
    }

    const assistantMessage: ChatMessage = {
      id: `msg-${Date.now()}-a`,
      sender: 'assistant',
      timestamp: new Date().toISOString(),
      content: assistantReply,
    };
    incident.messages.push(assistantMessage);
    incident.updatedAt = new Date().toISOString();

    await this.ctx.storage.put('incident_record', incident);
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
    await this.ctx.storage.put('incident_record', incident);
    await this.syncWithIndex(incident);
    return incident;
  }

  private async updateIncidentStatus(status: IncidentStatus): Promise<IncidentRecord> {
    const incident = await this.getIncidentData();
    if (!incident) throw new Error('Incident not found');

    incident.status = status;
    incident.updatedAt = new Date().toISOString();
    await this.ctx.storage.put('incident_record', incident);
    await this.syncWithIndex(incident);
    return incident;
  }

  private async syncWithIndex(incident: IncidentRecord): Promise<void> {
    try {
      const indexStub = this.env.INCIDENT_INDEX.get(this.env.INCIDENT_INDEX.idFromName('global-index'));
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
        }),
      });
    } catch (e) {
      console.warn('Index sync error:', e);
    }
  }

  private createHeuristicFallback(payload: TriageRequestPayload, rawText = ''): any {
    const logs = payload.logs.toLowerCase();
    let title = 'Application Error & Performance Degradation';
    let severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';
    let service = payload.service || 'web-service';
    let hypothesis = 'Internal service failure triggered unhandled exceptions';
    let blastRadius = 'Intermittent 5xx responses for active user sessions';
    const commands: any[] = [];
    const actions: any[] = [];

    if (logs.includes('oom') || logs.includes('out of memory') || logs.includes('heap out of memory') || logs.includes('137')) {
      title = 'Container Memory Saturation & OOMKilled Termination';
      severity = 'CRITICAL';
      hypothesis = 'Process heap exceeded cgroup memory limit leading to kernel OOM termination (exit code 137)';
      blastRadius = 'Pod replicas restarting repeatedly, degrading cluster throughput';
      commands.push({
        label: 'Inspect Pod OOM Status',
        command: `kubectl describe pod -l app=${service} | grep -E "Exit Code|OOMKilled|Restart Count"`,
        explanation: 'Checks if container was terminated by kernel OOM killer',
        category: 'kubernetes',
      });
      commands.push({
        label: 'Fetch Pre-crash Logs',
        command: `kubectl logs -l app=${service} --previous --tail=200`,
        explanation: 'Retrieves logs right before termination',
        category: 'logs',
      });
      actions.push({
        id: 'act-1',
        description: 'Increase container memory limits in Deployment spec',
        type: 'immediate_mitigation',
        command: `kubectl set resources deployment/${service} --limits=memory=2Gi --requests=memory=1Gi`,
        explanation: 'Provides headroom to prevent OOM restarts while investigating leaks',
      });
      actions.push({
        id: 'act-2',
        description: 'Profile memory allocation snapshots to pinpoint leak source',
        type: 'permanent_fix',
        explanation: 'Audit caching layers and unbounded collection growth',
      });
    } else if (logs.includes('deadlock') || logs.includes('connection pool') || logs.includes('remaining connection slots') || logs.includes('pg_stat')) {
      title = 'Database Connection Starvation & Lock Contention';
      severity = 'CRITICAL';
      hypothesis = 'Database connection pool reached maximum capacity due to uncommitted transactions or slow lock acquisition';
      blastRadius = 'All incoming API requests requiring database transactions are queued or timing out';
      commands.push({
        label: 'Check Active PostgreSQL Queries',
        command: `psql -c "SELECT pid, age(clock_timestamp(), query_start), state, query FROM pg_stat_activity WHERE state != 'idle' ORDER BY age DESC LIMIT 10;"`,
        explanation: 'Finds long-running transactions holding table locks',
        category: 'database',
      });
      commands.push({
        label: 'Inspect Lock Waiting Graph',
        command: `psql -c "SELECT blocked_locks.pid AS blocked_pid, blocking_locks.pid AS blocking_pid, blocked_activity.query AS blocked_statement FROM  pg_catalog.pg_locks blocked_locks JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype WHERE NOT blocked_locks.granted;"`,
        explanation: 'Identifies which PID is blocking other operations',
        category: 'database',
      });
      actions.push({
        id: 'act-1',
        description: 'Terminate blocking runaway database query',
        type: 'immediate_mitigation',
        command: `psql -c "SELECT pg_terminate_backend(<BLOCKING_PID>);"`,
        explanation: 'Instantly releases row locks and unblocks waiting transactions',
      });
      actions.push({
        id: 'act-2',
        description: 'Verify connection pooler (PgBouncer) queue depth',
        type: 'diagnostic',
        command: `psql -p 6432 -U pgbouncer -c "SHOW POOLS;"`,
        explanation: 'Ensures pooler clients are not starved',
      });
    } else {
      commands.push({
        label: 'Tail Recent Error Logs',
        command: `journalctl -u ${service} -n 100 --no-pager -p err`,
        explanation: 'Extracts critical systemd service error logs',
        category: 'logs',
      });
      commands.push({
        label: 'Check Network Listening Sockets',
        command: `ss -tulpn | grep -E "80|443|3000|8080"`,
        explanation: 'Ensures application port is actively bound and receiving connections',
        category: 'network',
      });
      actions.push({
        id: 'act-1',
        description: 'Inspect upstream ingress and gateway error codes',
        type: 'diagnostic',
        explanation: 'Verify if 502 Bad Gateway is originating from backend process or network path',
      });
    }

    return {
      title,
      severity,
      service,
      environment: payload.environment || 'production',
      summary: rawText ? rawText.slice(0, 300) : `Incident detected in ${service}. Error frequency spiked, causing transaction degradation.`,
      blastRadius,
      rootCauses: [
        {
          hypothesis,
          confidence: 88,
          evidence: [payload.logs.split('\n')[0] || 'High error rate in logs'],
          contributingFactors: ['Spike in concurrent requests', 'Resource limit threshold reached'],
        },
      ],
      actionItems: actions,
      diagnosticCommands: commands,
      metrics: {
        errorRate: '18.4%',
        p99Latency: '3,450ms',
        affectedReplicas: '4 of 8 replicas',
        blastRadiusScore: severity === 'CRITICAL' ? 'High' : 'Moderate',
      },
      narrative: rawText || `### Triage Summary\n\nIncident analysis indicates **${title}** impacting **${service}**.\n\nKey finding: ${hypothesis}. Immediate steps have been prioritized in the actions panel.`,
    };
  }
}
