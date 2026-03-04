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
- Use the provided tools to manage tasks and communicate progress.
- You can call multiple tools at once if needed (e.g., propose multiple tasks).
`.trim()

// ─── Team roster visible to all agents ────────────────────────
const teamList = AGENTS.filter((a) => !a.isPlayer)
  .map((a) => `  [ID: ${a.index}] ${a.role} (${a.department}) — ${a.mission}`)
  .join('\n')

// ─── Build system prompt for a given agent ────────────────────
export function buildSystemPrompt(agentIndex: number): string {
  const agent = AGENTS.find(a => a.index === agentIndex)
  if (!agent) return ''

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
  ]
    .join('\n')
    .trim()
}

// ─── Dynamic context injected each turn ───────────────────────
export function buildDynamicContext(params: {
  clientBrief: string
  currentTask: Task | null
  taskBoardSummary: string
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

  return parts.join('\n\n')
}

// ─── Conversational chat prompt (no tools, no workflow) ───────
export function buildChatSystemPrompt(agentIndex: number): string {
  const agent = AGENTS.find(a => a.index === agentIndex)
  if (!agent) return ''

  return [
    `You are ${agent.role} at ${COMPANY_NAME}.`,
    `Department: ${agent.department}`,
    `Mission: ${agent.mission}`,
    `Personality: ${agent.personality}`,
    '',
    'CONTEXT:',
    'You are currently between tasks and the client has approached you for a conversation.',
    'Be helpful, friendly, and stay in character. Discuss the project, your expertise,',
    'your completed work, or answer questions about your role and the team.',
    '',
    'RULES:',
    '- Be conversational and responsive. Answer the client\'s questions directly.',
    '- You may discuss project status, your expertise, and offer professional opinions.',
    '- Keep replies concise (2-4 sentences) unless the client asks for detail.',
    '- Do NOT execute any work, create tasks, or call any tools — just talk.',
    '- If the client asks you to do something that requires a task, politely suggest',
    '  they speak with the Account Manager to coordinate it.',
  ]
    .join('\n')
    .trim()
}
