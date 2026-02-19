import { AgentBehavior, ActiveEncounter } from '../../types';
import { AgentStateBuffer } from './AgentStateBuffer';
import { AgentData, PLAYER_INDEX } from '../../data/agents';

// ── Tuning constants ─────────────────────────────────────────
const NPC_COLLISION_RADIUS = 0.8;          // world units — NPC↔NPC freeze trigger
const PLAYER_ENCOUNTER_RADIUS = 1.5;       // world units — player↔NPC chat trigger
const PLAYER_ARRIVAL_RADIUS = 0.3;         // world units — GOTO waypoint reached
const FROZEN_DURATION_MS = 4000;           // ms NPCs stay frozen after a collision
const MAX_FROZEN_PAIRS = 10;               // cap simultaneous NPC↔NPC frozen pairs
const UNFREEZE_COOLDOWN_MS = 800;          // ms after unfreeze before NPC can re-collide

interface FrozenPair {
  a: number;
  b: number;
  expiresAt: number;
}

export class BehaviorManager {
  private frozenPairs = new Map<string, FrozenPair>();
  private frozenIndices = new Set<number>();
  private unfreezeTimestamps = new Map<number, number>(); // index → time of last unfreeze
  private currentEncounterNPC: number | null = null;

  constructor(
    private stateBuffer: AgentStateBuffer,
    private agents: AgentData[],
    private onEncounterChange: (encounter: ActiveEncounter | null) => void,
  ) {
    // Player starts FROZEN (idle) — user activates it with a floor click (GOTO)
    stateBuffer.setState(PLAYER_INDEX, AgentBehavior.FROZEN);
    // All NPCs start in BOIDS mode (resetAllNPCsToState is called with default 0 values already)
  }

  // ─────────────────────────────────────────────────────────────
  //  Per-frame update  (call after GPU readback)
  // ─────────────────────────────────────────────────────────────
  public update(positions: Float32Array): void {
    const now = Date.now();
    const count = this.agents.length;

    // 1. Expire frozen NPC pairs
    for (const [key, pair] of this.frozenPairs) {
      if (now > pair.expiresAt) {
        this.stateBuffer.setState(pair.a, AgentBehavior.BOIDS);
        this.stateBuffer.setState(pair.b, AgentBehavior.BOIDS);
        this.frozenIndices.delete(pair.a);
        this.frozenIndices.delete(pair.b);
        this.unfreezeTimestamps.set(pair.a, now);
        this.unfreezeTimestamps.set(pair.b, now);
        this.frozenPairs.delete(key);
      }
    }

    // Clean up expired cooldowns
    for (const [idx, ts] of this.unfreezeTimestamps) {
      if (now - ts > UNFREEZE_COOLDOWN_MS) this.unfreezeTimestamps.delete(idx);
    }

    // 2. Detect new NPC↔NPC collisions (skip index 0 = player)
    if (this.frozenPairs.size < MAX_FROZEN_PAIRS) {
      for (let i = 1; i < count - 1; i++) {
        if (this.frozenIndices.has(i)) continue;
        if (this.stateBuffer.getState(i) !== AgentBehavior.BOIDS) continue;
        if (this.unfreezeTimestamps.has(i)) continue; // cooling down

        for (let j = i + 1; j < count; j++) {
          if (this.frozenIndices.has(j)) continue;
          if (this.stateBuffer.getState(j) !== AgentBehavior.BOIDS) continue;
          if (this.unfreezeTimestamps.has(j)) continue; // cooling down

          const dx = positions[i * 4] - positions[j * 4];
          const dz = positions[i * 4 + 2] - positions[j * 4 + 2];

          if (dx * dx + dz * dz < NPC_COLLISION_RADIUS * NPC_COLLISION_RADIUS) {
            this.stateBuffer.setState(i, AgentBehavior.FROZEN);
            this.stateBuffer.setState(j, AgentBehavior.FROZEN);
            this.frozenIndices.add(i);
            this.frozenIndices.add(j);
            const key = `${i}-${j}`;
            this.frozenPairs.set(key, { a: i, b: j, expiresAt: now + FROZEN_DURATION_MS });

            if (this.frozenPairs.size >= MAX_FROZEN_PAIRS) break;
          }
        }
        if (this.frozenPairs.size >= MAX_FROZEN_PAIRS) break;
      }
    }

    // 3. Detect player GOTO arrival
    if (this.stateBuffer.getState(PLAYER_INDEX) === AgentBehavior.GOTO) {
      const wp = this.stateBuffer.getWaypoint(PLAYER_INDEX);
      const pdx = positions[PLAYER_INDEX * 4] - wp.x;
      const pdz = positions[PLAYER_INDEX * 4 + 2] - wp.z;
      if (pdx * pdx + pdz * pdz < PLAYER_ARRIVAL_RADIUS * PLAYER_ARRIVAL_RADIUS) {
        this.stateBuffer.setState(PLAYER_INDEX, AgentBehavior.FROZEN);
      }
    }

    // 4. Detect player↔NPC proximity (encounter)
    const px = positions[PLAYER_INDEX * 4];
    const pz = positions[PLAYER_INDEX * 4 + 2];
    let nearestNPC: number | null = null;
    let nearestDist2 = PLAYER_ENCOUNTER_RADIUS * PLAYER_ENCOUNTER_RADIUS;

    for (let i = 1; i < count; i++) {
      const dx = px - positions[i * 4];
      const dz = pz - positions[i * 4 + 2];
      const d2 = dx * dx + dz * dz;
      if (d2 < nearestDist2) {
        nearestDist2 = d2;
        nearestNPC = i;
      }
    }

    if (nearestNPC !== this.currentEncounterNPC) {
      this.currentEncounterNPC = nearestNPC;
      if (nearestNPC !== null) {
        const agent = this.agents[nearestNPC];
        this.onEncounterChange({
          npcIndex: nearestNPC,
          npcName: agent.name,
          npcRole: agent.role,
          npcMission: agent.mission,
          npcPersonality: agent.personality,
        });
      } else {
        this.onEncounterChange(null);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  External actions
  // ─────────────────────────────────────────────────────────────

  /** Called when user clicks on the floor while player is selected. */
  public setPlayerWaypoint(x: number, z: number): void {
    this.stateBuffer.setWaypoint(PLAYER_INDEX, x, z);
    this.stateBuffer.setState(PLAYER_INDEX, AgentBehavior.GOTO);
  }
}
