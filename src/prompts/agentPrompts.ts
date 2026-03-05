import { AGENTS, COMPANY_NAME } from '../data/agents'
import type { Task } from '../store/agencyStore'

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

// ─── Team roster visible to all agents ────────────────────────
const teamList = AGENTS.filter((a) => !a.isPlayer)
  .map((a) => `  [ID: ${a.index}] ${a.role} (${a.department}) — ${a.mission}`)
  .join('\n')

// ─── Build system prompt for a given agent ────────────────────
export function buildSystemPrompt(agentIndex: number, isBoardroom = false): string {
  const agent = AGENTS.find(a => a.index === agentIndex)
  if (!agent) return ''

  const boardroomNote = isBoardroom
    ? `\nCONTEXT: You are in the BOARDROOM collaborating with other agents. ` +
      `Divide the work clearly using propose_subtask, one per teammate. ` +
      `Then each agent will execute their own sub-task independently.`
    : ''

  return [
    `You are ${agent.role} at ${COMPANY_NAME}.`,
    `Department: ${agent.department}`,
    `Mission: ${agent.mission}`,
    `Personality: ${agent.personality}`,
    '',
    SCOPE_CONSTRAINT,
    '',
    `TEAM:\n${teamList}`,
    '',
    WORKFLOW_RULES,
    boardroomNote,
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
export function buildChatSystemPrompt(agentIndex: number): string {
  const agent = AGENTS.find(a => a.index === agentIndex)
  if (!agent) return ''

  const isAM = agentIndex === 1;

  return [
    `You are ${agent.role} at ${COMPANY_NAME}.`,
    `Department: ${agent.department}`,
    `Mission: ${agent.mission}`,
    `Personality: ${agent.personality}`,
    '',
    'CONTEXT:',
    isAM
      ? [
          'You are the Account Manager. The client is here to discuss a project, refine their brief, or review final delivery.',
          'IMPORTANT BRIEFING RULE: Do NOT start work (propose tasks) until you have a clear, specific, and actionable brief from the client.',
          'If the client message is missing details, ask clarifying questions instead of starting the project.',
          'Use the "update_client_brief" tool to save/update the official brief based on the client\'s input.',
          'Once the brief is final and you are ready to start, use "propose_task" to assign work to the team.'
        ].join(' ')
      : 'The client has approached you for a conversation. If you previously requested their approval/feedback on a task (ON_HOLD), they are here to provide it so you can resume work.',
    'Be helpful, friendly, and stay in character.',
    '',
    'RULES:',
    '- Be conversational and responsive. Answer the client\'s questions directly.',
    '- IF the client provides the feedback or approval you needed to CONTINUE (the task stays in progress): call "receive_client_approval". The chat session will terminate and you will return to your workstation.',
    '- IF the client provides the final sign-off or enough info that your work is actually DONE: call "complete_task" with your final output (max 500 words). The chat session will also terminate.',
    '- Keep replies concise (2-4 sentences) unless the client asks for detail.',
    '- Use "update_client_brief" if you are the Account Manager and the project requirements have changed.',
    '- Do NOT propose new tasks or execute work via tools here (unless you are the AM starting the project).',
  ]
    .join('\n')
    .trim()
}
