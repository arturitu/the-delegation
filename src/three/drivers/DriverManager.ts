import * as THREE from 'three/webgpu';
import { IAgentDriver } from '../../types';
import { CharacterController } from '../CharacterController';
import { PLAYER_INDEX } from '../../data/agents';
import { AgentData } from '../../types';
import { PlayerInputDriver } from './PlayerInputDriver';
import { NpcAgentDriver } from './NpcAgentDriver';

/**
 * DriverManager — registers and orchestrates all agent drivers.
 *
 * SceneManager interacts only with DriverManager, never with individual drivers.
 * This makes it easy to:
 *  - Add/remove agents at runtime
 *  - Swap out a driver type (e.g. give an NPC player-like control)
 *  - Iterate all agents uniformly in the frame loop
 */
export class DriverManager {
  private drivers = new Map<number, IAgentDriver>();
  private playerDriver: PlayerInputDriver | null = null;

  constructor(private readonly controller: CharacterController) {}

  // ── Registration ─────────────────────────────────────────────

  /** Register the player driver. Returns it so SceneManager can wire InputManager callbacks. */
  public registerPlayer(): PlayerInputDriver {
    const driver = new PlayerInputDriver(this.controller);
    this.drivers.set(PLAYER_INDEX, driver);
    this.playerDriver = driver;
    return driver;
  }

  /** Register a NPC agent with its data. Returns the driver for optional further customization. */
  public registerNpc(agentIndex: number, data: AgentData): NpcAgentDriver {
    const driver = new NpcAgentDriver(agentIndex, this.controller, data);
    this.drivers.set(agentIndex, driver);
    return driver;
  }

  /** Replace the driver for an agent (e.g. switch from NPC to player control). */
  public setDriver(agentIndex: number, driver: IAgentDriver): void {
    this.drivers.get(agentIndex)?.dispose();
    this.drivers.set(agentIndex, driver);
  }

  /** Remove a driver and dispose it. */
  public unregister(agentIndex: number): void {
    this.drivers.get(agentIndex)?.dispose();
    this.drivers.delete(agentIndex);
  }

  // ── Accessors ────────────────────────────────────────────────

  public getPlayerDriver(): PlayerInputDriver | null {
    return this.playerDriver;
  }

  public getDriver(agentIndex: number): IAgentDriver | undefined {
    return this.drivers.get(agentIndex);
  }

  /** Immediately trigger the NPC to decide a new autonomous action (e.g. after task completion). */
  public kickNpc(agentIndex: number): void {
    const driver = this.drivers.get(agentIndex);
    if (driver instanceof NpcAgentDriver) {
      driver.kick();
    }
  }

  /** Play or stop the working animation on an NPC, walking it to a free desk POI if available. */
  public setNpcWorking(agentIndex: number, working: boolean): void {
    if (working) {
      const pois = this.controller.poiManager.getFreePois('sit_work', agentIndex);
      if (pois.length > 0) {
        const poi = pois[Math.floor(Math.random() * pois.length)];
        const positions = this.controller.getCPUPositions();
        const currentPos = positions
          ? new THREE.Vector3(
              positions[agentIndex * 4],
              positions[agentIndex * 4 + 1],
              positions[agentIndex * 4 + 2],
            )
          : undefined;
        this.controller.walkToPoi(agentIndex, poi.id, undefined, currentPos);
      } else {
        this.controller.play(agentIndex, 'sit_work');
      }
    } else {
      this.controller.play(agentIndex, 'idle');
    }
  }

  // ── Frame loop ───────────────────────────────────────────────

  /** Call every frame after positions are synced from GPU. */
  public update(positions: Float32Array, delta: number): void {
    for (const driver of this.drivers.values()) {
      driver.update(positions, delta);
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────

  public dispose(): void {
    for (const driver of this.drivers.values()) {
      driver.dispose();
    }
    this.drivers.clear();
  }
}
