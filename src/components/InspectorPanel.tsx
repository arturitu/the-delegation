import React, { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { useSceneManager } from '../three/SceneContext';
import { useAgencyStore } from '../store/agencyStore';
import { useChatAvailability } from '../hooks/useChatAvailability';
import AgentView from './AgentView';
import ProjectView from './ProjectView';
import ChatPanel from './ChatPanel';
import { AGENTS } from '../data/agents';
import { MessageSquare, Lock, FolderOpen, Siren, MessageSquareWarning } from 'lucide-react';

const AM_INDEX = 1;

interface InspectorPanelProps {
  isFloating?: boolean;
}

const InspectorPanel: React.FC<InspectorPanelProps> = ({ isFloating }) => {
  const { selectedNpcIndex, isChatting } = useStore();
  const scene = useSceneManager();
  const { phase, setFinalOutputOpen, tasks } = useAgencyStore();
  const { canChat, reason } = useChatAvailability(selectedNpcIndex);
  const prevCanChat = useRef(canChat);

  const agent = selectedNpcIndex !== null ? AGENTS[selectedNpcIndex] : null;
  const isProjectReady = phase === 'done' && selectedNpcIndex === AM_INDEX;

  const isAMIdle = selectedNpcIndex === AM_INDEX && phase === 'idle';
  const tasksOnHold = agent ? tasks.filter(
    t => t.assignedAgentIds.includes(agent.index) && t.status === 'on_hold'
  ) : [];
  const hasTaskOnHold = tasksOnHold.length > 0;

  const needsDiscussion = isAMIdle || hasTaskOnHold;

  // When canChat transitions true → false, end any active chat
  useEffect(() => {
    if (prevCanChat.current && !canChat) {
      if (isChatting) scene?.endChat();
    }
    prevCanChat.current = canChat;
  }, [canChat]);

  const handleEndChat = () => {
    scene?.endChat();
  };

  const handleStartChat = () => {
    if (canChat && selectedNpcIndex !== null) {
      scene?.startChat(selectedNpcIndex);
    }
  };

  return (
    <div className={`${isFloating ? 'w-full h-full max-h-[85vh] self-end rounded-2xl shadow-2xl border border-white/20' : 'w-80 h-full border-l border-zinc-100'} bg-white flex flex-col pointer-events-auto shrink-0 relative z-30 overflow-hidden transition-all duration-300`}>
      {!agent ? (
        !isFloating && <ProjectView />
      ) : (
        <>
          {/* Header with Role and Department */}
          <div className={`p-4 pb-1 border-b border-zinc-50 bg-white ${isFloating ? 'bg-zinc-50/50' : ''}`}>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: agent.color }}
                    />
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                      {agent.department}
                    </p>
                  </div>
                  <h2 className="text-xl font-black text-zinc-900 leading-tight">
                    {agent.role}
                  </h2>
                </div>
              </div>
              {needsDiscussion && isChatting && (
                <div className="bg-[#FFF9F2] border border-[#FFE4CC]/50 rounded-xl p-3 shadow-sm animate-in fade-in slide-in-from-top-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-4 h-4 bg-orange-500 rounded text-white shadow-sm">
                        <MessageSquareWarning size={10} strokeWidth={3} />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-orange-600">Discussion</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Active</span>
                    </div>
                  </div>
                  <p className="text-[12px] font-bold text-zinc-900 leading-tight mt-1.5">
                    {isAMIdle
                      ? "Waiting for project briefing."
                      : `${agent?.role} needs input.`}
                  </p>
                </div>
              )}
              {needsDiscussion && !isChatting ? (
                <div className="flex flex-col gap-3 p-4 bg-zinc-50 border border-zinc-100 rounded-xl animate-in fade-in slide-in-from-top-1 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center justify-center w-5 h-5 bg-blue-500 rounded-md text-white">
                      <MessageSquare size={12} strokeWidth={3} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-500">Needs Discussion</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <p className="text-[12px] font-bold text-zinc-900 leading-tight">
                      {isAMIdle
                        ? "Discuss the project briefing with the team."
                        : `"${tasks.find(t => t.assignedAgentIds.includes(agent.index) && t.status === 'on_hold')?.title || 'This task'} is waiting for your input to proceed."`}
                    </p>
                    <p className="text-[10px] text-zinc-400 italic">Waiting for your input to proceed.</p>
                    <button
                      onClick={handleStartChat}
                      disabled={!canChat}
                      className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 active:scale-95 disabled:opacity-50 text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm mt-1"
                    >
                      <MessageSquareWarning size={14} strokeWidth={3} />
                      Chat about {isAMIdle ? 'briefing' : 'approval'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Chat Action Button below name - ONLY SHOW IF NOT NEEDS DISCUSSION (OR IF CHATTING) */
                <div className="w-full">
                  {isProjectReady ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex flex-col gap-3 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-yellow-700">Project Ready</span>
                      </div>
                      <button
                        onClick={() => setFinalOutputOpen(true)}
                        className="flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-black px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all w-full shadow-sm"
                      >
                        <FolderOpen size={14} strokeWidth={3} />
                        View Final Output
                      </button>
                    </div>
                  ) : isChatting ? (
                    null
                  ) : (
                    <button
                      onClick={handleStartChat}
                      disabled={!canChat}
                      title={!canChat ? reason : undefined}
                      className={`w-full h-10 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 text-[10px] font-black uppercase tracking-widest ${
                        canChat
                        ? 'bg-zinc-900 text-white border-none shadow-md'
                        : 'bg-zinc-50 text-zinc-300 border border-transparent cursor-not-allowed'
                      }`}
                    >
                      {canChat ? (
                        <>
                          <MessageSquare size={13} className="text-white" />
                          Open Chat
                        </>
                      ) : (
                        <>
                          <Lock size={12} className="opacity-40" />
                          {reason}
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className={`flex-1 overflow-y-auto relative min-h-0 ${isFloating ? 'bg-white' : 'bg-zinc-50/30'}`}>
            {isChatting ? (
              <div className="flex flex-col h-full bg-white">
                <div className="flex-1 overflow-y-auto">
                  <ChatPanel />
                </div>
                {/* Close Chat button at the bottom when chatting */}
                <div className="p-3 bg-white border-t border-zinc-100 flex-shrink-0">
                  <button
                    onClick={handleEndChat}
                    className="w-full h-10 px-4 bg-zinc-900 hover:bg-black text-white rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 text-[10px] font-black uppercase tracking-widest shadow-md"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Close Chat
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="flex-1">
                  <AgentView agentIndex={selectedNpcIndex!} />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default InspectorPanel;
