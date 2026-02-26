
import { Engine } from './core/Engine';
import { Stage } from './core/Stage';
import { CharacterManager } from './entities/CharacterManager';
import { InputManager } from './input/InputManager';
import { BehaviorManager } from './behavior/BehaviorManager';
import { AGENTS, PLAYER_INDEX } from '../data/agents';
import { useStore } from '../store/useStore';
import { AgentBehavior, ChatMessage } from '../types';
import { geminiService } from '../services/geminiService';
import * as THREE from 'three/webgpu';

export class SceneManager {
  private engine: Engine;
  private stage: Stage;
  private characters: CharacterManager;

  private inputManager: InputManager | null = null;
  private behaviorManager: BehaviorManager | null = null;
  private selectedIndex: number | null = null;

  private unsubs: (() => void)[] = [];
  private isDisposed = false;

  constructor(container: HTMLElement) {
    this.engine = new Engine(container);
    this.stage = new Stage(this.engine.renderer.domElement);
    this.characters = new CharacterManager(this.stage.scene);
    this.init();
  }

  private async init() {
    await this.engine.init();
    if (this.isDisposed) return;
    await this.characters.load();
    if (this.isDisposed) return;

    const state = useStore.getState();

    // Initial sync
    this.characters.setInstanceCount(state.instanceCount);
    this.characters.updateWorldSize(state.worldSize);
    this.stage.updateDimensions(state.worldSize);

    this.engine.renderer.setAnimationLoop(this.animate.bind(this));
    window.addEventListener('resize', this.onResize.bind(this));

    const stateBuffer = this.characters.getAgentStateBuffer();
    if (stateBuffer) {
      this.behaviorManager = new BehaviorManager(
        stateBuffer,
        AGENTS,
        (encounter) => useStore.getState().setActiveEncounter(encounter),
        (index, isSpeaking) => this.characters.setSpeaking(index, isSpeaking),
        (npcIndex) => {
          // Player arrived at NPC -> Start thinking/talking
          const state = useStore.getState();
          if (state.isChatting && state.selectedNpcIndex === npcIndex) {
            this.handleNpcGreeting(npcIndex);
          }
        }
      );
    }

    this.inputManager = new InputManager(
      this.engine.renderer.domElement,
      this.stage.camera,
      () => this.characters.getCPUPositions(),
      () => this.characters.getCount(),
      (index) => {
        const state = useStore.getState();
        // If we are chatting, end it before changing selection
        if (state.isChatting) {
          state.endChat();
        }

        this.selectedIndex = index;
        // Update store: null = default (follow player), number = selected NPC
        useStore.getState().setSelectedNpc(index !== PLAYER_INDEX ? index : null);
      },
      (x, z) => {
        const { worldSize } = useStore.getState();
        // Constrain to grid boundaries
        if (Math.abs(x) <= worldSize && Math.abs(z) <= worldSize) {
          this.behaviorManager?.setPlayerWaypoint(x, z);
        }
      },
      (index, pos) => { useStore.getState().setHoveredNpc(index, pos); },
    );

    useStore.setState({
      startChat: async (index: number) => {
        const positions = this.characters.getCPUPositions();
        if (positions) {
          this.behaviorManager?.startChat(index, positions);

          useStore.setState({
            selectedNpcIndex: index,
            isChatting: true,
            chatMessages: [],
            isThinking: false
          });
        }
      },
      endChat: () => {
        const { selectedNpcIndex } = useStore.getState();
        this.behaviorManager?.endChat(selectedNpcIndex);
        useStore.setState({
          isChatting: false,
          isTyping: false,
          isThinking: false,
          chatMessages: []
        });
      },
      sendMessage: async (text: string) => {
        const state = useStore.getState();
        if (state.selectedNpcIndex === null || state.isThinking) return;

        const agent = AGENTS[state.selectedNpcIndex];
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const userMessage: ChatMessage = {
          role: 'user',
          text,
          timestamp
        };

        useStore.setState((s) => ({
          chatMessages: [...s.chatMessages, userMessage],
          isThinking: true,
          isTyping: false
        }));

        try {
          const systemInstruction = `You are ${agent.role} at FakeClaw Inc.
Department: ${agent.department}
Mission: ${agent.mission}
Personality: ${agent.personality}
Expertise: ${agent.expertise.join(', ')}

Keep your responses extremely brief (1-2 short sentences max) and professional, matching your corporate persona.`;

          const responseText = await geminiService.chat(
            systemInstruction,
            useStore.getState().chatMessages.slice(0, -1), // History without the last user message
            text
          );

          const modelMessage: ChatMessage = {
            role: 'model',
            text: responseText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };

          useStore.setState((s) => ({
            chatMessages: [...s.chatMessages, modelMessage],
            isThinking: false
          }));

        } catch (error) {
          console.error("Gemini Error:", error);
          useStore.setState({ isThinking: false });
        }
      }
    });

    const sub2 = useStore.subscribe((state, prevState) => {
      if (state.instanceCount !== prevState.instanceCount) {
        this.characters.setInstanceCount(state.instanceCount);
      }

      // Update World Size
      if (state.worldSize !== prevState.worldSize) {
        this.characters.updateWorldSize(state.worldSize);
        this.stage.updateDimensions(state.worldSize);
      }

      // Handle Speaking Animation trigger
      if (state.lastSpeakingTrigger !== prevState.lastSpeakingTrigger && state.lastSpeakingTrigger) {
        this.characters.setSpeaking(state.lastSpeakingTrigger.index, state.lastSpeakingTrigger.isSpeaking);
      }

      // Handle Player Thinking/Speaking during chat
      if (state.isChatting !== prevState.isChatting || state.isThinking !== prevState.isThinking || state.isTyping !== prevState.isTyping) {
        if (state.isChatting && state.selectedNpcIndex !== null) {
          // NPC speaks when thinking (model response)
          this.characters.setSpeaking(state.selectedNpcIndex, state.isThinking);

          // Player speaks when typing
          this.characters.setSpeaking(PLAYER_INDEX, state.isTyping);
        } else if (!state.isChatting && prevState.isChatting) {
          // Chat ended - clean up whichever NPC was chatting
          const prevNpcIndex = prevState.selectedNpcIndex;
          if (prevNpcIndex !== null) {
            this.characters.setSpeaking(prevNpcIndex, false);
          }
          this.characters.setSpeaking(PLAYER_INDEX, false);
        }
      }
    });

    this.unsubs.push(sub2);
  }

  private onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.engine.onResize(w, h);
    this.stage.onResize(w, h);
  }

  private animate() {
    this.engine.timer.update();
    const delta = this.engine.timer.getDelta();
    const time = this.engine.timer.getElapsed();

    this.stage.update();

    // 1. GPU Update
    this.characters.update(delta, this.engine.renderer);

    // 2. GPU → CPU readback (async, 1-frame lag). Keeps debugPosArray in sync with the compute shader.
    //    Used for picking, camera follow.
    this.characters.syncFromGPU(this.engine.renderer).then((positions) => {
      if (!positions) return;
      // Run behavior logic with fresh GPU positions
      this.behaviorManager?.update(positions);
    });

    // 3. Camera follow: NPC if one is selected, otherwise always follow the player
    const { isChatting, selectedNpcIndex, setSelectedPosition } = useStore.getState();
    const followIdx = this.selectedIndex ?? PLAYER_INDEX;
    const pos = this.characters.getCPUPosition(followIdx);
    this.stage.setFollowTarget(pos);

    // Update selected NPC screen position for UI bubble
    if (selectedNpcIndex !== null) {
      const npcPos = this.characters.getCPUPosition(selectedNpcIndex);
      if (npcPos) {
        const screenPos = npcPos.clone();
        screenPos.y += 1.3; // CHARACTER_Y_OFFSET + bubble offset
        screenPos.project(this.stage.camera);

        const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (screenPos.y * -0.5 + 0.5) * window.innerHeight;
        setSelectedPosition({ x, y });
      }
    } else {
      setSelectedPosition(null);
    }

    // 4. Chat camera logic
    if (isChatting) {
      // Disable controls while moving to NPC
      const playerState = this.characters.getAgentState(PLAYER_INDEX);
      if (playerState === AgentBehavior.GOTO) {
        if (this.stage.controls) this.stage.controls.enabled = false;
        // Slow zoom in
        if (this.stage.controls) {
          this.stage.controls.minDistance = THREE.MathUtils.lerp(this.stage.controls.minDistance, 4, 0.05);
          this.stage.controls.maxDistance = THREE.MathUtils.lerp(this.stage.controls.maxDistance, 6, 0.05);
        }
      } else {
        // Re-enable controls once arrived
        if (this.stage.controls) {
          this.stage.controls.enabled = true;
          // Keep it zoomed in but allow some zoom range
          this.stage.controls.minDistance = THREE.MathUtils.lerp(this.stage.controls.minDistance, 3, 0.05);
          this.stage.controls.maxDistance = THREE.MathUtils.lerp(this.stage.controls.maxDistance, 10, 0.05);
        }
      }
    } else {
      // Reset camera constraints when not chatting
      if (this.stage.controls) {
        this.stage.controls.enabled = true;
        this.stage.controls.minDistance = THREE.MathUtils.lerp(this.stage.controls.minDistance, 3, 0.05);
        this.stage.controls.maxDistance = THREE.MathUtils.lerp(this.stage.controls.maxDistance, 50, 0.05);
      }
    }

    this.engine.render(this.stage.scene, this.stage.camera);
  }

  private async handleNpcGreeting(npcIndex: number) {
    const agent = AGENTS[npcIndex];
    useStore.setState({ isThinking: true });

    try {
      const systemInstruction = `You are ${agent.role} at FakeClaw Inc.
Department: ${agent.department}
Mission: ${agent.mission}
Personality: ${agent.personality}
Expertise: ${agent.expertise.join(', ')}

Keep your responses extremely brief (1-2 short sentences max) and professional. Introduce yourself very briefly and ask how you can help.`;

      const responseText = await geminiService.chat(
        systemInstruction,
        [],
        "Hello! Please introduce yourself briefly."
      );

      const modelMessage: ChatMessage = {
        role: 'model',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      useStore.setState((s) => ({
        chatMessages: [modelMessage],
        isThinking: false
      }));
    } catch (error) {
      console.error("Auto-presentation error:", error);
      useStore.setState({ isThinking: false });
    }
  }

  public dispose() {
    this.isDisposed = true;
    this.unsubs.forEach(unsub => unsub());
    window.removeEventListener('resize', this.onResize);
    this.inputManager?.dispose();
    this.engine.dispose();
    if (this.stage.controls) this.stage.controls.dispose();
  }
}
