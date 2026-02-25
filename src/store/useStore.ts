
import { create } from 'zustand';
import { CharacterState, AnimationName, ActiveEncounter } from '../types';

export const useStore = create<CharacterState>()(
  (set) => ({
    isThinking: false,
    aiResponse: "Hello! I'm your AI character. Type something to talk to me.",
    instanceCount: 10,
    worldSize: 10,      // radius of Kaldera

    activeEncounter: null,
    selectedNpcIndex: null,
    selectedPosition: null,
    hoveredNpcIndex: null,
    hoverPosition: null,
    isChatting: false,
    isTyping: false,
    chatMessages: [],

    lastSpeakingTrigger: null,

    setSpeaking: (index: number, isSpeaking: boolean) => set({
      lastSpeakingTrigger: { index, isSpeaking, timestamp: Date.now() }
    }),
    setThinking: (isThinking: boolean) => set({ isThinking }),
    setIsTyping: (isTyping: boolean) => set({ isTyping }),
    setAIResponse: (aiResponse: string) => set({ aiResponse }),
    setInstanceCount: (count: number) => set({ instanceCount: count }),
    setWorldSize: (size: number) => set({ worldSize: size }),

    setActiveEncounter: (encounter: ActiveEncounter | null) => set({ activeEncounter: encounter }),
    setSelectedNpc: (index: number | null) => set({ selectedNpcIndex: index, selectedPosition: null }),
    setSelectedPosition: (pos: { x: number; y: number } | null) => set({ selectedPosition: pos }),
    setHoveredNpc: (index: number | null, pos: { x: number; y: number } | null) => set({ hoveredNpcIndex: index, hoverPosition: pos }),
    startChat: () => {},
    endChat: () => {},
    sendMessage: async () => {},
  })
);
