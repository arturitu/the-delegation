# Autonomous Characters Lab — Agent City System Design

> Status: **In development** · Last updated: Feb 2026

---

## Overview

A Three.js WebGPU simulation of **Bubbylon**, a fictional city with 100 autonomous agents. One agent is always the **Player** (index 0); the other 99 are **NPCs**. All share the same `InstancedMesh`. Physics run on the GPU via a compute shader; state logic runs on CPU and is synced to the GPU each frame.

---

## File Structure

```
data/
  agents.ts               ← static city data (names, roles, missions, …)

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
- `index 1–99` — NPCs with 99 unique names, 20 roles (cyclic), 30 missions (cyclic), 8 personalities (cyclic)

**City constants:**

```
CITY_NAME          = "Bubbylon"
TOTAL_COUNT        = 100
PLAYER_INDEX       = 0
NPC_START_INDEX    = 1
```

---

## Behavior States (`types.ts → AgentBehavior`)

```typescript
enum AgentBehavior {
  BOIDS = 0, // Reynolds separation — GPU compute, autonomous movement
  FROZEN = 1, // Position locked, velocity = 0, animation idle
  GOTO = 2, // Moving toward a waypoint at uSpeed, then → FROZEN on arrival
  TALK = 3, // Position locked, playing talk animation + mouth movement
}
```

---

## State Machine

### NPC state machine

```
         spawn
           │
         BOIDS  ◄──────────────────────────┐
           │                               │
   dist(i,j) < 0.8 units            timer (4 000 ms)
     (NPC↔NPC collision)                   │
           │                               │
         TALK   ───────────────────────────┘
   (Alternating turns)
```

- Maximum **10 talking pairs** simultaneously (cap to avoid stacking effects).
- Only NPCs in `BOIDS` state can trigger a new talking freeze.
- NPCs in `TALK` state automatically loop mouth animations via `ExpressionBuffer`.
- **Alternation Logic:** During NPC-NPC encounters, agents alternate speaking turns every 1.5–3 seconds (one talks, one listens).

### Player state machine

```
         spawn
           ├── FROZEN  (standing, default)
           │
    click on floor (GOTO) or startChat (moveToNPC)
           │
          GOTO  (moves to waypoint/target)
           │
    dist to waypoint < 0.3 units
           │
         FROZEN / TALK (if chatting & thinking/typing)

    ─── Interaction ────────────────────────────
    chatting (store.isChatting) ─┐
                                 ├─► TALK state triggered on arrival
    thinking/typing (sync)  ────┘
```

- **startChat(npc):** Sets NPC to `FROZEN` (facing player) and Player to `GOTO` (destination near NPC).
- **Arrival Logic:** Upon reaching the NPC, the chat begins.
- **Visual Sync:** NPC enters `TALK` animation only when `isThinking` (AI is generating). Player enters `TALK` animation only when `isTyping` in the chat UI.
- **endChat:** Restores player to `FROZEN` and NPC to `BOIDS`.

---

## CharacterManager (`three/entities/CharacterManager.ts`)

Owns all GPU buffers and the instanced meshes. Handles multi-mesh character structure.

**Multi-Mesh Support:**

- Supports characters with 3 `SkinnedMesh` components: `body`, `eyes`, and `mouth`.
- **Body:** Receives `instanceColor` and handles skeletal animations.
- **Eyes/Mouth:** Use the original texture maps with alpha transparency. UVs are offset on the GPU using a 4x2 expression atlas.

**GPU buffers:**

| Buffer                       | Type                              | Stride | Content                      |
| ---------------------------- | --------------------------------- | ------ | ---------------------------- |
| `posAttribute`               | `StorageInstancedBufferAttribute` | vec4   | position (x, y, z, 1)        |
| `velAttribute`               | `StorageInstancedBufferAttribute` | vec4   | velocity (x, 0, z, 0)        |
| `agentStateBuffer.attribute` | `StorageInstancedBufferAttribute` | vec4   | (wpX, 0, wpZ, state)         |
| `expressionBuffer.attribute` | `StorageInstancedBufferAttribute` | vec4   | (eyeX, eyeY, mouthX, mouthY) |
| `bakedIdleBuffer`            | `StorageBufferAttribute`          | mat4   | pre-baked idle (clip 0)      |
| `bakedTalkBuffer`            | `StorageBufferAttribute`          | mat4   | pre-baked talk (clip 1)      |
| `bakedWalkBuffer`            | `StorageBufferAttribute`          | mat4   | pre-baked walk (clip 2)      |

**Expression System (`three/behavior/ExpressionBuffer.ts`):**

- Per-instance control of UV offsets for facial expressions.
- **Atlas (4x2):** Supports 8 distinct frames for eyes and mouth.
- **Blinking:** Automatic random blinking logic (CPU timer → GPU offset update).
- **Mouth Sync:** Looping mouth animation frames triggered during `TALK` state (sync'd to AI thinking or Player typing).

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

| Feature                        | Notes                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------- |
| **Player selection highlight** | Player is identified by `colors[0]` (blue) but has no highlight ring or indicator |
| **Waypoint indicator**         | No visual marker on the floor when player is sent to a destination                |
| **NPC state exposed to UI**    | No overlay showing nearby NPC name/role on hover or proximity                     |
| **Department Logic**           | NPCs currently wander randomly; no "go to office" or department-specific behavior |

---

## Key Design Decisions

1. **Player is instance 0 of the same InstancedMesh** — same geometry, same material, differentiated only by `colors[0]` (blue). This allows switching player identity in the future.
2. **GPU compute handles physics; CPU handles logic** — avoids complex branching in WGSL for state logic like timers and AI, while keeping physics performance high.
3. **State is a float in the GPU buffer** — allows reading in the shader without a texture lookup. Three states use float ranges: `< 0.5` = BOIDS, `0.5–1.5` = FROZEN, `> 1.5` = GOTO.
4. **GPU readback is the single source of truth** — no parallel CPU simulation. Picking, camera follow, and behavior all use the same readback position array.
5. **`activeEncounter` is stateless from the NPC side** — the NPC does not change state when the player approaches. Only the player-side encounter UI reacts. This keeps NPC logic simple.
