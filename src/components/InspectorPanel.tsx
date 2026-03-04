import React, { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { useSceneManager } from '../three/SceneContext';
import { useAgencyStore } from '../store/agencyStore';
import { useChatAvailability } from '../hooks/useChatAvailability';
import AgentView from './AgentView';
import ProjectView from './ProjectView';
import ChatPanel from './ChatPanel';
import { AGENTS, AM_INDEX } from '../data/agents';
import { Info, MessageSquare, Lock } from 'lucide-react';

const InspectorPanel: React.FC = () => {
  const { selectedNpcIndex, inspectorTab, setInspectorTab, isChatting } = useStore();
  const scene = useSceneManager();
  const { phase } = useAgencyStore();
  const { canChat, reason } = useChatAvailability(selectedNpcIndex);
  const prevCanChat = useRef(canChat);

  const agent = selectedNpcIndex !== null ? AGENTS[selectedNpcIndex] : null;

  // Auto-switch to chat tab for special agents
  useEffect(() => {
    if (selectedNpcIndex === null) return;

    if (selectedNpcIndex === AM_INDEX && phase === 'done') {
      setInspectorTab('chat');
      return;
    }
  }, [selectedNpcIndex]);

  // When canChat transitions true → false, force back to Info and end any active chat
  useEffect(() => {
    if (prevCanChat.current && !canChat) {
      if (inspectorTab === 'chat') setInspectorTab('info');
      if (isChatting) scene?.endChat();
    }
    prevCanChat.current = canChat;
  }, [canChat]);

  return (
    <div className="w-80 h-full bg-white border-l border-zinc-100 flex flex-col pointer-events-auto shrink-0 relative z-30">
      {!agent ? (
        <ProjectView />
      ) : (
        <>
          {/* Tab Header (Only when agent is selected) */}
          <div className="flex border-b border-zinc-100 bg-zinc-50/50">
            <button
              onClick={() => setInspectorTab('info')}
              className={`flex-1 py-4 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                inspectorTab === 'info'
                ? 'text-zinc-900 bg-white border-b-2 border-zinc-900'
                : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              <Info size={14} />
              Info
            </button>
            <button
              onClick={() => canChat && setInspectorTab('chat')}
              disabled={!canChat}
              title={!canChat ? reason : undefined}
              className={`flex-1 py-4 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                !canChat
                ? 'text-zinc-300 cursor-not-allowed opacity-50'
                : inspectorTab === 'chat'
                ? 'text-zinc-900 bg-white border-b-2 border-zinc-900'
                : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              {!canChat ? <Lock size={12} /> : <MessageSquare size={14} />}
              Chat
              {!canChat && (
                <span className="text-[8px] font-bold text-zinc-300 tracking-tight normal-case ml-1 max-w-20 truncate">
                  ({reason})
                </span>
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto relative min-h-0 bg-zinc-50/30">
            {inspectorTab === 'info' ? (
              <AgentView agentIndex={selectedNpcIndex!} />
            ) : (
              <ChatPanel />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default InspectorPanel;
