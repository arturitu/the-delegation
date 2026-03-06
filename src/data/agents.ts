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
  // ── 1. Unboring dot net ─────────────────────────
  {
    id: 'marketing-agency',
    companyName: 'Unboring.net',
    companyType: 'Creative & Strategy Agency',
    companyDescription: 'A full-service creative agency covering branding, design, development and go-to-market strategy.',
    color: '#4387E2',
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
        color: '#4387E2',
      },
      {
        index: 2,
        department: 'UX/UI',
        role: 'Designer',
        expertise: ['UI/UX', 'Aesthetics', 'Branding'],
        mission: 'Ensure the aesthetics and user experience are exceptional.',
        personality: 'Creative, detail-oriented, and focused on visual harmony.',
        isPlayer: false,
        color: '#eab308',
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

  // ── 2. Game Studio ──────────────────────────────────────────
  {
    id: 'game-studio',
    companyName: 'Pixxel AI Games',
    companyType: 'Indie Game Studio',
    companyDescription: 'A specialized game development studio focused on creating the next viral hit. Our goal is to craft the perfect prompt for a groundbreaking game.',
    color: '#22c55e',
    agents: [
      {
        index: 0,
        department: 'Visionary',
        role: 'Lead Visionary',
        expertise: ['Game Concepts', 'Core Mechanics', 'Player Experience'],
        mission: 'Define the core essence of a new game and get a perfect prompt to generate it.',
        personality: 'Passionate gamer, imaginative, and focused on "fun factor".',
        isPlayer: true,
        color: '#7EACEA',
      },
      {
        index: 1,
        department: 'Direction',
        role: 'Game Director',
        expertise: ['Game Design', 'Systems Design', 'World Building'],
        mission: 'Turn raw ideas into structured game mechanics and loop systems.',
        personality: 'Analytical, visionary, and balanced.',
        isPlayer: false,
        color: '#22c55e',
      },
      {
        index: 2,
        department: 'Engineering',
        role: 'Technical Architect',
        expertise: ['Game Engines', 'AI Systems', 'Prompt Engineering'],
        mission: 'Ensure the game concept is technically feasible and translate it into a high-fidelity generation prompt.',
        personality: 'Calculated, tech-obsessed, and precise.',
        isPlayer: false,
        color: '#4DECAC',
      },
    ],
  },

  // ── 3. Music Production ────────────────────────────────
  {
    id: 'music-production',
    companyName: 'SonicAI Bloom Records',
    companyType: 'Music Promotion & Production',
    companyDescription: 'A musical agency dedicated to composing the perfect song prompt by harmonizing rhythm, melody, and lyrics.',
    color: '#E97B21',
    agents: [
      {
        index: 0,
        department: 'Artist',
        role: 'Artist',
        expertise: ['Vibe', 'Inspiration', 'Mood'],
        mission: 'Communicate my musical vision to create the perfect prompt for my next hit song.',
        personality: 'Expressive, emotional, and creatively driven.',
        isPlayer: true,
        color: '#7EACEA',
      },
      {
        index: 1,
        department: 'Production',
        role: 'Music Producer',
        expertise: ['Orchestration', 'Arrangement', 'Direction'],
        mission: 'Coordinate the rhythmic, harmonic, and lyrical specialists to realize the artist\'s vision.',
        personality: 'Experienced, visionary, and a natural leader.',
        isPlayer: false,
        color: '#E97B21',
      },
      {
        index: 2,
        department: 'Rhythm',
        role: 'Rhythm Expert',
        expertise: ['Beats', 'Groove', 'Percussion', 'Tempo'],
        mission: 'Define the rhythmic foundation and energy of the track.',
        personality: 'High-energy, focused on the "feel" and timing.',
        isPlayer: false,
        color: '#BFE543',
      },
      {
        index: 3,
        department: 'Harmony',
        role: 'Harmony Expert',
        expertise: ['Chords', 'Progression', 'Texturing'],
        mission: 'Build the harmonic structure and emotional depth of the song.',
        personality: 'Sophisticated, attentive to detail, and atmospheric.',
        isPlayer: false,
        color: '#F7E77C',
      },
      {
        index: 4,
        department: 'Melody',
        role: 'Melody Expert',
        expertise: ['Hooks', 'Leads', 'Counter-melody'],
        mission: 'Craft a memorable and catchy melodic hook that defines the song.',
        personality: 'Creative, intuitive, and focused on catchiness.',
        isPlayer: false,
        color: '#DDC733',
      },
      {
        index: 5,
        department: 'Lyrics',
        role: 'Lyrics Expert',
        expertise: ['Storytelling', 'Rhyme', 'Metaphor', 'Tone'],
        mission: 'Write powerful, evocative lyrics that resonate with the audience.',
        personality: 'Poetic, profound, and weight-conscious wordsmith.',
        isPlayer: false,
        color: '#FFB077',
      },
    ],
  },

  // ── 4. Restaurant ─────────────────────────────────────
  {
    id: 'restaurant',
    companyName: 'Le Robot Gourmet',
    companyType: 'Experimental Restaurant',
    companyDescription: 'A futuristic bistro where culinary art meets artificial intelligence. Our goal is to design a unique, multi-sensory dining experience.',
    color: '#EF52BA',
    agents: [
      {
        index: 0,
        department: 'Patron',
        role: 'Patron',
        expertise: ['Taste', 'Cravings', 'Occasion'],
        mission: 'Describe my ideal imaginary meal and get a complete conceptual recipe and atmosphere guide.',
        personality: 'Sophisticated palate, curious about new flavors.',
        isPlayer: true,
        color: '#7EACEA',
      },
      {
        index: 1,
        department: 'Kitchen',
        role: 'Executive Chef',
        expertise: ['Flavor Pairing', 'Molecular Gastronomy', 'Menu Design'],
        mission: 'Conceptualize the main course and its unique flavor profile.',
        personality: 'Passionate, slightly temperamental, but a genius with ingredients.',
        isPlayer: false,
        color: '#EF52BA',
      },
      {
        index: 2,
        department: 'Cellar',
        role: 'Sommelier',
        expertise: ['Wine Pairing', 'Mixology', 'Tasting Notes'],
        mission: 'Design the perfect beverage pairings to elevate the culinary experience.',
        personality: 'Refined, eloquent, and obsessed with vintage.',
        isPlayer: false,
        color: '#F7A4EA',
      },
      {
        index: 3,
        department: 'Ambiance',
        role: 'Experience Designer',
        expertise: ['Lighting', 'Soundscape', 'Plating Aesthetics'],
        mission: 'Define the atmosphere, visual presentation, and sensory environment of the meal.',
        personality: 'Aesthetic-focused, avant-garde, and detail-oriented.',
        isPlayer: false,
        color: '#FEC7F2',
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
