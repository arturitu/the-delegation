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
  const { setLogOpen, actionLog, logFilterAgentIndex } = useAgencyStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest entry whenever a new log entry arrives
  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [actionLog])

  const filterAgent =
    logFilterAgentIndex !== null ? AGENTS[logFilterAgentIndex] ?? null : null

  const entries =
    logFilterAgentIndex !== null
      ? actionLog.filter((e) => e.agentIndex === logFilterAgentIndex)
      : actionLog

  const accentColor = filterAgent?.color ?? '#a1a1aa'

  return (
    <div className="w-[320px] h-full bg-white border-r border-zinc-100 shadow-2xl flex flex-col pointer-events-auto overflow-hidden shrink-0">
          {/* Color accent bar */}
          <div
            className="absolute top-0 left-0 w-full h-1.5 z-20 transition-colors duration-500"
            style={{ backgroundColor: accentColor }}
          />

          {/* Header */}
          <div className="px-8 py-6 border-b border-zinc-100 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10">
            <div>
              <h2 className="text-xl font-black text-zinc-900 tracking-tight">Log</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right flex flex-col items-end">
                {filterAgent ? (
                  <>
                    <p
                      className="text-[9px] font-black uppercase tracking-widest"
                      style={{ color: accentColor }}
                    >
                      {filterAgent.department ?? 'Agent'}
                    </p>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-zinc-900 leading-tight">{filterAgent.role}</h3>
                      <button
                        onClick={() => setLogOpen(true, null)}
                        className="text-[8px] font-bold text-zinc-400 hover:text-zinc-700 transition-colors uppercase tracking-widest border border-zinc-200 rounded-full px-1.5 py-0.5 cursor-pointer"
                      >
                        All
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">All agents</p>
                )}
              </div>
              <button
                onClick={() => setLogOpen(false)}
                className="text-zinc-300 hover:text-zinc-600 transition-colors text-base leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Entries */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:display-none">
            {entries.length === 0 && (
              <p className="text-zinc-300 text-sm text-center py-16 font-medium">No actions yet.</p>
            )}
            {entries.map((entry) => {
              const agent = AGENTS[entry.agentIndex]
              return (
                <div key={entry.id} className="flex items-start gap-3">
                  <span className="text-zinc-300 text-[10px] shrink-0 font-mono pt-0.5">
                    {formatTime(entry.timestamp)}
                  </span>
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: agent?.color ?? '#999' }}
                      />
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                        {agent?.role ?? 'System'}
                      </span>
                    </div>
                    <p className="text-zinc-700 text-sm leading-relaxed">{entry.action}</p>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
    </div>
  )
}
