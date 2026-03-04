import React from 'react';
import { useAgencyStore } from '../store/agencyStore';
import { ScrollText } from 'lucide-react';

const ProjectView: React.FC = () => {
  const {
    clientBrief,
    phase,
    tasks
  } = useAgencyStore();

  const activeTasks = tasks.filter(t => t.status === 'in_progress');
  const doneTasks = tasks.filter(t => t.status === 'done');

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 bg-white/50">
      <div className="mb-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">Project Overview</p>
        <h2 className="text-xl font-black text-zinc-900 leading-tight">The Agency Mission</h2>
      </div>

      <div className="h-px bg-zinc-100 w-full mb-6" />

      {/* Brief */}
      <div className="mb-8">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 flex items-center gap-2">
          <ScrollText size={10} />
          Client Brief
        </p>
        <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-4">
          <p className="text-xs text-zinc-600 leading-relaxed font-medium italic">
            {clientBrief || "No active brief. Use simulation controls to start."}
          </p>
        </div>
      </div>

      {/* Phase status */}
      <div className="mb-8">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Stage</p>
        <div className="flex items-center gap-2">
           <div className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
             phase === 'working' ? 'bg-blue-500 text-white' :
             phase === 'done' ? 'bg-green-500 text-white' :
             'bg-zinc-100 text-zinc-400'
           }`}>
             <div className={`w-1.5 h-1.5 rounded-full ${phase === 'working' ? 'bg-white animate-pulse' : 'bg-white opacity-40'}`} />
             {phase}
           </div>
        </div>
      </div>

      {/* Stats / Progress */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-3">
          <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400 mb-1">In Progress</p>
          <p className="text-lg font-black text-blue-600">{activeTasks.length}</p>
        </div>
        <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-3">
          <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400 mb-1">Completed</p>
          <p className="text-lg font-black text-green-600">{doneTasks.length}</p>
        </div>
      </div>
    </div>
  );
};

export default ProjectView;
