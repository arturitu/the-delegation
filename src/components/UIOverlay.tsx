
import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import InfoModal from './InfoModal';
import { getAgentSet } from '../data/agents';
import { useAgencyStore, Task } from '../store/agencyStore';
import { Siren, MessageSquareWarning, PartyPopper } from 'lucide-react';

const ORCHESTRATOR_INDEX = 1;

interface AlertBubbleProps {
  icon: React.ReactNode;
  position: { x: number; y: number };
  visible: boolean;
  color?: string;
  onClick?: () => void;
}

const AlertBubble: React.FC<AlertBubbleProps> = ({ icon, position, visible, color = '#facc15', onClick }) => {
  if (!visible) return null;

  return (
    <div
      className={`absolute z-20 ${onClick ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}`}
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%) translateY(-10px)'
      }}
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
    >
      <div
        className={`bg-zinc-800/90 backdrop-blur-md p-1.5 rounded-full border border-white/10 shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform ${onClick ? 'hover:border-white/30' : ''}`}
        style={{ color }}
      >
        {icon}
      </div>
    </div>
  );
};

type PhaseLabel = { text: string; className: string };

function getAgentPhaseLabel(
  agentIndex: number,
  tasks: Task[],
  phase: string,
  fallback: string,
): PhaseLabel {
  if (agentIndex === ORCHESTRATOR_INDEX && phase === 'done') {
    return { text: 'Project Ready!', className: 'text-yellow-400' };
  }
  const holdTask = tasks.find(
    t => t.assignedAgentIds.includes(agentIndex) && t.status === 'on_hold',
  );
  if (holdTask && phase !== 'done') {
    return { text: 'Approval Needed', className: 'text-orange-400' };
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
    hoverPosition,
    npcScreenPositions,
    setSelectedNpc,
  } = useStore();
  const [isHelpOpen, setHelpOpen] = useState(false);
  const {
    tasks,
    phase,
    selectedAgentSetId,
  } = useAgencyStore();
  const agents = getAgentSet(selectedAgentSetId).agents;

  const selectedAgent = selectedNpcIndex != null ? agents.find(a => a.index === selectedNpcIndex) ?? null : null;
  const hoveredAgent = hoveredNpcIndex != null ? agents.find(a => a.index === hoveredNpcIndex) ?? null : null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden select-none">
      {/* 1. Parallel Alert Bubbles System */}
      {agents.map((agent) => {
        const pos = npcScreenPositions[agent.index];
        if (!pos) return null;

        // Condition: Alert disappears when hovered
        const isCurrentlyHovered = hoveredNpcIndex === agent.index || selectedNpcIndex === agent.index;
        if (isCurrentlyHovered) return null;

        let alertIcon: React.ReactNode = null;
        let alertColor = '#facc15'; // Default yellow

        // Check specific conditions
        // - Orchestrator (index 1) idle: siren
        if (agent.index === ORCHESTRATOR_INDEX && phase === 'idle') {
          alertIcon = <Siren size={18} />;
          alertColor = '#ffffff'; // White for siren
        }
        // - Orchestrator (index 1) project finished: party-popper
        else if (agent.index === ORCHESTRATOR_INDEX && phase === 'done') {
          alertIcon = <PartyPopper size={18} />;
          alertColor = '#facc15'; // Yellow
        }
        // - Any agent waiting for approval: message-square-warning
        else {
          const hasTaskOnHold = tasks.some(
            t => t.assignedAgentIds.includes(agent.index) && t.status === 'on_hold'
          );
          if (hasTaskOnHold) {
            alertIcon = <MessageSquareWarning size={18} />;
            alertColor = '#fb923c'; // Orange-400
          }
        }

        if (!alertIcon) return null;

        return (
          <AlertBubble
            key={`alert-${agent.index}`}
            icon={alertIcon}
            position={pos}
            visible={true}
            color={alertColor}
            onClick={() => setSelectedNpc(agent.index)}
          />
        );
      })}

      {/* 2. Selection/Hover/Project Ready Bubble (Detailed) */}
      {(() => {
        // Priority 1: Selected Agent
        if (selectedAgent && selectedPosition) {
          const isOrchestratorProjectReady = selectedAgent.index === ORCHESTRATOR_INDEX && phase === 'done';
          const label = getAgentPhaseLabel(selectedAgent.index, tasks, phase, selectedAgent.department);

          return (
            <div
              className="absolute z-[25] pointer-events-none transition-all duration-75 ease-out"
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
                  ) : isOrchestratorProjectReady ? (
                    <span className={`text-[10px] font-black uppercase tracking-widest ${label.className}`}>
                      {label.text}
                    </span>
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
          const isOrchestratorProjectReady = hoveredAgent.index === ORCHESTRATOR_INDEX && phase === 'done';
          const label = getAgentPhaseLabel(hoveredAgent.index, tasks, phase, hoveredAgent.department);

          return (
            <div
              className="absolute z-[25] pointer-events-none transition-all duration-75 ease-out"
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
                  ) : isOrchestratorProjectReady ? (
                    <span className={`text-[10px] font-black uppercase tracking-widest ${label.className}`}>
                      {label.text}
                    </span>
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

      {/* Help Modal */}
      {isHelpOpen && <InfoModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
};

export default UIOverlay;
