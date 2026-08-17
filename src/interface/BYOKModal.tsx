import { Eye, EyeOff, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';
import { useUiStore } from '../integration/store/uiStore';
import { DEFAULT_MODELS } from '../core/llm/constants';

interface BYOKModalProps {
  onClose: () => void;
}

const STORAGE_KEY = 'byok-config';

const BYOKModal: React.FC<BYOKModalProps> = ({ onClose }) => {
  const { llmConfig, setLlmConfig, byokError } = useUiStore();

  const [apiKey, setApiKey] = useState<string>(llmConfig.apiKey || '');
  const [nimApiKey, setNimApiKey] = useState<string>(llmConfig.nimApiKey || '');
  const [openaiApiKey, setOpenaiApiKey] = useState<string>(llmConfig.openaiApiKey || '');
  const [anthropicApiKey, setAnthropicApiKey] = useState<string>(llmConfig.anthropicApiKey || '');

  const [showKey, setShowKey] = useState(false);
  const [isErrorExpanded, setIsErrorExpanded] = useState(false);

  const handleSave = () => {
    const config = {
      apiKey: apiKey.trim(),
      nimApiKey: nimApiKey.trim(),
      openaiApiKey: openaiApiKey.trim(),
      anthropicApiKey: anthropicApiKey.trim(),
      model: llmConfig.model || DEFAULT_MODELS.text,
    };
    setLlmConfig(config);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.error('Failed to save BYOK config', e);
    }
    onClose();
  };

  const handleClear = () => {
    const emptyConfig = {
      apiKey: '',
      nimApiKey: '',
      openaiApiKey: '',
      anthropicApiKey: '',
      model: llmConfig.model || DEFAULT_MODELS.text,
    };
    setApiKey('');
    setNimApiKey('');
    setOpenaiApiKey('');
    setAnthropicApiKey('');
    setLlmConfig(emptyConfig);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(emptyConfig));
    } catch (e) {
      console.error('Failed to clear BYOK config', e);
    }
  };

  const isSaved = !!llmConfig.apiKey || !!llmConfig.nimApiKey || !!llmConfig.openaiApiKey || !!llmConfig.anthropicApiKey;
  const hasAnyInput = !!apiKey || !!nimApiKey || !!openaiApiKey || !!anthropicApiKey;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-6 pointer-events-auto overflow-hidden">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-white/60 backdrop-blur-xl"
      />
      <div
        className="relative w-full max-w-lg bg-white rounded-[40px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] p-8 md:p-10 border border-zinc-100 max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-zinc-300 hover:text-zinc-600 transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="max-w-md mx-auto">
          <div className="mb-6">
            <h2 className="text-3xl font-black text-darkDelegation tracking-tight mb-2">
              API Keys
            </h2>
            <p className="text-zinc-400 text-sm font-medium leading-relaxed max-w-[240px]">
              Your keys are stored locally and never leave your browser.
            </p>
          </div>

          {byokError && (() => {
            const isLongError = byokError.length > 120;
            const displayError = isErrorExpanded || !isLongError ? byokError : byokError.slice(0, 110) + '...';
            return (
              <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-2">
                <div className="mt-0.5 text-red-500 shrink-0">
                  <X size={14} strokeWidth={3} className="rotate-45" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-red-500 mb-0.5">API Error</p>
                  <div className={`${isErrorExpanded ? 'max-h-48' : 'max-h-24'} overflow-y-auto pr-1`}>
                    <p className="text-[11px] font-medium text-red-600 leading-tight break-words whitespace-pre-wrap">
                      {displayError}
                    </p>
                    {isLongError && (
                      <button
                        onClick={() => setIsErrorExpanded(!isErrorExpanded)}
                        className="mt-1 text-[9px] font-black uppercase text-red-500"
                      >
                        {isErrorExpanded ? 'Show Less' : 'Show More'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="space-y-4 mb-8">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 ml-1">Gemini API Key</label>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AI Studio Key"
                className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-zinc-300 transition-all"
              />
            </div>
            <div>
              <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 ml-1">NVIDIA NIM API Key</label>
              <input
                type={showKey ? 'text' : 'password'}
                value={nimApiKey}
                onChange={(e) => setNimApiKey(e.target.value)}
                placeholder="nvapi-..."
                className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-zinc-300 transition-all"
              />
            </div>
            <div>
              <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 ml-1">OpenAI API Key</label>
              <input
                type={showKey ? 'text' : 'password'}
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-zinc-300 transition-all"
              />
            </div>
            <div>
              <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 ml-1">Anthropic API Key</label>
              <input
                type={showKey ? 'text' : 'password'}
                value={anthropicApiKey}
                onChange={(e) => setAnthropicApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-zinc-300 transition-all"
              />
            </div>
            <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="text-[10px] font-black uppercase text-zinc-400 hover:text-zinc-600 transition-colors mt-2 ml-1 cursor-pointer"
              >
                {showKey ? 'Hide Keys' : 'Show Keys'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={handleClear}
              disabled={!isSaved && !hasAnyInput}
              className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-zinc-400 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed group"
            >
              <div className="p-2 rounded-xl group-hover:bg-red-50 transition-colors">
                <Trash2 size={16} strokeWidth={2.5} />
              </div>
              Clear
            </button>

            <button
              onClick={handleSave}
              disabled={!hasAnyInput}
              className="px-12 py-4 bg-darkDelegation text-white rounded-[24px] text-xs font-black uppercase tracking-[0.2em] hover:bg-black transition-all active:scale-95 disabled:opacity-30 cursor-pointer shadow-xl"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BYOKModal;
