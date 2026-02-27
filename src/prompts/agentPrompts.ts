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
const TEAM_ROSTER = AGENTS.filter((a) => !a.isPlayer)
  .map((a) => `  [${a.index}] ${a.role} (${a.department}) — ${a.mission}`)
  .join('\n')

// ─── Build system prompt for a given agent ────────────────────
export function buildSystemPrompt(agentIndex: number, isBoardroom = false): string {
  const agent = AGENTS[agentIndex]
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
    `TEAM:\n${TEAM_ROSTER}`,
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
