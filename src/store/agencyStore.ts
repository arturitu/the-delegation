import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { LLMMessage } from '../services/llm/types'

export type TaskStatus = 'scheduled' | 'in_progress' | 'done'

export interface Task {
  id: string
  title: string
  description: string
  assignedAgentIds: number[]
  status: TaskStatus
  parentTaskId?: string
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

export interface DebugLogEntry {
  id: string
  timestamp: number
  agentIndex: number
  agentName: string
  phase: 'request' | 'response'
  systemPrompt: string
  dynamicContext: string
  messages: LLMMessage[]
  rawContent: string
  status: 'pending' | 'completed' | 'error'
  taskId?: string
}

export type ProjectPhase = 'idle' | 'briefing' | 'working' | 'done'

interface AgencyState {
  // ── Project ──────────────────────────────────────────────────
  clientBrief: string
  phase: ProjectPhase
  finalOutput: string | null

  // ── Tasks ────────────────────────────────────────────────────
  tasks: Task[]

  // ── Log ──────────────────────────────────────────────────────
  actionLog: ActionLogEntry[]
  debugLog: DebugLogEntry[]

  // ── Conversation histories ─────────────────────────────
  agentHistories: Record<number, LLMMessage[]>

  // ── UI ───────────────────────────────────────────────────────
  isKanbanOpen: boolean
  isLogOpen: boolean
  isFinalOutputOpen: boolean;
  logFilterAgentIndex: number | null;
  isPaused: boolean;
  pauseOnCall: boolean;

  // ── Actions — Project ─────────────────────────────────────────
  setClientBrief: (brief: string) => void;
  setPhase: (phase: ProjectPhase) => void;
  setFinalOutput: (output: string) => void;

  // ── Actions — Tasks ───────────────────────────────────────────
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Task;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  setTaskOutput: (taskId: string, output: string) => void;

  // ── Actions — Log ─────────────────────────────────────────────
  addLogEntry: (entry: Omit<ActionLogEntry, 'id' | 'timestamp'>) => void;
  addDebugLogEntry: (entry: Omit<DebugLogEntry, 'id' | 'timestamp'>) => void;


  // ── Actions — UI ──────────────────────────────────────────────
  setKanbanOpen: (open: boolean) => void;
  setLogOpen: (open: boolean, filterAgent?: number | null) => void;
  setFinalOutputOpen: (open: boolean) => void;
  togglePause: () => void;
  setPaused: (paused: boolean) => void;
  togglePauseOnCall: () => void;
}

const MAX_LOG_ENTRIES = 500;

const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

export const useAgencyStore = create<AgencyState>()(
  persist(
    (set) => ({
      clientBrief: '',
      phase: 'idle',
      finalOutput: null,
      tasks: [],
      actionLog: [],
      debugLog: [],
      agentHistories: {},
      isKanbanOpen: true,
      isLogOpen: true,
      isFinalOutputOpen: false,
      logFilterAgentIndex: null,
      isPaused: false,
      pauseOnCall: false,

      // ... other actions stay as they are ...
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
        set((s) => {
          const next = [...s.actionLog, { ...entry, id: `log_${uid()}`, timestamp: Date.now() }];
          return { actionLog: next.length > MAX_LOG_ENTRIES ? next.slice(-MAX_LOG_ENTRIES) : next };
        }),

      addDebugLogEntry: (entry) =>
        set((s) => {
          const next = [...s.debugLog, { ...entry, id: `debug_${uid()}`, timestamp: Date.now() }];
          return { debugLog: next.length > MAX_LOG_ENTRIES ? next.slice(-MAX_LOG_ENTRIES) : next };
        }),

      setKanbanOpen: (open) => set({ isKanbanOpen: open }),
      setLogOpen: (open, filterAgent = null) =>
        set({ isLogOpen: open, logFilterAgentIndex: filterAgent ?? null }),
      setFinalOutputOpen: (open) => set({ isFinalOutputOpen: open }),
      togglePause: () => set((s) => ({ isPaused: !s.isPaused })),
      setPaused: (isPaused) => set({ isPaused }),
      togglePauseOnCall: () => set((s) => ({ pauseOnCall: !s.pauseOnCall })),
    }),
    {
      name: 'agency-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        pauseOnCall: state.pauseOnCall,
        // Optional: you might want to persist other UI preferences here too
      }),
    }
  )
)
