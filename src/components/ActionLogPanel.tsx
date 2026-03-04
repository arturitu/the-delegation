import React, { useEffect, useRef, useState } from 'react'
import { useAgencyStore } from '../store/agencyStore'
import { AGENTS } from '../data/agents'
import { Download, Filter } from 'lucide-react'
import { DebugEntryView, formatTime } from './DebugEntryView'

export function ActionLogPanel() {
  const { setLogOpen, actionLog, debugLog, logFilterAgentIndex, phase, setFinalOutputOpen } = useAgencyStore()
  const [activeTab, setActiveTab] = useState<'activity' | 'technical'>('activity')
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)

  const handleDownloadAll = () => {
    const content = debugLog.map(entry => {
      const agent = AGENTS.find(a => a.index === entry.agentIndex);
      return `
=========================================
AGENT: ${agent?.role} (${entry.phase})
TIME: ${new Date(entry.timestamp).toLocaleString()}
PHASE: ${entry.phase}
=========================================

SYSTEM PROMPT:
${entry.systemPrompt}

-----------------------------------------
DYNAMIC CONTEXT:
${entry.dynamicContext}

-----------------------------------------
${entry.phase === 'request' ? 'REQUEST MESSAGE' : 'RAW RESPONSE'}:
${entry.rawContent}

`.trim();
    }).join('\n\n\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `embodied-agency-technical-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Auto-scroll to top when a new log entry arrives (since order is reversed)
  useEffect(() => {
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [actionLog, debugLog, activeTab])

  const filterAgent =
    logFilterAgentIndex !== null ? AGENTS.find(a => a.index === logFilterAgentIndex) ?? null : null

  const entries =
    logFilterAgentIndex !== null
      ? actionLog.filter((e) => e.agentIndex === logFilterAgentIndex).reverse()
      : [...actionLog].reverse()

  const debugEntries =
    logFilterAgentIndex !== null
      ? debugLog.filter((e) => e.agentIndex === logFilterAgentIndex).reverse()
      : [...debugLog].reverse()

  return (
    <div className="w-[320px] h-full bg-white border-r border-zinc-100 flex flex-col pointer-events-auto overflow-hidden shrink-0 relative">
          {/* Header */}
          <div className="h-10 px-5 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0 z-10">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Logs</span>
              {filterAgent && (
                <div
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold text-white uppercase tracking-tighter animate-in fade-in zoom-in duration-200"
                  style={{ backgroundColor: filterAgent.color }}
                >
                  {filterAgent.role}
                  <button
                    onClick={() => setLogOpen(true, null)}
                    className="hover:scale-110 transition-transform cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                  className={`p-1.5 rounded transition-colors cursor-pointer ${
                    isFilterMenuOpen || logFilterAgentIndex !== null
                      ? 'bg-zinc-900 text-white'
                      : 'text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50'
                  }`}
                  title="Filter by agent"
                >
                  <Filter size={14} />
                </button>

                {isFilterMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setIsFilterMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-zinc-100 rounded-xl shadow-xl z-30 py-1.5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      <button
                        onClick={() => {
                          setLogOpen(true, null);
                          setIsFilterMenuOpen(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-50 transition-colors ${
                          logFilterAgentIndex === null ? 'text-zinc-900' : 'text-zinc-400'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${logFilterAgentIndex === null ? 'bg-zinc-900' : 'bg-transparent border border-zinc-200'}`} />
                        All Agents
                      </button>
                      <div className="h-px bg-zinc-50 my-1" />
                      {AGENTS.map((agent) => (
                        <button
                          key={agent.index}
                          onClick={() => {
                            setLogOpen(true, agent.index);
                            setIsFilterMenuOpen(false);
                          }}
                          className={`w-full px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-50 transition-colors ${
                            logFilterAgentIndex === agent.index ? 'text-zinc-900' : 'text-zinc-400'
                          }`}
                        >
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: agent.color }}
                          />
                          {agent.role}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {activeTab === 'technical' && debugEntries.length > 0 && (
                <button
                  onClick={handleDownloadAll}
                  className="text-zinc-400 hover:text-zinc-900 transition-colors p-1 rounded hover:bg-zinc-50 cursor-pointer"
                  title="Download all as .txt"
                >
                  <Download size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex border-b border-zinc-100 bg-zinc-50/30">
            <button
                onClick={() => setActiveTab('activity')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                    activeTab === 'activity' ? 'bg-white border-b-2 border-zinc-900 text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
                }`}
            >
                Activity
            </button>
            <button
                onClick={() => setActiveTab('technical')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                    activeTab === 'technical' ? 'bg-white border-b-2 border-zinc-900 text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
                }`}
            >
                Technical
            </button>
          </div>

          {/* Project Done Action - Only show in Activity tab */}
          {activeTab === 'activity' && phase === 'done' && (
            <div className="px-5 py-4 bg-amber-50 border-b border-amber-100 flex flex-col gap-2">
              <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest leading-none">
                Final Delivery Ready
              </p>
              <button
                onClick={() => setFinalOutputOpen(true)}
                className="w-full py-2.5 bg-amber-400 text-black rounded-lg text-xs font-black uppercase tracking-widest hover:bg-amber-500 active:scale-[0.98] transition-all shadow-sm cursor-pointer"
              >
                View Project Output
              </button>
            </div>
          )}

          {/* Entries */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 shadow-[inset_0_-20px_20px_-20px_rgba(0,0,0,0.05)]">
            <div ref={topRef} />

            {activeTab === 'activity' ? (
              entries.length === 0 ? (
                <p className="text-zinc-300 text-[10px] font-bold uppercase tracking-widest text-center py-16">Awaiting actions...</p>
              ) : (
                entries.map((entry) => {
                  const agent = AGENTS[entry.agentIndex]
                  return (
                    <div key={entry.id} className="flex flex-col gap-1.5 group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-1.5 h-1.5 rounded-full shadow-sm"
                            style={{ backgroundColor: agent?.color ?? '#e4e4e7' }}
                          />
                          <span className="text-[10px] font-black text-zinc-900 uppercase tracking-widest leading-none">
                            {agent?.role ?? 'System'}
                          </span>
                        </div>
                        <span className="text-[9px] font-medium text-zinc-400 font-mono">
                          {formatTime(entry.timestamp)}
                        </span>
                      </div>

                      <div className="pl-3.5 border-l border-zinc-50 group-hover:border-zinc-200 transition-colors">
                        <p className="text-xs text-zinc-600 leading-relaxed font-medium">
                          {entry.action}
                        </p>
                      </div>
                    </div>
                  )
                })
              )
            ) : (
                debugEntries.length === 0 ? (
                    <p className="text-zinc-300 text-[10px] font-bold uppercase tracking-widest text-center py-16">No technical data...</p>
                ) : (
                    debugEntries.map((entry) => (
                        <DebugEntryView key={entry.id} entry={entry} />
                    ))
                )
            )}
          </div>
    </div>
  )
}
