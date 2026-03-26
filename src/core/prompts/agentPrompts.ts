import { getAllAgents } from '../../data/agents'
import type { Task } from '../../integration/store/coreStore'
import { getActiveAgentSet } from '../../integration/store/teamStore';

// ─── Scope constraint (fixed for all agents) ──────────────────
const SCOPE_CONSTRAINT = `
SCOPE:
Your only deliverable is a text prompt (plain text or markdown, max 500 words).
You do NOT produce real code, real designs, or real campaigns.
You craft the best possible prompt a human could use to achieve the stated goal.
`.trim()

// ─── Workflow rules + response schema ─────────────────────────
const WORKFLOW_RULES = `
WORKFLOW RULES:
- You work on ONE task at a time.
- Keep your messages concise and professional. No filler text.
- Before starting a new task, evaluate if the description is complete. Call request_client_approval to clarify goals, verify your approach, or if any details are missing.
- Use the provided tools to manage tasks and communicate progress.
- You can call multiple tools at once if needed (e.g., propose multiple tasks).
`.trim()

// ─── Build system prompt for a given agent ────────────────────
export function buildSystemPrompt(agentIndex: number, isBoardroom = false, skillInstructions: string = ''): string {
  const activeSet = getActiveAgentSet()
  const agents = getAllAgents(activeSet)
  const agent = agents.find(a => a.index === agentIndex)
  if (!agent) return ''

  const teamList = agents
    .filter((a) => a.index !== 0) // Exclude player if player is always 0
    .map((a) => `  [ID: ${a.index}] ${a.name}${a.description ? ` — ${a.description}` : ''}`)
    .join('\n')

  const isLead = agent.index === 1;
  const canDelegate = (agent.subagents?.length || 0) > 0;
  const hasRetry = !!agent.retryId;
  const isHITL = agent.retryId === 'user';

  const capabilities: string[] = [
    '- You can signal task completion using the "complete_task" tool.',
  ];

  if (canDelegate) {
    capabilities.push('- You are a MANAGER. You can delegate work to your subagents using the "propose_task" tool.');
  }
  if (hasRetry) {
    if (isHITL) {
      capabilities.push('- You can request human intervention or approval using the "request_client_approval" tool.');
    } else {
      capabilities.push('- You are a CRITIC/EDITOR. If work does not meet standards, use the "request_revision" tool to send it back to the assigned agent.');
    }
  }
  if (isLead) {
    capabilities.push('- You are the LEAD ORCHESTRATOR. You are responsible for refining the project brief and delivering the final result using "notify_client_project_ready".');
  }

  const boardroomNote = isBoardroom
    ? `\nCONTEXT: You are in the BOARDROOM collaborating with other agents. ` +
    `Divide the work clearly using propose_task, one per teammate. ` +
    `Then each agent will execute their own sub-task independently.`
    : ''

  return [
    `You are ${agent.name} at ${activeSet.teamName}.`,
    agent.description ? `Description: ${agent.description}` : '',
    `Instruction: ${agent.instruction}`,
    '',
    SCOPE_CONSTRAINT,
    '',
    `TEAM:\n${teamList}`,
    '',
    `CAPABILITIES:\n${capabilities.join('\n')}`,
    '',
    WORKFLOW_RULES,
    boardroomNote,
    skillInstructions ? `\n--- SKILL INSTRUCTIONS ---\n${skillInstructions}` : '',
  ]
    .join('\n')
    .trim()
}

// ─── Dynamic context injected each turn ───────────────────────
export function buildDynamicContext(params: {
  clientBrief: string
  currentTask: Task | null
  taskBoardSummary: string
  boardroomContext?: string
}): string {
  const parts: string[] = [
    `CLIENT BRIEF:\n${params.clientBrief || 'Not yet defined.'}`,
    `TASK BOARD:\n${params.taskBoardSummary}`,
  ]

  if (params.currentTask) {
    parts.push(
      `YOUR CURRENT TASK [${params.currentTask.id}]:\n${params.currentTask.description}`
    )
  }

  if (params.boardroomContext) {
    parts.push(`BOARDROOM CONTEXT:\n${params.boardroomContext}`)
  }

  return parts.join('\n\n')
}

// ─── Task board summary string ────────────────────────────────
export function buildTaskBoardSummary(tasks: Task[]): string {
  if (tasks.length === 0) return 'No tasks yet.'
  return tasks
    .map(
      (t) =>
        `[${t.id}] ${t.status.toUpperCase()} — ${t.description}` +
        ` (agents: ${t.assignedAgentIds.join(', ')})`
    )
    .join('\n')
}

// ─── Conversational chat prompt (no tools, no workflow) ───────
export function buildChatSystemPrompt(agentIndex: number, skillInstructions: string = ''): string {
  const activeSet = getActiveAgentSet()
  const agents = getAllAgents(activeSet)
  const agent = agents.find(a => a.index === agentIndex)
  if (!agent) return ''

  const isLead = agentIndex === activeSet.leadAgent.index;

  return [
    `You are ${agent.name} at ${activeSet.teamName}.`,
    agent.description ? `Description: ${agent.description}` : '',
    `Instruction: ${agent.instruction}`,
    '',
    'CONTEXT:',
    isLead
      ? [
        'You are the Orchestrator. The client is here to discuss a project, refine their brief, or review final delivery.',
        'IMPORTANT BRIEFING RULE: Do NOT start work (propose tasks) until you have a clear, specific, and actionable goal.',
        'If the client message is missing details, ask clarifying questions directly in your text response.',
        'The system will automatically capture and update the official project brief based on your conversation.',
        'Once you are ready to start, use "propose_task" to assign work to the team.'
      ].join(' ')
      : 'The client has approached you for a conversation. If you previously requested their approval/feedback on a task (ON_HOLD), they are here to provide it so you can resume work.',
    'Be helpful, friendly, and stay in character.',
    '',
    'RULES:',
    '- Be conversational and responsive. Answer the client\'s questions directly.',
    '- If you use a tool, always provide a conversational response in your message text as well.',
    '- IF the client provides the feedback or approval you needed to CONTINUE (the task stays in progress): call "receive_client_approval". The chat session will terminate and you will return to your workstation.',
    '- IF the client provides the final sign-off or enough info that your work is actually DONE: call "complete_task" with your final output (max 500 words). The chat session will also terminate.',
    '- Keep replies concise (2-4 sentences) unless the client asks for detail.',
    '- Do NOT propose new tasks or execute work via tools here (unless you are the Orchestrator starting the project).',
    skillInstructions ? `\n--- SKILL INSTRUCTIONS ---\n${skillInstructions}` : '',
  ]
    .filter(Boolean)
    .join('\n')
    .trim()
}
