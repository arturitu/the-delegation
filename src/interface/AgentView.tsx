import React from 'react';
import { useAgencyStore } from '../integration/store/agencyStore';
import { getAgentSet } from '../data/agents';

interface AgentViewProps {
  agentIndex: number;
}

const AgentView: React.FC<AgentViewProps> = ({ agentIndex }) => {
  const { tasks, selectedAgentSetId } = useAgencyStore();
  const agents = getAgentSet(selectedAgentSetId).agents;

  const agent = agents.find(a => a.index === agentIndex);
  if (!agent) return null;

  const activeTask = tasks.find(
    (t) => t.assignedAgentIds.includes(agentIndex) && t.status === 'in_progress'
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
