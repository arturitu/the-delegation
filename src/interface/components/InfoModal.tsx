import React from 'react';
import { X, ExternalLink } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  link?: string;
  linkText?: string;
}

export const InfoModal: React.FC<InfoModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  link,
  linkText
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="fixed inset-0" 
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-zinc-100 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-zinc-50 flex items-center justify-between bg-zinc-50/30">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
            {title}
          </h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-zinc-200 rounded-lg transition-colors text-zinc-400"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-8 space-y-6">
          <p className="text-xs text-zinc-600 leading-relaxed font-medium">
            {description}
          </p>
          {link && (
            <a 
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-black/10"
            >
              <ExternalLink size={12} strokeWidth={3} />
              {linkText || 'Learn More'}
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
