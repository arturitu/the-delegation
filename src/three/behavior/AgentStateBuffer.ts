import * as THREE from 'three/webgpu';
import { storage } from 'three/tsl';
import { AgentBehavior } from '../../types';

/**
 * CPU/GPU buffer that stores per-instance physics mode and animation state.
 *
 * Each instance maps to one vec4:
 *   .x = waypoint X  (used when mode == GOTO)
 *   .y = animation   (animation index to play)
 *   .z = waypoint Z  (used when mode == GOTO)
 *   .w = mode        (0 = IDLE, 1 = GOTO)
 *
 * CPU writes metadata, GPU shader reads them.
 */
export class AgentStateBuffer {
  /** Raw Float32Array (vec4 stride). Direct access for performance-sensitive code. */
  public readonly array: Float32Array;

  /** GPU buffer attribute — pass to storage() in the compute shader. */
  public readonly attribute: THREE.StorageInstancedBufferAttribute;

  /** TSL storage node — bind directly in initComputeNode. */
  public readonly storageNode: any;

  constructor(private readonly count: number) {
    this.array = new Float32Array(count * 4);
    this.attribute = new THREE.StorageInstancedBufferAttribute(this.array, 4);
    this.storageNode = storage(this.attribute, 'vec4', count);
  }

  // ── Mode/State ───────────────────────────────────────────────

  public getState(index: number): number {
    return this.array[index * 4 + 3];
  }

  public setState(index: number, state: number): void {
    this.array[index * 4 + 3] = state;
    this.attribute.needsUpdate = true;
  }

  // ── Animation ────────────────────────────────────────────────

  public getAnimation(index: number): number {
    return this.array[index * 4 + 1];
  }

  public setAnimation(index: number, animIndex: number): void {
    this.array[index * 4 + 1] = animIndex;
    this.attribute.needsUpdate = true;
  }

  // ── Waypoint / Orientation ──────────────────────────────────

  public setWaypoint(index: number, x: number, z: number): void {
    this.array[index * 4 + 0] = x;
    this.array[index * 4 + 2] = z;
    this.attribute.needsUpdate = true;
  }

  /** Used when mode is IDLE to force a specific facing direction. */
  public setFacing(index: number, x: number, z: number): void {
    this.array[index * 4 + 0] = x;
    this.array[index * 4 + 2] = z;
    this.attribute.needsUpdate = true;
  }

  public getWaypoint(index: number): { x: number; z: number } {
    return {
      x: this.array[index * 4 + 0],
      z: this.array[index * 4 + 2],
    };
  }

  // ── Bulk helpers ─────────────────────────────────────────────

  /** Set all NPC states (skips index 0 = player). */
  public resetAllNPCsToState(state: AgentBehavior, startIndex = 1): void {
    for (let i = startIndex; i < this.count; i++) {
      this.array[i * 4 + 3] = state;
    }
    this.attribute.needsUpdate = true;
  }
}
