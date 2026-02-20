import * as THREE from 'three/webgpu';
import { AgentBehavior, ActiveEncounter } from '../../types';
import { AgentStateBuffer } from './AgentStateBuffer';
import { AgentData, PLAYER_INDEX } from '../../data/agents';
import { useStore } from '../../store/useStore';

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
  private chatNPC: number | null = null; // NPC player is currently moving to talk to

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
        
        // When unfreezing, we don't need to do anything special here anymore
        // as the BOIDS logic on GPU will take over.

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

            // Set NPCs to face each other using the waypoint fields (used for facing when FROZEN)
            const dirX = positions[j * 4] - positions[i * 4];
            const dirZ = positions[j * 4 + 2] - positions[i * 4 + 2];
            this.stateBuffer.setWaypoint(i, dirX, dirZ);
            this.stateBuffer.setWaypoint(j, -dirX, -dirZ);

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
      const pdx = wp.x - positions[PLAYER_INDEX * 4];
      const pdz = wp.z - positions[PLAYER_INDEX * 4 + 2];
      if (pdx * pdx + pdz * pdz < PLAYER_ARRIVAL_RADIUS * PLAYER_ARRIVAL_RADIUS) {
        this.stateBuffer.setState(PLAYER_INDEX, AgentBehavior.FROZEN);
        
        if (this.chatNPC !== null) {
          // Face the NPC we came to talk to
          const nx = positions[this.chatNPC * 4];
          const nz = positions[this.chatNPC * 4 + 2];
          const fx = nx - positions[PLAYER_INDEX * 4];
          const fz = nz - positions[PLAYER_INDEX * 4 + 2];
          this.stateBuffer.setWaypoint(PLAYER_INDEX, fx, fz);
          
          // Notify store that chat has officially started (arrival)
          useStore.getState().setAnimation('Wave'); // Optional: greeting animation
          this.chatNPC = null;
        } else {
          // Store the arrival direction in the waypoint fields (now used for facing)
          this.stateBuffer.setWaypoint(PLAYER_INDEX, pdx, pdz);
        }
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
          npcDepartment: agent.department,
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
    this.chatNPC = null; // Cancel any pending chat
    this.stateBuffer.setWaypoint(PLAYER_INDEX, x, z);
    this.stateBuffer.setState(PLAYER_INDEX, AgentBehavior.GOTO);
  }

  public startChat(npcIndex: number, positions: Float32Array): void {
    const nx = positions[npcIndex * 4];
    const nz = positions[npcIndex * 4 + 2];
    
    const px = positions[PLAYER_INDEX * 4];
    const pz = positions[PLAYER_INDEX * 4 + 2];
    
    let dx = px - nx;
    let dz = pz - nz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    if (dist < 0.01) {
      dx = 1;
      dz = 0;
    } else {
      dx /= dist;
      dz /= dist;
    }
    
    // Target position for player: 1.2 units away from NPC
    const targetX = nx + dx * 1.2;
    const targetZ = nz + dz * 1.2;
    
    this.stateBuffer.setWaypoint(PLAYER_INDEX, targetX, targetZ);
    this.stateBuffer.setState(PLAYER_INDEX, AgentBehavior.GOTO);
    this.chatNPC = npcIndex;
    
    // Freeze NPC and set it to face the player's future position
    this.stateBuffer.setState(npcIndex, AgentBehavior.FROZEN);
    this.stateBuffer.setWaypoint(npcIndex, dx, dz); // Face the player
    
    // Break any existing pair
    for (const [key, pair] of this.frozenPairs) {
      if (pair.a === npcIndex || pair.b === npcIndex) {
        const other = pair.a === npcIndex ? pair.b : pair.a;
        this.stateBuffer.setState(other, AgentBehavior.BOIDS);
        this.frozenIndices.delete(pair.a);
        this.frozenIndices.delete(pair.b);
        this.frozenPairs.delete(key);
        break;
      }
    }
  }

  public endChat(npcIndex: number | null): void {
    this.chatNPC = null;
    if (npcIndex !== null) {
      this.stateBuffer.setState(npcIndex, AgentBehavior.BOIDS);
    }
    this.stateBuffer.setState(PLAYER_INDEX, AgentBehavior.FROZEN);
  }
}
