import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Terminal,
  Server,
  Layers,
  FileCode,
  Zap,
  Flame,
  CheckCircle,
} from 'lucide-react';
import type { IncidentPreset, Environment } from '../types';

interface NewIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    logs: string;
    description?: string;
    service?: string;
    environment?: Environment;
    title?: string;
  }) => Promise<void>;
  presets: IncidentPreset[];
}

export const NewIncidentModal: React.FC<NewIncidentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  presets,
}) => {
  const [logs, setLogs] = useState('');
  const [description, setDescription] = useState('');
  const [service, setService] = useState('auth-service');
  const [environment, setEnvironment] = useState<Environment>('production');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: IncidentPreset) => {
    setSelectedPresetId(preset.id);
    setTitle(preset.name);
    setService(preset.service);
    setEnvironment(preset.environment);
    setDescription(preset.description);
    setLogs(preset.logs);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logs.trim()) return;

    setLoading(true);
    try {
      await onSubmit({
        logs,
        description: description.trim() || undefined,
        service: service.trim() || 'unknown-service',
        environment,
        title: title.trim() || undefined,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl bg-[#0E131F] border border-gray-800 rounded-xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#111827]/70">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-100">
                New Incident Triage Session
              </h3>
              <p className="text-xs text-gray-400">
                Paste raw logs or stack traces for Workers AI root cause diagnosis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Quick Presets Carousel */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
              Or Choose a Pre-configured Production Scenario:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {presets.map(p => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => handleApplyPreset(p)}
                  className={`text-left p-2.5 rounded-lg border text-xs transition-all ${
                    selectedPresetId === p.id
                      ? 'bg-blue-950/40 border-blue-500 text-blue-200'
                      : 'bg-gray-900/60 border-gray-800 text-gray-300 hover:border-gray-700 hover:bg-gray-800/50'
                  }`}
                >
                  <div className="font-semibold text-gray-200 truncate flex items-center justify-between">
                    <span>{p.name}</span>
                    {selectedPresetId === p.id && (
                      <CheckCircle className="w-3.5 h-3.5 text-blue-400 ml-1 flex-shrink-0" />
                    )}
                  </div>
                  <div className="text-[11px] text-gray-400 truncate mt-0.5 font-mono">
                    {p.service} • {p.category}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Service & Environment Config */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Affected Service
              </label>
              <div className="relative">
                <Server className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={service}
                  onChange={e => setService(e.target.value)}
                  placeholder="e.g. auth-api"
                  className="w-full bg-[#111827] border border-gray-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500/60"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Environment
              </label>
              <select
                value={environment}
                onChange={e => setEnvironment(e.target.value as Environment)}
                className="w-full bg-[#111827] border border-gray-800 rounded-md px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500/60"
              >
                <option value="production">Production</option>
                <option value="canary">Canary</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Incident Title (Optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="AI will auto-generate if blank"
                className="w-full bg-[#111827] border border-gray-800 rounded-md px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500/60"
              />
            </div>
          </div>

          {/* Context / Symptoms */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Observed Symptoms & Context
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Users getting 502s during checkout, pod restarts spiking"
              className="w-full bg-[#111827] border border-gray-800 rounded-md px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500/60"
            />
          </div>

          {/* Application Logs Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-300 flex items-center space-x-1.5">
                <Terminal className="w-3.5 h-3.5 text-blue-400" />
                <span>Application Logs / Stack Traces</span>
              </label>
              <span className="text-[11px] font-mono text-gray-500">
                {logs.length > 0 ? `${logs.split('\n').length} lines • ${logs.length} chars` : 'Empty'}
              </span>
            </div>
            <textarea
              required
              rows={9}
              value={logs}
              onChange={e => setLogs(e.target.value)}
              placeholder="Paste raw server logs, Kubernetes events, Docker output, or stack traces here..."
              className="w-full bg-[#080B12] border border-gray-800 rounded-md p-3 font-mono text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 leading-relaxed resize-y"
            />
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-md bg-gray-800 text-gray-300 text-xs font-medium hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !logs.trim()}
              className="flex items-center space-x-2 px-5 py-2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Analyzing with Workers AI...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Start AI Triage</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
