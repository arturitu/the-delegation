import { GoogleGenAI } from '@google/genai'
import {
  buildSystemPrompt,
  buildDynamicContext,
  buildTaskBoardSummary,
} from '../prompts/agentPrompts'
import { useAgencyStore } from '../store/agencyStore'

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
const MODEL = 'gemini-3-flash-preview'

type HistoryEntry = { role: 'user' | 'model'; parts: { text: string }[] }

// ─── Types ────────────────────────────────────────────────────
export type FunctionCallName =
  | 'propose_task'
  | 'execute_work'
  | 'request_client_approval'
  | 'complete_task'
  | 'propose_subtask'
  | 'notify_client_project_ready'

export interface AgentFunctionCall {
  name: FunctionCallName
  args: Record<string, unknown>
}

export interface AgentResponse {
  text: string
  functionCall: AgentFunctionCall | null
}

// ─── Parse structured JSON from model output ──────────────────
function parseAgentOutput(raw: string): { message: string; fn: AgentFunctionCall | null } {
  try {
    // Strip markdown code fences if the model wraps its output
    const clean = raw
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```$/m, '')
      .trim()
    const parsed = JSON.parse(clean)
    return {
      message: typeof parsed.message === 'string' ? parsed.message : raw,
      fn: parsed.fn ?? null,
    }
  } catch {
    // Fallback: treat full text as message, no function call
    return { message: raw, fn: null }
  }
}

// ─── Core agent call ──────────────────────────────────────────
export async function callAgent(params: {
  agentIndex: number
  userMessage: string
  isBoardroom?: boolean
  boardroomTaskId?: string
}): Promise<AgentResponse> {
  const store = useAgencyStore.getState()
  const { agentIndex, userMessage, isBoardroom = false, boardroomTaskId } = params

  // Retrieve conversation history for this agent/session
  const history: HistoryEntry[] = isBoardroom && boardroomTaskId
    ? (store.boardroomHistories[boardroomTaskId] ?? [])
    : (store.agentHistories[agentIndex] ?? [])

  // Snapshot of the current task assigned to this agent (if any)
  const currentTask =
    store.tasks.find(
      (t) => t.assignedAgentIds.includes(agentIndex) && t.status === 'in_progress'
    ) ?? null

  const dynamicContext = buildDynamicContext({
    clientBrief: store.clientBrief,
    currentTask,
    taskBoardSummary: buildTaskBoardSummary(store.tasks),
  })

  const fullUserMessage = `${dynamicContext}\n\n---\nMESSAGE:\n${userMessage}`

  const contents: HistoryEntry[] = [
    ...history,
    { role: 'user', parts: [{ text: fullUserMessage }] },
  ]

  const response = await client.models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction: buildSystemPrompt(agentIndex, isBoardroom),
      temperature: 0.7,
      responseMimeType: 'application/json',
    },
  })

  const rawText = response.text ?? ''
  const { message, fn } = parseAgentOutput(rawText)

  // Persist turn in manual history
  if (isBoardroom && boardroomTaskId) {
    store.appendBoardroomHistory(boardroomTaskId, 'user', fullUserMessage)
    store.appendBoardroomHistory(boardroomTaskId, 'model', rawText)
  } else {
    store.appendAgentHistory(agentIndex, 'user', fullUserMessage)
    store.appendAgentHistory(agentIndex, 'model', rawText)
  }

  // Auto-add to the global action log whenever a function is called
  if (fn) {
    const taskId =
      typeof fn.args.taskId === 'string' ? fn.args.taskId : undefined
    store.addLogEntry({
      agentIndex,
      action: `${fn.name} — ${message}`,
      taskId,
    })
  }

  return { text: message, functionCall: fn }
}

// ─── Convenience wrappers ─────────────────────────────────────

/** Call the Account Manager (index 1) */
export const callAccountManager = (userMessage: string) =>
  callAgent({ agentIndex: 1, userMessage })

/** Call an agent in the context of a boardroom session for a given task */
export const callBoardroomAgent = (
  agentIndex: number,
  taskId: string,
  message: string
) => callAgent({ agentIndex, userMessage: message, isBoardroom: true, boardroomTaskId: taskId })
