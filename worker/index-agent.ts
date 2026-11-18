import { Agent, type AgentContext } from 'agents-sdk';
import type { Env, IncidentHeader } from './types';

export class IncidentIndex extends Agent<Env, { incidents: IncidentHeader[] }> {
  constructor(ctx: AgentContext, env: Env) {
    super(ctx, env);
    this.initSql();
  }

  private initSql(): void {
    try {
      if (this.ctx.storage.sql) {
        this.ctx.storage.sql.exec(`
          CREATE TABLE IF NOT EXISTS incidents_index (
            id TEXT PRIMARY KEY,
            title TEXT,
            severity TEXT,
            status TEXT,
            service TEXT,
            environment TEXT,
            blast_radius TEXT,
            root_causes_summary TEXT,
            created_at TEXT,
            updated_at TEXT
          );
        `);
      }
    } catch (e) {
      console.warn('SQLite init in IncidentIndex warning:', e);
    }
  }

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // List all incidents
      if (path.endsWith('/list') && method === 'GET') {
        const incidents = await this.getAllIncidents();
        return new Response(JSON.stringify(incidents), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Recent context summary for cross-incident memory
      if (path.endsWith('/recent-context') && method === 'GET') {
        const contextStr = await this.getRecentIncidentsSummary();
        return new Response(JSON.stringify({ context: contextStr }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Upsert incident into SQLite index
      if (path.endsWith('/upsert') && method === 'POST') {
        const item = (await request.json()) as IncidentHeader;
        await this.upsertIncident(item);
        return new Response(JSON.stringify({ success: true, id: item.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Delete incident from index
      if (path.endsWith('/delete') && method === 'POST') {
        const { id } = (await request.json()) as { id: string };
        await this.deleteIncident(id);
        return new Response(JSON.stringify({ success: true, deletedId: id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  private async getAllIncidents(): Promise<IncidentHeader[]> {
    if (this.ctx.storage.sql) {
      try {
        const rows = this.ctx.storage.sql.exec<any>(`
          SELECT id, title, severity, status, service, environment, blast_radius, root_causes_summary, created_at, updated_at
          FROM incidents_index
          ORDER BY created_at DESC;
        `);
        const result: IncidentHeader[] = [];
        for (const r of rows) {
          result.push({
            id: r.id,
            title: r.title,
            severity: r.severity,
            status: r.status,
            service: r.service,
            environment: r.environment,
            blastRadius: r.blast_radius,
            rootCausesSummary: r.root_causes_summary,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          });
        }
        if (result.length > 0) return result;
      } catch (e) {
        console.warn('SQLite read fallback to storage KV:', e);
      }
    }

    return (await this.ctx.storage.get<IncidentHeader[]>('index_list')) || [];
  }

  private async getRecentIncidentsSummary(): Promise<string> {
    const list = await this.getAllIncidents();
    if (list.length === 0) return 'No previous incidents on record.';

    return list
      .slice(0, 8)
      .map(
        (inc, i) =>
          `[Incident ${i + 1}] ID: ${inc.id} | Title: "${inc.title}" | Service: ${inc.service} (${inc.environment}) | Severity: ${inc.severity} | Status: ${inc.status} | Blast Radius: ${inc.blastRadius}${inc.rootCausesSummary ? ` | Root Cause: ${inc.rootCausesSummary}` : ''}`
      )
      .join('\n');
  }

  private async upsertIncident(item: IncidentHeader): Promise<void> {
    if (this.ctx.storage.sql) {
      try {
        this.ctx.storage.sql.exec(
          `
          INSERT INTO incidents_index (id, title, severity, status, service, environment, blast_radius, root_causes_summary, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            severity = excluded.severity,
            status = excluded.status,
            service = excluded.service,
            environment = excluded.environment,
            blast_radius = excluded.blast_radius,
            root_causes_summary = excluded.root_causes_summary,
            updated_at = excluded.updated_at;
        `,
          item.id,
          item.title,
          item.severity,
          item.status,
          item.service,
          item.environment,
          item.blastRadius,
          item.rootCausesSummary || '',
          item.createdAt,
          item.updatedAt
        );
      } catch (e) {
        console.warn('SQLite upsert warning:', e);
      }
    }

    // Also persist to KV storage for dual resilience
    const list = (await this.ctx.storage.get<IncidentHeader[]>('index_list')) || [];
    const idx = list.findIndex(i => i.id === item.id);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.unshift(item);
    }
    await this.ctx.storage.put('index_list', list);
  }

  private async deleteIncident(id: string): Promise<void> {
    if (this.ctx.storage.sql) {
      try {
        this.ctx.storage.sql.exec(`DELETE FROM incidents_index WHERE id = ?;`, id);
      } catch (e) {
        console.warn('SQLite delete warning:', e);
      }
    }

    let list = (await this.ctx.storage.get<IncidentHeader[]>('index_list')) || [];
    list = list.filter(i => i.id !== id);
    await this.ctx.storage.put('index_list', list);
  }
}
