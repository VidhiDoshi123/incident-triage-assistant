import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { IncidentBanner } from './components/IncidentBanner';
import { ChatTimeline } from './components/ChatTimeline';
import { TriageWorkbench } from './components/TriageWorkbench';
import { NewIncidentModal } from './components/NewIncidentModal';
import { PresetsModal } from './components/PresetsModal';
import { ExportModal } from './components/ExportModal';
import { api } from './services/api';
import type {
  IncidentHeader,
  IncidentRecord,
  IncidentPreset,
  IncidentStatus,
  Environment,
} from './types';
import {
  ShieldAlert,
  Sparkles,
  Terminal,
  Server,
  Zap,
  ArrowRight,
  Flame,
  CheckCircle,
} from 'lucide-react';

export function App() {
  const [incidents, setIncidents] = useState<IncidentHeader[]>([]);
  const [activeIncident, setActiveIncident] = useState<IncidentRecord | null>(null);
  const [presets, setPresets] = useState<IncidentPreset[]>([]);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isPresetsModalOpen, setIsPresetsModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [mobileTab, setMobileTab] = useState<'chat' | 'workbench'>('chat');

  // Initial load
  useEffect(() => {
    async function init() {
      try {
        const [presetList, incidentList] = await Promise.all([
          api.getPresets(),
          api.getIncidents(),
        ]);
        setPresets(presetList);
        setIncidents(incidentList);

        if (incidentList.length > 0) {
          const first = await api.getIncident(incidentList[0].id);
          if (first) setActiveIncident(first);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setInitialLoading(false);
      }
    }
    init();
  }, []);

  const handleSelectIncident = async (id: string) => {
    try {
      const inc = await api.getIncident(id);
      if (inc) {
        setActiveIncident(inc);
      }
    } catch (err) {
      console.error('Failed to load incident', err);
    }
  };

  const handleCreateIncident = async (data: {
    logs: string;
    description?: string;
    service?: string;
    environment?: Environment;
    title?: string;
  }) => {
    const created = await api.createAndTriage(data);
    setActiveIncident(created);

    // Refresh list
    const updatedList = await api.getIncidents();
    setIncidents(updatedList);
  };

  const handleSelectPreset = async (preset: IncidentPreset) => {
    await handleCreateIncident({
      title: preset.name,
      service: preset.service,
      environment: preset.environment,
      description: preset.description,
      logs: preset.logs,
    });
  };

  const handleSendMessage = async (text: string) => {
    if (!activeIncident) return;
    setChatLoading(true);
    try {
      const res = await api.sendChatMessage(activeIncident.id, text);
      setActiveIncident(res.incident);

      // Update incident in list
      setIncidents(prev =>
        prev.map(i =>
          i.id === activeIncident.id
            ? { ...i, updatedAt: res.incident.updatedAt }
            : i
        )
      );
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setChatLoading(false);
    }
  };

  const handleToggleAction = async (actionId: string, status: 'pending' | 'completed') => {
    if (!activeIncident) return;
    try {
      const updated = await api.toggleAction(activeIncident.id, actionId, status);
      setActiveIncident(updated);
    } catch (err) {
      console.error('Failed to toggle action:', err);
    }
  };

  const handleStatusChange = async (status: IncidentStatus) => {
    if (!activeIncident) return;
    try {
      const updated = await api.updateStatus(activeIncident.id, status);
      setActiveIncident(updated);
      setIncidents(prev =>
        prev.map(i => (i.id === activeIncident.id ? { ...i, status } : i))
      );
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleDeleteIncident = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this incident investigation?')) return;

    try {
      await api.deleteIncident(id);
      const remaining = incidents.filter(i => i.id !== id);
      setIncidents(remaining);
      if (activeIncident?.id === id) {
        if (remaining.length > 0) {
          handleSelectIncident(remaining[0].id);
        } else {
          setActiveIncident(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete incident:', err);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0B0F19] text-gray-100 overflow-hidden font-sans">
      {/* Top Header */}
      <Header
        activeIncident={activeIncident}
        onNewIncident={() => setIsNewModalOpen(true)}
        onOpenPresets={() => setIsPresetsModalOpen(true)}
        onOpenExport={() => setIsExportModalOpen(true)}
      />

      {/* Main Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Incident History & Search */}
        <Sidebar
          incidents={incidents}
          activeId={activeIncident?.id || null}
          onSelect={handleSelectIncident}
          onDelete={handleDeleteIncident}
        />

        {/* Center & Right Triage Workspace */}
        {activeIncident ? (
          <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#0B0F19]">
            {/* Top Incident Header Banner */}
            <IncidentBanner
              incident={activeIncident}
              onStatusChange={handleStatusChange}
            />

            {/* Mobile Tab Switcher (< lg) */}
            <div className="lg:hidden flex border-b border-gray-800 bg-[#0E131F]">
              <button
                onClick={() => setMobileTab('chat')}
                className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors ${
                  mobileTab === 'chat'
                    ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                Chat Timeline
              </button>
              <button
                onClick={() => setMobileTab('workbench')}
                className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors ${
                  mobileTab === 'workbench'
                    ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                Triage Workbench ({activeIncident.actionItems.length} actions)
              </button>
            </div>

            {/* Split View: Chat Timeline (Left) & DevOps Workbench (Right) */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
              {/* Left / Center: Interactive AI Chat Timeline (7 cols) */}
              <section
                className={`lg:col-span-7 h-full flex-col overflow-hidden border-r border-gray-800 ${
                  mobileTab === 'chat' ? 'flex' : 'hidden lg:flex'
                }`}
              >
                <ChatTimeline
                  messages={activeIncident.messages}
                  onSendMessage={handleSendMessage}
                  loading={chatLoading}
                />
              </section>

              {/* Right: Root Causes & Action Runbook (5 cols) */}
              <section
                className={`lg:col-span-5 h-full flex-col overflow-hidden bg-[#0E131F] ${
                  mobileTab === 'workbench' ? 'flex' : 'hidden lg:flex'
                }`}
              >
                <TriageWorkbench
                  incident={activeIncident}
                  onToggleAction={handleToggleAction}
                  onAskInChat={handleSendMessage}
                />
              </section>
            </div>
          </main>
        ) : (
          /* Empty State / Welcome Screen */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#0B0F19] overflow-y-auto">
            <div className="max-w-xl space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center mx-auto shadow-xl shadow-blue-500/20">
                <ShieldAlert className="w-8 h-8 text-white" />
              </div>

              <div>
                <h2 className="text-2xl font-bold tracking-tight text-gray-100">
                  AI-Powered Incident Triage Assistant
                </h2>
                <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                  Paste error logs or select a production incident scenario. Our SRE copilot uses
                  Cloudflare Workers AI and Durable Objects to diagnose root causes and generate
                  immediate mitigation steps.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setIsNewModalOpen(true)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 transition-all"
                >
                  <Terminal className="w-4 h-4" />
                  <span>Paste Logs & Triage</span>
                </button>

                <button
                  onClick={() => setIsPresetsModalOpen(true)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-semibold border border-gray-700 flex items-center justify-center space-x-2 transition-all"
                >
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <span>Browse Scenarios Library</span>
                </button>
              </div>

              {/* Quick Preset Cards */}
              <div className="pt-6 border-t border-gray-800/80">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Or launch a pre-configured production failure:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                  {presets.slice(0, 4).map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPreset(p)}
                      className="p-3 rounded-lg bg-[#111827] border border-gray-800 hover:border-gray-700 hover:bg-[#151E30] transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-200 group-hover:text-blue-300">
                          {p.name}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-blue-400 transform group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <p className="text-[11px] text-gray-400 font-mono mt-1 truncate">
                        {p.service} • {p.category}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <NewIncidentModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSubmit={handleCreateIncident}
        presets={presets}
      />

      <PresetsModal
        isOpen={isPresetsModalOpen}
        onClose={() => setIsPresetsModalOpen(false)}
        presets={presets}
        onSelectPreset={handleSelectPreset}
      />

      {activeIncident && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          incident={activeIncident}
        />
      )}
    </div>
  );
}

export default App;
