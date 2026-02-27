import * as THREE from 'three/webgpu';
import { AgentBehavior, AnimationName, CharacterStateKey, ExpressionKey, ICharacterDriver } from '../types';
import { CharacterManager } from './entities/CharacterManager';
import { CharacterStateMachine } from './behavior/CharacterStateMachine';
import { AgentStateBuffer } from './behavior/AgentStateBuffer';
import { PathAgent } from './pathfinding/PathAgent';
import { NavMeshManager } from './pathfinding/NavMeshManager';
import { PoiManager } from './world/PoiManager';

/**
 * CharacterController — unified API for controlling any character (player or NPC).
 *
 * Composes:
 *  - CharacterManager     → GPU rendering, animation baking, expression buffers
 *  - CharacterStateMachine → declarative state→animation+expression mapping
 *  - PathAgent[]          → per-agent CPU path following
 *  - NavMeshManager       → path queries
 *  - PoiManager           → POI lookup and occupancy
 *
 * Implements ICharacterDriver so it can be passed to the state machine and
 * behavior drivers without circular dependencies.
 *
 * All behavior code (PlayerInputDriver, NpcAgentDriver) goes through this class.
 */
export class CharacterController implements ICharacterDriver {
  private stateMachine: CharacterStateMachine;
  private pathAgents: PathAgent[] = [];
  /** Per-agent callback fired when the agent reaches its path destination. */
  private arrivalCallbacks: ((index: number) => void)[] = [];

  constructor(
    private readonly characterManager: CharacterManager,
    private readonly navMesh: NavMeshManager,
    public readonly poiManager: PoiManager,
  ) {
    const count = characterManager.getCount();
    this.stateMachine = new CharacterStateMachine(count);

    const stateBuffer = characterManager.getAgentStateBuffer()!;
    for (let i = 0; i < count; i++) {
      this.pathAgents.push(new PathAgent(i, stateBuffer));
    }
  }

  // ── High-level character API ─────────────────────────────────

  /**
   * Transition a character to the given state.
   * The state machine applies the correct animation + expression automatically.
   * Non-interruptible states (e.g. 'sit_down') will queue the new state until ready.
   */
  public play(index: number, state: CharacterStateKey): void {
    this.stateMachine.transition(index, state, this);
  }

  /**
   * Walk a character to a world-space position using the navmesh.
   * Automatically transitions to 'walk' and then to `arrivalState` on arrival.
   *
   * @param arrivalState State to enter upon reaching the destination (default: 'idle')
   * @param onArrival    Optional callback fired when the destination is reached
   */
  public moveTo(
    index: number,
    target: THREE.Vector3,
    arrivalState: CharacterStateKey = 'idle',
    onArrival?: (index: number) => void,
  ): void {
    const positions = this.characterManager.getCPUPositions();
    if (!positions) return;

    const from = new THREE.Vector3(
      positions[index * 4],
      positions[index * 4 + 1],
      positions[index * 4 + 2],
    );

    const path = this.navMesh.findPath(from, target);

    if (path.length === 0) return;

    // Ensure the agent ends up at the exact target position,
    // not at the nearest navmesh polygon boundary.
    path[path.length - 1] = target.clone();

    this.pathAgents[index].setPath(path);
    this.arrivalCallbacks[index] = (i) => {
      this.play(i, arrivalState);
      onArrival?.(i);
    };

    this.setPhysicsMode(index, AgentBehavior.GOTO);
    this.play(index, 'walk');
  }

  /**
   * Walk a character to a POI by ID.
   * Occupies the POI immediately; releases existing ones first.
   */
  public walkToPoi(index: number, poiId: string, onArrival?: (index: number) => void): void {
    const poi = this.poiManager.getPoi(poiId);
    if (!poi || (poi.occupiedBy !== null && poi.occupiedBy !== index)) return;

    this.poiManager.releaseAll(index);
    this.poiManager.occupy(poiId, index);

    const targetState = poi.arrivalState;
    // POI arrivalState is always the desired FINAL state (sit_idle or sit_work).
    // Both require the one-shot 'sit_down' entry animation first.
    const isSitVariant = targetState === 'sit_idle' || targetState === 'sit_work';

    // Navigate to the exact POI position.
    // We use 'idle' as a throw-away arrivalState and handle everything
    // explicitly in the callback so orientation is set BEFORE any animation.
    this.moveTo(index, poi.position, 'idle', (i) => {
      // 1. Snap orientation to POI facing direction FIRST
      this.characterManager.setOrientation(i, poi.quaternion);

      // 2. Drive the correct animation sequence
      if (isSitVariant) {
        // Play sit_down once (non-interruptible, nextState → 'sit_idle' by default)
        this.play(i, 'sit_down');

        // For sit_work: queue the work loop — applied once 'sit_down' finishes,
        // overriding the default nextState ('sit_idle')
        if (targetState === 'sit_work') {
          this.play(i, 'sit_work');
        }
      } else {
        this.play(i, targetState);
      }

      onArrival?.(i);
    });
  }

  /** Speaking mouth animation overlay — independent of character state. */
  public setSpeaking(index: number, isSpeaking: boolean): void {
    this.characterManager.setSpeaking(index, isSpeaking);
  }

  public getState(index: number): CharacterStateKey {
    return this.stateMachine.getState(index);
  }

  // ── Per-frame update ─────────────────────────────────────────

  /**
   * Main update loop. Call once per frame.
   *  1. Updates GPU expression buffers (blink, mouth animation).
   *  2. Runs GPU compute shader (physics/movement).
   *  3. Ticks the state machine timers (non-looping state auto-transitions).
   *  4. Advances per-agent path following.
   */
  public update(delta: number, renderer: any): void {
    this.characterManager.update(delta, renderer);
    this.stateMachine.update(delta, this);
  }

  /**
   * GPU→CPU position readback (async, 1-frame lag).
   * Returns the positions buffer so drivers can use it for logic.
   */
  public async syncFromGPU(renderer: any): Promise<Float32Array | null> {
    return this.characterManager.syncFromGPU(renderer);
  }

  /**
   * Advance path agents. Call after syncFromGPU resolves so positions are fresh.
   * Fires arrival callbacks for agents that reach their destination.
   */
  public updatePaths(positions: Float32Array): void {
    for (let i = 0; i < this.pathAgents.length; i++) {
      if (!this.pathAgents[i].isMoving) continue;

      const currentPos = new THREE.Vector3(
        positions[i * 4],
        positions[i * 4 + 1],
        positions[i * 4 + 2],
      );

      const arrived = this.pathAgents[i].update(currentPos);
      if (arrived) {
        this.setPhysicsMode(i, AgentBehavior.IDLE);
        this.arrivalCallbacks[i]?.(i);
      }
    }
  }

  /** Cancel movement for an agent and return to idle. */
  public cancelMovement(index: number): void {
    this.pathAgents[index].cancel();
    this.setPhysicsMode(index, AgentBehavior.IDLE);
  }

  // ── Forwarded accessors ──────────────────────────────────────

  public getCPUPositions(): Float32Array | null {
    return this.characterManager.getCPUPositions();
  }

  public getCPUPosition(index: number): THREE.Vector3 | null {
    return this.characterManager.getCPUPosition(index);
  }

  public getCount(): number {
    return this.characterManager.getCount();
  }

  public getAgentStateBuffer(): AgentStateBuffer | null {
    return this.characterManager.getAgentStateBuffer();
  }

  public setInstanceCount(count: number): void {
    this.characterManager.setInstanceCount(count);
    // Re-sync path agents and state machine after resize
    const newCount = this.characterManager.getCount();
    const stateBuffer = this.characterManager.getAgentStateBuffer()!;
    this.pathAgents = [];
    for (let i = 0; i < newCount; i++) {
      this.pathAgents.push(new PathAgent(i, stateBuffer));
    }
    this.stateMachine = new CharacterStateMachine(newCount);
  }

  public get isLoaded(): boolean {
    return this.characterManager.isLoaded;
  }

  // ── ICharacterDriver implementation ──────────────────────────

  public setPhysicsMode(index: number, mode: AgentBehavior): void {
    this.characterManager.setPhysicsMode(index, mode);
  }

  public setAnimation(index: number, name: AnimationName): void {
    this.characterManager.setAnimation(index, name);
  }

  public setExpression(index: number, key: ExpressionKey): void {
    this.characterManager.setExpression(index, key);
  }

  public getAgentState(index: number): AgentBehavior {
    return this.characterManager.getAgentState(index);
  }

  public getAnimationDuration(name: AnimationName): number {
    return this.characterManager.getAnimationDuration(name);
  }
}
