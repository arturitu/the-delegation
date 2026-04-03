import { AgentNode, AgenticSystem, getAllAgents } from '../../data/agents';

export interface AgentPermissions {
  canProposeTask: boolean;
  canConsult: boolean;
  canDeliver: boolean;
}

/**
 * Utility class to handle agent hierarchy and "reach" logic.
 * Decoupled from simulation and UI.
 */
export class AgentHierarchy {
  /**
   * Finds the direct subordinates (children) of an agent.
   */
  public static getDirectSubordinates(system: AgenticSystem, agentIndex: number): AgentNode[] {
    const all = getAllAgents(system);
    const agent = all.find(a => a.index === agentIndex);
    return agent?.subagents || [];
  }

  /**
   * Finds the direct superior (parent) of an agent.
   * Returns 0 for the User if the agent is the Lead Agent.
   */
  public static getDirectSuperiorIndex(system: AgenticSystem, agentIndex: number): number {
    if (agentIndex === 1) return 0; // Lead Agent reports to User

    const all = getAllAgents(system);
    
    // Recursive search for parent
    const findParent = (nodes: AgentNode[], targetIndex: number, parentIndex: number): number | null => {
      for (const node of nodes) {
        if (node.index === targetIndex) return parentIndex;
        if (node.subagents) {
          const found = findParent(node.subagents, targetIndex, node.index);
          if (found !== null) return found;
        }
      }
      return null;
    };

    const parent = findParent([system.leadAgent], agentIndex, 1);
    return parent ?? 0;
  }

  /**
   * Returns the list of indices an agent is allowed to interact with.
   * Reach = Direct Subordinates + Direct Superior + User (0).
   */
  public static getAgentReachIndices(system: AgenticSystem, agentIndex: number): number[] {
    const subordinates = this.getDirectSubordinates(system, agentIndex).map(s => s.index);
    const superior = this.getDirectSuperiorIndex(system, agentIndex);
    
    const reach = new Set([0, superior, ...subordinates]);
    // Remove self from reach
    reach.delete(agentIndex);
    
    return Array.from(reach);
  }

  /**
   * Returns tool permissions for an agent based on their role and hierarchy.
   */
  public static getPermissions(system: AgenticSystem, agentIndex: number, phase: string): AgentPermissions {
    const subordinates = this.getDirectSubordinates(system, agentIndex);
    const isLead = agentIndex === 1;

    return {
      canProposeTask: phase === 'working' && subordinates.length > 0,
      canConsult: phase === 'working' || phase === 'idle',
      canDeliver: phase === 'working' && isLead
    };
  }
}
