
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CharacterState, AnimationName, PerformanceStats, BoidsParams } from '../types';

export const useStore = create<CharacterState>()(
  persist(
    (set) => ({
      currentAction: AnimationName.WALK,
      isThinking: false,
      aiResponse: "Hello! I'm your AI character. Type something to talk to me.",
      isDebugOpen: false, // Will be overwritten by persist if exists
      instanceCount: 100, // Will be overwritten by persist if exists
      worldSize: 20,      // Default radius

      // Default Boids Parameters
      boidsParams: {
        speed: 0.015,
        separationRadius: 0.6,
        separationStrength: 0.030,
        alignmentRadius: 3.0,
        cohesionRadius: 3.0
      },

      debugPositions: null,

      performance: {
        fps: 0,
        drawCalls: 0,
        triangles: 0,
        geometries: 0,
        textures: 0,
        entities: 0
      },

      setAnimation: (name: string) => set({ currentAction: name }),
      setThinking: (isThinking: boolean) => set({ isThinking }),
      setAIResponse: (aiResponse: string) => set({ aiResponse }),
      toggleDebug: () => set((state) => ({ isDebugOpen: !state.isDebugOpen })),
      setInstanceCount: (count: number) => set({ instanceCount: count }),
      setWorldSize: (size: number) => set({ worldSize: size }),

      setBoidsParams: (params) => set((state) => ({
        boidsParams: { ...state.boidsParams, ...params }
      })),

      setDebugPositions: (positions) => set({ debugPositions: positions }),

      updatePerformance: (performance: PerformanceStats) => set({ performance }),
    }),
    {
      name: 'gemini-world-storage', // unique name for localStorage
      storage: createJSONStorage(() => localStorage),
      // Only persist configuration data, not runtime/transient data
      partialize: (state) => ({
        boidsParams: state.boidsParams,
        instanceCount: state.instanceCount,
        isDebugOpen: state.isDebugOpen,
        worldSize: state.worldSize
      }),
    }
  )
);
