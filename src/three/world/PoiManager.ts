import * as THREE from 'three/webgpu';
import { CharacterStateKey, PoiDef } from '../../types';

/**
 * Manages Points of Interest (POIs) in the world.
 *
 * A POI is a named location that, when reached by an agent, triggers
 * a specific character state (e.g. 'sit_idle', 'sit_work').
 *
 * Procedural POIs are added via addPoi().
 * In the future, loadFromGlb() will extract them from empty objects
 * in a scene GLB (naming convention: pois named "poi-<state>-<id>").
 */
export class PoiManager {
  private pois = new Map<string, PoiDef>();

  // ── Registration ─────────────────────────────────────────────

  public addPoi(def: PoiDef): void {
    this.pois.set(def.id, { ...def });
  }

  public removePoi(id: string): void {
    this.pois.delete(id);
  }

  // ── Occupancy ────────────────────────────────────────────────

  /** Mark a POI as occupied by an agent. */
  public occupy(id: string, agentIndex: number): void {
    const poi = this.pois.get(id);
    if (poi) poi.occupiedBy = agentIndex;
  }

  /** Release the POI so other agents can use it. */
  public release(id: string): void {
    const poi = this.pois.get(id);
    if (poi) poi.occupiedBy = null;
  }

  /** Release all POIs held by a specific agent. */
  public releaseAll(agentIndex: number): void {
    for (const poi of this.pois.values()) {
      if (poi.occupiedBy === agentIndex) poi.occupiedBy = null;
    }
  }

  // ── Queries ──────────────────────────────────────────────────

  public getPoi(id: string): PoiDef | undefined {
    return this.pois.get(id);
  }

  /** Returns all free POIs for a specific arrival state.
   * If agentIndex is provided, include the POIs already occupied by that agent.
   */
  public getFreePois(arrivalState: CharacterStateKey, agentIndex?: number): PoiDef[] {
    return Array.from(this.pois.values()).filter(
      p => p.arrivalState === arrivalState && (p.occupiedBy === null || p.occupiedBy === agentIndex)
    );
  }

  /** Returns all free POIs that start with a specific ID prefix (e.g. 'spawn', 'area'). */
  public getFreePoisByPrefix(prefix: string, agentIndex?: number): PoiDef[] {
    return Array.from(this.pois.values()).filter(
      p => p.id.includes(prefix) && (p.occupiedBy === null || p.occupiedBy === agentIndex)
    );
  }

  /** Returns a random point near a POI (for area wandering). */
  public getRandomPointNearPoi(poiId: string, radius: number): THREE.Vector3 | null {
    const poi = this.pois.get(poiId);
    if (!poi) return null;

    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * radius;
    return new THREE.Vector3(
      poi.position.x + Math.cos(angle) * r,
      poi.position.y,
      poi.position.z + Math.sin(angle) * r
    );
  }

  // ── GLB loading ─────────────────────────────────────

  /**
   * Extract POIs from a loaded GLB scene.
   * Convention: empty objects named "poi-<arrivalState>-<uniqueId>".
   * Special arrival states: "spawn" and "area" default to "idle" state.
   *
   * Example: "poi-sit_idle-chair_01", "poi-sit_work-desk_02", "poi-spawn-A", "poi-area-lounge"
   */
  public loadFromGlb(scene: THREE.Object3D): void {
    scene.traverse((child) => {
      // Regex detects poi-TYPE-ID
      const match = child.name.match(/^poi-([a-z0-9_]+)-(.+)$/);
      if (!match) return;

      const type = match[1];
      const uniqueId = match[2];

      // "spawn" and "area" aren't real character states, they map to 'idle'.
      // Anything else is treated as a CharacterStateKey ('sit_idle', etc).
      let arrivalState: CharacterStateKey = 'idle';
      let label: string | undefined = undefined;

      if (type !== 'spawn' && type !== 'area') {
        arrivalState = type as CharacterStateKey;
        if (arrivalState === 'sit_idle') {
          label = 'Sit down';
        }
      }

      const id = `${type}-${uniqueId}`;

      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      child.getWorldPosition(worldPos);
      child.getWorldQuaternion(worldQuat);

      this.addPoi({ id, position: worldPos, quaternion: worldQuat, arrivalState, occupiedBy: null, label });
    });
  }

  public getAllPois(): PoiDef[] {
    return Array.from(this.pois.values());
  }
}
