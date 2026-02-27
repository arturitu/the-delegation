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
- Always respond with valid JSON matching the schema below. No exceptions.
- If you have nothing to call, set "fn" to null.
- Keep "message" concise and professional. No filler text.

RESPONSE SCHEMA:
{
  "message": "<your visible message>",
  "fn": null
}
OR when calling a function:
{
  "message": "<brief explanation of what you are doing>",
  "fn": {
    "name": "<function_name>",
    "args": { ... }
  }
}

AVAILABLE FUNCTIONS:

propose_task
  args: { agentIds: number[], description: string, requiresApproval: boolean }
  use:  Account Manager only. Create a new task for one or more agents.

execute_work
  args: { taskId: string }
  use:  Signal you are starting work on your assigned task (moves it to in_progress).

request_client_approval
  args: { taskId: string, question: string }
  use:  When you need client input to continue. Task goes on_hold.

complete_task
  args: { taskId: string, output: string }
  use:  When your work is done. output is the prompt you crafted (max 500 words).

propose_subtask
  args: { agentId: number, description: string }
  use:  Boardroom only. Assign a specific sub-task to a teammate.

notify_client_project_ready
  args: { finalPrompt: string }
  use:  Account Manager only. When ALL tasks are done. Deliver the final assembled prompt.
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
