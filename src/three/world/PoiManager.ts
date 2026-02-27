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

  /** Returns all free POIs for a specific arrival state. */
  public getFreePois(arrivalState: CharacterStateKey): PoiDef[] {
    return Array.from(this.pois.values()).filter(
      p => p.arrivalState === arrivalState && p.occupiedBy === null
    );
  }

  /** Returns all free POIs that start with a specific ID prefix (e.g. 'spawn', 'area'). */
  public getFreePoisByPrefix(prefix: string): PoiDef[] {
    return Array.from(this.pois.values()).filter(
      p => p.id.includes(prefix) && p.occupiedBy === null
    );
  }

  /** Returns a random free POI matching the given prefix. */
  public getRandomFreePoi(prefix?: string): PoiDef | null {
    const candidates = prefix
      ? this.getFreePoisByPrefix(prefix)
      : Array.from(this.pois.values()).filter(p => p.occupiedBy === null);

    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
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

  /** Returns the nearest free POI of a given arrival state to a world position, or null. */
  public getNearestFreePoi(
    arrivalState: CharacterStateKey,
    from: THREE.Vector3,
  ): PoiDef | null {
    const candidates = this.getFreePois(arrivalState);
    if (candidates.length === 0) return null;

    let nearest: PoiDef | null = null;
    let nearestDist2 = Infinity;

    for (const poi of candidates) {
      const dx = poi.position.x - from.x;
      const dz = poi.position.z - from.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < nearestDist2) {
        nearestDist2 = d2;
        nearest = poi;
      }
    }
    return nearest;
  }

  // ── Future: GLB loading ─────────────────────────────────────

  /**
   * Extract POIs from a loaded GLB scene.
   * Convention: empty objects named "poi-<arrivalState>-<uniqueId>".
   * The arrivalState is the FINAL resting state, not the entry animation.
   * Example: "poi-sit_idle-chair_01", "poi-sit_work-desk_02"
   */
  public loadFromGlb(scene: THREE.Object3D): void {
    scene.traverse((child) => {
      const match = child.name.match(/^poi-([a-z_]+)-(.+)$/);
      if (!match) return;

      const arrivalState = match[1] as CharacterStateKey;
      const uniqueId = match[2];
      const id = `${arrivalState}-${uniqueId}`;

      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      child.getWorldPosition(worldPos);
      child.getWorldQuaternion(worldQuat);

      this.addPoi({ id, position: worldPos, quaternion: worldQuat, arrivalState, occupiedBy: null });
    });
  }

  public getAllPois(): PoiDef[] {
    return Array.from(this.pois.values());
  }
}
