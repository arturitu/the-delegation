
import { create } from 'zustand';
import { CharacterState } from '../types';
import { AGENTS } from '../data/agents';

export const useStore = create<CharacterState>()(
  (set) => ({
    isThinking: false,
    instanceCount: AGENTS.length,

    selectedNpcIndex: null,
    selectedPosition: null,
    hoveredNpcIndex: null,
    hoveredPoiId: null,
    hoveredPoiLabel: null,
    hoverPosition: null,
    isChatting: false,
    isTyping: false,
    chatMessages: [],
    inspectorTab: 'info',

    llmConfig: (() => {
      try {
        const saved = localStorage.getItem('byok-config');
        if (saved) return JSON.parse(saved);
      } catch {}
      return {
        provider: 'gemini',
        apiKey: '',
        model: 'gemini-3-flash-preview'
      };
    })(),

    setThinking: (isThinking: boolean) => set({ isThinking }),
    setIsTyping: (isTyping: boolean) => set({ isTyping }),
    setInspectorTab: (tab: 'info' | 'chat') => set({ inspectorTab: tab }),
    setInstanceCount: (count: number) => set({ instanceCount: count }),

    setSelectedNpc: (index: number | null) => set({
      selectedNpcIndex: index,
      selectedPosition: null,
      inspectorTab: index !== null ? 'info' : 'info' // Default to info when switching
    }),
    setSelectedPosition: (pos: { x: number; y: number } | null) => set({ selectedPosition: pos }),
    setHoveredNpc: (index: number | null, pos: { x: number; y: number } | null) => set({
      hoveredNpcIndex: index,
      hoverPosition: pos,
      hoveredPoiId: null,
      hoveredPoiLabel: null,
    }),
    setHoveredPoi: (id: string | null, label: string | null, pos: { x: number; y: number } | null) => set({
      hoveredPoiId: id,
      hoveredPoiLabel: label,
      hoverPosition: pos,
      hoveredNpcIndex: null,
    }),
    setLlmConfig: (config) => set((s) => ({ llmConfig: { ...s.llmConfig, ...config } })),
  })
);
