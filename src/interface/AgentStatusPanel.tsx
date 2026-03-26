import React from 'react';
import { Cpu, HelpCircle, Globe, Check } from 'lucide-react';
import { getAgentSet, getAllAgents, getAllCharacters } from '../data/agents';
import { useCoreStore } from '../integration/store/coreStore';
import { useTeamStore } from '../integration/store/teamStore';
import { Avatar } from './components/Avatar';
import { InfoModal } from './components/InfoModal';

import { formatTokens } from './ProjectView';

interface AgentStatusPanelProps {
  agentIndex: number;
}

const AgentStatusPanel: React.FC<AgentStatusPanelProps> = ({ agentIndex }) => {
  const { tasks } = useCoreStore();
  const { selectedAgentSetId, customSystems } = useTeamStore();
  const system = getAgentSet(selectedAgentSetId, customSystems);
  const agents = getAllAgents(system);

  const agent = agents.find(a => a.index === agentIndex);
  if (!agent) return null;

  const activeTask = tasks.find(
    (t) => t.assignedAgentIds.includes(agentIndex) && t.status === 'in_progress'
  ) ?? null;

  const [infoType, setInfoType] = React.useState<'patterns' | 'extra' | null>(null);

  const usage = useCoreStore.getState().agentTokenUsage[agentIndex] || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  return (
    <div className="flex flex-col h-full p-6">
      {/* Agent Info */}
      <div className="mb-8 space-y-6">
        {/* Description */}
        {agent.description && agent.index !== 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Description</p>
              <div className="h-px flex-1 bg-zinc-100" />
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed font-medium">{agent.description}</p>
          </div>
        )}

        {/* Instruction */}
        {agent.index !== 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Instruction</p>
              <div className="h-px flex-1 bg-zinc-100" />
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed italic font-medium">{agent.instruction}</p>
          </div>
        )}
        {/* Model */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">LLM Model</p>
            <div className="h-px flex-1 bg-zinc-100" />
          </div>
          <div className="inline-flex items-center px-3 py-1.5 bg-zinc-50 rounded-xl border border-zinc-200/60 font-mono max-w-full shadow-sm">
            <p className="text-[10px] font-black text-zinc-800 uppercase tracking-tighter truncate whitespace-nowrap">
              {agent.model}
            </p>
          </div>
        </div>

        {/* Token Usage */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Token Usage</p>
            <div className="h-px flex-1 bg-zinc-100" />
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold font-mono">
            <span className="text-zinc-700">{formatTokens(usage.promptTokens)} <span className="text-zinc-400 font-medium">input</span></span>
            <span className="text-zinc-300">+</span>
            <span className="text-zinc-700">{formatTokens(usage.completionTokens)} <span className="text-zinc-400 font-medium">output</span></span>
          </div>
        </div>

        {/* SKILLS */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Skills</p>
            <div className="h-px flex-1 bg-zinc-100" />
          </div>

          <div className="space-y-6">
            {/* 1. Core Orchestration - Fixed Capability */}
            {agent.index !== 0 && (
              <div>
                <div className="mb-2">
                  <p className="text-[10px] text-zinc-400">core system</p>
                </div>
                <div className="inline-flex items-center px-3 py-1.5 bg-zinc-900 rounded-xl border border-zinc-900 max-w-full shadow-lg">
                  <div className="flex items-center gap-2 text-white">
                    <Cpu size={12} strokeWidth={3} />
                    <p className="text-[10px] font-black uppercase tracking-tighter truncate whitespace-nowrap">
                      core-skill
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Skill Pattern */}
            {agent.pattern && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <p className="text-[10px] text-zinc-400">skills design pattern</p>
                  <button
                    onClick={() => setInfoType('patterns')}
                    className="text-zinc-300 hover:text-zinc-500 transition-colors"
                  >
                    <HelpCircle size={12} />
                  </button>
                </div>
                <div className="inline-flex items-center px-3 py-1.5 bg-zinc-50 rounded-xl border border-zinc-200/60 max-w-full shadow-sm">
                  <p className="text-[10px] font-black text-zinc-800 uppercase tracking-tighter truncate whitespace-nowrap">
                    {agent.pattern}
                  </p>
                </div>
              </div>
            )}

            {/* 3. Skills List (Excluding core-skill) */}
            {agent.skills && agent.skills.filter(s => s !== 'core-skill').length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <p className="text-[10px] text-zinc-400">extra skills</p>
                  <button
                    onClick={() => setInfoType('extra')}
                    className="text-zinc-300 hover:text-zinc-500 transition-colors"
                  >
                    <HelpCircle size={12} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {agent.skills.filter(s => s !== 'core-skill').map((skillId: string) => (
                    <div key={skillId} className="inline-flex items-center px-3 py-1.5 bg-zinc-50 rounded-xl border border-zinc-200/60 max-w-full shadow-sm h-7">
                      <span className="text-[10px] font-black text-zinc-600 uppercase tracking-tighter truncate whitespace-nowrap">
                        {skillId}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
            Status
          </p>
          <p className="text-sm text-zinc-300 leading-snug italic font-medium">
            Waiting for next task...
          </p>
        </div>
      )}

      {/* Info Modals */}
      <InfoModal
        isOpen={infoType === 'patterns'}
        onClose={() => setInfoType(null)}
        title="Skill Design Patterns"
        description="Based on the Agent Design Kit (ADK), these patterns help structure how an agent processes information and uses tools. Patterns like Reviewer, Generator, and Pipeline provide proven templates for complex agentic workflows."
        link="https://lavinigam.com/posts/adk-skill-design-patterns/"
        linkText="Explore ADK Guide"
      />
      <InfoModal
        isOpen={infoType === 'extra'}
        onClose={() => setInfoType(null)}
        title="Extra Skills"
        description="Based on the Agent Skills Open Standard, these are modular, portable capabilities that can be shared across different agentic systems. They allow for easy integration of specialized tools and knowledge."
        link="https://agentskills.io/home"
        linkText="View Open Standard"
      />
    </div>
  );
};

export default AgentStatusPanel;
