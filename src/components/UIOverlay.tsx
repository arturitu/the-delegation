
import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { useSceneManager } from '../three/SceneContext';
import InfoModal from './InfoModal';
import { AGENTS } from '../data/agents';
import { useAgencyStore } from '../store/agencyStore';

const UIOverlay: React.FC = () => {
  const {
    selectedNpcIndex,
    selectedPosition,
    hoveredNpcIndex,
    hoveredPoiLabel,
    hoverPosition
  } = useStore();
  const scene = useSceneManager();
  const [isHelpOpen, setHelpOpen] = useState(false);
  const {
    tasks,
    isFinalOutputOpen,
    setFinalOutputOpen,
    pendingApprovalTaskId,
    phase,
  } = useAgencyStore();

  const AM_INDEX = 1; // Account Manager index

  const selectedAgent = selectedNpcIndex != null ? AGENTS[selectedNpcIndex] ?? null : null;
  const hoveredAgent = hoveredNpcIndex != null ? AGENTS[hoveredNpcIndex] ?? null : null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      {/* Selection/Hover/Project Ready Bubble */}
      {(() => {
        // Priority 1: Selected Agent
        if (selectedAgent && selectedPosition) {
          return (
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
          );
        }

        // Priority 2: Account Manager "Project Ready" (only if not selected)
        if (!isFinalOutputOpen && phase === 'done') {
          const amPos = scene?.getNpcScreenPosition(AM_INDEX);
          if (amPos) {
            return (
              <div
                className="absolute z-20 pointer-events-auto transition-all duration-75 ease-out cursor-pointer"
                style={{
                  left: amPos.x,
                  top: amPos.y,
                  transform: 'translate(-50%, -100%) translateY(-20px)'
                }}
                onClick={() => setFinalOutputOpen(true)}
              >
                <div className="bg-yellow-400 text-black px-3 py-1.5 rounded-full border border-white shadow-xl flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                  <span className="text-[10px] font-black uppercase tracking-widest">Project Ready!</span>
                  <div className="w-1.5 h-1.5 bg-black rounded-full animate-pulse" />
                </div>
              </div>
            );
          }
        }

        // Priority 3: Hovered Agent (only if not selected and no project ready bubble)
        if (hoveredAgent && hoverPosition && hoveredNpcIndex !== selectedNpcIndex) {
          return (
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
          );
        }

        return null;
      })()}

      {/* Task Approval Needed Bubble */}
      {pendingApprovalTaskId && (
        (() => {
          const task = tasks.find(t => t.id === pendingApprovalTaskId);
          const agentIndex = task?.assignedAgentIds[0];
          if (agentIndex === undefined) return null;
          // Don't show approval bubble if that agent is already selected (info is in panel)
          if (agentIndex === selectedNpcIndex) return null;
          const pos = scene?.getNpcScreenPosition(agentIndex);
          if (!pos) return null;

          return (
            <div
              className="absolute z-10 pointer-events-auto transition-all duration-75 ease-out cursor-pointer"
              style={{
                left: pos.x,
                top: pos.y,
                transform: 'translate(-50%, -100%) translateY(-20px)'
              }}
              onClick={() => {
                scene?.startChat(agentIndex);
              }}
            >
              <div className="bg-orange-500 text-white px-3 py-1.5 rounded-full border border-white shadow-xl flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                <span className="text-[10px] font-black uppercase tracking-widest text-white">Approval Needed</span>
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              </div>
            </div>
          );
        })()
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

      {/* Help Modal */}
      {isHelpOpen && <InfoModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
};

export default UIOverlay;
