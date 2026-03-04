import { useAgencyStore } from '../store/agencyStore'
import { AGENTS, AM_INDEX } from '../data/agents'

export interface ChatAvailability {
  canChat: boolean
  reason: string
}

/**
 * Derives whether the player can chat with a given agent based on
 * the current project phase and the agent's task state.
 */
export function useChatAvailability(agentIndex: number | null): ChatAvailability {
  const { phase, tasks } = useAgencyStore()

  if (agentIndex === null) return { canChat: false, reason: '' }

  const agent = AGENTS[agentIndex]
  if (!agent || agent.isPlayer) return { canChat: false, reason: '' }

  const activeTask = tasks.find(
    (t) => t.assignedAgentIds.includes(agentIndex) && t.status === 'in_progress',
  )

  switch (phase) {
    case 'idle':
      if (agentIndex === AM_INDEX) return { canChat: true, reason: '' }
      return { canChat: false, reason: 'Waiting for project brief' }

    case 'briefing':
      if (agentIndex === AM_INDEX) return { canChat: true, reason: '' }
      return { canChat: false, reason: 'Team is being briefed' }

    case 'working':
      if (activeTask)
        return {
          canChat: false,
          reason: `Working on: "${activeTask.title}"`,
        }
      return { canChat: true, reason: '' }

    case 'done':
      if (agentIndex === AM_INDEX) return { canChat: true, reason: '' }
      return { canChat: false, reason: 'Project completed' }

    default:
      return { canChat: true, reason: '' }
  }
}
