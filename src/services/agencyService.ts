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
  isBoardroom?: boolean;
  boardroomTaskId?: string;
  chatMode?: boolean;
}): Promise<AgentResponse> {
  const { agentIndex, userMessage, isBoardroom = false, boardroomTaskId, chatMode = false } = params;
  const llmConfig = useStore.getState().llmConfig;
  const provider = LLMFactory.getProvider(llmConfig);
  const agentData = AGENTS.find(a => a.index === agentIndex);

  // 1. Build context
  const systemInstruction = chatMode
    ? buildChatSystemPrompt(agentIndex)
    : buildSystemPrompt(agentIndex, isBoardroom);

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
    ? `${dynamicContext}\n\n---\nCLIENT MESSAGE:\n${userMessage}`
    : `${dynamicContext}\n\n---\nMESSAGE:\n${userMessage}`;

  // 2. Get history from store with summarizing logic for long chats
  let history = isBoardroom && boardroomTaskId
    ? (store.boardroomHistories[boardroomTaskId] || [])
    : (store.agentHistories[agentIndex] || []);

  const agentSummary = store.agentSummaries[agentIndex] || '';

  // If agent history is too long, we keep only last N messages and use a summary
  const MAX_HISTORY = 10;
  if (!isBoardroom && history.length > MAX_HISTORY) {
    const recentHistory = history.slice(-MAX_HISTORY);
    const contextWithSummary = [
      {
        role: 'system' as const,
        content: `SUMMARY OF PREVIOUS CONVERSATION:\n${agentSummary}\n\n(The above is a summary of what you discussed with the client earlier in this project. Below are the most recent messages.)`
      },
      ...recentHistory
    ];
    history = contextWithSummary;
  }

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
      taskId: boardroomTaskId || currentTask?.id
  });
  // PAUSE BEFORE CALL (only when debug mode on)
  if (useAgencyStore.getState().pauseOnCall) {
    useAgencyStore.getState().setPaused(true);
    await waitForResume();
  }

  // 3. Call LLM
  // We allow tools in chat mode if it's the specific approval or completion tools we need
  const tools = chatMode
    ? AGENCY_TOOLS.filter(t => ['receive_client_approval', 'complete_task', 'update_client_brief', 'propose_task'].includes(t.function.name))
    : AGENCY_TOOLS;
  const response = await provider.generateCompletion(
    messages,
    tools,
    systemInstruction,
    llmConfig.model
  );

  const text = response.content || '';
  let toolCalls = response.tool_calls || [];

  // --- SAFETY FILTERS ---
  // 1. If requesting client approval, do NOT execute work or complete task in the same turn.
  const hasApprovalRequest = toolCalls.some(tc => tc.function.name === 'request_client_approval');
  if (hasApprovalRequest) {
    toolCalls = toolCalls.filter(tc => !['execute_work', 'complete_task'].includes(tc.function.name));
  }

  // 2. If completing a task, remove redundant 'execute_work' calls for the same task.
  // This prevents race conditions where a task might be set to 'in_progress' AFTER being 'done'.
  const completeTaskCalls = toolCalls.filter(tc => tc.function.name === 'complete_task');
  if (completeTaskCalls.length > 0) {
    const completedTaskIds = completeTaskCalls.map(tc => {
      try { return JSON.parse(tc.function.arguments).taskId; } catch { return null; }
    }).filter(Boolean);

    toolCalls = toolCalls.filter(tc => {
      if (tc.function.name === 'execute_work') {
        try {
          const args = JSON.parse(tc.function.arguments);
          return !completedTaskIds.includes(args.taskId);
        } catch { return true; }
      }
      return true;
    });
  }

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
      taskId: boardroomTaskId || currentTask?.id
  });
  // PAUSE AFTER RESPONSE (only when debug mode on)
  if (useAgencyStore.getState().pauseOnCall) {
    useAgencyStore.getState().setPaused(true);
    await waitForResume();
  }

  // 4. Update history in store
  // In CHAT MODE, we only want to store the message if it's actual conversation or relevant feedback
  // In AUTONOMOUS MODE, we store everything as internal reasoning
  let assistantContent = response.content || '';

  // Special case: if there's a request_client_approval tool call, we want to show the question in the chat
  const approvalCall = response.tool_calls?.find(tc => tc.function.name === 'request_client_approval');
  if (approvalCall && !assistantContent) {
    try {
      const args = JSON.parse(approvalCall.function.arguments);
      if (args.question) {
        assistantContent = args.question;
      }
    } catch (e) {
      console.error("Failed to parse tool arguments for chat history", e);
    }
  }

  // Special case: if there's a propose_task tool call, show a feedback message in the chat
  const proposeCall = response.tool_calls?.find(tc => tc.function.name === 'propose_task');
  if (proposeCall && !assistantContent) {
    try {
      const args = JSON.parse(proposeCall.function.arguments);
      assistantContent = `Understood. I'm scheduling the following task: "${args.title}". `;
      if (args.requiresApproval) {
        assistantContent += "I'll ask for your confirmation before the team starts working on it.";
      }
    } catch (e) {
      assistantContent = "Understood. I'm scheduling a task for the team.";
    }
  }

  // REFINEMENT: If we are in CHAT MODE, and the assistant generated content that looks like
  // internal thoughts or task logs (and not a direct reply), we might want to skip or clean it.
  // However, the most effective way is to ensure that if CHAT MODE is false, we don't
  // push these automated "assigned task" logs into the persistent history that the chat uses.

  const assistantMessage: LLMMessage | null = assistantContent.trim() || (response.tool_calls && response.tool_calls.length > 0)
    ? {
        role: 'assistant',
        content: assistantContent,
        tool_calls: response.tool_calls
      }
    : null;

  // ONLY push to persistent history (the one shown in ChatPanel) if:
  // 1. We are explicitly in chatMode
  // 2. OR the assistant actually said something (assistantContent is not empty)
  // This prevents the "system-like" logs from autonomous cycles from polluting the chat history.
  const shouldUpdateHistory = chatMode || (assistantContent.trim().length > 0);

  if (shouldUpdateHistory) {
    // Only push assistant message if it exists (user message is now handled immediately in SceneManager for UI snappiness)
    if (assistantMessage) {
      useAgencyStore.setState((s) => {
        if (isBoardroom && boardroomTaskId) {
          return {
            boardroomHistories: {
              ...s.boardroomHistories,
              [boardroomTaskId]: [...(s.boardroomHistories[boardroomTaskId] || []), assistantMessage]
            }
          }
        } else {
          return {
            agentHistories: {
              ...s.agentHistories,
              [agentIndex]: [...(s.agentHistories[agentIndex] || []), assistantMessage]
            }
          }
        }
      });
    }
  }

  // 5. Trigger Summary Update for Agent Chats
  if (!isBoardroom && chatMode && (store.agentHistories[agentIndex]?.length || 0) > 12) {
      updateAgentSummary(agentIndex);
  }

  return { text, functionCalls };
}

async function updateAgentSummary(agentIndex: number) {
    const store = useAgencyStore.getState();
    const history = store.agentHistories[agentIndex] || [];
    const llmConfig = useStore.getState().llmConfig;
    const provider = LLMFactory.getProvider(llmConfig);

    // Simple prompt to summarize
    const summaryPrompt: LLMMessage[] = [
        ...history,
        {
            role: 'user',
            content: 'Please provide a very concise summary (max 100 words) of our conversation so far, focusing on key decisions, project requirements, and your role. This will be used as your memory context.'
        }
    ];

    try {
        const response = await provider.generateCompletion(summaryPrompt, [], 'You are an AI assistant helping an agent summarize their conversation history.', llmConfig.model);
        if (response.content) {
            store.setAgentSummary(agentIndex, response.content);
        }
    } catch (e) {
        console.error('Failed to update agent summary', e);
    }
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
