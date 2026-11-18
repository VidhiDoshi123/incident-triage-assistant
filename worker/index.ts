import { IncidentAgent } from './agent';
import { IncidentIndex } from './index-agent';
import { INCIDENT_PRESETS } from './presets';
import type { Env, TriageRequestPayload, ChatRequestPayload, IncidentStatus } from './types';

export { IncidentAgent, IncidentIndex };

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check endpoint
    if (path === '/api/health') {
      return jsonResponse({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          workersAI: !!env.AI,
          durableObjects: !!env.INCIDENT_AGENT,
        },
      });
    }

    // Presets endpoint
    if (path === '/api/presets' && method === 'GET') {
      return jsonResponse(INCIDENT_PRESETS);
    }

    // Incident list endpoint
    if (path === '/api/incidents' && method === 'GET') {
      try {
        const indexStub = env.INCIDENT_INDEX.get(env.INCIDENT_INDEX.idFromName('global-index'));
        const res = await indexStub.fetch('http://do/list');
        const list = await res.json();
        return jsonResponse(list);
      } catch (err: any) {
        return jsonResponse({ error: 'Failed to retrieve incidents', details: err.message }, 500);
      }
    }

    // Create & triage a new incident
    if (path === '/api/incidents' && method === 'POST') {
      try {
        const body = (await request.json()) as TriageRequestPayload;
        const incidentId = `inc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const agentStub = env.INCIDENT_AGENT.get(env.INCIDENT_AGENT.idFromName(incidentId));

        const res = await agentStub.fetch('http://do/triage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const incident = await res.json();
        return jsonResponse(incident, 201);
      } catch (err: any) {
        return jsonResponse({ error: 'Failed to create and triage incident', details: err.message }, 500);
      }
    }

    // Single incident operations: /api/incidents/:id/...
    const incidentMatch = path.match(/^\/api\/incidents\/([^/]+)(?:\/(.*))?$/);
    if (incidentMatch) {
      const incidentId = incidentMatch[1];
      const subPath = incidentMatch[2] || '';

      const agentStub = env.INCIDENT_AGENT.get(env.INCIDENT_AGENT.idFromName(incidentId));

      // GET /api/incidents/:id -> retrieve full incident data
      if (subPath === '' && method === 'GET') {
        const res = await agentStub.fetch('http://do/data');
        const data = await res.json();
        return jsonResponse(data);
      }

      // POST /api/incidents/:id/triage -> re-triage or update initial triage
      if (subPath === 'triage' && method === 'POST') {
        const body = await request.json();
        const res = await agentStub.fetch('http://do/triage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        return jsonResponse(data);
      }

      // POST /api/incidents/:id/chat -> multi-turn triage chat
      if (subPath === 'chat' && method === 'POST') {
        const body = (await request.json()) as ChatRequestPayload;
        const res = await agentStub.fetch('http://do/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        return jsonResponse(data);
      }

      // PATCH /api/incidents/:id/action -> toggle action item
      if (subPath === 'action' && method === 'PATCH') {
        const body = await request.json();
        const res = await agentStub.fetch('http://do/action', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        return jsonResponse(data);
      }

      // PATCH /api/incidents/:id/status -> update status
      if (subPath === 'status' && method === 'PATCH') {
        const body = (await request.json()) as { status: IncidentStatus };
        const res = await agentStub.fetch('http://do/status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        return jsonResponse(data);
      }

      // DELETE /api/incidents/:id -> delete from global index
      if (subPath === '' && method === 'DELETE') {
        const indexStub = env.INCIDENT_INDEX.get(env.INCIDENT_INDEX.idFromName('global-index'));
        await indexStub.fetch('http://do/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: incidentId }),
        });
        return jsonResponse({ success: true, deletedId: incidentId });
      }
    }

    // Static assets fallback if configured
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return jsonResponse({ error: 'Route not found' }, 404);
  },
};
