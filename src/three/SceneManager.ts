
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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
import { AgentBehavior, ChatMessage } from '../types';
import * as conversationService from '../services/conversationService';
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

  private unsubs: (() => void)[] = [];
  private isDisposed = false;

  constructor(container: HTMLElement) {
    this.engine = new Engine(container);
    this.stage = new Stage(this.engine.renderer.domElement);
    this.characterManager = new CharacterManager(this.stage.scene);
    this.navMesh = new NavMeshManager();
    this.poiManager = new PoiManager();
    this.worldManager = new WorldManager(this.stage.scene, this.navMesh, this.poiManager);
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
      this.worldManager.getOffice() ?? undefined
    );

    this.engine.renderer.setAnimationLoop(this.animate.bind(this));
    window.addEventListener('resize', this.onResize.bind(this));

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

    useStore.setState({
      selectedNpcIndex: npcIndex,
      isChatting: true,
      chatMessages: [],
      isThinking: false,
    });
    this.selectedIndex = npcIndex;

    // Stop NPC, face player
    this.controller.play(npcIndex, 'listen');
    this.controller.getAgentStateBuffer()?.setWaypoint(npcIndex, dir.x, dir.z);

    // Walk player to the NPC
    const playerDriver = this.driverManager?.getPlayerDriver();
    playerDriver?.walkTo(target, 'listen', () => {
      // Face the NPC once arrived
      const p = this.controller!.getCPUPositions()!;
      const fx = p[npcIndex * 4] - p[PLAYER_INDEX * 4];
      const fz = p[npcIndex * 4 + 2] - p[PLAYER_INDEX * 4 + 2];
      this.controller!.getAgentStateBuffer()?.setWaypoint(PLAYER_INDEX, fx, fz);
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

    const agent = AGENTS[state.selectedNpcIndex];
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = { role: 'user', text, timestamp };

    useStore.setState((s) => ({
      chatMessages: [...s.chatMessages, userMsg],
      isThinking: true,
      isTyping: false,
    }));

    try {
      const responseText = await conversationService.sendMessage(
        agent,
        useStore.getState().chatMessages.slice(0, -1),
        text,
      );
      const modelMsg: ChatMessage = {
        role: 'model',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      useStore.setState((s) => ({ chatMessages: [...s.chatMessages, modelMsg], isThinking: false }));
    } catch (err) {
      console.error('[SceneManager] sendMessage error:', err);
      useStore.setState({ isThinking: false });
    }
  }

  // ── Private helpers ──────────────────────────────────────────

  private async _triggerNpcGreeting(npcIndex: number): Promise<void> {
    const agent = AGENTS[npcIndex];
    useStore.setState({ isThinking: true });
    try {
      const text = await conversationService.getGreeting(agent);
      const msg: ChatMessage = {
        role: 'model',
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
    this.engine.onResize(window.innerWidth, window.innerHeight);
    this.stage.onResize(window.innerWidth, window.innerHeight);
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
    const { selectedNpcIndex, setSelectedPosition } = useStore.getState();
    if (selectedNpcIndex !== null && this.controller) {
      const npcPos = this.controller.getCPUPosition(selectedNpcIndex);
      if (npcPos) {
        const screenPos = npcPos.clone();
        screenPos.y += BUBBLE_Y_OFFSET;
        screenPos.project(this.stage.camera);
        setSelectedPosition({
          x: (screenPos.x * 0.5 + 0.5) * window.innerWidth,
          y: (screenPos.y * -0.5 + 0.5) * window.innerHeight,
        });
      }
    } else {
      setSelectedPosition(null);
    }

    // 5. Chat camera mode
    const { isChatting } = useStore.getState();
    const playerMoving = this.controller?.getAgentState(PLAYER_INDEX) === AgentBehavior.GOTO;
    this.stage.setChatMode(isChatting, playerMoving);

    this.engine.render(this.stage.scene, this.stage.camera);
  }

  public dispose() {
    this.isDisposed = true;
    this.unsubs.forEach(u => u());
    window.removeEventListener('resize', this.onResize.bind(this));
    this.inputManager?.dispose();
    this.driverManager?.dispose();
    this.engine.dispose();
    this.stage.controls?.dispose();
  }
}

