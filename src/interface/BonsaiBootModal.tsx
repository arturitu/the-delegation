import { Cpu, X, Zap, ShieldCheck, Box, PlayCircle, Globe } from 'lucide-react';
import React, { useEffect } from 'react';
import { useUiStore } from '../integration/store/uiStore';
import { TransformersJsProvider } from '../core/llm/providers/TransformersJsProvider';

interface BonsaiBootModalProps {
  onClose: () => void;
}

const BonsaiBootModal: React.FC<BonsaiBootModalProps> = ({ onClose }) => {
  const { llmConfig } = useUiStore();
  const MODEL_ID = llmConfig.model || 'Bonsai 1.7B';
  const {
    modelLoadingProgress,
    modelLoadingFile,
    isModelVerified,
    setIsModelVerified,
    isModelReady,
    isDownloading,
    setIsDownloading,
    setBYOKOpen
  } = useUiStore();

  // No verification needed for remote models
  useEffect(() => {
    setIsModelVerified(true);
  }, [setIsModelVerified]);

  const handleStartBoot = async () => {
    setIsDownloading(true);
    const provider = TransformersJsProvider.getInstance();
    await provider.loadModel(MODEL_ID, 'q1');
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-6 pointer-events-auto overflow-hidden">
      <div
        className="absolute inset-0 bg-white/60 backdrop-blur-xl"
      />
      <div
        className="relative w-full max-w-xl bg-white rounded-[40px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] p-8 md:p-12 border border-zinc-100 overflow-hidden"
      >
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />

        {/* Close button */}
        {!isDownloading && !isModelReady && (
          <button
            onClick={onClose}
            className="absolute top-8 right-8 text-zinc-300 hover:text-zinc-600 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        )}

        <div className="relative">
          {/* Header */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-full mb-6">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Local LLM Engine</span>
              <Cpu size={10} className="text-indigo-500" />
            </div>
            <h2 className="text-4xl font-black text-darkDelegation tracking-tight mb-4">
              {isDownloading ? 'Waking up' : 'Local'} <span className="text-indigo-600">{MODEL_ID}</span>
            </h2>
            <p className="text-zinc-500 text-sm font-medium leading-relaxed max-w-md">
              Local LLM model that runs entirely in your browser via WebGPU. No data leaves your device. 100% private.
            </p>
          </div>

          {isDownloading ? (
            <div className="py-10">
              <div className="flex justify-between items-end mb-4 px-2">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-indigo-500 mb-1">Mounting LLM Network</p>
                  <h3 className="text-lg font-black text-darkDelegation">Loading weights into VRAM</h3>
                </div>
                <p className="text-2xl font-black text-darkDelegation tabular-nums">
                  {Math.round(modelLoadingProgress)}<span className="text-indigo-500">%</span>
                </p>
              </div>
              <div className="w-full h-4 bg-zinc-100 rounded-full overflow-hidden p-1 shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${modelLoadingProgress}%` }}
                />
              </div>
              <div className="mt-4 flex flex-col items-center gap-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400/60 uppercase">Current Phase</p>
                <p className="text-[11px] font-mono font-bold text-zinc-500 truncate max-w-full px-4">
                  {modelLoadingFile ? `loading: ${modelLoadingFile}` : 'Initializing engine...'}
                </p>
              </div>
              <p className="mt-8 text-center text-xs font-medium text-zinc-400 max-w-xs mx-auto italic">
                Mounting LLM Network into VRAM. Please wait.
              </p>
            </div>
          ) : !isModelReady ? (
            <>
              <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-[32px] flex items-center gap-4 mb-8">
                <Globe className="text-emerald-500 shrink-0" size={24} />
                <div>
                  <h4 className="text-sm font-black text-emerald-900 uppercase tracking-tight mb-0.5">Network Ready</h4>
                  <p className="text-[11px] text-emerald-700/80 font-medium">{MODEL_ID} will be streamed to your browser via WebGPU.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-10">
                <div className="p-5 bg-zinc-50 rounded-3xl border border-zinc-100/50">
                  <Zap className="text-amber-500 mb-2" size={20} />
                  <p className="text-xs font-black text-darkDelegation uppercase tracking-tight mb-1">Turbo Mode</p>
                  <p className="text-[10px] text-zinc-400 font-medium font-mono lowercase">device: webgpu</p>
                </div>
                <div className="p-5 bg-zinc-50 rounded-3xl border border-zinc-100/50">
                  <Box className="text-indigo-500 mb-2" size={20} />
                  <p className="text-xs font-black text-darkDelegation uppercase tracking-tight mb-1">Architecture</p>
                  <p className="text-[10px] text-zinc-400 font-medium font-mono lowercase">dtype: 1-bit q1</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleStartBoot}
                  className="w-full flex items-center justify-center gap-3 py-5 bg-darkDelegation text-white rounded-[28px] text-sm font-black uppercase tracking-[0.2em] hover:bg-black transition-all active:scale-95 shadow-xl shadow-indigo-100 group"
                >
                  <PlayCircle size={20} className="text-indigo-400 group-hover:text-white transition-colors" />
                  Launch Local Engine
                </button>
                <button
                  onClick={() => {
                    onClose();
                    setBYOKOpen(true);
                  }}
                  className="w-full py-4 bg-zinc-50 text-zinc-500 border border-zinc-100 rounded-[28px] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-zinc-100 transition-all flex items-center justify-center gap-2"
                >
                  <Globe size={14} className="text-zinc-400" />
                  Configure BYOK (GEMINI)
                </button>
              </div>
            </>
          ) : (
            <div className="py-8 text-center animate-in zoom-in-95 duration-500">
              <div className="w-24 h-24 bg-emerald-50 rounded-[32px] flex items-center justify-center mx-auto mb-8 relative">
                <div className="absolute inset-0 bg-emerald-400 rounded-[32px] animate-ping opacity-20" />
                <ShieldCheck className="text-emerald-500 relative" size={48} />
              </div>
              <h3 className="text-3xl font-black text-darkDelegation tracking-tight mb-3">System Online</h3>
              <p className="text-zinc-400 text-sm font-medium mb-10 max-w-xs mx-auto leading-relaxed">
                {MODEL_ID} has been successfully loaded into VRAM. Agents are now fully autonomous and offline.
              </p>
              <button
                onClick={onClose}
                className="w-full py-5 bg-emerald-500 text-white rounded-[32px] text-xs font-black uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all active:scale-95 shadow-xl shadow-emerald-200"
              >
                Enter Playground
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BonsaiBootModal;
