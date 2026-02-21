import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { AGENTS } from '../data/agents';
import { Send, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ChatPanel: React.FC = () => {
  const {
    isChatting,
    chatMessages,
    sendMessage,
    isThinking,
    selectedNpcIndex,
    setIsTyping
  } = useStore();

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stopTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const agent = selectedNpcIndex !== null ? AGENTS[selectedNpcIndex] : null;

  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
      if (stopTypingTimeoutRef.current) clearTimeout(stopTypingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isThinking]);

  const simulateTyping = (text: string) => {
    let currentIndex = 0;
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);

    setIsTyping(true);

    typingIntervalRef.current = setInterval(() => {
      if (currentIndex < text.length) {
        const char = text[currentIndex];
        setInput((prev) => prev + char);
        currentIndex++;
      } else {
        if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
        setIsTyping(false);
      }
    }, 20); // 20ms per character for a natural feel
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    simulateTyping(pastedText);
  };

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    if (stopTypingTimeoutRef.current) clearTimeout(stopTypingTimeoutRef.current);
    setIsTyping(false);

    const text = input;
    setInput('');
    await sendMessage(text);
  };

  if (!isChatting || !agent) return null;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed top-0 right-0 w-100 h-full bg-white border-l border-zinc-100 shadow-2xl z-50 flex flex-col pointer-events-auto overflow-hidden"
    >
      {/* Color accent bar */}
      <div
        className="absolute top-0 left-0 w-full h-1.5 z-20"
        style={{ backgroundColor: agent.color }}
      />
      {/* Header */}
      <div className="p-8 border-b border-zinc-100 flex justify-between items-end bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div>
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Chat</h2>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">{agent.department}</p>
          <h3 className="text-lg font-black text-zinc-900 leading-tight">{agent.role}</h3>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-8 space-y-10 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:display-none"
      >
        <AnimatePresence initial={false}>
          {chatMessages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className={`flex items-start gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} max-w-[90%]`}>
                {/* Avatar / Icon */}
                <div className="shrink-0 mt-1">
                  {msg.role === 'model' ? (
                    <div className="w-5 h-5 text-zinc-400">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L14.85 9.15L22 12L14.85 14.85L12 22L9.15 14.85L2 12L9.15 9.15L12 2Z" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm">
                      <span className="text-sm font-black text-[#7EACEA]">U</span>
                    </div>
                  )}
                </div>

                <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-4 py-2.5 rounded-[20px] text-[14px] leading-relaxed shadow-sm ${
                    msg.role === 'user'
                    ? 'bg-blue-50/50 text-zinc-800 rounded-tr-none border border-blue-100/50'
                    : 'bg-zinc-50 text-zinc-800 rounded-tl-none border border-zinc-100'
                  }`}>
                    {msg.text}
                  </div>

                  <div className={`flex items-center gap-2 mt-2 px-1`}>
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                      {msg.role === 'user' ? 'You' : agent.role.split(' ')[0]}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isThinking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-start gap-3"
          >
            <div className="w-4 h-4 text-zinc-300 animate-pulse mt-1">
               <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L14.85 9.15L22 12L14.85 14.85L12 22L9.15 14.85L2 12L9.15 9.15L12 2Z" />
               </svg>
            </div>
            <div className="bg-zinc-50 px-4 py-3 rounded-2xl rounded-tl-none">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="p-8 border-t border-zinc-50">
        <div className="relative flex items-center gap-2">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => {
                const val = e.target.value;
                setInput(val);

                // Show player talking animation while typing
                if (val.length > 0) {
                  setIsTyping(true);
                  if (stopTypingTimeoutRef.current) clearTimeout(stopTypingTimeoutRef.current);
                  stopTypingTimeoutRef.current = setTimeout(() => setIsTyping(false), 1000);
                } else {
                  setIsTyping(false);
                }
              }}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Message (↵ to send)"
              className="w-full bg-white border border-zinc-200 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all resize-none h-14 pr-12 [scrollbar-width:none]"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isThinking}
            style={{ backgroundColor: !input.trim() || isThinking ? undefined : agent.color }}
            className={`h-14 px-6 rounded-2xl flex items-center gap-2 font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${
              !input.trim() || isThinking
              ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
              : 'text-white shadow-lg hover:brightness-90'
            }`}
          >
            Send
            <Send size={14} strokeWidth={3} />
          </button>
        </div>
        <p className="text-[9px] text-zinc-400 mt-2 text-center font-medium uppercase tracking-wider">
          Shift + ↵ for new line
        </p>
      </div>
    </motion.div>
  );
};

export default ChatPanel;
