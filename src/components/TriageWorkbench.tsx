import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Copy,
  Check,
  Terminal,
  Activity,
  ListTodo,
  ShieldAlert,
  ChevronRight,
  Flame,
  Search,
  HelpCircle,
  History,
  Layers,
  ArrowRight,
  AlertTriangle,
  FileSearch,
  Sparkles,
} from 'lucide-react';
import type { IncidentRecord, ActionItem } from '../types';

interface TriageWorkbenchProps {
  incident: IncidentRecord;
  onToggleAction: (actionId: string, status: 'pending' | 'completed') => Promise<void>;
  onAskInChat?: (prompt: string) => void;
}

export const TriageWorkbench: React.FC<TriageWorkbenchProps> = ({
  incident,
  onToggleAction,
  onAskInChat,
}) => {
  const [activeTab, setActiveTab] = useState<'structured' | 'actions' | 'diagnostics' | 'memory'>('structured');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const handleCopy = (command: string, id: string) => {
    navigator.clipboard.writeText(command);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const completedCount = incident.actionItems.filter(a => a.status === 'completed').length;
  const totalActions = incident.actionItems.length;

  const filteredCommands = incident.diagnosticCommands.filter(
    cmd => selectedCategory === 'all' || cmd.category === selectedCategory
  );

  const isLowConfidence =
    incident.confidenceAssessment?.isConfident === false ||
    (incident.rootCauses.length > 0 && incident.rootCauses[0].confidence < 60);

  // Group actions by priority
  const p1Actions = incident.actionItems.filter(a => a.priority === 'p1');
  const p2Actions = incident.actionItems.filter(a => a.priority === 'p2');
  const p3Actions = incident.actionItems.filter(a => a.priority === 'p3' || !a.priority);

  return (
    <div className="flex flex-col h-full bg-[#0E131F] border-l border-gray-800">
      {/* Tab Navigation */}
      <div className="flex items-center border-b border-gray-800 bg-[#0B0F19] px-2 text-xs font-medium overflow-x-auto">
        <button
          onClick={() => setActiveTab('structured')}
          className={`flex items-center space-x-1.5 py-3 px-3 border-b-2 transition-all flex-shrink-0 ${
            activeTab === 'structured'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Structured Triage</span>
          {isLowConfidence && (
            <span className="w-2 h-2 rounded-full bg-amber-400" title="Low confidence diagnosis" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('actions')}
          className={`flex items-center space-x-1.5 py-3 px-3 border-b-2 transition-all flex-shrink-0 ${
            activeTab === 'actions'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <ListTodo className="w-3.5 h-3.5" />
          <span>Troubleshooting Plan</span>
          <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 font-mono">
            {completedCount}/{totalActions}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`flex items-center space-x-1.5 py-3 px-3 border-b-2 transition-all flex-shrink-0 ${
            activeTab === 'diagnostics'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Diagnostics</span>
          <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/10 text-purple-400 font-mono">
            {incident.diagnosticCommands.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('memory')}
          className={`flex items-center space-x-1.5 py-3 px-3 border-b-2 transition-all flex-shrink-0 ${
            activeTab === 'memory'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Cross-Incident Memory</span>
        </button>
      </div>

      {/* Tab 1: 4-Stage Structured Triage */}
      {activeTab === 'structured' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Low Confidence / Ambiguity Guard Warning */}
          {isLowConfidence && (
            <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-2 text-xs">
              <div className="flex items-center space-x-2 text-amber-300 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Inconclusive Diagnosis (Low Confidence: {incident.confidenceAssessment?.primaryConfidence || '<60'}%)</span>
              </div>
              <p className="text-amber-200/90 leading-relaxed">
                {incident.confidenceAssessment?.ambiguityExplanation ||
                  'The submitted logs are ambiguous or lack explicit stack traces, preventing definitive root-cause identification.'}
              </p>

              {incident.confidenceAssessment?.missingTelemetry && (
                <div className="pt-2 border-t border-amber-500/20 space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                    Missing Telemetry to Confirm Root Cause:
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 text-amber-200/80 font-mono text-[11px]">
                    {incident.confidenceAssessment.missingTelemetry.map((t, idx) => (
                      <li key={idx}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Stage 1: Error Understanding */}
          <div className="p-4 rounded-xl bg-[#121826] border border-gray-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase font-bold text-blue-400 tracking-wider">
                Stage 1: Error Understanding
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono">
                {incident.errorUnderstanding?.affectedComponent || incident.service}
              </span>
            </div>

            <h4 className="text-xs sm:text-sm font-semibold text-gray-100">
              {incident.errorUnderstanding?.failureMechanism || incident.summary}
            </h4>

            {incident.errorUnderstanding?.extractedErrorCodes && incident.errorUnderstanding.extractedErrorCodes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {incident.errorUnderstanding.extractedErrorCodes.map((code, idx) => (
                  <span
                    key={idx}
                    className="font-mono text-[11px] px-2 py-0.5 rounded bg-[#090D15] border border-red-500/30 text-red-300"
                  >
                    {code}
                  </span>
                ))}
              </div>
            )}

            {incident.errorUnderstanding?.timeline && incident.errorUnderstanding.timeline.length > 0 && (
              <div className="pt-2 border-t border-gray-800/80 space-y-1">
                <span className="text-[11px] font-semibold text-gray-400">Chronological Failure Sequence:</span>
                <div className="space-y-1">
                  {incident.errorUnderstanding.timeline.map((step, idx) => (
                    <div key={idx} className="flex items-start space-x-2 text-[11px] text-gray-300 font-mono">
                      <span className="text-gray-500">{idx + 1}.</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Stage 2: Severity Categorization & Blast Radius */}
          <div className="p-4 rounded-xl bg-[#121826] border border-gray-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase font-bold text-amber-400 tracking-wider">
                Stage 2: Severity Categorization
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase font-mono ${
                  incident.severity === 'CRITICAL'
                    ? 'bg-red-500/15 text-red-400 border-red-500/30'
                    : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                }`}
              >
                {incident.severity}
              </span>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              {incident.severityAssessment?.justification || incident.blastRadius}
            </p>

            {incident.severityAssessment?.impactedAudiences && (
              <div className="pt-1 text-[11px] text-gray-400 flex items-center space-x-1.5">
                <span className="text-gray-500 font-semibold">Impacted Scope:</span>
                <span className="text-gray-300">{incident.severityAssessment.impactedAudiences.join(', ')}</span>
              </div>
            )}
          </div>

          {/* Stage 3: Root Cause Hypotheses */}
          <div className="space-y-3">
            <span className="text-[11px] font-mono uppercase font-bold text-purple-400 tracking-wider px-1">
              Stage 3: Root Cause Analysis (RCA)
            </span>

            {incident.rootCauses.map((rc, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-[#121826] border border-gray-800 space-y-2.5 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-xs sm:text-sm font-semibold text-gray-100 leading-snug">
                    {rc.hypothesis}
                  </h4>
                  <div className="flex flex-col items-end flex-shrink-0">
                    <span className="text-[11px] font-mono font-bold text-blue-400">
                      {rc.confidence}% Conf.
                    </span>
                    <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden mt-1">
                      <div
                        className={`h-full rounded-full transition-all ${
                          rc.confidence >= 80 ? 'bg-emerald-400' : rc.confidence >= 60 ? 'bg-blue-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${rc.confidence}%` }}
                      />
                    </div>
                  </div>
                </div>

                {rc.evidence && rc.evidence.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      Supporting Log Lines:
                    </span>
                    {rc.evidence.map((ev, i) => (
                      <div
                        key={i}
                        className="p-2 rounded bg-[#0A0D14] border border-gray-800 font-mono text-[11px] text-red-300/90 break-all"
                      >
                        {ev}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Stage 4 Preview Shortcut */}
          <button
            onClick={() => setActiveTab('actions')}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600/10 border border-blue-500/30 hover:bg-blue-600/20 text-blue-300 text-xs font-semibold flex items-center justify-between transition-colors"
          >
            <div className="flex items-center space-x-2">
              <ListTodo className="w-4 h-4 text-blue-400" />
              <span>View Prioritized Troubleshooting Plan (P1/P2/P3)</span>
            </div>
            <ArrowRight className="w-4 h-4 text-blue-400" />
          </button>
        </div>
      )}

      {/* Tab 2: Prioritized Troubleshooting Plan */}
      {activeTab === 'actions' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Prioritized by urgency (P1 Immediate Containment to P3 Fix)</span>
            <span className="font-mono text-gray-300">
              {completedCount} of {totalActions} done
            </span>
          </div>

          {/* Priority Groups */}
          {[
            { title: 'P1 - Immediate Containment (Stop Customer Impact)', items: p1Actions, color: 'text-red-400 border-red-500/20 bg-red-950/10' },
            { title: 'P2 - Diagnostic Verification (Confirm State)', items: p2Actions, color: 'text-purple-400 border-purple-500/20 bg-purple-950/10' },
            { title: 'P3 - Permanent Remediation (Prevent Recurrence)', items: p3Actions, color: 'text-blue-400 border-blue-500/20 bg-blue-950/10' },
          ].map(group => {
            if (group.items.length === 0) return null;
            return (
              <div key={group.title} className="space-y-2">
                <span className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border inline-block ${group.color}`}>
                  {group.title}
                </span>

                <div className="space-y-2">
                  {group.items.map(act => {
                    const isDone = act.status === 'completed';
                    return (
                      <div
                        key={act.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isDone
                            ? 'bg-[#0E1522]/60 border-emerald-900/40 text-gray-400'
                            : 'bg-[#121826] border-gray-800 text-gray-200 shadow-sm'
                        }`}
                      >
                        <div className="flex items-start space-x-2.5">
                          <button
                            onClick={() => onToggleAction(act.id, isDone ? 'pending' : 'completed')}
                            className="mt-0.5 flex-shrink-0 text-gray-400 hover:text-emerald-400 transition-colors"
                          >
                            {isDone ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Circle className="w-4 h-4 text-gray-500" />
                            )}
                          </button>

                          <div className="flex-1 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`text-xs font-semibold leading-relaxed ${
                                  isDone ? 'line-through text-gray-500' : 'text-gray-100'
                                }`}
                              >
                                {act.description}
                              </span>
                              <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-gray-800 text-gray-400 border border-gray-700">
                                {act.priority?.toUpperCase() || 'P1'}
                              </span>
                            </div>

                            {act.explanation && (
                              <p className="text-[11px] text-gray-400 leading-normal">
                                {act.explanation}
                              </p>
                            )}

                            {act.command && (
                              <div className="mt-2 rounded-lg bg-[#080B12] border border-gray-800 p-2 flex items-center justify-between font-mono text-xs">
                                <code className="text-blue-300 break-all pr-2">
                                  {act.command}
                                </code>
                                <button
                                  onClick={() => handleCopy(act.command!, act.id)}
                                  className="p-1 text-gray-400 hover:text-white transition-colors flex-shrink-0"
                                  title="Copy command"
                                >
                                  {copiedId === act.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 3: Diagnostic Commands */}
      {activeTab === 'diagnostics' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center space-x-1 overflow-x-auto pb-1 text-[11px]">
            {['all', 'kubernetes', 'database', 'network', 'logs', 'system'].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2 py-0.5 rounded uppercase font-mono transition-colors ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredCommands.map((cmd, i) => {
              const cmdId = `diag-${i}`;
              return (
                <div key={i} className="p-3 rounded-xl bg-[#121826] border border-gray-800 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-200">
                      {cmd.label}
                    </span>
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-gray-800 text-gray-400 border border-gray-700">
                      {cmd.category}
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-400">{cmd.explanation}</p>

                  <div className="rounded-lg bg-[#070A11] border border-gray-800 p-2.5 flex items-center justify-between font-mono text-xs">
                    <code className="text-emerald-400 break-all pr-2 leading-relaxed">
                      {cmd.command}
                    </code>
                    <button
                      onClick={() => handleCopy(cmd.command, cmdId)}
                      className="p-1 rounded bg-gray-800 text-gray-300 hover:text-white transition-colors flex-shrink-0"
                      title="Copy command"
                    >
                      {copiedId === cmdId ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 4: Cross-Incident Memory */}
      {activeTab === 'memory' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="text-xs text-gray-400 leading-relaxed">
            The assistant retains conversation context across sessions. It queries Durable Object SQLite storage to cross-reference previous incidents and compare failure patterns.
          </div>

          {incident.crossIncidentReferences && incident.crossIncidentReferences.length > 0 ? (
            <div className="space-y-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-400">
                Related Past Incidents Detected:
              </span>
              {incident.crossIncidentReferences.map((ref, i) => (
                <div key={i} className="p-3.5 rounded-xl bg-[#121826] border border-gray-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-semibold text-gray-100">{ref.relatedIncidentTitle}</h5>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {ref.similarityFactor}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-300">{ref.comparisonNote}</p>

                  {onAskInChat && (
                    <button
                      onClick={() => onAskInChat(`Compare this incident with our previous investigation: "${ref.relatedIncidentTitle}". What were the differences?`)}
                      className="mt-1 text-[11px] text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                    >
                      <span>Compare in Chat</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[#121826] border border-gray-800 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-semibold text-gray-200">
                <History className="w-4 h-4 text-blue-400" />
                <span>Cross-Incident Recall Active</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                You can ask questions referencing any previous investigation stored in the index.
              </p>
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Try asking:</span>
                {[
                  'How does this failure compare to our previous incident?',
                  'Did we experience a similar issue on this service before?',
                  'Compare the blast radius of this outage with our last critical incident',
                ].map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => onAskInChat && onAskInChat(q)}
                    className="w-full text-left p-2 rounded-lg bg-[#0A0D15] hover:bg-[#131A29] text-[11px] text-gray-300 border border-gray-800 transition-colors"
                  >
                    "{q}"
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
