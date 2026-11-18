import React from 'react';
import {
  Flame,
  AlertTriangle,
  Server,
  Layers,
  Activity,
  Gauge,
  Clock,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';
import type { IncidentRecord, IncidentStatus, Severity } from '../types';

interface IncidentBannerProps {
  incident: IncidentRecord;
  onStatusChange: (status: IncidentStatus) => Promise<void>;
}

export const IncidentBanner: React.FC<IncidentBannerProps> = ({
  incident,
  onStatusChange,
}) => {
  const getSeverityStyle = (sev: Severity) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-red-500/15 text-red-400 border-red-500/30';
      case 'HIGH':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'MEDIUM':
        return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30';
      default:
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    }
  };

  const getStatusColor = (status: IncidentStatus) => {
    switch (status) {
      case 'RESOLVED':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'MITIGATED':
        return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
      case 'IDENTIFIED':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      default:
        return 'text-red-400 bg-red-500/10 border-red-500/30';
    }
  };

  return (
    <div className="bg-[#0E131F] border-b border-gray-800 p-4 space-y-3">
      {/* Top row: Title, Severity, Status selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <span
            className={`px-2 py-0.5 rounded text-xs font-bold border uppercase tracking-wider font-mono flex items-center space-x-1 ${getSeverityStyle(
              incident.severity
            )}`}
          >
            {incident.severity === 'CRITICAL' && <Flame className="w-3 h-3 mr-1" />}
            {incident.severity === 'HIGH' && <AlertTriangle className="w-3 h-3 mr-1" />}
            <span>{incident.severity}</span>
          </span>

          <h2 className="text-base sm:text-lg font-bold text-gray-100 tracking-tight leading-snug">
            {incident.title}
          </h2>
        </div>

        {/* Status Dropdown */}
        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <span className="text-xs text-gray-400">Status:</span>
          <select
            value={incident.status}
            onChange={e => onStatusChange(e.target.value as IncidentStatus)}
            className={`text-xs font-semibold px-2.5 py-1 rounded border focus:outline-none transition-all cursor-pointer ${getStatusColor(
              incident.status
            )}`}
          >
            <option value="INVESTIGATING">INVESTIGATING</option>
            <option value="IDENTIFIED">IDENTIFIED</option>
            <option value="MITIGATED">MITIGATED</option>
            <option value="RESOLVED">RESOLVED</option>
          </select>
        </div>
      </div>

      {/* Metadata bar & Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-gray-800/60 text-xs">
        <div className="flex items-center space-x-1.5 text-gray-400">
          <Server className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-gray-500">Service:</span>
          <span className="font-mono text-gray-200">{incident.service}</span>
        </div>

        <div className="flex items-center space-x-1.5 text-gray-400">
          <Layers className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-gray-500">Environment:</span>
          <span className="font-mono text-gray-200 uppercase text-[11px] px-1 rounded bg-gray-800 border border-gray-700">
            {incident.environment}
          </span>
        </div>

        <div className="flex items-center space-x-1.5 text-gray-400">
          <Activity className="w-3.5 h-3.5 text-red-400" />
          <span className="text-gray-500">Error Rate:</span>
          <span className="font-mono text-red-300 font-semibold">
            {incident.metrics?.errorRate || 'Elevated'}
          </span>
        </div>

        <div className="flex items-center space-x-1.5 text-gray-400">
          <Gauge className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-gray-500">p99 Latency:</span>
          <span className="font-mono text-yellow-200">
            {incident.metrics?.p99Latency || 'Degraded'}
          </span>
        </div>
      </div>

      {/* Blast Radius Alert */}
      {incident.blastRadius && (
        <div className="p-2.5 rounded-md bg-amber-950/20 border border-amber-500/20 text-xs text-amber-200 flex items-start space-x-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-300">Blast Radius: </span>
            <span className="text-amber-200/90">{incident.blastRadius}</span>
          </div>
        </div>
      )}
    </div>
  );
};
