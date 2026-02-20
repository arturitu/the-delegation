// ─────────────────────────────────────────────────────────────
//  Corporate config
// ─────────────────────────────────────────────────────────────
export const COMPANY_NAME = 'FakeClaw Inc.';
export const PLAYER_INDEX = 0;
export const NPC_START_INDEX = 1;
export const TOTAL_COUNT = 2000;
export const NPC_COUNT = TOTAL_COUNT - 1; // 1999

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
//  Corporate Departments & Roles
// ─────────────────────────────────────────────────────────────

interface DepartmentConfig {
  name: string;
  color: string;
  roles: string[];
  expertise: string[][];
  missions: string[];
}

const DEPARTMENTS: DepartmentConfig[] = [
  {
    name: 'Production',
    color: '#22c55e', // Emerald/Green
    roles: [
      'Senior Software Engineer',
      'Frontend Developer',
      'Backend Architect',
      'DevOps Engineer',
      'QA Specialist',
      'Product Manager',
      'UI/UX Designer',
      'Data Scientist',
      'Mobile Lead',
      'Cloud Architect'
    ],
    expertise: [
      ['React', 'TypeScript', 'Node.js'],
      ['Python', 'Kubernetes', 'AWS'],
      ['Rust', 'Systems Programming', 'Performance'],
      ['PostgreSQL', 'Redis', 'System Design'],
      ['Figma', 'Design Systems', 'User Research'],
      ['PyTorch', 'Machine Learning', 'Data Pipelines'],
      ['Swift', 'Kotlin', 'Mobile Architecture'],
      ['CI/CD', 'Terraform', 'Infrastructure'],
      ['Cypress', 'Unit Testing', 'Automation'],
      ['Agile', 'Product Roadmap', 'Stakeholders']
    ],
    missions: [
      'Refactor the legacy authentication microservice',
      'Optimize the real-time data sync pipeline',
      'Implement the new design system across all platforms',
      'Reduce infrastructure costs by 20% this quarter',
      'Achieve 99.9% test coverage for the core API',
      'Launch the beta version of the mobile app',
      'Migrate the database to a multi-region setup',
      'Integrate the new AI recommendation engine',
      'Improve LCP and CLS scores for the landing page',
      'Automate the deployment process for staging environments'
    ]
  },
  {
    name: 'Sales',
    color: '#ef4444', // Red
    roles: [
      'Account Executive',
      'Sales Development Representative',
      'Customer Success Manager',
      'Solutions Architect',
      'Partnership Manager',
      'Sales Operations Lead',
      'Enterprise Sales Director',
      'Technical Sales Engineer',
      'Inside Sales Representative',
      'Channel Partner Manager'
    ],
    expertise: [
      ['CRM', 'Lead Generation', 'Negotiation'],
      ['Customer Retention', 'Upselling', 'Onboarding'],
      ['Technical Demos', 'Cloud Solutions', 'Pre-sales'],
      ['Strategic Partnerships', 'Networking', 'B2B'],
      ['Sales Forecasting', 'Data Analysis', 'Revenue Ops'],
      ['Enterprise Sales', 'Complex Deals', 'C-level Pitch'],
      ['Market Research', 'Competitor Analysis', 'Cold Outreach'],
      ['Contract Negotiation', 'Legal Compliance', 'Pricing'],
      ['Public Speaking', 'Presentations', 'Relationship Building'],
      ['Salesforce', 'HubSpot', 'Outreach.io']
    ],
    missions: [
      'Close the $500k contract with GlobalTech',
      'Increase the renewal rate to 95%',
      'Onboard 50 new mid-market customers this month',
      'Develop a new partnership strategy for the EU market',
      'Optimize the sales funnel conversion rate',
      'Deliver the technical demo for the upcoming RFP',
      'Expand the channel partner network in APAC',
      'Reduce the average sales cycle by 10 days',
      'Launch the new referral program for existing clients',
      'Conduct a win/loss analysis for the last quarter'
    ]
  },
  {
    name: 'Marketing',
    color: '#EF52BA', // Pink/Magenta
    roles: [
      'Content Strategist',
      'Growth Marketer',
      'SEO Specialist',
      'Social Media Manager',
      'Brand Designer',
      'Event Coordinator',
      'Performance Marketing Lead',
      'Copywriter',
      'Public Relations Manager',
      'Email Marketing Specialist'
    ],
    expertise: [
      ['Content Marketing', 'Storytelling', 'Editing'],
      ['A/B Testing', 'Conversion Optimization', 'Analytics'],
      ['SEO', 'SEM', 'Keyword Research'],
      ['Social Media Strategy', 'Community Management', 'Influencers'],
      ['Visual Identity', 'Typography', 'Illustration'],
      ['Event Planning', 'Logistics', 'Budgeting'],
      ['Paid Ads', 'Google Ads', 'Meta Ads'],
      ['Creative Writing', 'Messaging', 'Brand Voice'],
      ['Media Relations', 'Press Releases', 'Crisis Comms'],
      ['Marketing Automation', 'Segmentation', 'Drip Campaigns']
    ],
    missions: [
      'Launch the "Future of IT" brand campaign',
      'Increase organic traffic by 30% via SEO',
      'Organize the FakeClaw Annual Tech Summit',
      'Achieve a 5% click-through rate on the new ad set',
      'Publish the 2026 Industry Trends whitepaper',
      'Grow the LinkedIn community to 100k followers',
      'Redesign the corporate website for better conversion',
      'Secure 5 major media placements for the product launch',
      'Optimize the customer acquisition cost (CAC)',
      'Develop the messaging for the new enterprise tier'
    ]
  },
  {
    name: 'Finance',
    color: '#eab308', // Yellow
    roles: [
      'Financial Controller',
      'Financial Analyst',
      'Accountant',
      'Payroll Manager',
      'Tax Specialist',
      'Treasury Manager',
      'Internal Auditor',
      'Procurement Lead',
      'Investor Relations Manager',
      'FP&A Director'
    ],
    expertise: [
      ['Financial Modeling', 'Budgeting', 'Forecasting'],
      ['GAAP', 'IFRS', 'Financial Reporting'],
      ['Payroll Processing', 'Benefits Admin', 'Compliance'],
      ['Tax Planning', 'Audit Support', 'Corporate Tax'],
      ['Cash Flow Management', 'Risk Assessment', 'Banking'],
      ['Internal Controls', 'SOX Compliance', 'Process Improvement'],
      ['Strategic Sourcing', 'Vendor Management', 'Cost Control'],
      ['Investor Comms', 'Equity Research', 'SEC Filings'],
      ['ERP Systems', 'NetSuite', 'SAP'],
      ['Mergers & Acquisitions', 'Due Diligence', 'Valuation']
    ],
    missions: [
      'Finalize the Q1 financial statements',
      'Reduce operational expenses by 5%',
      'Implement the new automated expense system',
      'Prepare the documentation for the upcoming external audit',
      'Optimize the company\'s tax strategy for 2026',
      'Manage the $10M treasury portfolio',
      'Negotiate better terms with top 10 vendors',
      'Prepare the investor deck for the Series C round',
      'Streamline the payroll process for international employees',
      'Conduct a deep dive into the unit economics of the SaaS model'
    ]
  },
  {
    name: 'People',
    color: '#7C8289',
    roles: ['Chief People Officer'],
    expertise: [['Human Resources', 'Culture', 'Talent Strategy']],
    missions: ['Foster a world-class culture and employee experience']
  }
];

const PERSONALITIES: string[] = [
  'Direct and pragmatic, focused on KPIs',
  'Highly collaborative, always seeking consensus',
  'Analytical and data-driven, skeptical of intuition',
  'Visionary and ambitious, pushes boundaries',
  'Methodical and detail-oriented, follows procedure',
  'Empathetic and supportive, great team player',
  'Results-oriented, thrives under pressure',
  'Creative and unconventional, thinks outside the box'
];

// ─────────────────────────────────────────────────────────────
//  Generation
// ─────────────────────────────────────────────────────────────
function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

const _agents: AgentData[] = [];

// Index 0: CEO (Player)
_agents.push({
  index: 0,
  department: 'Executive',
  role: 'CEO',
  expertise: ['Strategy', 'Leadership', 'Vision'],
  mission: 'Lead FakeClaw Inc. to market dominance',
  personality: 'Decisive and inspiring leader',
  isPlayer: true,
  color: '#7EACEA', // Light Blue
});

// Indices 1-99: Employees
const otherDepts = DEPARTMENTS.filter(d => d.name !== 'People');
const peopleDept = DEPARTMENTS.find(d => d.name === 'People')!;

for (let i = 1; i < TOTAL_COUNT; i++) {
  let dept: DepartmentConfig;
  let n: number;
  let roleIdx: number;

  if (i === 1) {
    // Special case: Only one NPC for People department
    dept = peopleDept;
    n = 0;
    roleIdx = 0;
  } else {
    // Distribute the rest among other departments
    n = i - 2;
    dept = otherDepts[n % otherDepts.length];
    roleIdx = Math.floor(n / otherDepts.length) % dept.roles.length;
  }

  _agents.push({
    index: i,
    department: dept.name,
    role: dept.roles[roleIdx],
    expertise: dept.expertise[roleIdx],
    mission: pick(dept.missions, n),
    personality: pick(PERSONALITIES, n),
    isPlayer: false,
    color: dept.color,
  });
}

export const AGENTS: AgentData[] = _agents;

export function getAgent(index: number): AgentData | undefined {
  return _agents[index];
}
