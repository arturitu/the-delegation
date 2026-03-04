import { useAgencyStore } from '../store/agencyStore'
import { useStore } from '../store/useStore'
import {
  buildSystemPrompt,
  buildDynamicContext,
} from '../prompts/agentPrompts'
import { LLMFactory } from './llm/LLMFactory'
import { LLMMessage } from './llm/types'
import { AGENCY_TOOLS } from './llm/toolDefinitions'
import { AGENTS } from '../data/agents'

export interface AgentFunctionCall {
  name: string
  args: Record<string, unknown>
}

export interface AgentResponse {
  text: string
  functionCalls: AgentFunctionCall[]
}

const waitForResume = () => {
    return new Promise<void>((resolve) => {
      const unsub = useAgencyStore.subscribe((state, prevState) => {
        if (prevState.isPaused && !state.isPaused) {
          unsub();
          resolve();
        }
      });
    });
  };

export async function callAgent(params: {
  agentIndex: number;
  userMessage: string;
  isBoardroom?: boolean;
  boardroomTaskId?: string;
}): Promise<AgentResponse> {
  const { agentIndex, userMessage, isBoardroom = false, boardroomTaskId } = params;
  const llmConfig = useStore.getState().llmConfig;
  const provider = LLMFactory.getProvider(llmConfig);
  const agentData = AGENTS.find(a => a.index === agentIndex);

  // 1. Build context
  const systemInstruction = buildSystemPrompt(agentIndex, isBoardroom);

  const store = useAgencyStore.getState();
  const currentTask = store.tasks.find(
    (t) => t.assignedAgentIds.includes(agentIndex) && t.status === 'in_progress'
  ) ?? null;

  const dynamicContext = buildDynamicContext({
    clientBrief: store.clientBrief,
    currentTask,
    taskBoardSummary: store.tasks.map(t => `[${t.id}] ${t.status} - ${t.description}`).join('\n')
  });

  const fullUserMessage = `${dynamicContext}\n\n---\nMESSAGE:\n${userMessage}`;

  // 2. Get history from store
  const history = isBoardroom && boardroomTaskId
    ? (store.boardroomHistories[boardroomTaskId] || [])
    : (store.agentHistories[agentIndex] || []);

  const messages: LLMMessage[] = [
    ...history,
    { role: 'user', content: fullUserMessage }
  ];

  // PAUSE BEFORE CALL (OPTIONAL)
  if (useAgencyStore.getState().pauseOnCall) {
    useAgencyStore.getState().addDebugLogEntry({
        agentIndex,
        agentName: agentData?.role || 'Unknown',
        phase: 'request',
        systemPrompt: systemInstruction,
        dynamicContext,
        messages,
        rawContent: userMessage,
        status: 'pending',
        taskId: boardroomTaskId || currentTask?.id
    });
    useAgencyStore.getState().setPaused(true);
    await waitForResume();
  }

  // 3. Call LLM
  const response = await provider.generateCompletion(
    messages,
    AGENCY_TOOLS,
    systemInstruction,
    llmConfig.model
  );

  const text = response.content || '';
  const toolCalls = response.tool_calls || [];
  const functionCalls = toolCalls.map(tc => ({
    name: tc.function.name,
    args: JSON.parse(tc.function.arguments)
  }));

  // PAUSE AFTER RESPONSE (OPTIONAL)
  if (useAgencyStore.getState().pauseOnCall) {
    useAgencyStore.getState().addDebugLogEntry({
        agentIndex,
        agentName: agentData?.role || 'Unknown',
        phase: 'response',
        systemPrompt: systemInstruction,
        dynamicContext,
        messages,
        rawContent: JSON.stringify({ text, toolCalls }, null, 2),
        status: 'completed',
        taskId: boardroomTaskId || currentTask?.id
    });
    useAgencyStore.getState().setPaused(true);
    await waitForResume();
  }

  // 4. Update history in store
  const newMessages: LLMMessage[] = [
    { role: 'user', content: fullUserMessage },
    {
      role: 'assistant',
      content: text,
      tool_calls: response.tool_calls // Keep original tool calls for history
    }
  ];

  useAgencyStore.setState((s) => {
    if (isBoardroom && boardroomTaskId) {
      return {
        boardroomHistories: {
          ...s.boardroomHistories,
          [boardroomTaskId]: [...(s.boardroomHistories[boardroomTaskId] || []), ...newMessages]
        }
      }
    } else {
      return {
        agentHistories: {
          ...s.agentHistories,
          [agentIndex]: [...(s.agentHistories[agentIndex] || []), ...newMessages]
        }
      }
    }
  });

  return { text, functionCalls };
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
