import React from 'react';
import { useStore } from '../store/useStore';
import { useAgencyStore } from '../store/agencyStore';
import { AGENTS } from '../data/agents';
import { useSceneManager } from '../three/SceneContext';
import { useChatAvailability } from '../hooks/useChatAvailability';

interface AgentViewProps {
  agentIndex: number;
}

const AgentView: React.FC<AgentViewProps> = ({ agentIndex }) => {
  const { setInspectorTab, isChatting } = useStore();
  const scene = useSceneManager();
  const { canChat, reason } = useChatAvailability(agentIndex);
  const {
    tasks,
    setLogOpen,
    addTask,
    updateTaskStatus,
    setTaskOutput,
  } = useAgencyStore();

  const agent = AGENTS[agentIndex];
  if (!agent) return null;

  const activeTask = tasks.find(
    (t) => t.assignedAgentIds.includes(agentIndex) && t.status === 'in_progress'
  ) ?? null;

  const handleStartChat = () => {
    scene?.startChat(agentIndex);
    setInspectorTab('chat');
  };

  const handleEndChat = () => {
    scene?.endChat();
    setInspectorTab('info');
  };

  return (
    <div className="flex flex-col h-full p-6">
      <div className="mb-6 relative">
         <div
            className="absolute -left-6 top-0 w-1.5 h-12"
            style={{ backgroundColor: agent.color }}
          />
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">
          {agent.department}
        </p>
        <h2 className="text-xl font-black text-zinc-900 leading-tight">{agent.role}</h2>
      </div>

      <div className="h-px bg-zinc-100 w-full mb-6" />

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

      {/* Active task highlight */}
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
          <p className="text-sm text-zinc-400 leading-snug italic font-medium">
            Waiting for next task...
          </p>
        </div>
      )}

      <div className="mt-auto pt-6 flex flex-col gap-2.5">
        {isChatting ? (
          <button
            onClick={handleEndChat}
            style={{ backgroundColor: agent.color }}
            className="w-full py-3 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-90 active:scale-[0.98] transition-all shadow-lg pointer-events-auto cursor-pointer"
          >
            End Chat
          </button>
        ) : canChat ? (
          <button
            onClick={handleStartChat}
            className="w-full py-3 text-white rounded-xl text-xs font-black uppercase tracking-widest active:scale-[0.98] transition-all shadow-lg pointer-events-auto cursor-pointer bg-zinc-900 hover:bg-black shadow-zinc-200"
          >
            Start Chat
          </button>
        ) : (
          <div className="flex flex-col gap-1.5">
            <button
              disabled
              className="w-full py-3 bg-zinc-200 text-zinc-400 rounded-xl text-xs font-black uppercase tracking-widest cursor-not-allowed transition-all"
            >
              Busy
            </button>
            <p className="text-[10px] text-zinc-400 text-center font-medium italic">
              {reason}
            </p>
          </div>
        )}

        {/* Debug Controls */}
        <div className="mt-4 border-t border-zinc-100 pt-4">
          <p className="text-[8px] font-black text-zinc-300 uppercase mb-2 tracking-tighter">Debug Simulation</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => {
                addTask({
                  title: `Work for ${agent.role}`,
                  description: "Manually triggered work",
                  assignedAgentIds: [agentIndex],
                  status: 'scheduled',
                });
              }}
              className="px-2 py-1 bg-zinc-50 text-zinc-500 border border-zinc-200 text-[8px] font-bold rounded uppercase hover:bg-zinc-100 transition-colors"
            >
              + Task
            </button>
            {activeTask && (
              <>
                <button
                  onClick={() => {
                    updateTaskStatus(activeTask.id, 'done');
                    setTaskOutput(activeTask.id, "Simulated output");
                    scene?.setNpcWorking(agentIndex, false);
                  }}
                  className="px-2 py-1 bg-green-50 text-green-600 border border-green-100 text-[8px] font-bold rounded uppercase hover:bg-green-100 transition-colors"
                >
                  Set Done
                </button>

              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentView;
