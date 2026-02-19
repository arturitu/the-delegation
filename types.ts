
export interface PerformanceStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  entities: number;
}

export interface BoidsParams {
  speed: number;
  separationRadius: number;
  separationStrength: number;
  alignmentRadius: number;
  cohesionRadius: number;
}

export interface CharacterState {
  currentAction: string;
  isThinking: boolean;
  aiResponse: string;
  isDebugOpen: boolean;
  instanceCount: number;
  worldSize: number; // New: Radius of the world
  boidsParams: BoidsParams;
  debugPositions: Float32Array | null;

  performance: PerformanceStats;

  setAnimation: (name: string) => void;
  setThinking: (isThinking: boolean) => void;
  setAIResponse: (response: string) => void;
  toggleDebug: () => void;
  setInstanceCount: (count: number) => void;
  setWorldSize: (size: number) => void; // New
  setBoidsParams: (params: Partial<BoidsParams>) => void;
  setDebugPositions: (positions: Float32Array) => void;
  updatePerformance: (stats: PerformanceStats) => void;
}

export enum AnimationName {
  IDLE = 'Idle',
  WALK = 'Walk'
}
