import { create } from 'zustand'

export type TaskStatus = 'scheduled' | 'on_hold' | 'in_progress' | 'done'

export interface Task {
  id: string
  title: string
  description: string
  assignedAgentIds: number[]
  status: TaskStatus
  parentTaskId?: string
  requiresClientApproval: boolean
  output?: string
  createdAt: number
  updatedAt: number
}

export interface ActionLogEntry {
  id: string
  timestamp: number
  agentIndex: number
  action: string
  taskId?: string
}

export type ProjectPhase = 'idle' | 'briefing' | 'working' | 'awaiting_approval' | 'done'

interface AgencyState {
  // ── Project ──────────────────────────────────────────────────
  clientBrief: string
  phase: ProjectPhase
  finalOutput: string | null

  // ── Tasks ────────────────────────────────────────────────────
  tasks: Task[]

  // ── Log ──────────────────────────────────────────────────────
  actionLog: ActionLogEntry[]

  // ── Conversation histories (replaces Interactions API) ────────
  agentHistories: Record<number, Array<{ role: 'user' | 'model'; parts: { text: string }[] }>>
  boardroomHistories: Record<string, Array<{ role: 'user' | 'model'; parts: { text: string }[] }>>

  // ── UI ───────────────────────────────────────────────────────
  isKanbanOpen: boolean
  isLogOpen: boolean
  isFinalOutputOpen: boolean
  pendingApprovalTaskId: string | null
  logFilterAgentIndex: number | null

  // ── Actions — Project ─────────────────────────────────────────
  setClientBrief: (brief: string) => void
  setPhase: (phase: ProjectPhase) => void
  setFinalOutput: (output: string) => void

  // ── Actions — Tasks ───────────────────────────────────────────
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Task
  updateTaskStatus: (taskId: string, status: TaskStatus) => void
  setTaskOutput: (taskId: string, output: string) => void

  // ── Actions — Log ─────────────────────────────────────────────
  addLogEntry: (entry: Omit<ActionLogEntry, 'id' | 'timestamp'>) => void

  // ── Actions — History ───────────────────────────────────────
  appendAgentHistory: (agentIndex: number, role: 'user' | 'model', parts: any[]) => void
  appendBoardroomHistory: (taskId: string, role: 'user' | 'model', parts: any[]) => void
  clearAllHistories: () => void

  // ── Actions — UI ──────────────────────────────────────────────
  setKanbanOpen: (open: boolean) => void
  setLogOpen: (open: boolean, filterAgent?: number | null) => void
  setFinalOutputOpen: (open: boolean) => void
  setPendingApproval: (taskId: string | null) => void
}

const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

export const useAgencyStore = create<AgencyState>((set) => ({
  clientBrief: '',
  phase: 'idle',
  finalOutput: null,
  tasks: [],
  actionLog: [],
  agentHistories: {},
  boardroomHistories: {},
  isKanbanOpen: false,
  isLogOpen: false,
  isFinalOutputOpen: false,
  pendingApprovalTaskId: null,
  logFilterAgentIndex: null,

  setClientBrief: (brief) => set({ clientBrief: brief }),
  setPhase: (phase) => set({ phase }),
  setFinalOutput: (output) => set({ finalOutput: output }),

  addTask: (task) => {
    const newTask: Task = {
      ...task,
      id: `task_${uid()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    set((s) => ({ tasks: [...s.tasks, newTask] }))
    return newTask
  },

  updateTaskStatus: (taskId, status) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, status, updatedAt: Date.now() } : t
      ),
    })),

  setTaskOutput: (taskId, output) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, output, updatedAt: Date.now() } : t
      ),
    })),

  addLogEntry: (entry) =>
    set((s) => ({
      actionLog: [
        ...s.actionLog,
        { ...entry, id: `log_${uid()}`, timestamp: Date.now() },
      ],
    })),

  appendAgentHistory: (agentIndex, role, parts) =>
    set((s) => ({
      agentHistories: {
        ...s.agentHistories,
        [agentIndex]: [
          ...(s.agentHistories[agentIndex] ?? []),
          { role, parts },
        ],
      },
    })),

  appendBoardroomHistory: (taskId, role, parts) =>
    set((s) => ({
      boardroomHistories: {
        ...s.boardroomHistories,
        [taskId]: [
          ...(s.boardroomHistories[taskId] ?? []),
          { role, parts },
        ],
      },
    })),

  clearAllHistories: () => set({ agentHistories: {}, boardroomHistories: {} }),

  setKanbanOpen: (open) => set({ isKanbanOpen: open }),
  setLogOpen: (open, filterAgent = null) =>
    set({ isLogOpen: open, logFilterAgentIndex: filterAgent ?? null }),
  setFinalOutputOpen: (open) => set({ isFinalOutputOpen: open }),
  setPendingApproval: (taskId) => set({ pendingApprovalTaskId: taskId }),
}))
