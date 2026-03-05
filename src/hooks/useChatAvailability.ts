import { useAgencyStore } from '../store/agencyStore'
import { AGENTS } from '../data/agents'

const AM_INDEX = 1

export interface ChatAvailability {
  canChat: boolean
  reason: string
}

/**
 * Derives whether the player can chat with a given agent based on
 * the current project phase and the agent's task state.
 */
export function useChatAvailability(agentIndex: number | null): ChatAvailability {
  const { phase, tasks, pendingApprovalTaskId } = useAgencyStore()

  if (agentIndex === null) return { canChat: false, reason: '' }

  const agent = AGENTS[agentIndex]
  if (!agent || agent.isPlayer) return { canChat: false, reason: '' }

  const activeTask = tasks.find(
    (t) => t.assignedAgentIds.includes(agentIndex) && t.status === 'in_progress',
  )

  const isApprovalAgent =
    pendingApprovalTaskId != null &&
    tasks.some(
      (t) =>
        t.id === pendingApprovalTaskId &&
        t.assignedAgentIds.includes(agentIndex),
    )

  switch (phase) {
    case 'idle':
      // Only the AM accepts chat before a project starts
      if (agentIndex === AM_INDEX) return { canChat: true, reason: '' }
      return { canChat: false, reason: 'Waiting for project brief' }

    case 'briefing':
      if (agentIndex === AM_INDEX) return { canChat: true, reason: '' }
      return { canChat: false, reason: 'Team is being briefed' }

    case 'working':
    case 'awaiting_approval':
      // Approval flow always takes priority
      if (isApprovalAgent) return { canChat: true, reason: '' }
      // Busy agents cannot be interrupted
      if (activeTask)
        return {
          canChat: false,
          reason: `Working on: "${activeTask.title}"`,
        }
      // Idle agents can chat freely about the project
      return { canChat: true, reason: '' }

    case 'done':
      // AM is locked for chat when project is ready
      if (agentIndex === AM_INDEX) return { canChat: false, reason: 'Project ready for delivery' }
      return { canChat: false, reason: 'Project completed' }

    default:
      return { canChat: true, reason: '' }
  }
}
