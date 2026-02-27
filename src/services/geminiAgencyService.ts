import { GoogleGenAI, Type, Tool } from '@google/genai'
import {
  buildSystemPrompt,
  buildDynamicContext,
  buildTaskBoardSummary,
} from '../prompts/agentPrompts'
import { useAgencyStore } from '../store/agencyStore'

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
const MODEL = 'gemini-3-flash-preview'

type HistoryEntry = { role: 'user' | 'model'; parts: { text?: string; functionCall?: any; functionResponse?: any }[] }

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

// ─── Tools ────────────────────────────────────────────────────
const agencyTools: Tool[] = [
  {
    functionDeclarations: [
      {
        name: 'propose_task',
        description: 'Account Manager only. Create a new task for one or more agents.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            agentIds: {
              type: Type.ARRAY,
              items: { type: Type.INTEGER },
              description: 'List of agent IDs to assign the task to.',
            },
            title: {
              type: Type.STRING,
              description: 'A very brief 2-4 word summary of the task.',
            },
            description: {
              type: Type.STRING,
              description: 'A short 10-20 word instruction for the task.',
            },
            requiresApproval: {
              type: Type.BOOLEAN,
              description: 'Whether the task requires client approval before starting.',
            },
          },
          required: ['agentIds', 'title', 'description', 'requiresApproval'],
        },
      },
      {
        name: 'execute_work',
        description: 'Signal you are starting work on your assigned task (moves it to in_progress).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            taskId: {
              type: Type.STRING,
              description: 'The ID of the task you are starting.',
            },
          },
          required: ['taskId'],
        },
      },
      {
        name: 'request_client_approval',
        description: 'When you need client input to continue. Task goes on_hold.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            taskId: {
              type: Type.STRING,
              description: 'The ID of the task that needs approval.',
            },
            question: {
              type: Type.STRING,
              description: 'The question to ask the client.',
            },
          },
          required: ['taskId', 'question'],
        },
      },
      {
        name: 'complete_task',
        description: 'When your work is done. output is the prompt you crafted (max 500 words).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            taskId: {
              type: Type.STRING,
              description: 'The ID of the task you completed.',
            },
            output: {
              type: Type.STRING,
              description: 'The prompt you crafted (max 500 words).',
            },
          },
          required: ['taskId', 'output'],
        },
      },
      {
        name: 'propose_subtask',
        description: 'Boardroom only. Assign a specific sub-task to a teammate.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            agentId: {
              type: Type.INTEGER,
              description: 'The ID of the agent to assign the sub-task to.',
            },
            title: {
              type: Type.STRING,
              description: 'A very brief 2-4 word summary of the sub-task.',
            },
            description: {
              type: Type.STRING,
              description: 'A short 10-20 word instruction for the sub-task.',
            },
          },
          required: ['agentId', 'title', 'description'],
        },
      },
      {
        name: 'notify_client_project_ready',
        description: 'When all tasks are completed, assemble the final prompt for the client.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            finalPrompt: {
              type: Type.STRING,
              description: 'The final assembled prompt for the client.',
            },
          },
          required: ['finalPrompt'],
        },
      },
    ],
  },
]

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
      tools: agencyTools,
    },
  })

  const functionCall = response.functionCalls?.[0]
  const fn: AgentFunctionCall | null = functionCall
    ? {
        name: functionCall.name as FunctionCallName,
        args: functionCall.args as Record<string, unknown>,
      }
    : null

  const message = response.candidates?.[0]?.content?.parts?.find(p => p.text)?.text || (fn ? `[Called function: ${fn.name}]` : '')

  // We store the interaction as text in the history to avoid strict functionResponse validation
  const historyText = JSON.stringify({ message, fn })

  // Persist turn in manual history
  if (isBoardroom && boardroomTaskId) {
    store.appendBoardroomHistory(boardroomTaskId, 'user', [{ text: fullUserMessage }])
    store.appendBoardroomHistory(boardroomTaskId, 'model', [{ text: historyText }])
  } else {
    store.appendAgentHistory(agentIndex, 'user', [{ text: fullUserMessage }])
    store.appendAgentHistory(agentIndex, 'model', [{ text: historyText }])
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
