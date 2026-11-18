import { Agent, type AgentContext } from 'agents-sdk';
import type { Env, IncidentHeader } from './types';

export class IncidentIndex extends Agent<Env, { incidents: IncidentHeader[] }> {
  constructor(ctx: AgentContext, env: Env) {
    super(ctx, env);
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
      if (path.endsWith('/list') && method === 'GET') {
        const incidents = (await this.ctx.storage.get<IncidentHeader[]>('index_list')) || [];
        return new Response(JSON.stringify(incidents), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (path.endsWith('/upsert') && method === 'POST') {
        const item = (await request.json()) as IncidentHeader;
        const list = (await this.ctx.storage.get<IncidentHeader[]>('index_list')) || [];
        const existingIdx = list.findIndex(i => i.id === item.id);
        if (existingIdx >= 0) {
          list[existingIdx] = item;
        } else {
          list.unshift(item);
        }
        await this.ctx.storage.put('index_list', list);
        return new Response(JSON.stringify({ success: true, count: list.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (path.endsWith('/delete') && method === 'POST') {
        const { id } = (await request.json()) as { id: string };
        let list = (await this.ctx.storage.get<IncidentHeader[]>('index_list')) || [];
        list = list.filter(i => i.id !== id);
        await this.ctx.storage.put('index_list', list);
        return new Response(JSON.stringify({ success: true, count: list.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
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
}
