import React, { useEffect, useRef } from 'react'
import { useAgencyStore } from '../store/agencyStore'
import { AGENTS } from '../data/agents'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function ActionLogPanel() {
  const { setLogOpen, actionLog, logFilterAgentIndex, phase, setFinalOutputOpen } = useAgencyStore()
  const topRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to top when a new log entry arrives (since order is reversed)
  useEffect(() => {
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [actionLog])

  const filterAgent =
    logFilterAgentIndex !== null ? AGENTS[logFilterAgentIndex] ?? null : null

  const entries =
    logFilterAgentIndex !== null
      ? actionLog.filter((e) => e.agentIndex === logFilterAgentIndex).reverse()
      : [...actionLog].reverse()

  return (
    <div className="w-[320px] h-full bg-white border-r border-zinc-100 flex flex-col pointer-events-auto overflow-hidden shrink-0 relative">
          {/* Header */}
          <div className="h-10 px-5 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0 z-10">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Activity Log</span>
              {filterAgent && (
                <div
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold text-white uppercase tracking-tighter"
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
          </div>

          {/* Project Done Action */}
          {phase === 'done' && (
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
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div ref={topRef} />
            {entries.length === 0 ? (
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
            )}
          </div>
    </div>
  )
}
