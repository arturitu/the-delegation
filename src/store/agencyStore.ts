import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { LLMMessage } from '../services/llm/types'

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
  debugLog: DebugLogEntry[]

  // ── Conversation histories (Agnostic standard) ───────────────
  agentHistories: Record<number, LLMMessage[]>
  agentSummaries: Record<number, string>
  boardroomHistories: Record<string, LLMMessage[]>

  // ── UI ───────────────────────────────────────────────────────
  isKanbanOpen: boolean
  isLogOpen: boolean
  isFinalOutputOpen: boolean;
  pendingApprovalTaskId: string | null;
  logFilterAgentIndex: number | null;
  isResizing: boolean;
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

  // ── Actions — History ───────────────────────────────────────
  appendAgentHistory: (agentIndex: number, role: 'user' | 'assistant', parts: any[]) => void;
  setAgentSummary: (agentIndex: number, summary: string) => void;
  appendBoardroomHistory: (taskId: string, role: 'user' | 'assistant', parts: any[]) => void;
  clearAllHistories: () => void;

  // ── Actions — UI ──────────────────────────────────────────────
  setKanbanOpen: (open: boolean) => void;
  setLogOpen: (open: boolean, filterAgent?: number | null) => void;
  setFinalOutputOpen: (open: boolean) => void;
  setPendingApproval: (taskId: string | null) => void;
  setIsResizing: (isResizing: boolean) => void;
  togglePause: () => void;
  setPaused: (paused: boolean) => void;
  togglePauseOnCall: () => void;
  resetProject: () => void;
}

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
      agentSummaries: {},
      boardroomHistories: {},
      isKanbanOpen: true,
      isLogOpen: true,
      isFinalOutputOpen: false,
      pendingApprovalTaskId: null,
      logFilterAgentIndex: null,
      isResizing: false,
      isPaused: false,
      pauseOnCall: false,

      resetProject: () => set({
        clientBrief: '',
        phase: 'idle',
        finalOutput: null,
        tasks: [],
        actionLog: [],
        debugLog: [],
        agentHistories: {},
        agentSummaries: {},
        boardroomHistories: {},
        pendingApprovalTaskId: null,
        isFinalOutputOpen: false,
        isPaused: false,
      }),

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
        set((s) => {
          const task = s.tasks.find((t) => t.id === taskId);
          if (!task) return {};

          // Safety check: Cannot move back to 'in_progress' or 'on_hold' if already 'done'
          if (task.status === 'done' && (status === 'in_progress' || status === 'on_hold')) {
            return {};
          }

          return {
            tasks: s.tasks.map((t) =>
              t.id === taskId ? { ...t, status, updatedAt: Date.now() } : t
            ),
          };
        }),

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

      addDebugLogEntry: (entry) =>
        set((s) => {
          const newEntry = { ...entry, id: `debug_${uid()}`, timestamp: Date.now() };
          const updated = [...s.debugLog, newEntry];
          return { debugLog: updated.length > 30 ? updated.slice(-30) : updated };
        }),

      appendAgentHistory: (agentIndex, role, parts) =>
        set((s) => ({
          agentHistories: {
            ...s.agentHistories,
            [agentIndex]: [
              ...(s.agentHistories[agentIndex] ?? []),
              {
                role,
                content: Array.isArray(parts) ? parts.map(p => typeof p === 'string' ? p : JSON.stringify(p)).join(' ') : String(parts),
              },
            ],
          },
        })),

      setAgentSummary: (agentIndex, summary) =>
        set((s) => ({
          agentSummaries: {
            ...s.agentSummaries,
            [agentIndex]: summary
          }
        })),

      appendBoardroomHistory: (taskId, role, parts) =>
        set((s) => ({
          boardroomHistories: {
            ...s.boardroomHistories,
            [taskId]: [
              ...(s.boardroomHistories[taskId] ?? []),
              {
                role,
                content: Array.isArray(parts) ? parts.map(p => typeof p === 'string' ? p : JSON.stringify(p)).join(' ') : String(parts),
              },
            ],
          },
        })),

      clearAllHistories: () => set({ agentHistories: {}, boardroomHistories: {} }),

      setKanbanOpen: (open) => set({ isKanbanOpen: open }),
      setLogOpen: (open, filterAgent = null) =>
        set({ isLogOpen: open, logFilterAgentIndex: filterAgent ?? null }),
      setFinalOutputOpen: (open) => set({ isFinalOutputOpen: open }),
      setPendingApproval: (taskId) => set({ pendingApprovalTaskId: taskId }),
      setIsResizing: (resizing) => set({ isResizing: resizing }),
      togglePause: () => set((s) => ({ isPaused: !s.isPaused })),
      setPaused: (isPaused) => set({ isPaused }),
      togglePauseOnCall: () => set((s) => {
        const nextPauseOnCall = !s.pauseOnCall;
        // If turning OFF debug mode and we are paused, resume automatically
        if (!nextPauseOnCall && s.isPaused) {
          return { pauseOnCall: nextPauseOnCall, isPaused: false };
        }
        return { pauseOnCall: nextPauseOnCall };
      }),
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
