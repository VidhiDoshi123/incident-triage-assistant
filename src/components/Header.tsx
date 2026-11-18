import React from 'react';
import {
  Activity,
  Plus,
  FileDown,
  Sparkles,
  BookOpen,
  Cpu,
  ShieldAlert,
} from 'lucide-react';
import type { IncidentRecord } from '../types';

interface HeaderProps {
  activeIncident: IncidentRecord | null;
  onNewIncident: () => void;
  onOpenPresets: () => void;
  onOpenExport: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeIncident,
  onNewIncident,
  onOpenPresets,
  onOpenExport,
}) => {
  return (
    <header className="h-16 border-b border-gray-800 bg-[#0E131F]/90 backdrop-blur-md px-5 flex items-center justify-between sticky top-0 z-30">
      {/* Brand & Active Context */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-gray-100 tracking-tight text-base font-mono">
                Incident<span className="text-blue-400">Lens</span>
              </span>
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                AI SRE Copilot
              </span>
            </div>
            <p className="text-xs text-gray-400 hidden sm:block">
              Edge Triage • Workers AI • Durable Objects
            </p>
          </div>
        </div>

        {activeIncident && (
          <div className="hidden lg:flex items-center space-x-2 pl-4 border-l border-gray-800">
            <span className="text-xs text-gray-500">Active Incident:</span>
            <span className="text-xs font-medium text-gray-300 max-w-xs truncate font-mono">
              {activeIncident.title}
            </span>
          </div>
        )}
      </div>

      {/* Cloudflare Runtime Beacon & Actions */}
      <div className="flex items-center space-x-3">
        {/* Runtime Status Pill */}
        <div className="hidden md:flex items-center space-x-2 px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-mono text-[11px]">Workers AI Online</span>
        </div>

        {/* Presets Modal Trigger */}
        <button
          onClick={onOpenPresets}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-gray-800/80 hover:bg-gray-700/80 text-gray-300 text-xs font-medium border border-gray-700/60 transition-all hover:text-white"
          title="Sample Incidents Library"
        >
          <BookOpen className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden sm:inline">Incident Presets</span>
        </button>

        {/* Export Post-Mortem */}
        {activeIncident && (
          <button
            onClick={onOpenExport}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-gray-800/80 hover:bg-gray-700/80 text-gray-300 text-xs font-medium border border-gray-700/60 transition-all hover:text-white"
            title="Export Post-Mortem Report"
          >
            <FileDown className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Post-Mortem</span>
          </button>
        )}

        {/* New Incident Primary Action */}
        <button
          onClick={onNewIncident}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Triage</span>
        </button>
      </div>
    </header>
  );
};
