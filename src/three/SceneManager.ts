
import { Engine } from './core/Engine';
import { Stage } from './core/Stage';
import { CharacterManager } from './entities/CharacterManager';
import { CharacterController } from './CharacterController';
import { NavMeshManager } from './pathfinding/NavMeshManager';
import { PoiManager } from './world/PoiManager';
import { WorldManager } from './world/WorldManager';
import { DriverManager } from './drivers/DriverManager';
import { ChatManager } from './ChatManager';
import { InputManager } from './input/InputManager';
import { AGENTS, PLAYER_INDEX } from '../data/agents';
import { useStore } from '../store/useStore';
import { useAgencyStore } from '../store/agencyStore';
import { AgentBehavior } from '../types';
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
  private chatManager: ChatManager | null = null;
  private inputManager: InputManager | null = null;

  // Track which NPC is selected for camera follow
  private selectedIndex: number | null = null;

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

    // CharacterController — unified character API
    this.controller = new CharacterController(
      this.characterManager,
      this.navMesh,
      this.poiManager,
    );

    // Register all character drivers
    this.driverManager = new DriverManager(this.controller);
    const playerDriver = this.driverManager.registerPlayer();

    AGENTS.forEach((agent) => {
      if (agent.isPlayer) return;
      this.driverManager.registerNpc(agent.index, agent);
    });

    // ChatManager — encapsulates all player↔NPC chat logic
    this.chatManager = new ChatManager(this.controller, this.driverManager, this.poiManager);

    // InputManager — callbacks feed into PlayerInputDriver or store
    this.inputManager = new InputManager({
      canvas: this.engine.renderer.domElement,
      camera: this.stage.camera,
      getPositions: () => this.controller!.getCPUPositions(),
      getCount: () => this.controller!.getCount(),
      onSelect: (index) => {
        const storeState = useStore.getState();
        if (storeState.isChatting) {
          this.endChat();
        }
        this.selectedIndex = index !== PLAYER_INDEX ? index : null;
        useStore.getState().setSelectedNpc(this.selectedIndex);
      },
      onWaypoint: (x, z) => playerDriver.onFloorClick(x, z),
      onHover: (index, pos) => useStore.getState().setHoveredNpc(index, pos),
      getPois: () => this.poiManager.getAllPois(),
      onPoiHover: (id, label, pos) => useStore.getState().setHoveredPoi(id, label, pos),
      onPoiClick: (id) => playerDriver.onPoiClick(id),
      raycastObject: this.worldManager.getOffice() ?? undefined,
      isPointValid: (point) => this.navMesh.isPointOnNavMesh(point),
      getIsPaused: () => useAgencyStore.getState().isPaused,
    });

    this.engine.renderer.setAnimationLoop(this.animate.bind(this));

    // React to store changes that affect the 3D world
    const unsub = useStore.subscribe((s, prev) => {
      if (s.instanceCount !== prev.instanceCount) {
        this.controller?.setInstanceCount(s.instanceCount);
      }

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

  // ── Public chat API (delegates to ChatManager) ───────────────

  public startChat(npcIndex: number): void {
    this.chatManager?.startChat(npcIndex);
    this.selectedIndex = npcIndex;
  }

  public endChat(): void {
    this.chatManager?.endChat();
    this.selectedIndex = null;
    useStore.getState().setSelectedNpc(null);
  }

  public async sendMessage(text: string): Promise<void> {
    return this.chatManager?.sendMessage(text);
  }

  // ── Agency API ────────────────────────────────────────────────

  public setAgencyHandler(
    handler: ((npcIndex: number, text: string) => Promise<string | null>) | null,
  ): void {
    this.chatManager?.setAgencyHandler(handler);
  }

  /** Immediately trigger an NPC to pick a new autonomous action. */
  public kickNpcDriver(index: number): void {
    this.driverManager?.kickNpc(index);
  }

  /** Play or stop the working animation on an NPC. */
  public setNpcWorking(index: number, working: boolean): void {
    this.driverManager?.setNpcWorking(index, working);
  }

  // ── Private helpers ──────────────────────────────────────────

  private onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;

    // Always update camera aspect ratio for immediate visual scaling (fluid)
    this.stage.onResize(w, h);

    // Only update the renderer buffer if we are not actively dragging a panel.
    // This avoids expensive GPU reallocations during the drag, while the
    // CSS-driven sizing (100% width/height) handles the visual stretch.
    if (!useStore.getState().isResizing) {
      this.engine.onResize(w, h);
    }
  }

  private animate() {
    this.engine.timer.update();
    const isPaused = useAgencyStore.getState().isPaused;

    // When paused: update camera controls so orbiting still works, then render
    // the frozen frame and bail — no GPU compute, no path/driver updates.
    if (isPaused) {
      this.stage.update();
      this.engine.render(this.stage.scene, this.stage.camera);
      return;
    }

    const delta = this.engine.timer.getDelta();

    this.stage.update();

    // 1. GPU update (expressions + compute shader)
    this.controller?.update(delta, this.engine.renderer);

    // 2. GPU→CPU readback (async, 1-frame lag)
    this.controller?.syncFromGPU(this.engine.renderer).then((positions) => {
      if (!positions || !this.controller) return;
      // Guard: if the scene was paused while the readback was in-flight, discard
      if (useAgencyStore.getState().isPaused) return;
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
    this.inputManager?.dispose();
    this.driverManager?.dispose();
    this.engine.dispose();
    this.stage.controls?.dispose();
  }
}

