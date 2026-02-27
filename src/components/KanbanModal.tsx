import React from 'react'
import { useAgencyStore, type Task, type TaskStatus } from '../store/agencyStore'
import { AGENTS } from '../data/agents'

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'scheduled',   label: 'Scheduled'   },
  { status: 'on_hold',     label: 'On Hold'      },
  { status: 'in_progress', label: 'In Progress'  },
  { status: 'done',        label: 'Done'         },
]

function renderAgentTag(agentIndex: number) {
  const agent = AGENTS[agentIndex]
  if (!agent) return null
  return (
    <span key={agentIndex} className="flex items-center gap-1 text-[10px] text-zinc-500">
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: agent.color }}
      />
      {agent.role}
    </span>
  )
}

function renderTaskCard(task: Task) {
  return (
    <div key={task.id} className="bg-white rounded-lg border border-black/5 shadow-sm p-3 space-y-2">
      <p className="text-xs text-zinc-800 leading-snug font-medium">{task.description}</p>
      <div className="flex flex-wrap gap-1.5">
        {task.assignedAgentIds.map(renderAgentTag)}
      </div>
      {task.status === 'on_hold' && (
        <span className="inline-block text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
          awaiting input
        </span>
      )}
      {task.status === 'in_progress' && (
        <span className="inline-block text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
          working
        </span>
      )}
    </div>
  )
}

export function KanbanPanel() {
  const { setKanbanOpen, tasks } = useAgencyStore()

  return (
    <div
      className="w-full bg-white border-t border-black/8 flex flex-col pointer-events-auto shrink-0"
      style={{ height: 320 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-black/5 shrink-0">
        <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Task Board</h2>
        <button
          onClick={() => setKanbanOpen(false)}
          className="text-zinc-300 hover:text-zinc-600 transition-colors text-base leading-none cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* Columns */}
      <div className="flex gap-3 p-4 overflow-x-auto flex-1 min-h-0">
        {COLUMNS.map(({ status, label }) => {
          const colTasks = tasks.filter((t) => t.status === status)
          return (
            <div key={status} className="flex-1 min-w-36 flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400">
                  {label}
                </span>
                <span className="text-[9px] font-bold bg-zinc-100 text-zinc-400 rounded-full w-3.5 h-3.5 flex items-center justify-center">
                  {colTasks.length}
                </span>
              </div>
              <div className="flex flex-col gap-2 overflow-y-auto">
                {colTasks.map(renderTaskCard)}
                {colTasks.length === 0 && (
                  <div className="flex items-start pt-2 justify-center">
                    <span className="text-zinc-200 text-xs">—</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
