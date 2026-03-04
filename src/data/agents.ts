// ─────────────────────────────────────────────────────────────
//  Corporate config
// ─────────────────────────────────────────────────────────────
export const COMPANY_NAME = 'FakeClaw Lab';
export const PLAYER_INDEX = 0;
export const NPC_START_INDEX = 1;

// ─────────────────────────────────────────────────────────────
//  Agent data types
// ─────────────────────────────────────────────────────────────
export interface AgentData {
  index: number;
  department: string;
  role: string;
  expertise: string[];
  mission: string;
  personality: string;
  isPlayer: boolean;
  color: string;
}

// ─────────────────────────────────────────────────────────────
//  Agents Definition
// ─────────────────────────────────────────────────────────────

/**
 * Agents Definition
 */

// const ALL_AGENTS: AgentData[] = [
//   {
//     index: 0,
//     department: 'Client',
//     role: 'Client',
//     expertise: ['Vision', 'Idea', 'Requirements'],
//     mission: 'Obtain a solid and viable proposal for my business idea.',
//     personality: 'Demanding but open to professional suggestions.',
//     isPlayer: true,
//     color: '#7EACEA',
//   },
//   {
//     index: 1,
//     department: 'Coordination',
//     role: 'Account Manager',
//     expertise: ['Orchestration', 'Project Management', 'Communication'],
//     mission: "Break down the client's request into actionable missions for the team.",
//     personality: 'Organized, efficient, and central orchestrator.',
//     isPlayer: false,
//     color: '#eab308', // Yellow (Finance/Account)
//   },
//   {
//     index: 2,
//     department: 'UX/UI',
//     role: 'Designer',
//     expertise: ['UI/UX', 'Aesthetics', 'Branding'],
//     mission: 'Ensure the aesthetics and user experience are exceptional.',
//     personality: 'Creative, detail-oriented, and focused on visual harmony.',
//     isPlayer: false,
//     color: '#7C8289', // Grey (People)
//   },
//   {
//     index: 3,
//     department: 'Engineering',
//     role: 'Developer',
//     expertise: ['Architecture', 'Technical Feasibility', 'Tech Stack'],
//     mission: 'Evaluate technical feasibility and define the necessary architecture.',
//     personality: 'Pragmatic, technical, and focused on robustness.',
//     isPlayer: false,
//     color: '#22c55e', // Green (Production)
//   },
//   {
//     index: 4,
//     department: 'Marketing',
//     role: 'Marketing Expert',
//     expertise: ['Market Analysis', 'Target Audience', 'Narrative'],
//     mission: 'Analyze the target audience and build the sales narrative.',
//     personality: 'Strategic, persuasive, and market-savvy.',
//     isPlayer: false,
//     color: '#EF52BA', // Pink (Marketing)
//   },
//   {
//     index: 5,
//     department: 'Business',
//     role: 'Sales Lead',
//     expertise: ['Profitability', 'Business Viability', 'Sales'],
//     mission: 'Act as the final filter, ensuring the plan is profitable and viable.',
//     personality: 'Critical, realistic, and focused on return on investment.',
//     isPlayer: false,
//     color: '#ef4444', // Red (Sales)
//   }
// ];

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
