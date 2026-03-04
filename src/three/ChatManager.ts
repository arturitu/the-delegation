import * as THREE from 'three/webgpu';
import { CharacterController } from './CharacterController';
import { DriverManager } from './drivers/DriverManager';
import { PoiManager } from './world/PoiManager';
import { AGENTS, PLAYER_INDEX } from '../data/agents';
import { useStore } from '../store/useStore';
import { ChatMessage } from '../types';

/**
 * Manages player↔NPC chat sessions: starting/ending chats,
 * sending messages, agency handler integration, and greeting triggers.
 */
export class ChatManager {
  private controller: CharacterController;
  private driverManager: DriverManager;
  private poiManager: PoiManager;

  /** Optional handler that intercepts player→NPC messages for the agency system. */
  private agencyHandler: ((npcIndex: number, text: string) => Promise<string | null>) | null = null;

  constructor(
    controller: CharacterController,
    driverManager: DriverManager,
    poiManager: PoiManager,
  ) {
    this.controller = controller;
    this.driverManager = driverManager;
    this.poiManager = poiManager;
  }

  /**
   * Register a handler that intercepts player→NPC messages for the agency system.
   * Return the response string to override default chat, or null to fall through.
   */
  public setAgencyHandler(
    handler: ((npcIndex: number, text: string) => Promise<string | null>) | null,
  ): void {
    this.agencyHandler = handler;
  }

  public startChat(npcIndex: number): void {
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

    // Stop NPC, face player
    this.controller.cancelMovement(npcIndex);
    this.controller.play(npcIndex, 'listen');
    this.controller.getAgentStateBuffer()?.setWaypoint(npcIndex, dir.x, dir.z);

    // Walk player to the NPC
    const playerDriver = this.driverManager.getPlayerDriver();
    playerDriver?.walkTo(target, 'listen', () => {
      const p = this.controller.getCPUPositions()!;
      const fx = p[npcIndex * 4] - p[PLAYER_INDEX * 4];
      const fz = p[npcIndex * 4 + 2] - p[PLAYER_INDEX * 4 + 2];
      this.controller.getAgentStateBuffer()?.setWaypoint(PLAYER_INDEX, fx, fz);
      this.controller.getAgentStateBuffer()?.setWaypoint(npcIndex, -fx, -fz);

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
    if (selectedNpcIndex !== null) {
      this.controller.setSpeaking(selectedNpcIndex, false);
      this.controller.play(selectedNpcIndex, 'idle');
      this.poiManager.releaseAll(selectedNpcIndex);
    }
    this.controller.setSpeaking(PLAYER_INDEX, false);
    this.controller.play(PLAYER_INDEX, 'idle');
  }

  public async sendMessage(text: string): Promise<void> {
    const state = useStore.getState();
    if (state.selectedNpcIndex === null || state.isThinking) return;

    const npcIndex = state.selectedNpcIndex;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = { role: 'user', text, timestamp };

    useStore.setState((s) => ({
      chatMessages: [...s.chatMessages, userMsg],
      isThinking: true,
      isTyping: false,
    }));

    try {
      let responseText: string | null = null;
      if (this.agencyHandler) {
        responseText = await this.agencyHandler(npcIndex, text);
      }

      if (responseText === null) {
        responseText = "Sorry, I couldn't process your message right now. Please try again.";
      }

      const modelMsg: ChatMessage = {
        role: 'assistant',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      useStore.setState((s) => ({ chatMessages: [...s.chatMessages, modelMsg], isThinking: false }));
    } catch (err) {
      console.error('[ChatManager] sendMessage error:', err);
      useStore.setState({ isThinking: false });
    }
  }

  private async _triggerNpcGreeting(npcIndex: number): Promise<void> {
    const agent = AGENTS.find(a => a.index === npcIndex);
    if (!agent) return;
    useStore.setState({ isThinking: true });
    try {
      const text = `Hello. I am the ${agent.role}. How can I help you with our current objectives?`;
      const msg: ChatMessage = {
        role: 'assistant',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      useStore.setState({ chatMessages: [msg], isThinking: false });
    } catch (err) {
      console.error('[ChatManager] greeting error:', err);
      useStore.setState({ isThinking: false });
    }
  }
}
