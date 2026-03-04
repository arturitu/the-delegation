import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Maximize2, Key, Info } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import InfoModal from './InfoModal';
import BYOKModal from './BYOKModal';

const Header: React.FC = () => {
  const { llmConfig } = useStore();
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isBYOKOpen, setIsBYOKOpen] = useState(false);
  const hasKey = !!llmConfig.apiKey;

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <header className="h-14 border-b border-zinc-100 flex items-center justify-between px-6 bg-white shrink-0 relative z-40">
      {/* Left: Project Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-zinc-900 tracking-tight">The Embodied Agency</span>
          <button
            onClick={() => setIsInfoOpen(true)}
            className="text-zinc-300 hover:text-zinc-500 transition-colors cursor-pointer"
          >
            <Info size={16} />
          </button>
        </div>
      </div>

      {/* Center: Main Title (Removed as requested) */}

      {/* Right: Global Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleFullscreen}
          className="text-zinc-400 hover:text-zinc-900 transition-colors flex items-center gap-2"
          title="Fullscreen Browser"
        >
          <Maximize2 size={18} />
        </button>
        <button
          onClick={() => setIsBYOKOpen(true)}
          className="relative text-zinc-400 hover:text-zinc-900 transition-colors flex items-center gap-2"
          title="API Key (BYOK)"
        >
          <Key size={18} className={hasKey ? 'text-emerald-500 hover:text-emerald-600' : ''} />
          {hasKey && (
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
          )}
        </button>
      </div>

      {isInfoOpen && <InfoModal onClose={() => setIsInfoOpen(false)} />}

      <AnimatePresence>
        {isBYOKOpen && <BYOKModal onClose={() => setIsBYOKOpen(false)} />}
      </AnimatePresence>
    </header>
  );
};

export default Header;
