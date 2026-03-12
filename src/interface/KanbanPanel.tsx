import React, { useState } from 'react'
import { useCoreStore, type Task, type TaskStatus } from '../integration/store/coreStore'
import { getActiveAgentSet } from '../integration/store/coreStore'
import { ChevronDown, ChevronRight, Trash2, MessageSquareWarning } from 'lucide-react'
import DeleteTaskModal from './DeleteTaskModal'
import { useUiStore } from '../integration/store/uiStore'

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'scheduled',   label: 'Scheduled'   },
  { status: 'on_hold',     label: 'On Hold'      },
  { status: 'in_progress', label: 'In Progress'  },
  { status: 'done',        label: 'Done'         },
]

interface KanbanPanelProps {
  height?: number;
}

function renderAgentTag(agentIndex: number) {
  if (agentIndex === 0) { // Client / You
     return (
      <span key={agentIndex} className="flex items-center gap-1 text-[10px] text-[#7EACEA] font-bold">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0 bg-[#7EACEA]"
        />
        You
      </span>
    )
  }
  const agent = getActiveAgentSet().agents.find(a => a.index === agentIndex)
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
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const { removeTask } = useCoreStore()
  const { setSelectedNpc } = useUiStore()

  // For visual representation, if on_hold, we "virtualize" the client being assigned
  const effectiveAgentIds = task.status === 'on_hold'
    ? [...new Set([0, ...task.assignedAgentIds])]
    : task.assignedAgentIds

  const handleSelectAgent = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Select the first assigned NPC (not client)
    const agentId = task.assignedAgentIds.find(id => id !== 0);
    if (agentId !== undefined) {
      setSelectedNpc(agentId);
    }
  };

  return (
    <div key={task.id} className="bg-white rounded-lg border border-black/5 shadow-sm p-3 space-y-2 group relative">
      <div
        className="flex items-start justify-between gap-1 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-xs text-zinc-900 leading-snug font-bold flex-1">
          {task.title || 'Untitled Task'}
        </h3>
        <div className="flex items-center gap-1">
          {task.status === 'on_hold' && (
            <button
              onClick={handleSelectAgent}
              className="p-1 text-white bg-orange-500 hover:bg-orange-600 rounded mr-1"
              title="Select agent waiting for approval"
            >
              <MessageSquareWarning size={14} />
            </button>
          )}
          {task.status !== 'done' && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsDeleteModalOpen(true)
                }}
                className="p-1 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                title="Remove task"
              >
                <Trash2 size={12} />
              </button>
              <DeleteTaskModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={() => removeTask(task.id)}
                taskTitle={task.title}
              />
            </>
          )}
          <button className="text-zinc-300 group-hover:text-zinc-500 transition-colors">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <p className="text-[11px] text-zinc-500 leading-relaxed bg-zinc-50/50 p-2 rounded border border-black/5 animate-in fade-in slide-in-from-top-1 duration-200">
          {task.description}
        </p>
      )}

      <div className="flex flex-wrap gap-x-2 gap-y-1 pt-1">
        {effectiveAgentIds.map(renderAgentTag)}
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
  const { tasks } = useCoreStore()

  return (
    <div
      className="w-full bg-white border-t border-black/8 flex flex-col pointer-events-auto shrink-0 relative"
      style={{ height }}
    >
      {/* Columns Scroll Area */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden bg-zinc-50/20">
        <div className="flex h-full min-w-max px-5 py-4 gap-4">
          {COLUMNS.map(({ status, label }) => {
            const colTasks = tasks.filter((t) => t.status === status)
            return (
              <div key={status} className="w-60 flex flex-col gap-3">
                <div className="flex items-center justify-between shrink-0 select-none">
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
                    <div className="border border-dashed border-zinc-100 rounded-lg p-4 flex items-center justify-center select-none">
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
