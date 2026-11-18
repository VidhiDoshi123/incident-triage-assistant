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
  ExternalLink,
  Flame,
  Wrench,
  Search,
} from 'lucide-react';
import type { IncidentRecord, ActionItem } from '../types';

interface TriageWorkbenchProps {
  incident: IncidentRecord;
  onToggleAction: (actionId: string, status: 'pending' | 'completed') => Promise<void>;
}

export const TriageWorkbench: React.FC<TriageWorkbenchProps> = ({
  incident,
  onToggleAction,
}) => {
  const [activeTab, setActiveTab] = useState<'root-causes' | 'actions' | 'diagnostics'>('root-causes');
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

  return (
    <div className="flex flex-col h-full bg-[#0E131F] border-l border-gray-800">
      {/* Workbench Tab Navigation */}
      <div className="flex items-center border-b border-gray-800 bg-[#0B0F19] px-2 text-xs font-medium">
        <button
          onClick={() => setActiveTab('root-causes')}
          className={`flex items-center space-x-1.5 py-3 px-3 border-b-2 transition-all ${
            activeTab === 'root-causes'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Root Causes</span>
          <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500/10 text-blue-400 font-mono">
            {incident.rootCauses.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('actions')}
          className={`flex items-center space-x-1.5 py-3 px-3 border-b-2 transition-all ${
            activeTab === 'actions'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <ListTodo className="w-3.5 h-3.5" />
          <span>Action Items</span>
          <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 font-mono">
            {completedCount}/{totalActions}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`flex items-center space-x-1.5 py-3 px-3 border-b-2 transition-all ${
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
      </div>

      {/* Tab 1: Root Causes */}
      {activeTab === 'root-causes' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="text-xs text-gray-400">
            Workers AI identified the following probable failure modes and contributing factors:
          </div>

          {incident.rootCauses.map((rc, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-[#121826] border border-gray-800 shadow-sm space-y-3"
            >
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
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${rc.confidence}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Evidence from logs */}
              {rc.evidence && rc.evidence.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Log Evidence:
                  </span>
                  <div className="space-y-1">
                    {rc.evidence.map((ev, i) => (
                      <div
                        key={i}
                        className="p-2 rounded bg-[#0A0D14] border border-gray-800/80 font-mono text-[11px] text-red-300/90 leading-relaxed break-all"
                      >
                        {ev}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contributing factors */}
              {rc.contributingFactors && rc.contributingFactors.length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Contributing Factors:
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 text-xs text-gray-300">
                    {rc.contributingFactors.map((cf, i) => (
                      <li key={i}>{cf}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}

          {/* Incident Summary Card */}
          <div className="p-3.5 rounded-lg bg-[#111724] border border-gray-800/80 text-xs space-y-1.5">
            <span className="font-semibold text-gray-300 flex items-center space-x-1">
              <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
              <span>SRE Incident Assessment</span>
            </span>
            <p className="text-gray-400 leading-relaxed">
              {incident.summary}
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: Action Items & Runbook */}
      {activeTab === 'actions' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Remediation checklist persisted to Durable Object</span>
            <span className="font-mono text-gray-300">
              {completedCount} of {totalActions} done
            </span>
          </div>

          <div className="space-y-2.5">
            {incident.actionItems.map(act => {
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
                      onClick={() =>
                        onToggleAction(act.id, isDone ? 'pending' : 'completed')
                      }
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
                        <span
                          className={`text-[10px] font-mono uppercase px-1.5 py-0.2 rounded border ${
                            act.type === 'immediate_mitigation'
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : act.type === 'diagnostic'
                              ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}
                        >
                          {act.type.replace('_', ' ')}
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
      )}

      {/* Tab 3: Diagnostic Commands */}
      {activeTab === 'diagnostics' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Category Filter */}
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
                <div
                  key={i}
                  className="p-3 rounded-xl bg-[#121826] border border-gray-800 space-y-2 shadow-sm"
                >
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
                      className="p-1 rounded bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors flex-shrink-0"
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
    </div>
  );
};
