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
          <div className="p-4 border-b border-zinc-100 bg-zinc-50/50">
            <div className="flex items-center justify-between mb-1.5">
              <span
                className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: agent.color }}
              >
                {agent.department}
              </span>
              {isChatting && (
                <button
                  onClick={handleEndChat}
                  className="px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white bg-zinc-900 hover:bg-black active:scale-95 transition-all rounded-lg shadow-sm flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white opacity-80" />
                  Close Chat
                </button>
              )}
            </div>
            <h2 className="text-xl font-black text-zinc-900 tracking-tight leading-none capitalize">
              {agent.role}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto relative min-h-0 bg-zinc-50/30">
            {isChatting ? (
              <ChatPanel />
            ) : (
              <div className="flex flex-col h-full">
                <div className="flex-1">
                  <AgentView agentIndex={selectedNpcIndex!} />
                </div>

                <div className="p-4 bg-white border-t border-zinc-100">
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
                  ) : (
                    <button
                      onClick={handleStartChat}
                      disabled={!canChat}
                      title={!canChat ? reason : undefined}
                      className={`w-full py-4 px-4 flex flex-col items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl border-2 ${
                        !canChat
                        ? 'text-zinc-400 border-zinc-100 bg-zinc-50/50 cursor-not-allowed'
                        : 'text-zinc-900 border-zinc-900 hover:bg-zinc-900 hover:text-white active:scale-95'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {!canChat ? <Lock size={12} className="opacity-60" /> : <MessageSquare size={14} />}
                        <span>{canChat ? 'Open Chat' : 'Chat Locked'}</span>
                      </div>
                      {!canChat && (
                        <span className="text-[8px] font-bold text-zinc-400/80 tracking-tight normal-case leading-none">
                          ({reason})
                        </span>
                      )}
                    </button>
                  )}
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
