// ─────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────
export const PLAYER_INDEX = 0;
export const NPC_START_INDEX = 1;
export const DEFAULT_AGENT_SET_ID = 'marketing-agency';

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

export interface AgentSet {
  id: string;
  companyName: string;
  companyType: string;
  companyDescription: string;
  color: string;
  agents: AgentData[];
}

// ─────────────────────────────────────────────────────────────
//  Agent Sets
// ─────────────────────────────────────────────────────────────
export const AGENT_SETS: AgentSet[] = [
  // ── 1. Marketing Agency (default) ─────────────────────────
  {
    id: 'marketing-agency',
    companyName: 'Vivid Creative Agency',
    companyType: 'Creative & Strategy Agency',
    companyDescription: 'A full-service creative agency covering branding, design, development and go-to-market strategy.',
    color: '#eab308',
    agents: [
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
        color: '#eab308',
      },
      {
        index: 2,
        department: 'UX/UI',
        role: 'Designer',
        expertise: ['UI/UX', 'Aesthetics', 'Branding'],
        mission: 'Ensure the aesthetics and user experience are exceptional.',
        personality: 'Creative, detail-oriented, and focused on visual harmony.',
        isPlayer: false,
        color: '#7C8289',
      },
      {
        index: 3,
        department: 'Engineering',
        role: 'Developer',
        expertise: ['Architecture', 'Technical Feasibility', 'Tech Stack'],
        mission: 'Evaluate technical feasibility and define the necessary architecture.',
        personality: 'Pragmatic, technical, and focused on robustness.',
        isPlayer: false,
        color: '#22c55e',
      },
      {
        index: 4,
        department: 'Marketing',
        role: 'Marketing Expert',
        expertise: ['Market Analysis', 'Target Audience', 'Narrative'],
        mission: 'Analyze the target audience and build the sales narrative.',
        personality: 'Strategic, persuasive, and market-savvy.',
        isPlayer: false,
        color: '#EF52BA',
      },
      {
        index: 5,
        department: 'Business',
        role: 'Sales Lead',
        expertise: ['Profitability', 'Business Viability', 'Sales'],
        mission: 'Act as the final filter, ensuring the plan is profitable and viable.',
        personality: 'Critical, realistic, and focused on return on investment.',
        isPlayer: false,
        color: '#ef4444',
      },
    ],
  },

  // ── 2. Dev Studio ──────────────────────────────────────────
  {
    id: 'dev-studio',
    companyName: 'BuildFast Studio',
    companyType: 'Independent Dev Studio',
    companyDescription: 'A lean, execution-focused studio where a project lead and a full stack developer ship products from brief to delivery.',
    color: '#22c55e',
    agents: [
      {
        index: 0,
        department: 'Client',
        role: 'Client',
        expertise: ['Vision', 'Idea', 'Requirements'],
        mission: 'Get a clear, actionable plan for my product or feature.',
        personality: 'Direct and results-oriented.',
        isPlayer: true,
        color: '#7EACEA',
      },
      {
        index: 1,
        department: 'Coordination',
        role: 'Project Lead',
        expertise: ['Scoping', 'Coordination', 'Delivery Management'],
        mission: "Translate the client's goals into a focused, executable plan and keep the developer on track.",
        personality: 'Methodical, pragmatic, and obsessed with shipping.',
        isPlayer: false,
        color: '#eab308',
      },
      {
        index: 2,
        department: 'Engineering',
        role: 'Full Stack Developer',
        expertise: ['UI/UX', 'Frontend', 'Backend', 'Architecture'],
        mission: 'Design and develop the full product — from interface to infrastructure.',
        personality: 'Hands-on, versatile, and detail-oriented.',
        isPlayer: false,
        color: '#22c55e',
      },
    ],
  },

  // ── 3. Startup Consultancy ────────────────────────────────
  {
    id: 'startup-consultancy',
    companyName: 'Launchpad Advisors',
    companyType: 'Startup Consulting Firm',
    companyDescription: 'An advisory firm that stress-tests early-stage ideas and shapes them into fundable, scalable businesses.',
    color: '#8b5cf6',
    agents: [
      {
        index: 0,
        department: 'Founder',
        role: 'Founder',
        expertise: ['Vision', 'Business Idea', 'Goals'],
        mission: 'Validate my startup concept and get a concrete path to market.',
        personality: 'Ambitious, passionate, but open to hard feedback.',
        isPlayer: true,
        color: '#7EACEA',
      },
      {
        index: 1,
        department: 'Advisory',
        role: 'Startup Advisor',
        expertise: ['Venture Strategy', 'Orchestration', 'Mentorship'],
        mission: "Coordinate the advisory team to build a comprehensive plan for the founder's startup.",
        personality: 'Experienced, candid, and energizing.',
        isPlayer: false,
        color: '#eab308',
      },
      {
        index: 2,
        department: 'Research',
        role: 'Business Analyst',
        expertise: ['Market Research', 'Competitive Landscape', 'Data'],
        mission: 'Map the competitive landscape and identify the key market opportunities.',
        personality: 'Analytical, evidence-driven, and thorough.',
        isPlayer: false,
        color: '#7C8289',
      },
      {
        index: 3,
        department: 'Product',
        role: 'Product Strategist',
        expertise: ['Product Roadmap', 'User Stories', 'MVP Scoping'],
        mission: 'Define the MVP scope and shape a roadmap from idea to first release.',
        personality: 'User-centric, structured, and pragmatic.',
        isPlayer: false,
        color: '#8b5cf6',
      },
      {
        index: 4,
        department: 'Finance',
        role: 'Investor Relations',
        expertise: ['Fundraising', 'Pitch Decks', 'Financial Projections'],
        mission: 'Craft the investment narrative and stress-test the financial model.',
        personality: 'Sharp, numbers-focused, and persuasive.',
        isPlayer: false,
        color: '#ef4444',
      },
    ],
  },

  // ── 4. Content Studio ─────────────────────────────────────
  {
    id: 'content-studio',
    companyName: 'Spark Content Studio',
    companyType: 'Content & Media Studio',
    color: '#EF52BA',
    companyDescription: 'A content-first studio that turns brand briefs into multi-channel storytelling strategies with measurable reach.',
    agents: [
      {
        index: 0,
        department: 'Brand',
        role: 'Brand Owner',
        expertise: ['Brand Vision', 'Audience', 'Goals'],
        mission: 'Get a compelling, consistent content strategy that grows my brand.',
        personality: 'Passionate about the brand, strong opinions on tone.',
        isPlayer: true,
        color: '#7EACEA',
      },
      {
        index: 1,
        department: 'Direction',
        role: 'Creative Director',
        expertise: ['Creative Strategy', 'Brand Voice', 'Orchestration'],
        mission: "Shape the brand's creative vision and coordinate the studio team.",
        personality: 'Visionary, decisive, and highly collaborative.',
        isPlayer: false,
        color: '#eab308',
      },
      {
        index: 2,
        department: 'Copywriting',
        role: 'Copywriter',
        expertise: ['Brand Storytelling', 'Headlines', 'Long-form Content'],
        mission: 'Write compelling copy that captures the brand voice across all channels.',
        personality: 'Witty, empathetic, and obsessed with the right word.',
        isPlayer: false,
        color: '#7C8289',
      },
      {
        index: 3,
        department: 'Social',
        role: 'Social Media Manager',
        expertise: ['Platform Strategy', 'Community', 'Viral Content'],
        mission: 'Build a social media playbook that drives engagement and community growth.',
        personality: 'Trend-aware, data-informed, and audience-obsessed.',
        isPlayer: false,
        color: '#EF52BA',
      },
      {
        index: 4,
        department: 'Growth',
        role: 'SEO Strategist',
        expertise: ['SEO', 'Content Distribution', 'Organic Growth'],
        mission: 'Maximize organic reach through search-optimized content strategy.',
        personality: 'Methodical, analytical, and growth-focused.',
        isPlayer: false,
        color: '#06b6d4',
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────
export function getAgentSet(id: string): AgentSet {
  return AGENT_SETS.find((s) => s.id === id) ?? AGENT_SETS[0];
}

export function getAgent(index: number, agents: AgentData[]): AgentData | undefined {
  return agents.find((a) => a.index === index);
}
