import React, { useState } from 'react'
import { useAgencyStore, type Task, type TaskStatus } from '../store/agencyStore'
import { AGENTS } from '../data/agents'
import { ChevronDown, ChevronRight } from 'lucide-react'

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'scheduled',   label: 'Scheduled'   },
  { status: 'in_progress', label: 'In Progress'  },
  { status: 'done',        label: 'Done'         },
]

interface KanbanPanelProps {
  height?: number;
}

function renderAgentTag(agentIndex: number) {
  const agent = AGENTS.find(a => a.index === agentIndex)
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

function TaskCard({ task }: { task: Task; key?: string }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div key={task.id} className="bg-white rounded-lg border border-black/5 shadow-sm p-3 space-y-2 group">
      <div
        className="flex items-start justify-between gap-1 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-xs text-zinc-900 leading-snug font-bold flex-1">
          {task.title || 'Untitled Task'}
        </h3>
        <button className="text-zinc-300 group-hover:text-zinc-500 transition-colors">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {isExpanded && (
        <p className="text-[11px] text-zinc-500 leading-relaxed bg-zinc-50/50 p-2 rounded border border-black/5 animate-in fade-in slide-in-from-top-1 duration-200">
          {task.description}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 pt-1">
        {task.assignedAgentIds.map(renderAgentTag)}
      </div>
      {task.status === 'in_progress' && (
        <span className="inline-block text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
          working
        </span>
      )}
    </div>
  )
}

export function KanbanPanel({ height = 320 }: KanbanPanelProps) {
  const { tasks } = useAgencyStore()

  return (
    <div
      className="w-full bg-white border-t border-black/8 flex flex-col pointer-events-auto shrink-0 relative"
      style={{ height }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 h-10 border-b border-black/5 shrink-0 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Project Kanban</span>
        </div>
      </div>

      {/* Columns Scroll Area */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden bg-zinc-50/20">
        <div className="flex h-full min-w-max px-5 py-4 gap-4">
          {COLUMNS.map(({ status, label }) => {
            const colTasks = tasks.filter((t) => t.status === status)
            return (
              <div key={status} className="w-60 flex flex-col gap-3">
                <div className="flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 leading-none">
                      {label}
                    </span>
                    <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-400 text-[9px] font-bold rounded-md min-w-4.5 text-center">
                      {colTasks.length}
                    </span>
                  </div>
                </div>

                <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-1">
                  {colTasks.map((t) => (
                    <TaskCard key={t.id} task={t} />
                  ))}
                  {colTasks.length === 0 && (
                    <div className="border border-dashed border-zinc-100 rounded-lg p-4 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">Empty</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
