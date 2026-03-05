import React, { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { useSceneManager } from '../three/SceneContext';
import { useAgencyStore } from '../store/agencyStore';
import { useChatAvailability } from '../hooks/useChatAvailability';
import AgentView from './AgentView';
import ProjectView from './ProjectView';
import ChatPanel from './ChatPanel';
import { AGENTS } from '../data/agents';
import { MessageSquare, Lock, FolderOpen } from 'lucide-react';

const AM_INDEX = 1;

const InspectorPanel: React.FC = () => {
  const { selectedNpcIndex, isChatting } = useStore();
  const scene = useSceneManager();
  const { phase, setFinalOutputOpen } = useAgencyStore();
  const { canChat, reason } = useChatAvailability(selectedNpcIndex);
  const prevCanChat = useRef(canChat);

  const agent = selectedNpcIndex !== null ? AGENTS[selectedNpcIndex] : null;
  const isProjectReady = phase === 'done' && selectedNpcIndex === AM_INDEX;

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
    <div className="w-80 h-full bg-white border-l border-zinc-100 flex flex-col pointer-events-auto shrink-0 relative z-30">
      {!agent ? (
        <ProjectView />
      ) : (
        <>
          {/* Header with Role and Department */}
          <div className="p-6 border-b border-zinc-50 bg-white">
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

              {/* Chat Action Button below name */}
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
                  <button
                    onClick={handleEndChat}
                    className="w-full h-8 px-4 bg-zinc-900 hover:bg-black text-white rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95 text-[10px] font-black uppercase tracking-widest shadow-sm"
                  >
                    <div className="w-1 h-1 rounded-full bg-white animate-pulse" />
                    Close Chat
                  </button>
                ) : (
                  <button
                    onClick={handleStartChat}
                    disabled={!canChat}
                    title={!canChat ? reason : undefined}
                    className={`w-full h-8 px-4 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95 text-[10px] font-black uppercase tracking-widest ${
                      canChat
                      ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200 shadow-sm'
                      : 'bg-zinc-50 text-zinc-300 border border-transparent cursor-not-allowed'
                    }`}
                  >
                    {canChat ? (
                      <>
                        <MessageSquare size={13} className="text-zinc-500" />
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
            </div>
          </div>

          <div className="flex-1 overflow-y-auto relative min-h-0 bg-zinc-50/30">
            {isChatting ? (
              <ChatPanel />
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
