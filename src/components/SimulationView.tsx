import React from 'react';
import UIOverlay from './UIOverlay';
import { Play, Pause, Maximize2, Minimize2 } from 'lucide-react';
import { useAgencyStore } from '../store/agencyStore';
import { AGENTS } from '../data/agents';

interface SimulationViewProps {
  canvasRef: React.RefObject<HTMLDivElement>;
  isFullscreen: boolean;
  setIsFullscreen: (value: boolean) => void;
}

const SimulationView: React.FC<SimulationViewProps> = ({ canvasRef, isFullscreen, setIsFullscreen }) => {
  const isPaused = useAgencyStore((s) => s.isPaused);
  const setPaused = useAgencyStore((s) => s.setPaused);
  const pauseOnCall = useAgencyStore((s) => s.pauseOnCall);
  const isPlaying = !isPaused;
  const agentCount = AGENTS.length - 1; // Exclude player agent from count

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 relative">
      {/* Simulation View Header */}
      <div className="h-10 border-b border-black/5 flex items-center justify-between px-5 bg-white shrink-0">
        <div className="flex-1 flex items-center gap-2">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Simulation View</span>
          <span className="text-[10px] font-medium text-zinc-400 bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-100">
            {agentCount} AGENTS
          </span>
        </div>

        {/* Centered Controls */}
        {pauseOnCall && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPaused(false)}
              disabled={isPlaying}
              className={`p-1 border rounded transition-all cursor-pointer ${
                isPlaying
                  ? 'bg-zinc-50 text-zinc-300 border-zinc-100'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              <Play size={14} fill="none" />
            </button>
            <button
              onClick={() => setPaused(true)}
              disabled={!isPlaying}
              className={`p-1 border rounded transition-all cursor-pointer ${
                !isPlaying
                  ? 'bg-zinc-50 text-zinc-300 border-zinc-100'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              <Pause size={14} fill="none" />
            </button>
          </div>
        )}

        <div className="flex-1 flex items-center justify-end gap-1">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Panel"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      <div ref={canvasRef} className="flex-1 min-h-0 relative overflow-hidden bg-black/5">
        <UIOverlay />
      </div>
    </div>
  );
};

export default SimulationView;
