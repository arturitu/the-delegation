import { Cpu, X, Zap, ShieldCheck, Box, FileText, AlertCircle, PlayCircle, Loader2, Globe } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useUiStore } from '../integration/store/uiStore';
import { TransformersJsProvider } from '../core/llm/providers/TransformersJsProvider';

interface GemmaBootModalProps {
  onClose: () => void;
}

const MODEL_ID = 'gemma-4';

const GemmaBootModal: React.FC<GemmaBootModalProps> = ({ onClose }) => {
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

  const [isVerifying, setIsVerifying] = useState(true);
  const [localExists, setLocalExists] = useState(false);

  // Automatic Verification on Mount
  useEffect(() => {
    const verify = async () => {
      try {
        const [configRes, tokenizerRes] = await Promise.all([
          fetch(`${window.location.origin}/the-delegation/gemma-4/config.json`, { method: 'HEAD' }),
          fetch(`${window.location.origin}/the-delegation/gemma-4/tokenizer_config.json`, { method: 'HEAD' })
        ]);
        
        const exists = configRes.ok && tokenizerRes.ok;
        setLocalExists(exists);
        if (exists) {
          setIsModelVerified(true);
        }
      } catch (e) {
        setLocalExists(false);
      } finally {
        setIsVerifying(false);
      }
    };
    verify();
  }, [setIsModelVerified]);

  const handleStartBoot = async () => {
    setIsDownloading(true);
    const provider = TransformersJsProvider.getInstance();
    await provider.loadModel(MODEL_ID, '4bit');
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
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Local Neural Engine</span>
              <Cpu size={10} className="text-indigo-500" />
            </div>
            <h2 className="text-4xl font-black text-darkDelegation tracking-tight mb-4">
              {isDownloading ? 'Waking up' : 'Local'} <span className="text-indigo-600">Gemma 4</span>
            </h2>
            <p className="text-zinc-500 text-sm font-medium leading-relaxed max-w-md">
              High-performance local inference. No API keys, no latency, 100% private.
            </p>
          </div>

          {isVerifying ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <Loader2 className="text-indigo-500 animate-spin mb-4" size={32} />
              <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Verifying local files...</p>
            </div>
          ) : !localExists ? (
            <div className="space-y-6">
              <div className="p-6 bg-red-50 border border-red-100 rounded-[32px] flex items-start gap-4">
                <AlertCircle className="text-red-500 shrink-0" size={24} />
                <div>
                  <h4 className="text-sm font-black text-red-900 uppercase tracking-tight mb-1">Model Files Not Found</h4>
                  <p className="text-xs text-red-700/80 font-medium leading-relaxed">
                    The required ONNX shards are missing from your <code>public/gemma-4/</code> directory.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center gap-3 px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-3xl">
                  <Box className="text-zinc-400" size={16} />
                  <span className="text-[11px] font-bold text-zinc-500 font-mono italic">/public/gemma-4/config.json</span>
                </div>
                <div className="flex items-center gap-3 px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-3xl">
                  <FileText className="text-zinc-400" size={16} />
                  <span className="text-[11px] font-bold text-zinc-500 font-mono italic">/public/gemma-4/tokenizer.json</span>
                </div>
              </div>

              <div className="pt-4 flex flex-col gap-3">
                <button
                  onClick={onClose}
                  className="w-full py-5 bg-darkDelegation text-white rounded-[28px] text-xs font-black uppercase tracking-[0.2em] hover:bg-black transition-all shadow-xl"
                >
                  Close
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
            </div>
          ) : isDownloading ? (
            <div className="py-10">
              <div className="flex justify-between items-end mb-4 px-2">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-indigo-500 mb-1">Mounting Neural Network</p>
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
                Mounting Neural Network into VRAM. Please wait.
              </p>
            </div>
          ) : !isModelReady ? (
            <>
              <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-[32px] flex items-center gap-4 mb-8">
                <ShieldCheck className="text-emerald-500 shrink-0" size={24} />
                <div>
                  <h4 className="text-sm font-black text-emerald-900 uppercase tracking-tight mb-0.5">Model Detected</h4>
                  <p className="text-[11px] text-emerald-700/80 font-medium">Local assets verified in public directory.</p>
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
                  <p className="text-[10px] text-zinc-400 font-medium font-mono lowercase">dtype: 4-bit q4</p>
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
                Gemma 4 has been successfully loaded into VRAM. Agents are now fully autonomous and offline.
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

export default GemmaBootModal;
