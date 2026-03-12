import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, RefreshCcw, X } from 'lucide-react';

interface ResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const ResetModal: React.FC<ResetModalProps> = ({ isOpen, onClose, onConfirm }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden border border-zinc-100"
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500">
                  <AlertTriangle size={24} />
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-zinc-100 rounded-full text-zinc-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <h3 className="text-2xl font-black text-zinc-900 mb-2 leading-tight">
                Reset Project?
              </h3>
              <p className="text-sm text-zinc-500 leading-relaxed mb-8">
                This will clear the current client brief, all tasks, logs, and conversation histories.
                The team will return to their starting positions and the project will revert to idle.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2"
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ResetModal;
