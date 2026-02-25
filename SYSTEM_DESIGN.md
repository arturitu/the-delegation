# FakeClaw Inc. HQ — Corporate Agent Simulation

> Status: **In development** · Last updated: Feb 2026

---

## Overview

A Three.js WebGPU simulation of **FakeClaw Inc.**, a fictional IT company with 10 autonomous agents. One agent is the **CEO (Player)**; the other 9 are **Employees (NPCs)** divided into departments: **Production, Sales, Marketing, and Finance**. All share the same `InstancedMesh`. Physics run on the GPU via a compute shader; state logic runs on CPU and is synced to the GPU each frame.

---

## File Structure

```
data/
  agents.ts               ← corporate data (departments, roles, missions, …)

three/
  core/
    Engine.ts             ← WebGPU renderer + timer
    Stage.ts              ← scene, camera, OrbitControls, ground, grid
  entities/
    CharacterManager.ts   ← GPU buffers, compute shader, instanced mesh
  behavior/
    AgentStateBuffer.ts   ← shared CPU/GPU state + waypoint buffer
    BehaviorManager.ts    ← per-frame behavior logic, state transitions
  input/
    InputManager.ts       ← mouse picking, floor click → waypoint
  SceneManager.ts         ← orchestrator, animation loop

store/
  useStore.ts             ← Zustand store (React ↔ simulation bridge)

types.ts                  ← shared TypeScript types and enums
```

---

## Agent Data (`data/agents.ts`)

```typescript
interface AgentData {
  index: number // instanced mesh index (0 = player)
  name: string // unique first name
  role: string // city role ("Architect", "Physician", …)
  expertise: string[] // 3 domain tags
  mission: string // current objective in the city
  personality: string // character trait description
  lang: string // BCP-47 primary language ("en", "es", "fr", "ko", "ja", "de", "it")
  isPlayer: boolean
}
```

**Population:**

- `index 0` — Player · name `"You"` · role `"Outsider"` · `lang: "en"`
- `index 1–9` — NPCs with 9 unique names, 20 roles (cyclic), 30 missions (cyclic), 8 personalities (cyclic)

**City constants:**

```
CITY_NAME          = "Bubbylon"
TOTAL_COUNT        = 10
PLAYER_INDEX       = 0
NPC_START_INDEX    = 1
```

---

## Behavior States (`types.ts → AgentBehavior`)

```typescript
enum AgentBehavior {
  IDLE = 0, // Position locked, velocity = 0, animation idle
  FROZEN = 1, // Position locked, velocity = 0, animation idle
  GOTO = 2, // Moving toward a waypoint at uSpeed, then → FROZEN on arrival
}
```

---

## State Machine

### NPC state machine

NPCs start in `IDLE` state. They move only when a `GOTO` command is issued (e.g., via function calling).

### Player state machine

```
         spawn
           ├── FROZEN  (standing, default)
           │
    click on floor
    (player is selected)
           │
          GOTO  (moves to waypoint)
           │
    dist to waypoint < 0.3 units
           │
         FROZEN  (arrived)

    ─── at any state ───────────────────────────
    dist(player, npc) < 1.5 units → ActiveEncounter emitted to store
    player moves away             → encounter cleared
```

---

## AgentStateBuffer (`three/behavior/AgentStateBuffer.ts`)

A `StorageInstancedBufferAttribute` of **vec4 per instance**, shared between CPU and GPU:

```
vec4 layout per instance:
  .x  =  waypointX   (GOTO target, world space)
  .y  =  0           (reserved)
  .z  =  waypointZ   (GOTO target, world space)
  .w  =  AgentBehavior (0 / 1 / 2)
```

**API:**

```typescript
setState(index, AgentBehavior)           // writes .w, marks needsUpdate
getState(index): AgentBehavior
setWaypoint(index, x, z)                 // writes .x/.z, marks needsUpdate
getWaypoint(index): { x, z }
resetAllNPCsToState(state, startIndex?)
```

CPU writes → GPU reads the buffer in the compute shader each frame.

---

## BehaviorManager (`three/behavior/BehaviorManager.ts`)

Pure logic class. No Three.js, no React.
Receives GPU-readback positions every frame and drives state transitions.

**Constructor:**

```typescript
new BehaviorManager(
  stateBuffer:      AgentStateBuffer,
  agents:           AgentData[],
  onEncounterChange: (encounter: ActiveEncounter | null) => void
)
```

**`update(positions: Float32Array)` — called each frame after GPU readback:**

| Step | What it does                                                                          |
| ---- | ------------------------------------------------------------------------------------- |
| 1    | Detects player arrival at GOTO waypoint → `FROZEN`                                    |
| 2    | Detects nearest NPC within player encounter radius → emits `ActiveEncounter` to store |

**Constants:**

```
PLAYER_ENCOUNTER_RADIUS = 1.5  world units
PLAYER_ARRIVAL_RADIUS   = 0.3  world units
```

**External action:**

```typescript
setPlayerWaypoint(x, z) // sets waypoint + transitions player to GOTO
```

---

## CharacterManager (`three/entities/CharacterManager.ts`)

Owns all GPU buffers and the instanced mesh. Talks to the compute shader.

**GPU buffers:**

| Buffer                       | Type                              | Stride | Content                 |
| ---------------------------- | --------------------------------- | ------ | ----------------------- |
| `posAttribute`               | `StorageInstancedBufferAttribute` | vec4   | position (x, y, z, 1)   |
| `velAttribute`               | `StorageInstancedBufferAttribute` | vec4   | velocity (x, 0, z, 0)   |
| `agentStateBuffer.attribute` | `StorageInstancedBufferAttribute` | vec4   | (wpX, 0, wpZ, state)    |
| `bakedAnimationBuffer`       | `StorageBufferAttribute`          | mat4   | pre-baked bone matrices |

**Compute shader logic (TSL):**

```
for each instance:
  read agentState (.w)

  if state > 1.5  → GOTO
      move toward waypoint at uSpeed
      stop if dist < 0.2

  else if state > 0.5  → FROZEN
      velocity = 0, position unchanged

  else  → IDLE
      velocity = 0, position unchanged
```

**Vertex shader safety fix:**
When velocity is zero, `atan(0,0)` is undefined (NaN in WGSL), which collapses the rotation matrix making the instance invisible. Fix: fall back to direction `(0, 0, 1)` when `length(vel) < 0.001`.

**Uniforms:**

```
uSpeed              (default 0.015)
uWorldSize          (default 10.0)
```

**GPU readback:**

```typescript
async syncFromGPU(renderer): Promise<Float32Array | null>
```

Reads `posAttribute` from VRAM to `debugPosArray` (CPU). Called every frame with 1-frame lag. Used for picking, camera follow, and BehaviorManager.

---

## InputManager (`three/input/InputManager.ts`)

**Click detection:**
`pointerdown/move/up` with a drag threshold of **4 px** — orbit drags are ignored.

**Agent picking:**
Ray-sphere intersection against CPU positions (`debugPosArray`). Sphere radius = **0.65 world units** centered at `y + 0.9`.

**Interaction rules:**

| Condition                                     | Action                                                   |
| --------------------------------------------- | -------------------------------------------------------- |
| Click on an NPC/Player                        | Select it (`onSelect(index)`)                            |
| Click on already-selected                     | Deselect (`onSelect(null)`)                              |
| Click on empty floor **with player selected** | `onWaypoint(x, z)` → `BehaviorManager.setPlayerWaypoint` |
| Click on empty floor (NPC selected)           | Deselect                                                 |

---

## Stage (`three/core/Stage.ts`)

Handles camera follow when an agent is selected:

```typescript
setFollowTarget(pos: Vector3 | null)
// update() lerps controls.target toward follow target (factor 0.06/frame)
// null → lerps back to default target (0, 0.8, 0)
```

---

## SceneManager (`three/SceneManager.ts`)

Animation loop order each frame:

```
1. stage.update()                          ← orbit controls + camera lerp
2. characters.update(renderer)             ← GPU compute dispatch
3. characters.syncFromGPU(renderer)        ← async GPU → CPU readback
   ├── behaviorManager.update(positions)   ← state transitions (CPU)
   └── store.setDebugPositions(...)        ← only if debug panel open
4. camera follow from selectedIndex
5. engine.render(scene, camera)
6. updateStats()
```

---

## Zustand Store (`store/useStore.ts`)

Relevant runtime state for the agent city:

```typescript
activeEncounter: ActiveEncounter | null // set by BehaviorManager when player is near an NPC
setActiveEncounter(encounter | null)

// Also available (for future chat UI):
// encounter.npcIndex, .npcName, .npcRole, .npcMission, .npcPersonality
```

---

## What is NOT yet implemented

| Feature                           | Notes                                                                                              |
| --------------------------------- | -------------------------------------------------------------------------------------------------- |
| **AI chat when player meets NPC** | `activeEncounter` is ready in the store; needs UI panel + LLM call                                 |
| **NPC–NPC "talking" visual**      | They freeze correctly but no visual cue (no speech bubble, no animation)                           |
| **Player selection highlight**    | Player is identified by `colors[0]` (blue) but has no highlight ring or indicator                  |
| **Waypoint indicator**            | No visual marker on the floor when player is sent to a destination                                 |
| **NPC state exposed to UI**       | No overlay showing nearby NPC name/role on hover or proximity                                      |
| **Encounter with non-BOIDS NPC**  | Player can only encounter NPCs regardless of their state, but no special handling for frozen pairs |

---

## Key Design Decisions

1. **Player is instance 0 of the same InstancedMesh** — same geometry, same material, differentiated only by `colors[0]` (blue). This allows switching player identity in the future.
2. **GPU compute handles physics; CPU handles logic** — avoids complex branching in WGSL for state logic like timers and AI, while keeping physics performance high.
3. **State is a float in the GPU buffer** — allows reading in the shader without a texture lookup. Three states use float ranges: `< 0.5` = BOIDS, `0.5–1.5` = FROZEN, `> 1.5` = GOTO.
4. **GPU readback is the single source of truth** — no parallel CPU simulation. Picking, camera follow, and behavior all use the same readback position array.
5. **`activeEncounter` is stateless from the NPC side** — the NPC does not change state when the player approaches. Only the player-side encounter UI reacts. This keeps NPC logic simple.
