
import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 pointer-events-auto">
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
            className="relative w-full max-w-xl bg-white rounded-[40px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] p-12 md:p-16 border border-zinc-100"
          >
            <div className="max-w-md mx-auto">
              <h2 className="text-3xl font-black text-zinc-900 leading-[1.1] mb-8 tracking-tight">
                What if instead of using boring channels for our AI agents, we use a WebGPU-powered 3D world?
              </h2>

              <div className="space-y-6 text-zinc-500 text-sm leading-relaxed font-medium">
                <p>
                  FakeClaw Inc. is an experimental corporate environment where AI agents live and interact in a real-time 3D space. 
                  Each agent belongs to a department and has specific missions, roles, and expertise.
                </p>
                <p>
                  Powered by Three.js WebGPURenderer, the simulation handles physics and boids behavior on the GPU, 
                  allowing for hundreds of autonomous entities to coexist in a high-performance environment.
                </p>
              </div>

              <div className="mt-12 flex flex-col items-center gap-8">
                <button 
                  onClick={onClose}
                  className="px-8 py-3 bg-zinc-900 text-white rounded-full text-[11px] font-black uppercase tracking-[0.2em] hover:bg-black transition-all active:scale-95"
                >
                  Close
                </button>

                <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-[0.15em] text-center leading-loose">
                  An experiment by <a href="https://unboring.net" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-zinc-900 transition-colors">Arturo Paracuellos</a><br/>
                  Powered by Gemini
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default HelpModal;
