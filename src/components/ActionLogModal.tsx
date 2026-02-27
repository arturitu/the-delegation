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

export function ActionLogModal() {
  const { isLogOpen, setLogOpen, actionLog, logFilterAgentIndex } = useAgencyStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest entry
  useEffect(() => {
    if (isLogOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [actionLog, isLogOpen])

  if (!isLogOpen) return null

  const filterAgent =
    logFilterAgentIndex !== null ? AGENTS[logFilterAgentIndex] ?? null : null

  const entries =
    logFilterAgentIndex !== null
      ? actionLog.filter((e) => e.agentIndex === logFilterAgentIndex)
      : actionLog

  return (
    <>
      {/* Transparent backdrop — click outside to close */}
      <div className="fixed inset-0 z-40" onClick={() => setLogOpen(false)} />

      {/* Panel anchored top-right below header */}
      <div
        className="fixed top-24 right-8 z-50 bg-white border border-black/8 rounded-2xl shadow-2xl flex flex-col w-96 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-7rem)] pointer-events-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/5">
          <div className="flex items-center gap-2">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Action Log</h2>
            {filterAgent && (
              <span
                className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: filterAgent.color + '18',
                  color: filterAgent.color,
                  border: `1px solid ${filterAgent.color}30`,
                }}
              >
                {filterAgent.role}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {logFilterAgentIndex !== null && (
              <button
                onClick={() => setLogOpen(true, null)}
                className="text-[10px] text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                Show all
              </button>
            )}
            <button
              onClick={() => setLogOpen(false)}
              className="text-zinc-300 hover:text-zinc-600 transition-colors text-base leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Entries */}
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
          {entries.length === 0 && (
            <p className="text-zinc-400 text-xs text-center py-10">No actions yet.</p>
          )}
          {entries.map((entry) => {
            const agent = AGENTS[entry.agentIndex]
            return (
              <div key={entry.id} className="flex items-start gap-3">
                <span className="text-zinc-400 text-[10px] shrink-0 mt-0.5 w-16 font-mono">
                  {formatTime(entry.timestamp)}
                </span>
                <span
                  className="w-2 h-2 rounded-full shrink-0 mt-1"
                  style={{ backgroundColor: agent?.color ?? '#999' }}
                />
                <span className="text-zinc-500 text-xs shrink-0 font-semibold">
                  {agent?.role ?? 'System'}
                </span>
                <span className="text-zinc-700 text-xs leading-relaxed">{entry.action}</span>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      </div>
    </>
  )
}
