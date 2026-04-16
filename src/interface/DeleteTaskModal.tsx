import { Trash2, X } from 'lucide-react';
import React from 'react';

interface DeleteTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  taskTitle?: string;
}

const DeleteTaskModal: React.FC<DeleteTaskModalProps> = ({ isOpen, onClose, onConfirm, taskTitle }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-110 flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-white/60 backdrop-blur-[2px]"
      />
      <div
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden border border-zinc-100"
      >
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
              <Trash2 size={20} />
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-zinc-100 rounded-full text-zinc-400 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <h3 className="text-lg font-bold text-darkDelegation mb-1.5 leading-tight">
            Delete Task?
          </h3>
          <p className="text-[13px] text-zinc-500 leading-relaxed mb-6">
            Are you sure you want to delete {taskTitle ? <span className="font-semibold text-zinc-700">"{taskTitle}"</span> : "this task"}? This action cannot be undone.
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 text-sm font-bold text-zinc-500 hover:bg-zinc-50 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="flex-1 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors shadow-sm shadow-red-200"
            >
              Delete Task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteTaskModal;
