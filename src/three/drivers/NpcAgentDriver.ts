import { IAgentDriver } from '../../types';
import { CharacterController } from '../CharacterController';
import { AgentData } from '../../data/agents';

/**
 * NpcAgentDriver — drives a single NPC autonomously.
 *
 * Each NPC in the scene has its own instance of this class.
 * The update() method is the entry point for all NPC autonomous behavior.
 *
 * Currently: NPCs remain in idle state (base skeleton to build on).
 *
 * Extend here to add:
 *  - Wandering between waypoints
 *  - Sitting at POIs
 *  - Reacting to player proximity
 *  - Scheduled routines (work → break → work)
 */
export class NpcAgentDriver implements IAgentDriver {
  public readonly agentIndex: number;
  private behaviorTimer: number = Math.random() * 5 + 2; // Initial wait before moving

  constructor(
    agentIndex: number,
    protected readonly controller: CharacterController,
    protected readonly data: AgentData,
  ) {
    this.agentIndex = agentIndex;
  }

  // ── IAgentDriver ─────────────────────────────────────────────

  public update(_positions: Float32Array, delta: number): void {
    const currentState = this.controller.getState(this.agentIndex);

    // Only decide new actions if we are currently resting in a stable state
    if (currentState === 'idle' || currentState === 'sit_idle' || currentState === 'sit_work') {
      this.behaviorTimer -= delta;

      if (this.behaviorTimer <= 0) {
        this._decideNextAction();
      }
    }
  }

  private _decideNextAction(): void {
    const rand = Math.random();

    // 1. Probabilidad alta de ir a trabajar (sit_work)
    if (rand < 0.4) {
      const pois = this.controller.poiManager.getFreePois('sit_work');
      if (pois.length > 0) {
        const poi = pois[Math.floor(Math.random() * pois.length)];
        this.controller.walkToPoi(this.agentIndex, poi.id);
        this.behaviorTimer = Math.random() * 30 + 30; // Trabajar durante 30-60 segundos
        return;
      }
    }

    // 2. Probabilidad media de ir a descansar (sit_idle)
    if (rand < 0.7) {
      const pois = this.controller.poiManager.getFreePois('sit_idle');
      if (pois.length > 0) {
        const poi = pois[Math.floor(Math.random() * pois.length)];
        this.controller.walkToPoi(this.agentIndex, poi.id);
        this.behaviorTimer = Math.random() * 20 + 10; // Estar sentado 10-30 seg
        return;
      }
    }

    // 3. If the NPC is currently seated (sit_idle / sit_work), never stand up via the
    //    fallback path — only stand when actively finding a new POI (cases 1 & 2 above).
    const currentState = this.controller.getState(this.agentIndex);
    if (currentState === 'sit_idle' || currentState === 'sit_work') {
      this.behaviorTimer = Math.random() * 15 + 10;
      return;
    }

    // 4. Standing: try wandering to an area POI
    if (rand < 0.9) {
      const areaPois = this.controller.poiManager.getFreePoisByPrefix('area_');
      if (areaPois.length > 0) {
        const areaPoi = areaPois[Math.floor(Math.random() * areaPois.length)];
        const target = this.controller.poiManager.getRandomPointNearPoi(areaPoi.id, 3);
        if (target) {
          this.controller.poiManager.releaseAll(this.agentIndex);
          this.controller.moveTo(this.agentIndex, target, 'look_around');
          this.behaviorTimer = Math.random() * 10 + 5;
          return;
        }
      }
    }

    // 5. Standing idle fallback — play a short reaction animation
    const expressions: ('look_around' | 'wave' | 'happy')[] = ['look_around', 'wave', 'happy'];
    const randomAnim = expressions[Math.floor(Math.random() * expressions.length)];
    this.controller.play(this.agentIndex, randomAnim);
    this.behaviorTimer = Math.random() * 5 + 5;
  }

  public dispose(): void {}
}
