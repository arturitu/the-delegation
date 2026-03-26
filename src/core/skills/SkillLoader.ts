import yaml from 'js-yaml';
import { AgentSkill, SkillMetadata } from './types';

/**
 * Internal IndexedDB helper for larger storage capacity than localStorage.
 */
class SkillDb {
  private static DB_NAME = 'AgenticSkillsDB';
  private static STORE_NAME = 'user_skills';
  private static DB_VERSION = 1;

  static async open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  static async save(skill: AgentSkill): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      tx.objectStore(this.STORE_NAME).put(skill);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  static async getAll(): Promise<AgentSkill[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const request = tx.objectStore(this.STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

/**
 * SkillLoader
 * 
 * Responsible for discovering and parsing SKILL.md files at compile time (via Vite)
 * or runtime (via dynamic loading).
 */
export class SkillLoader {
  private static skills: Map<string, AgentSkill> = new Map();

  /**
   * Initializes the loader.
   */
  static async init() {
    this.skills.clear();
    await this.loadBuiltInSkills();
    await this.loadUserSkills();
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
   * Loads custom skills saved in IndexedDB.
   */
  private static async loadUserSkills() {
    // Migration from localStorage if needed
    const oldSaved = localStorage.getItem('user_skills_registry');
    if (oldSaved) {
      try {
        const legacySkills = JSON.parse(oldSaved) as AgentSkill[];
        for (const s of legacySkills) {
          await SkillDb.save({ ...s, isUserSkill: true });
        }
        localStorage.removeItem('user_skills_registry');
        console.log('[SkillLoader] Migrated skills from localStorage to IndexedDB');
      } catch (e) {
        console.error('[SkillLoader] Migration failed:', e);
      }
    }

    try {
      const userSkills = await SkillDb.getAll();
      userSkills.forEach(s => {
        s.isUserSkill = true;
        this.skills.set(s.id, s);
      });
    } catch (e) {
      console.error('[SkillLoader] Error loading user skills from IndexedDB:', e);
    }
  }

  /**
   * Saves a new skill to IndexedDB.
   */
  static async saveUserSkill(skill: AgentSkill) {
    const userSkill = { ...skill, isUserSkill: true };
    await SkillDb.save(userSkill);
    this.skills.set(skill.id, userSkill);
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
