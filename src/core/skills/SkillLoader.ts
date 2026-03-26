import yaml from 'js-yaml';
import { AgentSkill, SkillMetadata } from './types';

/**
 * SkillLoader
 * 
 * Responsible for discovering and parsing SKILL.md files at compile time (via Vite)
 * or runtime (via dynamic loading).
 */
export class SkillLoader {
  private static skills: Map<string, AgentSkill> = new Map();
  private static USER_SKILLS_KEY = 'user_skills_registry';

  /**
   * Initializes the loader.
   */
  static async init() {
    this.skills.clear();
    await this.loadBuiltInSkills();
    this.loadUserSkills();
  }

  /**
   * Loads skills from src/skills folder using Vite globbing.
   */
  private static async loadBuiltInSkills() {
    try {
      // @ts-ignore
      const mdModules = import.meta.glob('/src/skills/**/SKILL.md', { query: '?raw', eager: true });
      // Load assets and references too
      // @ts-ignore
      const assetModules = import.meta.glob('/src/skills/**/assets/*.{md,json,txt}', { query: '?raw', eager: true });
      // @ts-ignore
      const refModules = import.meta.glob('/src/skills/**/references/*.{md,json,txt}', { query: '?raw', eager: true });

      for (const path in mdModules) {
        const content = (mdModules[path] as any).default || mdModules[path];
        const skill = this.parseSkill(path, content);
        if (skill) {
          // Find adjacent assets and references
          const skillDir = path.replace('/SKILL.md', '');
          
          skill.assets = this.getGroupedModules(assetModules, `${skillDir}/assets/`);
          skill.references = this.getGroupedModules(refModules, `${skillDir}/references/`);

          this.skills.set(skill.id, skill);
        }
      }
    } catch (error) {
      console.error('[SkillLoader] Failed to load built-in skills:', error);
    }
  }

  private static getGroupedModules(modules: Record<string, any>, prefix: string): Record<string, string> {
    const grouped: Record<string, string> = {};
    for (const path in modules) {
      if (path.startsWith(prefix)) {
        const fileName = path.split('/').pop() || path;
        grouped[fileName] = (modules[path] as any).default || modules[path];
      }
    }
    return grouped;
  }

  /**
   * Loads custom skills saved in localStorage.
   */
  private static loadUserSkills() {
    const saved = localStorage.getItem(this.USER_SKILLS_KEY);
    if (saved) {
      try {
        const userSkills = JSON.parse(saved) as AgentSkill[];
        userSkills.forEach(s => {
          s.isUserSkill = true;
          this.skills.set(s.id, s);
        });
      } catch (e) {
        console.error('[SkillLoader] Error loading user skills:', e);
      }
    }
  }

  /**
   * Saves a new skill to user local storage.
   */
  static saveUserSkill(skill: AgentSkill) {
    const userSkills = Array.from(this.skills.values()).filter(s => s.isUserSkill);
    const existingIndex = userSkills.findIndex(s => s.id === skill.id);
    
    if (existingIndex >= 0) userSkills[existingIndex] = { ...skill, isUserSkill: true };
    else userSkills.push({ ...skill, isUserSkill: true });

    localStorage.setItem(this.USER_SKILLS_KEY, JSON.stringify(userSkills));
    this.skills.set(skill.id, { ...skill, isUserSkill: true });
  }

  /**
   * Parses a SKILL.md content into an AgentSkill object.
   */
  public static parseSkill(path: string, content: string, explicitId?: string): AgentSkill | null {
    const parts = content.split('---');
    if (parts.length < 3) return null;

    try {
      let rawMetadata = yaml.load(parts[1]) as any;
      
      // Flatten if it's nested under 'metadata' (some standards do this)
      if (rawMetadata.metadata && typeof rawMetadata.metadata === 'object' && !Array.isArray(rawMetadata.metadata)) {
        rawMetadata = { ...rawMetadata, ...rawMetadata.metadata };
        delete rawMetadata.metadata;
      }
      
      const metadata = rawMetadata as SkillMetadata;
      const instructions = parts.slice(2).join('---').trim();
      
      // Resolve ID: explicitId > metadata.id > metadata.name > path-based ID
      let id = explicitId || 
               metadata.id || 
               metadata.name?.toLowerCase().replace(/ /g, '-') || 
               'unknown-skill';

      if (!explicitId && !metadata.id && !metadata.name) {
        const pathParts = path.split('/');
        if (pathParts.length >= 2) {
          id = pathParts[pathParts.length - 2];
        }
      }

      return { id, metadata, instructions };
    } catch (e) {
      console.error('[SkillLoader] Parsing error:', e);
      return null;
    }
  }

  static getSkill(id: string): AgentSkill | undefined {
    return this.skills.get(id);
  }

  static getAllSkills(): AgentSkill[] {
    return Array.from(this.skills.values());
  }
}
