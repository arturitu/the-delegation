import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { useAgencyStore } from '../store/agencyStore';
import { Maximize2, KeyRound, Info, Zap, ZapOff, Play } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import InfoModal from './InfoModal';
import BYOKModal from './BYOKModal';
import { version } from '../../package.json';

const Header: React.FC = () => {
  const { llmConfig, isBYOKOpen, setBYOKOpen } = useStore();
  const { pauseOnCall, togglePauseOnCall, isPaused, setPaused } = useAgencyStore();
  const [isInfoOpen, setIsInfoOpen] = useState(false);
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
      <div className="flex items-center gap-4">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-zinc-900 leading-none tracking-tight">The</span>
          <span className="text-lg font-bold text-zinc-900 leading-none tracking-tighter">Delegation</span>
        </div>

       <div className="flex items-center gap-4 self-start mt-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsInfoOpen(true)}
              className="text-zinc-300 hover:text-zinc-500 transition-colors cursor-pointer"
            >
              <Info size={16} strokeWidth={2} />
            </button>
            <span className="text-[11px] font-medium text-zinc-400 font-mono">v{version}</span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://x.com/arturitu"
              target="_blank"
              rel="noopener"
              className="text-[11px] font-medium text-zinc-400 hover:text-zinc-900 transition-colors"
            >
              @arturitu
            </a>
            <a
              href="https://github.com/arturitu/the-delegation"
              target="_blank"
              rel="noopener"
              className="text-zinc-300 hover:text-zinc-900 transition-colors"
              title="View on GitHub"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>
            </a>
          </div>
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
          onClick={() => setBYOKOpen(true)}
          className="relative text-zinc-400 hover:text-zinc-900 transition-colors flex items-center gap-2"
          title="API Key (BYOK)"
        >
          <KeyRound size={18} className={hasKey ? 'text-emerald-500 hover:text-emerald-600' : ''} />
          {hasKey && (
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
          )}
        </button>
      </div>

      <AnimatePresence>
        {isInfoOpen && (
          <InfoModal key="info-modal" onClose={() => setIsInfoOpen(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isBYOKOpen && (
          <BYOKModal key="byok-modal" onClose={() => setBYOKOpen(false)} />
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
