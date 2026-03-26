import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, Copy, Check, MessageSquare } from 'lucide-react';
import { useUiStore } from '../../integration/store/uiStore';
import { Avatar } from './Avatar';

export const MessageFullViewModal: React.FC = () => {
  const { fullViewMessage, setFullViewMessage } = useUiStore();
  const [copied, setCopied] = useState(false);

  if (!fullViewMessage) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullViewMessage.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-[250] flex items-center justify-center p-4 md:p-8 bg-zinc-900/40 backdrop-blur-md animate-in fade-in duration-300"
      onClick={() => setFullViewMessage(null)}
    >
      <div 
        className="bg-white w-full max-w-4xl h-full max-h-[90vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col border border-zinc-200/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-zinc-900 text-white rounded-2xl shadow-lg">
              <MessageSquare size={24} />
            </div>
            <div>
              <h3 className="font-black text-xl text-zinc-800 uppercase tracking-tight">Full Response View</h3>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                {fullViewMessage.role === 'assistant' ? `From ${fullViewMessage.agentName || 'AI Agent'}` : 'User Message'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopy}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                copied 
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border border-zinc-200'
              }`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy Content'}
            </button>
            <button 
              onClick={() => setFullViewMessage(null)}
              className="p-2.5 hover:bg-zinc-200 rounded-xl transition-colors text-zinc-400 border border-transparent hover:border-zinc-300"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 md:p-12">
          <div className="max-w-3xl mx-auto">
            <div className="markdown-content prose prose-zinc max-w-none">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  pre: ({node, ...props}) => <pre className="bg-zinc-900 text-white p-6 rounded-2xl my-6 overflow-x-auto shadow-xl" {...props} />,
                  code: ({node, ...props}) => <code className="bg-zinc-100 px-1.5 py-0.5 rounded-md text-pink-600 font-bold" {...props} />,
                  img: ({node, ...props}) => <img className="max-w-full h-auto rounded-3xl my-8 shadow-lg" {...props} />,
                  h1: ({node, ...props}) => <h1 className="text-3xl font-black uppercase tracking-tight text-zinc-800 mt-12 mb-6 border-b-4 border-zinc-100 pb-2" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-xl font-black uppercase tracking-tight text-zinc-800 mt-10 mb-4" {...props} />,
                  p: ({node, ...props}) => <p className="text-zinc-600 leading-relaxed text-lg mb-6" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc pl-6 space-y-2 mb-6 text-zinc-600 text-lg" {...props} />,
                  li: ({node, ...props}) => <li className="pl-2" {...props} />,
                }}
              >
                {fullViewMessage.content}
              </ReactMarkdown>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-zinc-50 border-t border-zinc-100 flex items-center justify-center">
          <p className="text-[10px] font-bold text-zinc-300 uppercase tracking-[0.3em]">Full Document Mode · Optimized for Clarity</p>
        </div>
      </div>
    </div>
  );
};
