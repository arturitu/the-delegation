
import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { useSceneManager } from '../three/SceneContext';
import HelpModal from './HelpModal';
import { AGENTS } from '../data/agents';
import { HelpCircle } from 'lucide-react';
import { useAgencyStore } from '../store/agencyStore';

const UIOverlay: React.FC = () => {
  const {
    isThinking,
    selectedNpcIndex,
    selectedPosition,
    hoveredNpcIndex,
    hoveredPoiLabel,
    hoverPosition,
    isChatting
  } = useStore();
  const scene = useSceneManager();
  const [isHelpOpen, setHelpOpen] = useState(false);
  const {
    tasks,
    actionLog,
    isKanbanOpen,
    isLogOpen,
    setKanbanOpen,
    setLogOpen,
    pendingApprovalTaskId,
  } = useAgencyStore();

  const activeTasks = tasks.filter((t) => t.status !== 'done');
  const selectedAgentActiveTask =
    selectedNpcIndex != null
      ? tasks.find(
          (t) =>
            t.assignedAgentIds.includes(selectedNpcIndex) &&
            t.status === 'in_progress'
        ) ?? null
      : null;

  const selectedAgent = selectedNpcIndex != null ? AGENTS[selectedNpcIndex] ?? null : null;
  const hoveredAgent = hoveredNpcIndex != null ? AGENTS[hoveredNpcIndex] ?? null : null;

  const handleStartChat = () => {
    if (selectedNpcIndex !== null) {
      scene?.startChat(selectedNpcIndex);
    }
  };

  const handleEndChat = () => {
    scene?.endChat();
  };


  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8 z-10">
      {/* Selected Bubble (Always visible when selected) */}
      {selectedAgent && selectedPosition && (
        <div
          className="absolute z-10 pointer-events-none transition-all duration-75 ease-out"
          style={{
            left: selectedPosition.x,
            top: selectedPosition.y,
            transform: 'translate(-50%, -100%) translateY(-10px)'
          }}
        >
          <div className="bg-zinc-800/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-xl flex items-center gap-2 whitespace-nowrap animate-in fade-in zoom-in-95 duration-200">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: selectedAgent.color }}
            />
            <div className="flex items-center gap-1.5">
              {selectedAgent.isPlayer ? (
                <span className="text-[10px] font-black uppercase tracking-widest text-white">{selectedAgent.role} (You)</span>
              ) : (
                <>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white">
                    {selectedAgent.role}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-white/40">·</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                    {selectedAgent.department}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hover Bubble */}
      {hoveredAgent && hoverPosition && hoveredNpcIndex !== selectedNpcIndex && (
        <div
          className="absolute z-10 pointer-events-none transition-all duration-75 ease-out"
          style={{
            left: hoverPosition.x,
            top: hoverPosition.y,
            transform: 'translate(-50%, -100%) translateY(-10px)'
          }}
        >
          <div className="bg-zinc-800/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-xl flex items-center gap-2 whitespace-nowrap animate-in fade-in zoom-in-95 duration-200">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: hoveredAgent.color }}
            />
            <div className="flex items-center gap-1.5">
              {hoveredAgent.isPlayer ? (
                <span className="text-[10px] font-black uppercase tracking-widest text-white">{hoveredAgent.role} (You)</span>
              ) : (
                <>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white">
                    {hoveredAgent.role}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-white/40">·</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                    {hoveredAgent.department}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* POI Hover Bubble */}
      {hoveredPoiLabel && hoverPosition && (
        <div
          className="absolute z-10 pointer-events-none transition-all duration-75 ease-out"
          style={{
            left: hoverPosition.x,
            top: hoverPosition.y,
            transform: 'translate(-50%, -100%) translateY(-10px)'
          }}
        >
          <div className="bg-zinc-800/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-xl flex items-center gap-2 whitespace-nowrap animate-in fade-in zoom-in-95 duration-200">
            <span className="text-[10px] font-black uppercase tracking-widest text-white">{hoveredPoiLabel}</span>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex justify-between items-start relative z-30">
        <div className="bg-white/20 p-4 rounded-2xl max-w-96 pointer-events-auto flex gap-4">
          <div className="w-2 h-8 bg-[#7EACEA] rounded-full shrink-0 mt-1" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-black text-zinc-900 tracking-tight">The Embodied Agency</h1>
              <button
                onClick={() => setHelpOpen(true)}
                className="text-zinc-300 hover:text-zinc-500 transition-colors cursor-pointer"
              >
                <HelpCircle size={22} strokeWidth={2} />
              </button>
            </div>
            <p className="text-[13px] text-zinc-400 font-medium leading-snug">
              A 3D gateway to the professional & social life of specialized AI agents.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Bar: Log, Tasks (Left) and NPC Panel (Right) */}
      <div className="flex justify-between items-end relative z-30 pointer-events-none mt-auto">
        {/* Actions (Log & Tasks) */}
        <div className="flex gap-2 pointer-events-auto">
          <button
            onClick={() => setLogOpen(!isLogOpen)}
            className={`flex items-center gap-2 px-3 py-2 backdrop-blur-sm border border-black/10 rounded-xl shadow text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
              isLogOpen
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'bg-white/90 text-zinc-600 hover:bg-white hover:text-zinc-900'
            }`}
          >
            Log
            {actionLog.length > 0 && (
              <span className={`${isLogOpen ? 'bg-white text-zinc-900' : 'bg-zinc-900 text-white'} text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center`}>
                {actionLog.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setKanbanOpen(!isKanbanOpen)}
            className={`flex items-center gap-2 px-3 py-2 backdrop-blur-sm border border-black/10 rounded-xl shadow text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
              isKanbanOpen
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'bg-white/90 text-zinc-600 hover:bg-white hover:text-zinc-900'
            }`}
          >
            Tasks
            {activeTasks.length > 0 && (
              <span className={`${isKanbanOpen ? 'bg-white text-zinc-900' : 'bg-zinc-900 text-white'} text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center`}>
                {activeTasks.length}
              </span>
            )}
          </button>
        </div>

        {/* NPC Info Panel — shown when an NPC is selected */}
        {selectedAgent && (
          <div className="w-72 bg-white/95 backdrop-blur-2xl rounded-2xl border border-black/10 shadow-2xl p-6 pointer-events-auto animate-in fade-in slide-in-from-right-4 duration-300 overflow-hidden relative">
            {/* Color accent bar */}
            <div
              className="absolute top-0 left-0 w-full h-1.5"
              style={{ backgroundColor: selectedAgent.color }}
            />

            <div className="mb-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">
                {selectedAgent.department}
              </p>
              <h2 className="text-xl font-black text-zinc-900 leading-tight">{selectedAgent.role}</h2>
            </div>

            <div className="h-px bg-zinc-100 w-full mb-4" />

            {/* Active task highlight */}
            {selectedAgentActiveTask ? (
              <div className="mb-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: selectedAgent.color }}></span>
                    <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: selectedAgent.color }}></span>
                  </span>
                  Doing Now
                </p>
                <p className="text-sm text-zinc-800 leading-snug font-bold">
                  "{selectedAgentActiveTask.description}"
                </p>
              </div>
            ) : (
              <div className="mb-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                  Status
                </p>
                <p className="text-sm text-zinc-400 leading-snug italic font-medium">
                  Waiting for next task...
                </p>
              </div>
            )}

            <div className="h-px bg-zinc-100 w-full mb-6" />

            <div className="flex flex-col gap-2.5">
              {isChatting ? (
                <button
                  onClick={handleEndChat}
                  style={{ backgroundColor: selectedAgent.color }}
                  className="w-full py-3 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-90 active:scale-[0.98] transition-all shadow-lg pointer-events-auto cursor-pointer"
                >
                  End Chat
                </button>
              ) : (
                <button
                  onClick={handleStartChat}
                  className="w-full py-3 bg-zinc-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black active:scale-[0.98] transition-all shadow-lg shadow-zinc-200 pointer-events-auto cursor-pointer"
                >
                  Start Chat
                </button>
              )}
              {!selectedAgent.isPlayer && (
                <button
                  onClick={() => setLogOpen(true, selectedNpcIndex ?? undefined)}
                  className="w-full py-3 bg-zinc-100 text-zinc-600 border border-zinc-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white hover:text-zinc-900 active:scale-[0.98] transition-all pointer-events-auto cursor-pointer"
                >
                  Action Log
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Help Modal */}
    </div>
  );
};

export default UIOverlay;
