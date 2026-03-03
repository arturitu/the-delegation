
import * as THREE from 'three/webgpu';
import { Engine } from './core/Engine';
import { Stage } from './core/Stage';
import { CharacterManager } from './entities/CharacterManager';
import { CharacterController } from './CharacterController';
import { NavMeshManager } from './pathfinding/NavMeshManager';
import { PoiManager } from './world/PoiManager';
import { WorldManager } from './world/WorldManager';
import { DriverManager } from './drivers/DriverManager';
import { InputManager } from './input/InputManager';
import { AGENTS, PLAYER_INDEX, NPC_START_INDEX } from '../data/agents';
import { useStore } from '../store/useStore';
import { useAgencyStore } from '../store/agencyStore';
import { AgentBehavior, ChatMessage } from '../types';
import { BUBBLE_Y_OFFSET } from './constants';

export class SceneManager {
  private engine: Engine;
  private stage: Stage;
  private characterManager: CharacterManager;
  private controller: CharacterController | null = null;
  private navMesh: NavMeshManager;
  private poiManager: PoiManager;
  private worldManager: WorldManager;
  private driverManager: DriverManager | null = null;
  private inputManager: InputManager | null = null;

  // Track which NPC is selected for camera follow
  private selectedIndex: number | null = null;

  /** Optional handler that intercepts player→NPC messages for the agency system. */
  private agencyHandler: ((npcIndex: number, text: string) => Promise<string | null>) | null = null;

  private unsubs: (() => void)[] = [];
  private isDisposed = false;
  private container: HTMLElement;
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement) {
    this.container = container;
    this.engine = new Engine(container);
    this.stage = new Stage(this.engine.renderer.domElement);
    this.characterManager = new CharacterManager(this.stage.scene);
    this.navMesh = new NavMeshManager();
    this.poiManager = new PoiManager();
    this.characterManager.setPoiManager(this.poiManager);
    this.worldManager = new WorldManager(this.stage.scene, this.navMesh, this.poiManager);

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(container);

    this.init();
  }

  private async init() {
    await this.engine.init();
    if (this.isDisposed) return;

    // 1. Load World & Office Assets
    await this.worldManager.load();

    // 2. Load Characters
    await this.characterManager.load();
    if (this.isDisposed) return;

    const state = useStore.getState();
    this.characterManager.setInstanceCount(state.instanceCount);

    // Note: Stage.updateDimensions() removed, using static office
    // Note: NavMesh.buildFromPlane() removed, using static navmesh from GLB

    // CharacterController — unified character API
    this.controller = new CharacterController(
      this.characterManager,
      this.navMesh,
      this.poiManager,
    );

    // Register all character drivers
    this.driverManager = new DriverManager(this.controller);
    const playerDriver = this.driverManager.registerPlayer();

    for (let i = NPC_START_INDEX; i < AGENTS.length; i++) {
      this.driverManager.registerNpc(i, AGENTS[i]);
    }

    // InputManager — callbacks feed into PlayerInputDriver or store
    this.inputManager = new InputManager(
      this.engine.renderer.domElement,
      this.stage.camera,
      () => this.controller!.getCPUPositions(),
      () => this.controller!.getCount(),
      (index) => {
        const storeState = useStore.getState();
        if (storeState.isChatting) {
          this.endChat();
        }
        this.selectedIndex = index !== PLAYER_INDEX ? index : null;
        useStore.getState().setSelectedNpc(this.selectedIndex);
      },
      (x, z) => playerDriver.onFloorClick(x, z),
      (index, pos) => useStore.getState().setHoveredNpc(index, pos),
      () => this.poiManager.getAllPois(),
      (id, label, pos) => useStore.getState().setHoveredPoi(id, label, pos),
      (id) => playerDriver.onPoiClick(id),
      this.worldManager.getOffice() ?? undefined,
      (point) => this.navMesh.isPointOnNavMesh(point)
    );

    this.engine.renderer.setAnimationLoop(this.animate.bind(this));

    // React to store changes that affect the 3D world
    const unsub = useStore.subscribe((s, prev) => {
      if (s.instanceCount !== prev.instanceCount) {
        this.controller?.setInstanceCount(s.instanceCount);
      }
      // worldSize removal — now using static office

      // isChatting/isThinking/isTyping → update character visuals
      const chatChanged = s.isChatting !== prev.isChatting
        || s.isThinking !== prev.isThinking
        || s.isTyping !== prev.isTyping;

      if (chatChanged && this.controller) {
        if (s.isChatting && s.selectedNpcIndex !== null) {
          const npc = s.selectedNpcIndex;
          // NPC: thinking = talk, waiting = listen
          if (this.controller.getState(npc) !== 'walk') {
            this.controller.play(npc, s.isThinking ? 'talk' : 'listen');
          }
          this.controller.setSpeaking(npc, s.isThinking);
          // Player: typing = talk, waiting = listen
          if (this.controller.getState(PLAYER_INDEX) !== 'walk') {
            this.controller.play(PLAYER_INDEX, s.isTyping ? 'talk' : 'listen');
          }
          this.controller.setSpeaking(PLAYER_INDEX, s.isTyping);
        } else if (!s.isChatting && prev.isChatting) {
          // Chat ended — restore both sides
          if (prev.selectedNpcIndex !== null) {
            this.controller.setSpeaking(prev.selectedNpcIndex, false);
            this.controller.play(prev.selectedNpcIndex, 'idle');
          }
          this.controller.setSpeaking(PLAYER_INDEX, false);
          this.controller.play(PLAYER_INDEX, 'idle');
        }
      }
    });
    this.unsubs.push(unsub);
  }

  // ── Public chat API ──────────────────────────────────────────
  // Components call these methods via the sceneManagerRef, not via the store.

  public startChat(npcIndex: number): void {
    if (!this.controller) return;
    const positions = this.controller.getCPUPositions();
    if (!positions) return;

    const npc = new THREE.Vector3(positions[npcIndex * 4], 0, positions[npcIndex * 4 + 2]);
    const player = new THREE.Vector3(positions[PLAYER_INDEX * 4], 0, positions[PLAYER_INDEX * 4 + 2]);

    // Direction from NPC to player, stop 1.2 units away
    let dir = new THREE.Vector3().subVectors(player, npc);
    const dist = dir.length();
    if (dist < 0.01) dir.set(1, 0, 0); else dir.divideScalar(dist);

    const target = npc.clone().addScaledVector(dir, 1.2);

    // Stop NPC autonomous behavior by making them "busy" in the agency store sense
    useStore.setState({
      selectedNpcIndex: npcIndex,
      isChatting: true,
      chatMessages: [],
      isThinking: false,
    });
    this.selectedIndex = npcIndex;

    // Stop NPC, face player
    this.controller.cancelMovement(npcIndex);
    this.controller.play(npcIndex, 'listen');
    this.controller.getAgentStateBuffer()?.setWaypoint(npcIndex, dir.x, dir.z);

    // Walk player to the NPC
    const playerDriver = this.driverManager?.getPlayerDriver();
    playerDriver?.walkTo(target, 'listen', () => {
      // Face each other once arrived
      const p = this.controller!.getCPUPositions()!;
      const fx = p[npcIndex * 4] - p[PLAYER_INDEX * 4];
      const fz = p[npcIndex * 4 + 2] - p[PLAYER_INDEX * 4 + 2];
      this.controller!.getAgentStateBuffer()?.setWaypoint(PLAYER_INDEX, fx, fz);
      this.controller!.getAgentStateBuffer()?.setWaypoint(npcIndex, -fx, -fz);

      this._triggerNpcGreeting(npcIndex);
    });
  }

  public endChat(): void {
    const { selectedNpcIndex } = useStore.getState();
    useStore.setState({
      isChatting: false,
      isTyping: false,
      isThinking: false,
      chatMessages: [],
    });
    if (selectedNpcIndex !== null && this.controller) {
      this.controller.setSpeaking(selectedNpcIndex, false);
      this.controller.play(selectedNpcIndex, 'idle');
      // Release POI if any
      this.controller.poiManager.releaseAll(selectedNpcIndex);
    }
    if (this.controller) {
      this.controller.setSpeaking(PLAYER_INDEX, false);
      this.controller.play(PLAYER_INDEX, 'idle');
    }
    this.selectedIndex = null;
    useStore.getState().setSelectedNpc(null);
  }

  public async sendMessage(text: string): Promise<void> {
    const state = useStore.getState();
    if (state.selectedNpcIndex === null || state.isThinking) return;

    const npcIndex = state.selectedNpcIndex;
    const agent = AGENTS[npcIndex];
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = { role: 'user', text, timestamp };

    useStore.setState((s) => ({
      chatMessages: [...s.chatMessages, userMsg],
      isThinking: true,
      isTyping: false,
    }));

    try {
      // Direct call to agency system. No more conversationService fallback.
      let responseText: string | null = null;
      if (this.agencyHandler) {
        responseText = await this.agencyHandler(npcIndex, text);
      }

      // If agency system didn't handle it (unlikely with new strict focus),
      // we can have a fallback but it should be operative.
      if (responseText === null) {
        responseText = "I'm sorry, I'm currently focused on my tasks. Please give me an instruction related to our project.";
      }

      const modelMsg: ChatMessage = {
        role: 'assistant',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      useStore.setState((s) => ({ chatMessages: [...s.chatMessages, modelMsg], isThinking: false }));
    } catch (err) {
      console.error('[SceneManager] sendMessage error:', err);
      useStore.setState({ isThinking: false });
    }
  }

  // ── Agency API ────────────────────────────────────────────────

  /**
   * Register a handler that intercepts player→NPC messages for the agency system.
   * Return the response string to override the default conversationService,
   * or null to fall through to normal chat.
   */
  public setAgencyHandler(
    handler: ((npcIndex: number, text: string) => Promise<string | null>) | null,
  ): void {
    this.agencyHandler = handler;
  }

  /** Play or stop the working animation on an NPC. */
  public setNpcWorking(index: number, working: boolean): void {
    if (!this.controller) return;
    if (working) {
      const pois = this.poiManager.getFreePois('sit_work', index);
      if (pois.length > 0) {
        const poi = pois[Math.floor(Math.random() * pois.length)];
        const positions = this.controller.getCPUPositions();
        const currentPos = positions
          ? new THREE.Vector3(
              positions[index * 4],
              positions[index * 4 + 1],
              positions[index * 4 + 2],
            )
          : undefined;
        this.controller.walkToPoi(index, poi.id, undefined, currentPos);
      } else {
        this.controller.play(index, 'sit_work');
      }
    } else {
      this.controller.play(index, 'idle');
    }
  }

  /** Walk an NPC to the boardroom area POI. */
  public moveNpcToBoardroom(index: number, onArrival?: () => void): void {
    if (!this.controller) return;
    const positions = this.controller.getCPUPositions();
    const currentPos = positions
      ? new THREE.Vector3(
          positions[index * 4],
          positions[index * 4 + 1],
          positions[index * 4 + 2],
        )
      : undefined;
    const boardroomPoi = this.poiManager.getPoi('idle-area-boardroom');
    if (boardroomPoi) {
      const target = this.poiManager.getRandomPointNearPoi('idle-area-boardroom', 2)
        ?? boardroomPoi.position;
      this.controller.moveTo(index, target, 'idle', onArrival ? () => onArrival() : undefined, currentPos);
    } else if (onArrival) {
      onArrival();
    }
  }

  // ── Private helpers ──────────────────────────────────────────

  private async _triggerNpcGreeting(npcIndex: number): Promise<void> {
    const agent = AGENTS[npcIndex];
    useStore.setState({ isThinking: true });
    try {
      // Simplified operational greeting
      const text = `Hello. I am the ${agent.role}. How can I help you with our current objectives?`;
      const msg: ChatMessage = {
        role: 'assistant',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      useStore.setState({ chatMessages: [msg], isThinking: false });
    } catch (err) {
      console.error('[SceneManager] greeting error:', err);
      useStore.setState({ isThinking: false });
    }
  }

  private onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;

    // Always update camera aspect ratio for immediate visual scaling (fluid)
    this.stage.onResize(w, h);

    // Only update the renderer buffer if we are not actively dragging a panel.
    // This avoids expensive GPU reallocations during the drag, while the
    // CSS-driven sizing (100% width/height) handles the visual stretch.
    if (!useAgencyStore.getState().isResizing) {
      this.engine.onResize(w, h);
    }
  }

  private animate() {
    this.engine.timer.update();
    const delta = this.engine.timer.getDelta();

    this.stage.update();

    // 1. GPU update (expressions + compute shader)
    this.controller?.update(delta, this.engine.renderer);

    // 2. GPU→CPU readback (async, 1-frame lag)
    this.controller?.syncFromGPU(this.engine.renderer).then((positions) => {
      if (!positions || !this.controller) return;
      this.controller.updatePaths(positions);
      this.driverManager?.update(positions, delta);
    });

    // 3. Camera follow
    const followIdx = this.selectedIndex ?? PLAYER_INDEX;
    const followPos = this.controller?.getCPUPosition(followIdx) ?? null;
    this.stage.setFollowTarget(followPos);

    // 4. NPC screen-space bubble position
    const { selectedNpcIndex, setSelectedPosition, selectedPosition } = useStore.getState();
    if (selectedNpcIndex !== null && this.controller) {
      const npcPos = this.controller.getCPUPosition(selectedNpcIndex);
      if (npcPos) {
        const screenPos = npcPos.clone();
        screenPos.y += BUBBLE_Y_OFFSET;
        screenPos.project(this.stage.camera);

        const rect = this.container.getBoundingClientRect();
        const nextX = (screenPos.x * 0.5 + 0.5) * rect.width;
        const nextY = (screenPos.y * -0.5 + 0.5) * rect.height;

        // Optimization: only update state if the position has changed significantly (e.g. > 0.5px)
        // This reduces Unnecessary React re-renders in the main loop.
        const dx = Math.abs(nextX - (selectedPosition?.x ?? 0));
        const dy = Math.abs(nextY - (selectedPosition?.y ?? 0));

        if (dx > 0.5 || dy > 0.5) {
          setSelectedPosition({ x: nextX, y: nextY });
        }
      }
    } else {
      if (selectedPosition !== null) setSelectedPosition(null);
    }

    // 5. Chat camera mode
    const { isChatting } = useStore.getState();
    const playerMoving = this.controller?.getAgentState(PLAYER_INDEX) === AgentBehavior.GOTO;
    this.stage.setChatMode(isChatting, playerMoving);

    this.engine.render(this.stage.scene, this.stage.camera);
  }

  public getNpcScreenPosition(index: number): { x: number; y: number } | null {
    if (!this.controller) return null;
    const npcPos = this.controller.getCPUPosition(index);
    if (!npcPos) return null;

    const screenPos = npcPos.clone();
    screenPos.y += BUBBLE_Y_OFFSET;
    screenPos.project(this.stage.camera);

    const rect = this.container.getBoundingClientRect();
    return {
      x: (screenPos.x * 0.5 + 0.5) * rect.width,
      y: (screenPos.y * -0.5 + 0.5) * rect.height,
    };
  }

  public dispose() {
    this.isDisposed = true;
    this.resizeObserver.disconnect();
    this.unsubs.forEach(u => u());
    this.driverManager?.dispose();
    this.engine.dispose();
    this.stage.controls?.dispose();
  }
}

