import { USER_COLOR } from '../theme/brand';

export const USER_ID = 'user';
export const USER_NAME = 'Client';
export { USER_COLOR };
export const DEFAULT_AGENTIC_SET_ID = 'single-agent';
export const DEFAULT_MAX_ITERATIONS = 5;

export interface AgentNode {
  id: string;
  index: number;
  name: string;
  description?: string;
  instruction: string;
  color: string;
  model: string;
  nextId?: string;
  retryId?: string;
  maxIterations?: number;
  position?: { x: number; y: number };
  subagents?: AgentNode[];
  pattern?: string;
  skills?: string[];
}

export interface AgenticSystem {
  id: string;
  teamName: string;
  teamType: string;
  teamDescription: string;
  color: string;
  user: {
    index: number;
    model: string;
    position?: { x: number; y: number };
  };
  leadAgent: AgentNode;
}

export const AGENTIC_SETS: AgenticSystem[] = [
  // 1. Single Agent (The Solo Expert)
  {
    id: 'single-agent',
    teamName: 'Solo Expert',
    teamType: 'Consultancy',
    teamDescription: 'A single specialized agent for quick tasks.',
    color: '#7EACEA',
    user: { index: 0, model: 'Human', position: { x: 0, y: 0 } },
    leadAgent: {
      id: 'expert',
      index: 1,
      name: 'Expert',
      description: 'Generalized expert agent.',
      instruction: 'Provide direct and concise answers.',
      color: '#7EACEA',
      model: 'gemini-3-flash-preview',
      position: { x: 0, y: 150 },
      skills: ['core-skill']
    }
  },

  // 2. Sequential Pipeline (The Content Factory)
  {
    id: 'sequential-pipeline',
    teamName: 'Content Factory',
    teamType: 'Production Line',
    teamDescription: 'A multi-step process: Research -> Write -> Translate.',
    color: '#f97316',
    user: { index: 0, model: 'Human', position: { x: 0, y: 0 } },
    leadAgent: {
      id: 'researcher',
      index: 1,
      name: 'Researcher',
      description: 'Gathers information.',
      instruction: 'Find key facts about the topic.',
      color: '#f97316',
      model: 'gemini-3-flash-preview',
      nextId: 'writer',
      position: { x: 0, y: 150 },
      skills: ['core-skill'],
      subagents: [
        {
          id: 'writer',
          index: 2,
          name: 'Writer',
          description: 'Drafts the content.',
          instruction: 'Convert facts into a narrative.',
          color: '#eab308',
          model: 'gemini-3-flash-preview',
          nextId: 'translator',
          position: { x: 0, y: 400 },
          skills: ['core-skill']
        },
        {
          id: 'translator',
          index: 3,
          name: 'Translator',
          description: 'Translates to Spanish.',
          instruction: 'Translate the draft into professional Spanish.',
          color: '#22c55e',
          model: 'gemini-3-flash-preview',
          position: { x: 0, y: 650 },
          skills: ['core-skill']
        }
      ]
    }
  },

  // 3. Parallel Team (The Creative Squad)
  {
    id: 'parallel-team',
    teamName: 'Creative Squad',
    teamType: 'Creative Agency',
    teamDescription: 'Lead manages multiple workers simultaneously.',
    color: '#a855f7',
    user: { index: 0, model: 'Human', position: { x: 0, y: 0 } },
    leadAgent: {
      id: 'director',
      index: 1,
      name: 'Art Director',
      description: 'Orchestrates the creative vision.',
      instruction: 'Delegate design and copy tasks to your team.',
      color: '#a855f7',
      model: 'gemini-3-flash-preview',
      position: { x: 0, y: 150 },
      skills: ['core-skill'],
      subagents: [
        {
          id: 'designer',
          index: 2,
          name: 'Designer',
          description: 'Creates visual assets.',
          instruction: 'Design a modern UI layout.',
          color: '#ec4899',
          model: 'gemini-3-flash-preview',
          position: { x: -200, y: 400 }
        },
        {
          id: 'copywriter',
          index: 3,
          name: 'Copywriter',
          description: 'Writes marketing text.',
          instruction: 'Write compelling copy for the landing page.',
          color: '#3b82f6',
          model: 'gemini-3-flash-preview',
          position: { x: 200, y: 400 }
        }
      ]
    }
  },

  // 4. Generator / Critic (The Quality Loop)
  {
    id: 'generator-critic',
    teamName: 'Code Quality',
    teamType: 'Engineering',
    teamDescription: 'Iterative refinement cycle between Coder and Reviewer.',
    color: '#06b6d4',
    user: { index: 0, model: 'Human', position: { x: 0, y: 0 } },
    leadAgent: {
      id: 'coder',
      index: 1,
      name: 'Coder',
      description: 'Writes the initial implementation.',
      instruction: 'Write robust Python code for the requested feature.',
      color: '#06b6d4',
      model: 'gemini-3-flash-preview',
      nextId: 'reviewer',
      position: { x: 0, y: 150 },
      skills: ['core-skill'],
      subagents: [
        {
          id: 'reviewer',
          index: 2,
          name: 'Reviewer',
          description: 'Ensures quality and style standards.',
          instruction: 'Check for bugs. If found, use request_revision.',
          color: '#ef4444',
          model: 'gemini-3-flash-preview',
          retryId: 'coder',
          position: { x: 0, y: 400 },
          pattern: 'reviewer',
          skills: ['core-skill']
        }
      ]
    }
  },

  // 5. Multi-Level Org (Recursive Hierarchy)
  {
    id: 'recursive-hierarchy',
    teamName: 'Global Corp',
    teamType: 'Corporate',
    teamDescription: 'Director -> Manager -> Worker hierarchy.',
    color: '#64748b',
    user: { index: 0, model: 'Human', position: { x: 0, y: 0 } },
    leadAgent: {
      id: 'ceo',
      index: 1,
      name: 'CEO',
      description: 'Strategic lead.',
      instruction: 'Lead the organization towards long-term goals.',
      color: '#64748b',
      model: 'gemini-3-flash-preview',
      position: { x: 0, y: 150 },
      skills: ['core-skill'],
      subagents: [
        {
          id: 'manager',
          index: 2,
          name: 'Manager',
          description: 'Operational lead.',
          instruction: 'Manage day-to-day operations and delegate to workers.',
          color: '#94a3b8',
          model: 'gemini-3-flash-preview',
          position: { x: 0, y: 400 },
          subagents: [
            {
              id: 'worker',
              index: 3,
              name: 'Worker',
              description: 'Execution specialist.',
              instruction: 'Execute the tasks assigned by the manager.',
              color: '#cbd5e1',
              model: 'gemini-3-flash-preview',
              position: { x: 0, y: 650 }
            }
          ]
        }
      ]
    }
  },

  // 6. Human Evaluation (HITL)
  {
    id: 'hitl-system',
    teamName: 'Guided Agent',
    teamType: 'Assisted Search',
    teamDescription: 'Agent performs task but requires human sign-off.',
    color: '#10b981',
    user: { index: 0, model: 'Human', position: { x: 0, y: 0 } },
    leadAgent: {
      id: 'assisted-agent',
      index: 1,
      name: 'Explorer',
      description: 'Autonomous searcher with human safety.',
      instruction: 'Find data but wait for human approval before proceeding.',
      color: '#10b981',
      model: 'gemini-3-flash-preview',
      retryId: 'user',
      position: { x: 0, y: 150 }
    }
  },

  // 7. Circular Refinement (State Machine)
  {
    id: 'circular-refinement',
    teamName: 'Double Loop',
    teamType: 'Refinement',
    teamDescription: 'Two agents improving each other in a circle.',
    color: '#8b5cf6',
    user: { index: 0, model: 'Human', position: { x: 0, y: 0 } },
    leadAgent: {
      id: 'agent-a',
      index: 1,
      name: 'Synthesizer',
      description: 'Part A of the circle.',
      instruction: 'Create content and pass it to Agent B.',
      color: '#8b5cf6',
      model: 'gemini-3-flash-preview',
      nextId: 'agent-b',
      position: { x: -150, y: 150 },
      subagents: [
        {
          id: 'agent-b',
          index: 2,
          name: 'Refiner',
          description: 'Part B of the circle.',
          instruction: 'Improve content and pass it back to Agent A.',
          color: '#d946ef',
          model: 'gemini-3-flash-preview',
          nextId: 'agent-a',
          position: { x: 150, y: 150 }
        }
      ]
    }
  },

  // 8. Orchestrator-Workers (Complex Router)
  {
    id: 'orchestrator-router',
    teamName: 'Smart Router',
    teamType: 'Dispatcher',
    teamDescription: 'Lead acts as a router for different domains.',
    color: '#14b8a6',
    user: { index: 0, model: 'Human', position: { x: 0, y: 0 } },
    leadAgent: {
      id: 'dispatcher',
      index: 1,
      name: 'Dispatcher',
      description: 'Roots tasks to the right specialist.',
      instruction: 'Identify task type and delegate to Code or Art.',
      color: '#14b8a6',
      model: 'gemini-3-flash-preview',
      position: { x: 0, y: 150 },
      subagents: [
        {
          id: 'code-team',
          index: 2,
          name: 'Code Specialist',
          description: 'Handles technical requests.',
          instruction: 'Execute code-related tasks.',
          color: '#0d9488',
          model: 'gemini-3-flash-preview',
          position: { x: -200, y: 400 }
        },
        {
          id: 'art-team',
          index: 3,
          name: 'Art Specialist',
          description: 'Handles creative requests.',
          instruction: 'Execute art-related tasks.',
          color: '#f43f5e',
          model: 'gemini-3-flash-preview',
          position: { x: 200, y: 400 }
        }
      ]
    }
  }
];

export function getAgentSet(id: string, customSystems: AgenticSystem[] = []): AgenticSystem {
  return (
    customSystems.find((s) => s.id === id) ||
    AGENTIC_SETS.find((s) => s.id === id) ||
    AGENTIC_SETS[0]
  );
}

export function getAllAgents(system: AgenticSystem): AgentNode[] {
  const agents: AgentNode[] = [];
  const traverse = (node: AgentNode) => {
    agents.push(node);
    if (node.subagents) {
      node.subagents.forEach(traverse);
    }
  };
  traverse(system.leadAgent);
  return agents;
}

export function getAllCharacters(system: AgenticSystem): AgentNode[] {
  const userNode: AgentNode = {
    id: USER_ID,
    index: system.user.index,
    name: USER_NAME,
    color: USER_COLOR,
    model: system.user.model,
    instruction: '',
  };
  return [userNode, ...getAllAgents(system)];
}
