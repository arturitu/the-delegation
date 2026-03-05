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
  private wasBusy: boolean = false;

  constructor(
    agentIndex: number,
    protected readonly controller: CharacterController,
    protected readonly data: AgentData,
  ) {
    this.agentIndex = agentIndex;
  }

  /** Force the agent to pick a new autonomous action immediately (e.g. after completing a task). */
  public kick(): void {
    this.behaviorTimer = 0;
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

    // Special behavior for Orchestrator (index 1) when project is ready
    if (this.agentIndex === 1 && agencyState.phase === 'done') {
      this._updateProjectReadyBehavior(positions, delta, currentState);
      return;
    }

    // Capture current active task (if any)
    const activeTask = agencyState.tasks.find(
      t => t.assignedAgentIds.includes(this.agentIndex) && (t.status === 'in_progress' || t.status === 'on_hold')
    );
    const isBusyWithAgency = !!activeTask;

    // Detect busy→idle transition: kick the agent to move away immediately
    if (this.wasBusy && !isBusyWithAgency) {
      this.behaviorTimer = 0;
    }
    this.wasBusy = isBusyWithAgency;

    if (activeTask) {
      if (activeTask.status === 'on_hold') {
        const spawnId = `idle-spawn-${this.agentIndex}`;
        const targetPoi = this.controller.poiManager.getPoi(spawnId);
        if (targetPoi) {
          const currentPos = new THREE.Vector3(
            positions[this.agentIndex * 4],
            positions[this.agentIndex * 4 + 1],
            positions[this.agentIndex * 4 + 2]
          );
          const dist = currentPos.distanceTo(targetPoi.position);

          if (dist > 1.5) {
            if (currentState !== 'walk') {
              this.controller.moveTo(this.agentIndex, targetPoi.position, 'wave_loop', undefined, currentPos, targetPoi.quaternion);
            }
          } else {
            if (currentState !== 'wave_loop' && currentState !== 'walk') {
              this.controller.characterManager.setOrientation(this.agentIndex, targetPoi.quaternion);
              if (currentState !== 'idle') {
                this.controller.cancelMovement(this.agentIndex);
              }
              this.controller.play(this.agentIndex, 'wave_loop');
            }
          }
        }
      } else if (activeTask.status === 'in_progress') {
        const pois = this.controller.poiManager.getFreePois('sit_work', this.agentIndex);
        if (pois.length > 0) {
          // Use indices for consistent assignment or random like SceneManager
          const targetPoi = pois[this.agentIndex % pois.length];
          const currentPos = new THREE.Vector3(
            positions[this.agentIndex * 4],
            positions[this.agentIndex * 4 + 1],
            positions[this.agentIndex * 4 + 2]
          );
          const dist = currentPos.distanceTo(targetPoi.position);

          if (dist > 0.5) {
            if (currentState !== 'walk') {
              this.controller.moveTo(this.agentIndex, targetPoi.position, 'sit_work', undefined, currentPos, targetPoi.quaternion);
            }
          } else {
            if (currentState !== 'sit_work' && currentState !== 'walk') {
              this.controller.characterManager.setOrientation(this.agentIndex, targetPoi.quaternion);
              if (currentState !== 'idle') {
                this.controller.cancelMovement(this.agentIndex);
              }
              this.controller.play(this.agentIndex, 'sit_work');
            }
          }
        } else {
          // Fallback if no POI is found
          if (currentState !== 'sit_work' && currentState !== 'walk') {
            this.controller.play(this.agentIndex, 'sit_work');
          }
        }

        if (currentState === 'walk') return;
      }

      // Suspend autonomous random behaviors while busy
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

  private _updateProjectReadyBehavior(positions: Float32Array, delta: number, currentState: string): void {
    const targetPoi = this.controller.poiManager.getPoi('idle-spawn-1'); // Correct ID for Orchestrator spawn
    if (!targetPoi) return;

    const currentPos = new THREE.Vector3(
      positions[this.agentIndex * 4],
      positions[this.agentIndex * 4 + 1],
      positions[this.agentIndex * 4 + 2]
    );

    // If not near spawn area, go there
    const dist = currentPos.distanceTo(targetPoi.position);
    if (dist > 1.5) { // Slightly larger threshold to avoid oscillation
      if (currentState !== 'walk') {
        this.controller.moveTo(this.agentIndex, targetPoi.position, 'happy_loop', undefined, currentPos, targetPoi.quaternion);
      }
      return;
    }

    // If arrived or idling near spawn, switch to the looping happy state.
    const isHappy = currentState === 'happy_loop';
    if (!isHappy && currentState !== 'walk') {
      // Snap to target orientation if we are already close but not in the final state
      this.controller.characterManager.setOrientation(this.agentIndex, targetPoi.quaternion);

      // Don't cancel movement if we're naturally arriving via moveTo's arrivalState
      if (currentState !== 'idle') {
        this.controller.cancelMovement(this.agentIndex);
      }
      this.controller.play(this.agentIndex, 'happy_loop');
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
    // Orchestrator (index 1) NEVER sits, he prefers to pace or stay standing
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
        const target = areaPoi.position;
        if (target) {
          if (this.controller.moveTo(this.agentIndex, target, 'look_around', undefined, currentPos, areaPoi.quaternion)) {
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
