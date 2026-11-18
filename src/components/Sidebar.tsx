import React, { useState } from 'react';
import {
  Search,
  Filter,
  Trash2,
  Clock,
  Server,
  AlertOctagon,
  AlertTriangle,
  Info,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
} from 'lucide-react';
import type { IncidentHeader, Severity, IncidentStatus } from '../types';

interface SidebarProps {
  incidents: IncidentHeader[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

function formatTimeAgo(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  } catch {
    return 'Recently';
  }
}

export const Sidebar: React.FC<SidebarProps> = ({
  incidents,
  activeId,
  onSelect,
  onDelete,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | 'ALL'>('ALL');
  const [collapsed, setCollapsed] = useState(false);

  const filtered = incidents.filter(inc => {
    const matchesSearch =
      inc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.service.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.blastRadius.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSeverity =
      selectedSeverity === 'ALL' || inc.severity === selectedSeverity;

    return matchesSearch && matchesSeverity;
  });

  const getSeverityBadge = (sev: Severity) => {
    switch (sev) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
            <Flame className="w-2.5 h-2.5" />
            <span>CRIT</span>
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-2.5 h-2.5" />
            <span>HIGH</span>
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">
            <span>MED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <span>LOW</span>
          </span>
        );
    }
  };

  const getStatusDot = (status: IncidentStatus) => {
    switch (status) {
      case 'RESOLVED':
        return <span className="w-2 h-2 rounded-full bg-emerald-400 ring-4 ring-emerald-500/10" title="Resolved" />;
      case 'MITIGATED':
        return <span className="w-2 h-2 rounded-full bg-cyan-400 ring-4 ring-cyan-500/10" title="Mitigated" />;
      case 'IDENTIFIED':
        return <span className="w-2 h-2 rounded-full bg-amber-400 ring-4 ring-amber-500/10" title="Root cause identified" />;
      default:
        return <span className="w-2 h-2 rounded-full bg-red-400 ring-4 ring-red-500/10 animate-pulse" title="Active investigation" />;
    }
  };

  if (collapsed) {
    return (
      <aside className="w-14 border-r border-gray-800 bg-[#0B0F19] flex flex-col items-center py-4 space-y-4">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
          title="Expand sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="flex-1 w-full space-y-2 px-2 overflow-y-auto">
          {incidents.map(inc => (
            <button
              key={inc.id}
              onClick={() => onSelect(inc.id)}
              className={`w-full aspect-square rounded-lg flex flex-col items-center justify-center p-1 border transition-all ${
                activeId === inc.id
                  ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                  : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'
              }`}
              title={inc.title}
            >
              {getStatusDot(inc.status)}
            </button>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-80 border-r border-gray-800 bg-[#0B0F19] flex flex-col h-[calc(100vh-4rem)]">
      {/* Search & Collapse Header */}
      <div className="p-3 border-b border-gray-800/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Investigation History
            </span>
            <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-full bg-gray-800 text-gray-400 border border-gray-700/50">
              {incidents.length}
            </span>
          </div>
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800"
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search logs, services, titles..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-[#111827] border border-gray-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30"
          />
        </div>

        {/* Severity Filter Chips */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-0.5 text-[11px]">
          {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'] as const).map(sev => (
            <button
              key={sev}
              onClick={() => setSelectedSeverity(sev)}
              className={`px-2 py-0.5 rounded font-mono transition-colors ${
                selectedSeverity === sev
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Incident List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-800/40 p-2 space-y-1.5">
        {filtered.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-xs text-gray-500 mb-1">No incidents match filter</p>
            <p className="text-[11px] text-gray-600">
              Paste new logs to start an AI triage session.
            </p>
          </div>
        ) : (
          filtered.map(inc => {
            const isSelected = activeId === inc.id;
            return (
              <div
                key={inc.id}
                onClick={() => onSelect(inc.id)}
                className={`group relative p-3 rounded-lg border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#151D2E] border-blue-500/60 shadow-sm shadow-blue-500/10'
                    : 'bg-[#101623]/80 border-gray-800/70 hover:border-gray-700 hover:bg-[#131A2B]'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center space-x-2">
                    {getStatusDot(inc.status)}
                    {getSeverityBadge(inc.severity)}
                  </div>
                  <span className="text-[10px] text-gray-500 flex items-center font-mono">
                    <Clock className="w-2.5 h-2.5 mr-1" />
                    {formatTimeAgo(inc.updatedAt || inc.createdAt)}
                  </span>
                </div>

                <h4 className="text-xs font-semibold text-gray-200 line-clamp-2 leading-relaxed mb-1.5 group-hover:text-blue-300 transition-colors">
                  {inc.title}
                </h4>

                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span className="flex items-center font-mono text-gray-400 truncate max-w-[170px]">
                    <Server className="w-3 h-3 mr-1 text-gray-500 flex-shrink-0" />
                    {inc.service}
                  </span>

                  <button
                    onClick={e => onDelete(inc.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 rounded hover:bg-gray-800 transition-all"
                    title="Delete incident"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
