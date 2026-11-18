import type {
  IncidentRecord,
  IncidentHeader,
  IncidentPreset,
  IncidentStatus,
  ChatMessage,
} from '../types';
import { LOCAL_PRESETS, createMockIncident } from './mockPresets';

const STORAGE_KEY = 'incident_lens_records_v1';

function getLocalRecords(): Record<string, IncidentRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalRecords(records: Record<string, IncidentRecord>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.error('Failed to save to local storage', err);
  }
}

// Seed initial incidents if empty
function initializeLocalDefaults(): Record<string, IncidentRecord> {
  const existing = getLocalRecords();
  if (Object.keys(existing).length === 0) {
    const initial1 = createMockIncident(LOCAL_PRESETS[0]);
    const initial2 = createMockIncident(LOCAL_PRESETS[1]);
    const initial = { [initial1.id]: initial1, [initial2.id]: initial2 };
    saveLocalRecords(initial);
    return initial;
  }
  return existing;
}

export const api = {
  async getPresets(): Promise<IncidentPreset[]> {
    try {
      const res = await fetch('/api/presets');
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback to local
    }
    return LOCAL_PRESETS;
  },

  async getIncidents(): Promise<IncidentHeader[]> {
    try {
      const res = await fetch('/api/incidents');
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback to local
    }

    const localMap = initializeLocalDefaults();
    return Object.values(localMap)
      .map(inc => ({
        id: inc.id,
        title: inc.title,
        severity: inc.severity,
        status: inc.status,
        service: inc.service,
        environment: inc.environment,
        createdAt: inc.createdAt,
        updatedAt: inc.updatedAt,
        blastRadius: inc.blastRadius,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async getIncident(id: string): Promise<IncidentRecord | null> {
    try {
      const res = await fetch(`/api/incidents/${id}`);
      if (res.ok) {
        const data = (await res.json()) as IncidentRecord;
        if (data && data.id) {
          const local = getLocalRecords();
          local[data.id] = data;
          saveLocalRecords(local);
          return data;
        }
      }
    } catch {
      // Fallback
    }

    const localMap = getLocalRecords();
    return localMap[id] || null;
  },

  async createAndTriage(payload: {
    logs: string;
    description?: string;
    service?: string;
    environment?: 'production' | 'staging' | 'canary' | 'development';
    title?: string;
  }): Promise<IncidentRecord> {
    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = (await res.json()) as IncidentRecord;
        // Also cache locally
        const local = getLocalRecords();
        local[data.id] = data;
        saveLocalRecords(local);
        return data;
      }
    } catch {
      // Fallback
    }

    // Client-side fallback generation if backend is offline
    const matchedPreset = LOCAL_PRESETS.find(p => payload.logs.includes(p.service)) || LOCAL_PRESETS[0];
    const newIncident = createMockIncident({
      ...matchedPreset,
      name: payload.title || matchedPreset.name,
      service: payload.service || matchedPreset.service,
      environment: payload.environment || 'production',
      description: payload.description || matchedPreset.description,
      logs: payload.logs,
    });

    const local = getLocalRecords();
    local[newIncident.id] = newIncident;
    saveLocalRecords(local);
    return newIncident;
  },

  async sendChatMessage(incidentId: string, message: string): Promise<{ message: ChatMessage; incident: IncidentRecord }> {
    try {
      const res = await fetch(`/api/incidents/${incidentId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (res.ok) {
        const data = (await res.json()) as { message: ChatMessage; incident: IncidentRecord };
        const local = getLocalRecords();
        local[incidentId] = data.incident;
        saveLocalRecords(local);
        return data;
      }
    } catch {
      // Fallback
    }

    // Local fallback
    const local = getLocalRecords();
    const incident = local[incidentId];
    if (!incident) throw new Error('Incident not found');

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      sender: 'user',
      timestamp: new Date().toISOString(),
      content: message,
    };
    incident.messages.push(userMsg);

    // Realistic smart response
    let assistantText = '';
    const lower = message.toLowerCase();
    if (lower.includes('restart') || lower.includes('rollout')) {
      assistantText = `Proceeding with rolling restart on **${incident.service}**:\n\n\`\`\`bash\nkubectl rollout restart deployment/${incident.service} -n ${incident.environment}\nkubectl rollout status deployment/${incident.service} -n ${incident.environment} --watch\n\`\`\`\n\nEnsure readiness probes pass before routing 100% of traffic. Monitor pod memory with \`kubectl top pod -l app=${incident.service}\`.`;
    } else if (lower.includes('rollback') || lower.includes('previous version')) {
      assistantText = `To safely roll back to the prior deployment revision:\n\n\`\`\`bash\nkubectl rollout undo deployment/${incident.service} -n ${incident.environment}\n\`\`\`\n\nVerify that database migrations from the current release are backward-compatible.`;
    } else if (lower.includes('command') || lower.includes('diagnose') || lower.includes('verify')) {
      assistantText = `Run this diagnostic command to inspect the latest error signatures:\n\n\`\`\`bash\nkubectl logs -l app=${incident.service} --tail=100 -n ${incident.environment} | grep -iE "error|exception|killed|fatal"\n\`\`\`\n\nPaste the output here if you need me to interpret specific stack trace frames.`;
    } else {
      assistantText = `Acknowledged. I've analyzed your input regarding **${incident.title}**.\n\nRecommended next step: Execute the immediate mitigations listed in the action items panel to stabilize the error rate, then verify cluster metrics.`;
    }

    const assistantMsg: ChatMessage = {
      id: `msg-${Date.now()}-a`,
      sender: 'assistant',
      timestamp: new Date().toISOString(),
      content: assistantText,
    };
    incident.messages.push(assistantMsg);
    incident.updatedAt = new Date().toISOString();
    local[incidentId] = incident;
    saveLocalRecords(local);

    return { message: assistantMsg, incident };
  },

  async toggleAction(incidentId: string, actionId: string, status: 'pending' | 'completed'): Promise<IncidentRecord> {
    try {
      const res = await fetch(`/api/incidents/${incidentId}/action`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, status }),
      });
      if (res.ok) {
        const updated = (await res.json()) as IncidentRecord;
        const local = getLocalRecords();
        local[incidentId] = updated;
        saveLocalRecords(local);
        return updated;
      }
    } catch {
      // Fallback
    }

    const local = getLocalRecords();
    const inc = local[incidentId];
    if (inc) {
      const act = inc.actionItems.find(a => a.id === actionId);
      if (act) act.status = status;
      inc.updatedAt = new Date().toISOString();
      saveLocalRecords(local);
      return inc;
    }
    throw new Error('Incident not found');
  },

  async updateStatus(incidentId: string, status: IncidentStatus): Promise<IncidentRecord> {
    try {
      const res = await fetch(`/api/incidents/${incidentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = (await res.json()) as IncidentRecord;
        const local = getLocalRecords();
        local[incidentId] = updated;
        saveLocalRecords(local);
        return updated;
      }
    } catch {
      // Fallback
    }

    const local = getLocalRecords();
    const inc = local[incidentId];
    if (inc) {
      inc.status = status;
      inc.updatedAt = new Date().toISOString();
      saveLocalRecords(local);
      return inc;
    }
    throw new Error('Incident not found');
  },

  async deleteIncident(incidentId: string): Promise<void> {
    try {
      await fetch(`/api/incidents/${incidentId}`, { method: 'DELETE' });
    } catch {
      // Fallback
    }

    const local = getLocalRecords();
    delete local[incidentId];
    saveLocalRecords(local);
  },
};
