import React from 'react';
import { useAgencyStore } from '../store/agencyStore';
import { AGENTS } from '../data/agents';

interface AgentViewProps {
  agentIndex: number;
}

const AgentView: React.FC<AgentViewProps> = ({ agentIndex }) => {
  const { tasks } = useAgencyStore();

  const agent = AGENTS[agentIndex];
  if (!agent) return null;

  const activeTask = tasks.find(
    (t) => t.assignedAgentIds.includes(agentIndex) && t.status === 'in_progress'
  ) ?? null;

  const onHoldTask = tasks.find(
    (t) => t.assignedAgentIds.includes(agentIndex) && t.status === 'on_hold'
  ) ?? null;

  return (
    <div className="flex flex-col h-full p-6">
      {/* Expertise / Traits */}
      <div className="mb-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Expertise</p>
        <p className="text-xs text-zinc-600 leading-relaxed italic">{agent.mission}</p>
        <div className="flex flex-wrap gap-1 mt-3">
          {agent.expertise.map(exp => (
            <span key={exp} className="px-2 py-0.5 bg-zinc-100 text-zinc-500 text-[9px] font-bold rounded-full uppercase">
              {exp}
            </span>
          ))}
        </div>
      </div>

      <div className="h-px bg-zinc-100 w-full mb-6" />

      {/* Task Status */}
      {activeTask ? (
        <div className="mb-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: agent.color }}></span>
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: agent.color }}></span>
            </span>
            Doing Now
          </p>
          <p className="text-sm text-zinc-800 leading-snug font-bold">
            "{activeTask.description}"
          </p>
        </div>
      ) : onHoldTask ? (
        <div className="mb-6">
          <div className="text-[10px] font-black uppercase tracking-widest text-[#7EACEA] mb-2 flex items-center gap-2">
             <div className="flex -space-x-1.5">
                <div className="w-4 h-4 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: agent.color }} />
                <div className="w-4 h-4 rounded-full border-2 border-white shadow-sm bg-[#7EACEA]" />
             </div>
            Needs Discussion
          </div>
          <p className="text-sm text-zinc-800 leading-snug font-bold">
            "{onHoldTask.description}"
          </p>
          <p className="text-[10px] text-zinc-400 mt-2 italic font-medium">
            Waiting for your input to proceed.
          </p>
        </div>
      ) : (
        <div className="mb-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400/50 mb-2">
            Status
          </p>
          <p className="text-sm text-zinc-300 leading-snug italic font-medium">
            Waiting for next task...
          </p>
        </div>
      )}
    </div>
  );
};

export default AgentView;
