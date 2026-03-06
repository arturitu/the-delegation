import React, { useState } from 'react';
import { X, Eye, EyeOff, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';

interface BYOKModalProps {
  onClose: () => void;
}

const STORAGE_KEY = 'byok-config';

const PROVIDERS = [
  { id: 'gemini', label: 'Gemini', model: 'gemini-3-flash-preview', enabled: true },
  { id: 'openai', label: 'OpenAI', model: 'gpt-4o', enabled: false },
  { id: 'anthropic', label: 'Anthropic', model: 'claude-opus-4-5', enabled: false },
] as const;

const BYOKModal: React.FC<BYOKModalProps> = ({ onClose }) => {
  const { llmConfig, setLlmConfig, byokError, setBYOKOpen } = useStore();

  const [selectedProvider, setSelectedProvider] = useState<string>(llmConfig.provider);
  const [apiKey, setApiKey] = useState<string>(llmConfig.apiKey || '');
  const [showKey, setShowKey] = useState(false);

  const handleSave = () => {
    const provider = PROVIDERS.find(p => p.id === selectedProvider)!;
    const config = {
      provider: provider.id as 'gemini' | 'openai' | 'anthropic' | 'local',
      apiKey,
      model: provider.model,
    };
    setLlmConfig(config);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {}
    onClose();
  };

  const handleClear = () => {
    const provider = PROVIDERS.find(p => p.id === selectedProvider)!;
    const emptyConfig = {
      provider: provider.id as 'gemini' | 'openai' | 'anthropic' | 'local',
      apiKey: '',
      model: provider.model,
    };
    setApiKey('');
    setLlmConfig(emptyConfig);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(emptyConfig));
    } catch {}
  };

  const isSaved = !!llmConfig.apiKey;

  return (
    <AnimatePresence mode="wait">
      <div className="fixed inset-0 z-100 flex items-center justify-center p-6 pointer-events-auto overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-white/60 backdrop-blur-xl"
        />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="relative w-full max-w-md bg-white rounded-[40px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] p-8 md:p-10 border border-zinc-100"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-zinc-300 hover:text-zinc-600 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>

          <div className="max-w-sm mx-auto">
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-black text-zinc-900 tracking-tight mb-1">
                API Key
              </h2>
              <p className="text-zinc-400 text-xs font-medium leading-relaxed">
                Your key is stored locally and never leaves your browser.
              </p>
            </div>

            {/* Error Message */}
            {byokError && (
              <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
                <div className="mt-0.5 text-red-500">
                  <X size={14} strokeWidth={3} className="rotate-45" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-red-500 mb-0.5">Authentication Error</p>
                  <p className="text-[11px] font-medium text-red-600 leading-tight">{byokError}</p>
                </div>
              </div>
            )}

            {/* Provider selector */}
            <div className="mb-5">
              <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400 mb-2">
                Provider
              </label>
              <div className="flex gap-2 flex-wrap">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    disabled={!p.enabled}
                    onClick={() => p.enabled && setSelectedProvider(p.id)}
                    className={`px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all border
                      ${selectedProvider === p.id && p.enabled
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : p.enabled
                          ? 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400 hover:text-zinc-900 cursor-pointer'
                          : 'bg-white text-zinc-300 border-zinc-100 cursor-not-allowed'
                      }`}
                  >
                    {p.label}
                    {!p.enabled && (
                      <span className="ml-1 text-[9px] normal-case tracking-normal font-medium opacity-60">soon</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* API Key input */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">
                  Key
                </label>
                {selectedProvider === 'gemini' && (
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener"
                    className="group flex items-center gap-2 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 hover:border-emerald-200 rounded-full transition-all duration-200"
                  >
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Get Gemini API Key</span>
                    <svg className="text-emerald-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="7" y1="17" x2="17" y2="7"></line>
                      <polyline points="7 7 17 7 17 17"></polyline>
                    </svg>
                  </a>
                )}
              </div>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your API key here"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 pr-10 text-sm text-zinc-900 font-mono placeholder:text-zinc-300 placeholder:font-sans focus:outline-none focus:border-zinc-400 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-600 transition-colors cursor-pointer"
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleClear}
                disabled={!isSaved && !apiKey}
                className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-zinc-300 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Trash2 size={13} />
                Clear
              </button>

              <button
                onClick={handleSave}
                disabled={!apiKey.trim()}
                className="px-8 py-3 bg-zinc-900 text-white rounded-full text-[11px] font-black uppercase tracking-[0.2em] hover:bg-black transition-all active:scale-95 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                Save
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BYOKModal;
