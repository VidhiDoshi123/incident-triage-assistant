export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type IncidentStatus = 'INVESTIGATING' | 'IDENTIFIED' | 'MITIGATED' | 'RESOLVED';
export type Environment = 'production' | 'staging' | 'canary' | 'development';

export interface RootCauseHypothesis {
  hypothesis: string;
  confidence: number;
  evidence: string[];
  contributingFactors: string[];
}

export interface ActionItem {
  id: string;
  description: string;
  type: 'immediate_mitigation' | 'diagnostic' | 'permanent_fix';
  status: 'pending' | 'completed';
  command?: string;
  explanation?: string;
}

export interface DiagnosticCommand {
  label: string;
  command: string;
  explanation: string;
  category: 'kubernetes' | 'logs' | 'network' | 'database' | 'process' | 'system';
}

export interface IncidentMetrics {
  errorRate?: string;
  p99Latency?: string;
  affectedReplicas?: string;
  blastRadiusScore?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  timestamp: string;
  content: string;
  isInitialTriage?: boolean;
}

export interface IncidentRecord {
  id: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  service: string;
  environment: Environment;
  createdAt: string;
  updatedAt: string;
  summary: string;
  blastRadius: string;
  rawLogs?: string;
  errorDescription?: string;
  rootCauses: RootCauseHypothesis[];
  actionItems: ActionItem[];
  diagnosticCommands: DiagnosticCommand[];
  metrics: IncidentMetrics;
  messages: ChatMessage[];
}

export interface IncidentHeader {
  id: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  service: string;
  environment: Environment;
  createdAt: string;
  updatedAt: string;
  blastRadius: string;
}

export interface IncidentPreset {
  id: string;
  name: string;
  category: string;
  service: string;
  environment: Environment;
  description: string;
  logs: string;
}
