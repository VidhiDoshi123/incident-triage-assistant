export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type IncidentStatus = 'INVESTIGATING' | 'IDENTIFIED' | 'MITIGATED' | 'RESOLVED';
export type Environment = 'production' | 'staging' | 'canary' | 'development';

export interface RootCauseHypothesis {
  hypothesis: string;
  confidence: number; // 0 - 100
  evidence: string[];
  contributingFactors: string[];
}

export interface ActionItem {
  id: string;
  description: string;
  type: 'immediate_mitigation' | 'diagnostic' | 'permanent_fix';
  priority: 'p1' | 'p2' | 'p3';
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

export interface ErrorUnderstanding {
  failureMechanism: string;
  affectedComponent: string;
  extractedErrorCodes: string[];
  timeline: string[];
}

export interface SeverityAssessment {
  severity: Severity;
  justification: string;
  blastRadius: string;
  impactedAudiences: string[];
}

export interface ConfidenceAssessment {
  isConfident: boolean;
  primaryConfidence: number;
  ambiguityExplanation?: string;
  missingTelemetry?: string[];
}

export interface CrossIncidentReference {
  relatedIncidentId: string;
  relatedIncidentTitle: string;
  similarityFactor: string;
  comparisonNote: string;
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

  // Structured 4-phase triage artifacts
  errorUnderstanding?: ErrorUnderstanding;
  severityAssessment?: SeverityAssessment;
  confidenceAssessment?: ConfidenceAssessment;
  crossIncidentReferences?: CrossIncidentReference[];

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
  rootCausesSummary?: string;
}

export interface TriageRequestPayload {
  title?: string;
  logs: string;
  description?: string;
  service?: string;
  environment?: Environment;
}

export interface ChatRequestPayload {
  message: string;
}

export interface Env {
  AI: Ai;
  INCIDENT_AGENT: DurableObjectNamespace;
  INCIDENT_INDEX: DurableObjectNamespace;
  ASSETS?: Fetcher;
}
