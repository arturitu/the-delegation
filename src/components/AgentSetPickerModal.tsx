import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, Users } from 'lucide-react';
import { AGENT_SETS, AgentSet } from '../data/agents';
import { useAgencyStore } from '../store/agencyStore';
import { useSceneManager } from '../three/SceneContext';
import { abortAllCalls } from '../services/agencyService';
import ResetModal from './ResetModal';

interface AgentSetPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasActiveProject?: boolean;
}

const AgentSetCard: React.FC<{
  set: AgentSet;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ set, isSelected, onSelect }) => {
  const npcAgents = set.agents.filter((a) => !a.isPlayer);
  const accent = set.color;

  return (
    <button
      onClick={onSelect}
      className={`relative w-full text-left rounded-2xl border-2 p-4 transition-all duration-200 ${
        isSelected
          ? 'border-zinc-900 bg-zinc-50 shadow-lg'
          : 'border-zinc-100 bg-white hover:border-zinc-200 hover:shadow-sm'
      }`}
    >
      {/* Top row: color square + name + type */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg shrink-0 shadow-sm"
            style={{ backgroundColor: accent }}
          />
          <div>
            <p className="text-xs font-black text-zinc-900 leading-tight">{set.companyName}</p>
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest leading-none mt-0.5">
              {set.companyType}
            </p>
          </div>
        </div>
        <div
          className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 transition-all ${
            isSelected ? 'border-zinc-900 bg-zinc-900' : 'border-zinc-200 bg-white'
          }`}
        />
      </div>

      {/* Description */}
      <p className="text-[10px] text-zinc-500 leading-relaxed mb-3">{set.companyDescription}</p>

      {/* Agent role chips */}
      <div className="flex flex-wrap gap-1">
        {npcAgents.map((agent) => (
          <span
            key={agent.index}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wide"
            style={{ borderColor: `${agent.color}40`, color: agent.color, backgroundColor: `${agent.color}10` }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: agent.color }}
            />
            {agent.role}
          </span>
        ))}
      </div>
    </button>
  );
};

const AgentSetPickerModal: React.FC<AgentSetPickerModalProps> = ({
  isOpen,
  onClose,
  hasActiveProject = false,
}) => {
  const { selectedAgentSetId, setAgentSet } = useAgencyStore();
  const [pendingSetId, setPendingSetId] = useState<string>(selectedAgentSetId);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const scene = useSceneManager();

  const selectedSet = AGENT_SETS.find((s) => s.id === pendingSetId) ?? AGENT_SETS[0];
  const isChangingSet = pendingSetId !== selectedAgentSetId;

  const handleConfirm = () => {
    if (isChangingSet && hasActiveProject) {
      setIsResetConfirmOpen(true);
      return;
    }
    executeSwitch();
  };

  const executeSwitch = () => {
    // 1. Cancel all in-flight LLM calls
    abortAllCalls();
    // 2. Reset the 3D scene (teleport agents, clear chat)
    scene?.resetScene();
    // 3. Switch agent set + reset project state in one atomic update
    setAgentSet(pendingSetId);
    setIsResetConfirmOpen(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[32px] shadow-2xl overflow-hidden border border-zinc-100 max-h-[90vh] flex flex-col"
            >
            {/* Header */}
            <div className="px-8 pt-8 pb-6 shrink-0">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center text-white">
                  <Users size={22} />
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-zinc-100 rounded-full text-zinc-400 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <h3 className="text-2xl font-black text-zinc-900 mb-1 leading-tight">Choose Your Team</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Pick the company you want to simulate. This will reset any active project.
              </p>

              {/* Warning banner if project is active */}
              {hasActiveProject && (
                <div className="mt-4 flex items-center gap-2.5 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                  <p className="text-[11px] font-medium text-amber-700">
                    Switching teams will clear the current brief, all tasks, logs, and conversation histories.
                  </p>
                </div>
              )}
            </div>

            {/* Cards grid */}
            <div className="px-8 overflow-y-auto flex-1">
              <div className="flex flex-col gap-3 pb-6">
                {AGENT_SETS.map((set) => (
                  <AgentSetCard
                    key={set.id}
                    set={set}
                    isSelected={pendingSetId === set.id}
                    onSelect={() => setPendingSetId(set.id)}
                  />
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 pb-8 shrink-0 border-t border-zinc-100 pt-5">
              <button
                onClick={handleConfirm}
                className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Users size={14} />
                {isChangingSet
                  ? `Switch to ${selectedSet.companyName}`
                  : `Start with ${selectedSet.companyName}`}
              </button>
            </div>
          </motion.div>
        </div>

        <ResetModal
          isOpen={isResetConfirmOpen}
          onClose={() => setIsResetConfirmOpen(false)}
          onConfirm={executeSwitch}
        />
        </>
      )}
    </AnimatePresence>
  );
};

export default AgentSetPickerModal;
