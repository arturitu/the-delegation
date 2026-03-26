import { LLMToolDefinition } from '../llm/types';

export type ADKPattern = 'reviewer' | 'generator' | 'pipeline' | 'tool-wrapper' | 'inversion';

export interface SkillMetadata {
  name: string;
  description: string;
  tools?: LLMToolDefinition[];
  pattern?: ADKPattern;
  [key: string]: any;
}

export interface AgentSkill {
  id: string;
  metadata: SkillMetadata;
  instructions: string;
  assets?: Record<string, string>; // name -> content
  references?: Record<string, string>; // name -> content
  isUserSkill?: boolean;
}
