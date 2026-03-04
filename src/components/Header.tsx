import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { useAgencyStore } from '../store/agencyStore';
import { Maximize2, KeyRound, Info, Zap, ZapOff, Play } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import InfoModal from './InfoModal';
import BYOKModal from './BYOKModal';

const Header: React.FC = () => {
  const { llmConfig } = useStore();
  const { pauseOnCall, togglePauseOnCall, isPaused, setPaused } = useAgencyStore();
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

      {/* Right: Global Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={togglePauseOnCall}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-all border cursor-pointer ${
            pauseOnCall
              ? 'bg-amber-50 text-amber-600 border-amber-200'
              : 'bg-zinc-50 text-zinc-400 border-zinc-100 hover:bg-zinc-100 hover:text-zinc-600'
          }`}
          title={pauseOnCall ? "Pause on AI Call: ON" : "Pause on AI Call: OFF"}
        >
          {pauseOnCall ? <Zap size={14} fill="currentColor" /> : <ZapOff size={14} />}
          <span>{pauseOnCall ? 'Debug Mode ON' : 'Debug Mode'}</span>
        </button>

        <div className="w-[1px] h-4 bg-zinc-200 mx-1" />

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
          <KeyRound size={18} className={hasKey ? 'text-emerald-500 hover:text-emerald-600' : ''} />
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
