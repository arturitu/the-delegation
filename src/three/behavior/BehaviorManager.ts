import * as THREE from 'three/webgpu';
import { AgentBehavior, ActiveEncounter, AnimationName } from '../../types';
import { AgentStateBuffer } from './AgentStateBuffer';
import { AgentData, PLAYER_INDEX } from '../../data/agents';
import { useStore } from '../../store/useStore';

// ── Tuning constants ─────────────────────────────────────────
const PLAYER_ENCOUNTER_RADIUS = 1.5;       // world units — player↔NPC chat trigger
const PLAYER_ARRIVAL_RADIUS = 0.3;         // world units — GOTO waypoint reached

export class BehaviorManager {
  private currentEncounterNPC: number | null = null;
  private chatNPC: number | null = null; // NPC player is currently moving to talk to
  private characterManager: any = null; // Optional reference

  constructor(
    private stateBuffer: AgentStateBuffer,
    private agents: AgentData[],
    private onEncounterChange: (encounter: ActiveEncounter | null) => void,
    private onPlayerArrivedAtNPC: (index: number) => void,
  ) {
    // Note: Initial state is set via CharacterManager during its own initialization
  }

  public setCharacterManager(mgr: any) {
    this.characterManager = mgr;
  }

  private setAgentState(index: number, behavior: AgentBehavior) {
    if (!this.characterManager) return;

    // Map high-level AgentBehavior to physical mode (index) and AnimationName
    let animation = AnimationName.IDLE;

    if (behavior === AgentBehavior.GOTO) {
      animation = AnimationName.WALK;
    }

    this.characterManager.setPhysicsMode(index, behavior);
    this.characterManager.setAnimation(index, animation);
  }

  // ─────────────────────────────────────────────────────────────
  //  Per-frame update  (call after GPU readback)
  // ─────────────────────────────────────────────────────────────
  public update(positions: Float32Array): void {
    const count = this.agents.length;

    // 1. Detect player GOTO arrival
    if (this.stateBuffer.getState(PLAYER_INDEX) === AgentBehavior.GOTO) {
      const wp = this.stateBuffer.getWaypoint(PLAYER_INDEX);
      const pdx = wp.x - positions[PLAYER_INDEX * 4];
      const pdz = wp.z - positions[PLAYER_INDEX * 4 + 2];
      if (pdx * pdx + pdz * pdz < PLAYER_ARRIVAL_RADIUS * PLAYER_ARRIVAL_RADIUS) {
        this.setAgentState(PLAYER_INDEX, AgentBehavior.IDLE);

        if (this.chatNPC !== null) {
          const finishedNPC = this.chatNPC;
          // Face the NPC we came to talk to
          const nx = positions[finishedNPC * 4];
          const nz = positions[finishedNPC * 4 + 2];
          const fx = nx - positions[PLAYER_INDEX * 4];
          const fz = nz - positions[PLAYER_INDEX * 4 + 2];
          this.stateBuffer.setWaypoint(PLAYER_INDEX, fx, fz);

          // Notify store that chat has officially started (arrival)
          this.onPlayerArrivedAtNPC(finishedNPC);
          this.chatNPC = null;
        } else {
          // Store the arrival direction in the waypoint fields (now used for facing)
          this.stateBuffer.setWaypoint(PLAYER_INDEX, pdx, pdz);
        }
      }
    }

    // 2. Detect player↔NPC proximity (encounter)
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
    this.setAgentState(PLAYER_INDEX, AgentBehavior.GOTO);
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
    this.setAgentState(PLAYER_INDEX, AgentBehavior.GOTO);
    this.chatNPC = npcIndex;

    // Set NPC to IDLE and face the player's approach position
    this.setAgentState(npcIndex, AgentBehavior.IDLE);
    this.stateBuffer.setWaypoint(npcIndex, dx, dz); // Face the player
  }

  public endChat(npcIndex: number | null): void {
    this.chatNPC = null;
    if (npcIndex !== null) {
      this.setAgentState(npcIndex, AgentBehavior.IDLE);
    }
    this.setAgentState(PLAYER_INDEX, AgentBehavior.IDLE);
  }
}
