import { AlertTriangle, RefreshCcw, X } from 'lucide-react';
import React from 'react';

interface ResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const ResetModal: React.FC<ResetModalProps> = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-white/60 backdrop-blur-sm"
      />
      <div
        className="relative w-full max-w-md bg-white rounded-4xl shadow-2xl overflow-hidden border border-zinc-100"
      >
        <div className="px-8 pt-8 pb-10">
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 shadow-sm shadow-red-100">
                <AlertTriangle size={32} strokeWidth={2.5} />
              </div>
              <h3 className="text-2xl font-black text-darkDelegation leading-tight">
                Start New Project?
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-100 rounded-full text-zinc-400 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <p className="text-sm text-zinc-500 leading-relaxed mb-8">
            This will clear the current user brief, all tasks, logs, and conversation histories.
            The team will return to their starting positions and the project will revert to idle.
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="w-full py-4 bg-darkDelegation hover:bg-darkDelegation text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <RefreshCcw size={14} />
              Yes, Reset Everything
            </button>
            <button
              onClick={onClose}
              className="w-full py-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetModal;
