import React, { useState } from 'react';
import { useAgencyStore } from '../store/agencyStore';
import { ScrollText, RefreshCcw, FolderOpen } from 'lucide-react';
import ResetModal from './ResetModal';
import { useSceneManager } from '../three/SceneContext';
import { abortAllCalls } from '../services/agencyService';

const ProjectView: React.FC = () => {
  const {
    clientBrief,
    phase,
    actionLog,
    resetProject,
    setFinalOutputOpen
  } = useAgencyStore();
  const scene = useSceneManager();
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const hasLogs = actionLog.length > 0;

  const handleReset = () => {
    // 1. Cancel all in-flight LLM calls so no stale response lands on the clean store.
    abortAllCalls();
    // 2. Reset the scene: cancels movements, ends chat, and clears useStore UI state.
    scene?.resetScene();
    // 3. Wipe the agency store; phase goes back to 'idle'.
    resetProject();
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 bg-white/50">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">Project Overview</p>
          <h2 className="text-xl font-black text-zinc-900 leading-tight">The Agency Mission</h2>
        </div>
      </div>

      <div className="h-px bg-zinc-100 w-full mb-6" />

      {/* Reset Project Button - More Subtle */}
      {hasLogs && (
        <div className="mb-8 flex justify-end">
          <button
            onClick={() => setIsResetModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100/50 hover:bg-zinc-100 text-zinc-400 hover:text-red-500 rounded-lg transition-all active:scale-95 group border border-transparent hover:border-red-100"
          >
            <RefreshCcw size={12} className="transition-transform group-hover:rotate-180 duration-500" />
            <span className="text-[10px] font-black uppercase tracking-widest">Reset Project</span>
          </button>
        </div>
      )}

      {/* Brief */}
      <div className="mb-8">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 flex items-center gap-2">
          <ScrollText size={10} />
          Client Brief
        </p>
        <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-4">
          <p className="text-xs text-zinc-600 leading-relaxed font-medium italic">
            {clientBrief || "No active brief. Talk to the Account Manager to define your project."}
          </p>
        </div>
      </div>

      <div className="mb-8">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Stage</p>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
              phase === 'working' ? 'bg-blue-500 text-white' :
              phase === 'done' ? 'bg-green-500 text-white' :
              phase === 'briefing' ? 'bg-amber-500 text-white' :
              'bg-zinc-100 text-zinc-400'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${['working', 'briefing'].includes(phase) ? 'bg-white animate-pulse' : 'bg-white opacity-40'}`} />
              {phase}
            </div>
          </div>
        </div>
      </div>

      <ResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={handleReset}
      />
    </div>
  );
};

export default ProjectView;
