import { useAgencyStore } from '../store/agencyStore'
import { useStore } from '../store/useStore'
import {
  buildSystemPrompt,
  buildChatSystemPrompt,
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
  chatMode?: boolean;
}): Promise<AgentResponse> {
  const { agentIndex, userMessage, chatMode = false } = params;
  const llmConfig = useStore.getState().llmConfig;
  const provider = LLMFactory.getProvider(llmConfig);
  const agentData = AGENTS.find(a => a.index === agentIndex);

  // 1. Build context
  const systemInstruction = chatMode
    ? buildChatSystemPrompt(agentIndex)
    : buildSystemPrompt(agentIndex);

  const store = useAgencyStore.getState();
  const currentTask = store.tasks.find(
    (t) => t.assignedAgentIds.includes(agentIndex) && t.status === 'in_progress'
  ) ?? null;

  const dynamicContext = buildDynamicContext({
    clientBrief: store.clientBrief,
    currentTask,
    taskBoardSummary: store.tasks.map(t => `[${t.id}] ${t.status} - ${t.description}`).join('\n')
  });

  const fullUserMessage = chatMode
    ? userMessage
    : `${dynamicContext}\n\n---\nMESSAGE:\n${userMessage}`;

  // 2. Get history from store
  const history = store.agentHistories[agentIndex] || [];

  const messages: LLMMessage[] = [
    ...history,
    { role: 'user', content: fullUserMessage }
  ];

  // Always log the request for the technical log panel
  useAgencyStore.getState().addDebugLogEntry({
      agentIndex,
      agentName: agentData?.role || 'Unknown',
      phase: 'request',
      systemPrompt: systemInstruction,
      dynamicContext,
      messages,
      rawContent: userMessage,
      status: 'pending',
      taskId: currentTask?.id
  });
  // PAUSE BEFORE CALL (only when debug mode on)
  if (useAgencyStore.getState().pauseOnCall) {
    useAgencyStore.getState().setPaused(true);
    await waitForResume();
  }

  // 3. Call LLM
  const tools = chatMode ? [] : AGENCY_TOOLS;
  const response = await provider.generateCompletion(
    messages,
    tools,
    systemInstruction,
    llmConfig.model
  );

  const text = response.content || '';
  const toolCalls = response.tool_calls || [];
  const functionCalls = toolCalls.map(tc => ({
    name: tc.function.name,
    args: JSON.parse(tc.function.arguments)
  }));

  // Always log the response for the technical log panel
  useAgencyStore.getState().addDebugLogEntry({
      agentIndex,
      agentName: agentData?.role || 'Unknown',
      phase: 'response',
      systemPrompt: systemInstruction,
      dynamicContext,
      messages,
      rawContent: JSON.stringify({ text, toolCalls }, null, 2),
      status: 'completed',
      taskId: currentTask?.id
  });
  // PAUSE AFTER RESPONSE (only when debug mode on)
  if (useAgencyStore.getState().pauseOnCall) {
    useAgencyStore.getState().setPaused(true);
    await waitForResume();
  }

  // 4. Update history in store
  // Store only the bare userMessage (without dynamic context prefix) so that history
  // stays lean and the fresh dynamic context is injected only on the current turn.
  const newMessages: LLMMessage[] = [
    { role: 'user', content: userMessage },
    {
      role: 'assistant',
      content: text,
      tool_calls: response.tool_calls // Keep original tool calls for history
    }
  ];

  useAgencyStore.setState((s) => ({
    agentHistories: {
      ...s.agentHistories,
      [agentIndex]: [...(s.agentHistories[agentIndex] || []), ...newMessages]
    }
  }));

  return { text, functionCalls };
}

// ─── Convenience wrappers ─────────────────────────────────────

/** Call the Account Manager (index 1) */
export const callAccountManager = (userMessage: string) =>
  callAgent({ agentIndex: 1, userMessage })
