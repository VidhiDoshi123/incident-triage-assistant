import React, { useState } from 'react';
import {
  X,
  BookOpen,
  ArrowRight,
  Server,
  Layers,
  Terminal,
  Zap,
} from 'lucide-react';
import type { IncidentPreset } from '../types';

interface PresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  presets: IncidentPreset[];
  onSelectPreset: (preset: IncidentPreset) => void;
}

export const PresetsModal: React.FC<PresetsModalProps> = ({
  isOpen,
  onClose,
  presets,
  onSelectPreset,
}) => {
  const [activePreset, setActivePreset] = useState<IncidentPreset>(presets[0]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl bg-[#0E131F] border border-gray-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#111827]/70">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-100">
                Production Incident Scenarios Library
              </h3>
              <p className="text-xs text-gray-400">
                Test the triage engine with authentic high-fidelity production failure logs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-column layout */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Left list (4 cols) */}
          <div className="md:col-span-5 border-r border-gray-800 overflow-y-auto p-3 space-y-2 bg-[#0B0F19]">
            {presets.map(p => {
              const isSelected = activePreset.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setActivePreset(p)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-[#151D2E] border-blue-500/60 shadow-sm shadow-blue-500/10'
                      : 'bg-gray-900/60 border-gray-800/80 text-gray-400 hover:border-gray-700 hover:bg-gray-800/40'
                  }`}
                >
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-gray-800 text-blue-400 border border-gray-700/60">
                    {p.category}
                  </span>
                  <h4 className="text-xs font-semibold text-gray-100 mt-1.5 leading-snug">
                    {p.name}
                  </h4>
                  <div className="flex items-center space-x-2 mt-1 text-[11px] text-gray-400 font-mono">
                    <Server className="w-3 h-3 text-gray-500" />
                    <span className="truncate">{p.service}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right preview (7 cols) */}
          <div className="md:col-span-7 flex flex-col h-full bg-[#0E131F] overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                  {activePreset.category}
                </span>
                <h3 className="text-base font-bold text-gray-100 mt-2">
                  {activePreset.name}
                </h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  {activePreset.description}
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-gray-300 flex items-center space-x-1.5">
                  <Terminal className="w-3.5 h-3.5 text-blue-400" />
                  <span>Log Sample Preview:</span>
                </span>
                <div className="rounded-lg bg-[#070A11] border border-gray-800 p-3 font-mono text-xs text-gray-200 overflow-x-auto max-h-60 leading-relaxed">
                  <pre>{activePreset.logs}</pre>
                </div>
              </div>
            </div>

            {/* Bottom Action */}
            <div className="p-4 border-t border-gray-800 bg-[#111827]/70 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                Will submit this scenario to Workers AI for root-cause diagnosis
              </span>
              <button
                onClick={() => {
                  onSelectPreset(activePreset);
                  onClose();
                }}
                className="flex items-center space-x-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition-all"
              >
                <Zap className="w-4 h-4" />
                <span>Launch Triage</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
