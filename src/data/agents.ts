// ─────────────────────────────────────────────────────────────
//  Corporate config
// ─────────────────────────────────────────────────────────────
import { AgentData } from '../types';
export type { AgentData };

export const COMPANY_NAME = 'FakeClaw Lab';
export const PLAYER_INDEX = 0;
export const NPC_START_INDEX = 1;
export const AM_INDEX = 1;

// ─────────────────────────────────────────────────────────────
//  Agents Definition
// ─────────────────────────────────────────────────────────────

export const AGENTS: AgentData[] = [
  {
    index: 0,
    department: 'Client',
    role: 'Client',
    expertise: ['Vision', 'Idea', 'Requirements'],
    mission: 'Obtain a solid and viable proposal for my business idea.',
    personality: 'Demanding but open to professional suggestions.',
    isPlayer: true,
    color: '#7EACEA',
  },
  {
    index: 1,
    department: 'Coordination',
    role: 'Account Manager',
    expertise: ['Orchestration', 'Project Management', 'Communication'],
    mission: "Break down the client's request into actionable missions for the team.",
    personality: 'Organized, efficient, and central orchestrator.',
    isPlayer: false,
    color: '#eab308', // Yellow (Finance/Account)
  },
  {
    index: 2,
    department: 'Development',
    role: 'Full Stack Developer',
    expertise: ['UI/UX', 'Design', 'Development', 'Marketing', 'Business'],
    mission: 'Full stack development, design, and implementation across multiple domains.',
    personality: 'Creative, detail-oriented, and focused on visual harmony.',
    isPlayer: false,
    color: '#7C8289', // Grey (People)
  }
];

export function getAgent(index: number): AgentData | undefined {
  return AGENTS.find(a => a.index === index);
}
