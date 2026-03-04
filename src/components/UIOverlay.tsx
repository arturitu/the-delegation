
import React from 'react';
import { useStore } from '../store/useStore';
import { AGENTS, AM_INDEX } from '../data/agents';
import { useAgencyStore, Task } from '../store/agencyStore';

type PhaseLabel = { text: string; className: string };

function getAgentPhaseLabel(
  agentIndex: number,
  tasks: Task[],
  phase: string,
  fallback: string,
): PhaseLabel {
  if (agentIndex === AM_INDEX && phase === 'done') {
    return { text: 'Project Ready!', className: 'text-yellow-400' };
  }
  const activeTask = tasks.find(
    t => t.assignedAgentIds.includes(agentIndex) && t.status === 'in_progress',
  );
  if (activeTask) {
    return { text: 'Working', className: 'text-emerald-400' };
  }
  return { text: fallback, className: 'text-white/70' };
}

const UIOverlay: React.FC = () => {
  const {
    selectedNpcIndex,
    selectedPosition,
    hoveredNpcIndex,
    hoveredPoiLabel,
    hoverPosition
  } = useStore();
  const {
    tasks,
    phase,
  } = useAgencyStore();

  const selectedAgent = selectedNpcIndex != null ? AGENTS.find(a => a.index === selectedNpcIndex) ?? null : null;
  const hoveredAgent = hoveredNpcIndex != null ? AGENTS.find(a => a.index === hoveredNpcIndex) ?? null : null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      {/* Selection/Hover/Project Ready Bubble */}
      {(() => {
        // Priority 1: Selected Agent
        if (selectedAgent && selectedPosition) {
          const label = getAgentPhaseLabel(selectedAgent.index, tasks, phase, selectedAgent.department);
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
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${label.className}`}>
                        {label.text}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        }

        // Priority 2: Hovered Agent with dynamic phase label (only if not selected)
        if (hoveredAgent && hoverPosition && hoveredNpcIndex !== selectedNpcIndex) {
          const label = getAgentPhaseLabel(hoveredAgent.index, tasks, phase, hoveredAgent.department);
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
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${label.className}`}>
                        {label.text}
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

    </div>
  );
};

export default UIOverlay;
