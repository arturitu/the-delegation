import { MemoryService } from '../context/MemoryService'
import { LLMFactory } from '../core/llm/LLMFactory'
import { LLMMessage, LLMToolDefinition } from '../core/llm/types'
import { SkillLoader } from '../core/skills/SkillLoader';
import { AgentSkill } from '../core/skills/types';
import {
  buildChatSystemPrompt,
  buildDynamicContext, buildSystemPrompt
} from '../core/prompts/agentPrompts'
import { getAllAgents } from '../data/agents'
import { useCoreStore } from './store/coreStore'
import { useTeamStore, getActiveAgentSet } from './store/teamStore';
import { useUiStore } from './store/uiStore'

export interface AgentFunctionCall {
  name: string
  args: Record<string, unknown>
}

export interface AgentResponse {
  text: string
  functionCalls: AgentFunctionCall[]
}

// ── Reset abort controller ────────────────────────────────────
// Replaced on every reset so all in-flight callAgent promises reject immediately.
let _resetController = new AbortController();

/** Cancel every in-flight LLM call and arm a fresh signal for the next run. */
export function abortAllCalls(): void {
  _resetController.abort();
  _resetController = new AbortController();
}

/** Rejects if the current reset signal has been aborted. */
function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('LLM call aborted by reset', 'AbortError');
}

/** Returns a promise that rejects as soon as the signal is aborted. */
function abortRace(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) { reject(new DOMException('LLM call aborted by reset', 'AbortError')); return; }
    signal.addEventListener('abort', () => reject(new DOMException('LLM call aborted by reset', 'AbortError')), { once: true });
  });
}

const waitForResume = (signal: AbortSignal) => {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('LLM call aborted by reset', 'AbortError')); return; }
    const unsub = useCoreStore.subscribe((state, prevState) => {
      if (prevState.isPaused && !state.isPaused) {
        unsub();
        if (signal.aborted) reject(new DOMException('LLM call aborted by reset', 'AbortError'));
        else resolve();
      }
    });
    signal.addEventListener('abort', () => { unsub(); reject(new DOMException('LLM call aborted by reset', 'AbortError')); }, { once: true });
  });
};

export function handleLLMError(e: any): void {
  const error = e as any;
  let errorMessage = '';

  if (typeof error === 'string') {
    errorMessage = error;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else {
    errorMessage = JSON.stringify(error);
  }

  const isQuotaError = errorMessage.includes('429') ||
    errorMessage.includes('RESOURCE_EXHAUSTED') ||
    errorMessage.includes('quota');

  if (isQuotaError) {
    let displayMessage = 'API Quota exceeded. Please wait a moment or use your own API key to continue.';
    // Try to extract a more descriptive message from the API error JSON if present
    try {
      const jsonMatch = errorMessage.match(/\{.*\}/s);
      if (jsonMatch) {
        const errorData = JSON.parse(jsonMatch[0]);
        if (errorData.error?.message) {
          displayMessage = errorData.error.message;
        }
      }
    } catch (parseError) {
      // Fallback to generic if parsing fails
    }
    useUiStore.getState().setBYOKOpen(true, displayMessage);
  } else if (errorMessage.includes('API key') || errorMessage.includes('400') || errorMessage.includes('401')) {
    useUiStore.getState().setBYOKOpen(true, 'API key not valid. Please check your key and try again.');
  }
}

export async function callAgent(params: {
  agentIndex: number;
  userMessage: string;
  isBoardroom?: boolean;
  boardroomTaskId?: string;
  chatMode?: boolean;
}): Promise<AgentResponse> {
  // Capture the reset signal at call-time — if reset fires mid-call this will abort.
  const signal = _resetController.signal;
  throwIfAborted(signal);
  const { agentIndex, userMessage, isBoardroom = false, boardroomTaskId, chatMode = false } = params;
  const llmConfig = useUiStore.getState().llmConfig;

  let provider;
  try {
    provider = LLMFactory.getProvider(llmConfig);
  } catch (e) {
    handleLLMError(e);
    throw e;
  }

  const activeSet = getActiveAgentSet();
  const agentData = getAllAgents(activeSet).find((a) => a.index === agentIndex);

  // 1. Gather Tools and Instructions from Skills
  const coreSkill = SkillLoader.getSkill('core-skill');
  const patternSkill = agentData?.pattern ? SkillLoader.getSkill(agentData.pattern) : null;
  const assignedSkills = (agentData?.skills || []).map(id => SkillLoader.getSkill(id)).filter(Boolean) as AgentSkill[];
  
  let skillInstructions = coreSkill?.instructions || '';
  
  const processSkill = (skill: AgentSkill, type: 'PATTERN' | 'EXTRA') => {
    let block = `\n\n### ${type}: ${skill.metadata.name.toUpperCase()}\n${skill.instructions}`;
    
    // Inject References
    if (skill.references && Object.keys(skill.references).length > 0) {
      block += `\n\n#### REFERENCES:`;
      for (const [name, content] of Object.entries(skill.references)) {
        block += `\n- **${name}**:\n${content}\n`;
      }
    }

    // Inject Assets
    if (skill.assets && Object.keys(skill.assets).length > 0) {
      block += `\n\n#### ASSETS:`;
      for (const [name, content] of Object.entries(skill.assets)) {
        block += `\n- **${name}**:\n${content}\n`;
      }
    }
    return block;
  };

  if (patternSkill) {
    skillInstructions += processSkill(patternSkill, 'PATTERN');
  }

  assignedSkills.forEach(s => {
    skillInstructions += processSkill(s, 'EXTRA');
  });

  const allAvailableTools: LLMToolDefinition[] = [...(coreSkill?.metadata.tools || [])];
  
  if (patternSkill?.metadata.tools) {
    allAvailableTools.push(...patternSkill.metadata.tools);
  }

  assignedSkills.forEach(s => {
    if (s.metadata.tools) allAvailableTools.push(...s.metadata.tools);
  });

  // 2. Build context
  const fullSystemPrompt = chatMode
    ? buildChatSystemPrompt(agentIndex, skillInstructions)
    : buildSystemPrompt(agentIndex, isBoardroom, skillInstructions);

  const store = useCoreStore.getState();
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

  // 3. Get history from store with summarizing logic for long chats
  let history = isBoardroom && boardroomTaskId
    ? (store.boardroomHistories[boardroomTaskId] || [])
    : (store.agentHistories[agentIndex] || []);

  const agentSummary = store.agentSummaries[agentIndex] || '';

  // If the last history entry is a user message matching the current one,
  // it was pushed by SceneManager for UI snappiness. Strip it to avoid duplication —
  // we'll add the enriched version (with dynamic context).
  const lastEntry = history.length > 0 ? history[history.length - 1] : null;
  if (lastEntry?.role === 'user' && lastEntry.content === userMessage) {
    history = history.slice(0, -1);
  }

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

  // 4. Call LLM — using declarative tool permissions based on topology
  const isLead = agentData?.index === 1;
  const canDelegate = (agentData?.subagents?.length || 0) > 0;
  const hasRetry = !!agentData?.retryId;
  const isHITL = agentData?.retryId === 'user';

  const allowedToolNames = new Set<string>(['complete_task', 'receive_client_approval']);
  if (isLead) {
    allowedToolNames.add('notify_client_project_ready');
  }
  if (canDelegate) allowedToolNames.add('propose_task');
  if (hasRetry) {
    if (isHITL) {
      allowedToolNames.add('request_client_approval');
    } else {
      allowedToolNames.add('request_revision');
    }
  }

  // Tools from extra skills are always allowed
  const extraSkillToolNames = new Set<string>();
  assignedSkills.forEach(s => {
    s.metadata.tools?.forEach(t => extraSkillToolNames.add(t.function.name));
  });

  const tools = allAvailableTools.filter((t) => 
    allowedToolNames.has(t.function.name) || extraSkillToolNames.has(t.function.name)
  );

  // PAUSE BEFORE CALL (only when debug mode on)
  if (useCoreStore.getState().pauseOnCall) {
    useCoreStore.getState().setPaused(true);
    await waitForResume(signal);
  }
  throwIfAborted(signal);


  // Use agent.model if available, else fallback to llmConfig.model
  const modelToUse = agentData?.model || llmConfig.model;

  let response;
  try {
    response = await Promise.race([
      provider.generateCompletion(messages, tools, fullSystemPrompt, modelToUse, signal),
      abortRace(signal),
    ]);
  } catch (e) {
    handleLLMError(e);
    throw e;
  }

  const text = response.content || '';
  let toolCalls = response.tool_calls || [];

  // --- SAFETY FILTER ---
  // If requesting client approval, do NOT complete task in the same turn.
  const hasApprovalRequest = toolCalls.some(tc => tc.function.name === 'request_client_approval');
  if (hasApprovalRequest) {
    toolCalls = toolCalls.filter(tc => tc.function.name !== 'complete_task');
  }

  const functionCalls = toolCalls.map(tc => ({
    name: tc.function.name,
    args: JSON.parse(tc.function.arguments)
  }));

  // Log the request (mapped by provider)
  if (response.request) {
    useCoreStore.getState().addRequestLog({
      agentIndex,
      agentName: agentData?.name || 'Unknown',
      systemInstruction: response.request.systemInstruction,
      contents: response.request.contents,
      systemTools: response.request.tools,
      taskId: boardroomTaskId || currentTask?.id
    });
  }

  // Log the response
  useCoreStore.getState().addResponseLog({
    agentIndex,
    agentName: agentData?.name || 'Unknown',
    content: response.content,
    tool_calls: response.tool_calls,
    usage: response.usage,
    raw: response.raw,
    taskId: boardroomTaskId || currentTask?.id
  });
  // PAUSE AFTER RESPONSE (only when debug mode on)
  if (useCoreStore.getState().pauseOnCall) {
    useCoreStore.getState().setPaused(true);
    await waitForResume(signal);
  }
  throwIfAborted(signal);

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
  // 1. We have actual text content to show.
  // This prevents the "system-like" logs from autonomous cycles from polluting the chat history.
  const shouldUpdateHistory = (assistantContent.trim().length > 0);

  if (shouldUpdateHistory) {
    // Only push assistant message if it exists (user message is now handled immediately in SceneManager for UI snappiness)
    if (assistantMessage) {
      useCoreStore.setState((s) => {
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
  // We trigger it every turn for the Lead Agent during briefing to keep the Project Brief fresh
  const isLeadInChat = (agentIndex === 1) && chatMode;
  if (!isBoardroom && (isLeadInChat || (chatMode && (store.agentHistories[agentIndex]?.length || 0) > 12))) {
    MemoryService.updateAgentSummary(agentIndex);
  }

  return { text, functionCalls };
}

// ─── Convenience wrappers ─────────────────────────────────────

/** Call the Orchestrator (Lead Agent) */
export const callOrchestrator = (userMessage: string) => {
  const leadAgentIndex = getActiveAgentSet().leadAgent.index;
  return callAgent({ agentIndex: leadAgentIndex, userMessage });
}

/** Call an agent in the context of a boardroom session for a given task */
export const callBoardroomAgent = (
  agentIndex: number,
  taskId: string,
  message: string
) => callAgent({ agentIndex, userMessage: message, isBoardroom: true, boardroomTaskId: taskId })
