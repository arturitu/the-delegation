
import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { useSceneManager } from '../three/SceneContext';
import HelpModal from './HelpModal';
import ChatPanel from './ChatPanel';
import { AGENTS } from '../data/agents';
import { HelpCircle } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useAgencyStore } from '../store/agencyStore';
import { KanbanModal } from './KanbanModal';
import { ActionLogModal } from './ActionLogModal';
import { FinalOutputModal } from './FinalOutputModal';

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
    <div className="fixed inset-0 pointer-events-none flex flex-col justify-between p-8">
      <AnimatePresence>
        <ChatPanel />
      </AnimatePresence>
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
        <div className="bg-white p-4 rounded-2xl border border-black/5 shadow-xl max-w-96 pointer-events-auto flex gap-4">
          <div className="w-2 h-8 bg-[#7EACEA] rounded-full shrink-0 mt-1" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-black text-zinc-900 tracking-tight">The Embodied Agency</h1>
              <button
                onClick={() => setHelpOpen(true)}
                className="text-zinc-300 hover:text-zinc-500 transition-colors"
              >
                <HelpCircle size={22} strokeWidth={2} />
              </button>
            </div>
            <p className="text-[13px] text-zinc-400 font-medium leading-snug">
              A 3D gateway to the professional & social life of specialized AI agents.
            </p>
          </div>
        </div>
        {/* Header action buttons */}
        <div className="flex gap-2 pointer-events-auto">
          <button
            onClick={() => setKanbanOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm border border-black/10 rounded-xl shadow text-xs font-black uppercase tracking-widest text-zinc-600 hover:bg-white hover:text-zinc-900 transition-all"
          >
            Tasks
            {activeTasks.length > 0 && (
              <span className="bg-zinc-900 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                {activeTasks.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setLogOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm border border-black/10 rounded-xl shadow text-xs font-black uppercase tracking-widest text-zinc-600 hover:bg-white hover:text-zinc-900 transition-all"
          >
            Log
            {actionLog.length > 0 && (
              <span className="bg-zinc-900 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                {actionLog.length}
              </span>
            )}
          </button>
        </div>      </div>

      {/* Help Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setHelpOpen(false)} />

      {/* Agency Modals */}
      <KanbanModal />
      <ActionLogModal />
      <FinalOutputModal />

      {/* NPC Info Panel — shown when an NPC is selected */}
      {selectedAgent && (
        <div className="absolute bottom-8 left-8 w-72 bg-white/85 backdrop-blur-2xl rounded-2xl border border-black/5 shadow-2xl p-5 pointer-events-auto animate-in fade-in slide-in-from-left-4 duration-300 z-30 overflow-hidden">
          {/* Color accent bar */}
          <div
            className="absolute top-0 left-0 w-full h-1"
            style={{ backgroundColor: selectedAgent.color }}
          />
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">
                {selectedAgent.department}
              </p>
              <h2 className="text-xl font-black text-zinc-900 leading-tight">{selectedAgent.role}</h2>
            </div>
          </div>

          <p className="text-xs text-zinc-600 leading-relaxed mb-3 italic">
            "{selectedAgent.mission}"
          </p>

          <div className="flex flex-wrap gap-1 mb-3">
            {selectedAgent.expertise.map((tag) => (
              <span key={tag} className="text-[10px] font-bold bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>

          <p className="text-[11px] text-zinc-400 leading-snug mb-4">{selectedAgent.personality}</p>

          {/* Active task highlight */}
          {selectedAgentActiveTask && (
            <div
              className="rounded-xl p-3 mb-4"
              style={{
                backgroundColor: selectedAgent.color + '15',
                border: `1px solid ${selectedAgent.color}30`,
              }}
            >
              <p
                className="text-[9px] font-black uppercase tracking-widest mb-1"
                style={{ color: selectedAgent.color }}
              >
                Now working on
              </p>
              <p className="text-xs text-zinc-700 leading-snug font-medium">
                {selectedAgentActiveTask.description}
              </p>
              <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-wide mt-1">
                In Progress
              </p>
            </div>
          )}

          {/* Approval pending highlight */}
          {pendingApprovalTaskId &&
            tasks.find(
              (t) =>
                t.id === pendingApprovalTaskId &&
                t.assignedAgentIds.includes(selectedNpcIndex!)
            ) && (
            <div className="rounded-xl p-3 mb-4 bg-amber-50 border border-amber-200">
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-1">
                Waiting for your approval
              </p>
              <p className="text-xs text-amber-700 leading-snug">
                {tasks.find((t) => t.id === pendingApprovalTaskId)?.description}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {isChatting ? (
              <button
                onClick={handleEndChat}
                style={{ backgroundColor: selectedAgent.color }}
                className="w-full py-3 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-90 active:scale-[0.98] transition-all shadow-lg pointer-events-auto"
              >
                End Chat
              </button>
            ) : (
              <button
                onClick={handleStartChat}
                className="w-full py-3 bg-zinc-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black active:scale-[0.98] transition-all shadow-lg shadow-zinc-200 pointer-events-auto"
              >
                Start Chat
              </button>
            )}
            {!selectedAgent.isPlayer && (
              <button
                onClick={() => setLogOpen(true, selectedNpcIndex ?? undefined)}
                className="w-full py-2.5 bg-zinc-100 text-zinc-500 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-zinc-200 hover:text-zinc-700 active:scale-[0.98] transition-all pointer-events-auto"
              >
                Action Log
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UIOverlay;
