import * as THREE from 'three/webgpu';
import { IAgentDriver } from '../../types';
import { CharacterController } from '../CharacterController';
import { AgentData } from '../../data/agents';
import { useAgencyStore } from '../../store/agencyStore';
import { useStore } from '../../store/useStore';

/**
 * NpcAgentDriver — drives a single NPC autonomously.
 *
 * Each NPC in the scene has its own instance of this class.
 * The update() method is the entry point for all NPC autonomous behavior.
 *
 * It respects the global Agency phase and individual task status to determine behavior.
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

  public update(positions: Float32Array, delta: number): void {
    const currentState = this.controller.getState(this.agentIndex);
    const agencyState = useAgencyStore.getState();
    const globalState = useStore.getState();

    // If we are currently chatting with this NPC, suspend autonomous behavior
    if (globalState.isChatting && globalState.selectedNpcIndex === this.agentIndex) {
      return;
    }

    // If the agent is currently "working" or "on hold" (waiting for approval)
    // according to the agency system, we let the agency system control its main animation state.
    const isBusyWithAgency = agencyState.tasks.some(
      t => t.assignedAgentIds.includes(this.agentIndex) && (t.status === 'in_progress' || t.status === 'on_hold')
    );

    if (isBusyWithAgency) {
       // While busy with agency tasks, the driver suspends autonomous random behaviors.
       return;
    }

    // Only decide new actions if we are currently resting in a stable state
    if (currentState === 'idle' || currentState === 'sit_idle' || currentState === 'look_around') {
      this.behaviorTimer -= delta;

      if (this.behaviorTimer <= 0) {
        this._decideNextAction(positions, currentState);
      }
    }
  }

  private _decideNextAction(positions: Float32Array, currentState: string): void {
    const rand = Math.random();
    const isSeated = currentState === 'sit_idle';

    // 1. Behavior when SEATED
    if (isSeated) {
      // 10% chance to just stay seated and play an expression
      if (rand < 0.1) {
        const expressions: ('sit_idle')[] = ['sit_idle'];
        const randomAnim = expressions[Math.floor(Math.random() * expressions.length)];
        this.controller.play(this.agentIndex, randomAnim);
        this.behaviorTimer = Math.random() * 15 + 15;
        return;
      }

      // 90% chance to stand up: fall through to movement logic below,
      // but only to move/wander, not to sit again immediately.
    }

    // Capture current position
    const currentPos = new THREE.Vector3(
      positions[this.agentIndex * 4],
      positions[this.agentIndex * 4 + 1],
      positions[this.agentIndex * 4 + 2]
    );

    // 2. Behavior when STANDING (or if decided to get up)

    // A. Chance to go sit (only if NOT already seated or if we explicitly want a new POI)
    // Account Manager (index 1) NEVER sits, he prefers to pace or stay standing
    if (!isSeated && rand < 0.4 && this.agentIndex !== 1) {
      const pois = this.controller.poiManager.getFreePois('sit_idle', this.agentIndex);
      if (pois.length > 0) {
        const poi = pois[Math.floor(Math.random() * pois.length)];
        this.controller.walkToPoi(this.agentIndex, poi.id, undefined, currentPos);
        this.behaviorTimer = Math.random() * 15 + 15;
        return;
      }
    }

    // B. Chance to wander to common areas (both standing and those getting up)
    if (rand < 0.7) {
      const areaPois = this.controller.poiManager.getFreePoisByPrefix('area-', this.agentIndex);
      if (areaPois.length > 0) {
        const areaPoi = areaPois[Math.floor(Math.random() * areaPois.length)];
        const target = this.controller.poiManager.getRandomPointNearPoi(areaPoi.id, 3);
        if (target) {
          if (this.controller.moveTo(this.agentIndex, target, 'look_around', undefined, currentPos)) {
            this.controller.poiManager.releaseAll(this.agentIndex);
            this.behaviorTimer = Math.random() * 5 + 10;
            return;
          }
        }
      }
    }

    // C. Fallback: play a short reaction animation (only if standing)
    if (!isSeated) {
      const expressions: ('look_around' | 'wave' | 'happy')[] = ['look_around', 'wave', 'happy'];
      const randomAnim = expressions[Math.floor(Math.random() * expressions.length)];
      this.controller.play(this.agentIndex, randomAnim);
      this.behaviorTimer = Math.random() * 5 + 5;
    } else {
      // If we were seated and decided to get up (10%) but found no place to go, stay seated.
      this.behaviorTimer = 5;
    }
  }

  public dispose(): void {}
}
