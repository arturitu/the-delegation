
import { create } from 'zustand';
import { UIState } from '../types';
import { AGENTS } from '../data/agents';

export const useStore = create<UIState>()(
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
    isResizing: false,

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
    setIsResizing: (isResizing: boolean) => set({ isResizing }),
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
    setLlmConfig: (config) => set((s) => {
      const merged = { ...s.llmConfig, ...config };
      try { localStorage.setItem('byok-config', JSON.stringify(merged)); } catch {}
      return { llmConfig: merged };
    }),
  })
);
