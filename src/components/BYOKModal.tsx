import React, { useState } from 'react';
import { X, Eye, EyeOff, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';

interface BYOKModalProps {
  onClose: () => void;
}

const PROVIDERS = [
  { id: 'gemini', label: 'Gemini', model: 'gemini-3-flash-preview', enabled: true },
  { id: 'openai', label: 'OpenAI', model: 'gpt-4o', enabled: false },
  { id: 'anthropic', label: 'Anthropic', model: 'claude-opus-4-5', enabled: false },
] as const;

const BYOKModal: React.FC<BYOKModalProps> = ({ onClose }) => {
  const { llmConfig, setLlmConfig } = useStore();

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
              <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400 mb-2">
                Key
              </label>
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
