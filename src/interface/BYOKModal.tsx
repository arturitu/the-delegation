import { Eye, EyeOff, Trash2, X, Cpu, Globe, Zap, ShieldCheck } from 'lucide-react';
import React, { useState } from 'react';
import { useUiStore } from '../integration/store/uiStore';
import { DEFAULT_MODELS, AVAILABLE_MODELS } from '../core/llm/constants';

interface BYOKModalProps {
  onClose: () => void;
}

const STORAGE_KEY = 'byok-config';

const BYOKModal: React.FC<BYOKModalProps> = ({ onClose }) => {
  const { llmConfig, setLlmConfig, byokError } = useUiStore();

  const [apiKey, setApiKey] = useState<string>(llmConfig.apiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState(llmConfig.model || DEFAULT_MODELS.text);

  const { isModelReady, setIsModelReady, setIsBootModalOpen, setIsModelVerified } = useUiStore();
  const isLocalModelSelected = selectedModel === 'gemma-4';
  
  const handleClose = () => {
    // If we're closing and the current model is gemma-4 but not ready, 
    // go back to the boot modal to ensure we don't end up in a broken state
    if (isLocalModelSelected && !isModelReady) {
       setIsBootModalOpen(true);
    }
    onClose();
  };

  const handleSave = () => {
    const config = {
      apiKey: isLocalModelSelected ? '' : apiKey.trim(),
      model: selectedModel,
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
      model: llmConfig.model || DEFAULT_MODELS.text,
    };
    setApiKey('');
    setLlmConfig(emptyConfig);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(emptyConfig));
    } catch (e) {
      console.error('Failed to clear BYOK config', e);
    }
  };

  const isSaved = !!llmConfig.apiKey;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-6 pointer-events-auto overflow-hidden">
      <div
        onClick={handleClose}
        className="absolute inset-0 bg-white/60 backdrop-blur-xl"
      />
      <div
        className="relative w-full max-w-md bg-white rounded-[40px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] p-8 md:p-10 border border-zinc-100"
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-6 right-6 text-zinc-300 hover:text-zinc-600 transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-3xl font-black text-darkDelegation tracking-tight mb-2">
              AI Configuration
            </h2>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener"
              className="group inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 hover:border-emerald-200 rounded-full transition-all duration-200 mb-3"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Get Gemini API Key</span>
              <svg className="text-emerald-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="7" y1="17" x2="17" y2="7"></line>
                <polyline points="7 7 17 7 17 17"></polyline>
              </svg>
            </a>
            <p className="text-zinc-400 text-sm font-medium leading-relaxed max-w-[240px]">
              Configure your cloud API keys or use local inference.
            </p>
          </div>

          {byokError && (
            <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
              <div className="mt-0.5 text-red-500 shrink-0">
                <X size={14} strokeWidth={3} className="rotate-45" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-red-500 mb-0.5">API Error</p>
                <p className="text-[11px] font-medium text-red-600 leading-tight break-words">
                  {byokError}
                </p>
              </div>
            </div>
          )}

          {/* Model Selection */}
          <div className="mb-8">
            <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-zinc-300 mb-4 ml-1">
              Primary Model
            </label>
            <div className="grid grid-cols-1 gap-2">
              {AVAILABLE_MODELS.text.map(model => {
                const isSelected = selectedModel === model;
                const isLocal = model === 'gemma-4';
                
                return (
                  <button
                    key={model}
                    onClick={() => setSelectedModel(model)}
                    className={`flex items-center justify-between px-6 py-4 rounded-3xl border transition-all duration-300 ${
                      isSelected 
                        ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                        : 'bg-zinc-50 border-zinc-100 hover:border-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isLocal ? (
                        <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-indigo-500 text-white' : 'bg-zinc-200 text-zinc-500'}`}>
                          <Cpu size={14} />
                        </div>
                      ) : (
                        <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-blue-500 text-white' : 'bg-zinc-200 text-zinc-500'}`}>
                          <Globe size={14} />
                        </div>
                      )}
                      <span className={`text-xs font-bold ${isSelected ? 'text-indigo-900' : 'text-zinc-500'}`}>
                        {model === 'gemma-4' ? 'Gemma 4 (Local Inference)' : model}
                      </span>
                    </div>
                    {isSelected && (
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* API Key input or Local Status */}
          <div className="mb-10">
            {isLocalModelSelected ? (
              <div className="p-6 bg-zinc-50 rounded-[32px] border border-zinc-100/50">
                <div className="flex items-center gap-4 mb-4">
                  <div className={`p-3 rounded-2xl ${isModelReady ? 'bg-emerald-50 text-emerald-500' : 'bg-indigo-50 text-indigo-500'}`}>
                    {isModelReady ? <ShieldCheck size={24} /> : <Zap size={24} />}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-darkDelegation tracking-tight">
                      {isModelReady ? 'System Ready' : 'Neural Engine Offline'}
                    </h4>
                    <p className="text-[10px] font-medium text-zinc-400">
                      {isModelReady ? 'Weights verified in VRAM.' : 'Ready to boot local model.'}
                    </p>
                  </div>
                </div>
                
                {!isModelReady ? (
                  <div className="space-y-3">
                    <button
                      onClick={() => setIsBootModalOpen(true)}
                      className="w-full py-4 bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                    >
                      <Zap size={14} />
                      Verify & Boot Engine
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => {
                        setIsModelReady(false);
                        setIsModelVerified(false);
                    }}
                    className="w-full py-2 text-[9px] font-black uppercase tracking-widest text-zinc-300 hover:text-indigo-400 transition-colors"
                  >
                    Reset engine state
                  </button>
                )}
              </div>
            ) : (
              <>
                <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-zinc-300 mb-4 ml-1">
                  API Key
                </label>
                <div className="relative group">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Paste your API key here"
                    className="w-full bg-zinc-50 border border-zinc-100 rounded-3xl px-6 py-4 pr-14 text-sm text-darkDelegation font-mono placeholder:text-zinc-300 placeholder:font-sans focus:outline-none focus:border-zinc-200 transition-all shadow-sm group-hover:shadow-md"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(v => !v)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-200 hover:text-zinc-400 transition-colors cursor-pointer"
                  >
                    {showKey ? <EyeOff size={20} strokeWidth={2.5} /> : <Eye size={20} strokeWidth={2.5} />}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleClear}
              disabled={!isSaved && !apiKey}
              className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-zinc-400 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed group"
            >
              <div className="p-2 rounded-xl group-hover:bg-red-50 transition-colors">
                <Trash2 size={16} strokeWidth={2.5} />
              </div>
              Clear
            </button>

            <button
              onClick={handleSave}
              disabled={(!isLocalModelSelected && !apiKey.trim()) || (isLocalModelSelected && !isModelReady)}
              className="px-12 py-4 bg-darkDelegation text-white rounded-[24px] text-xs font-black uppercase tracking-[0.2em] hover:bg-black transition-all active:scale-95 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 shadow-xl shadow-black/10"
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
