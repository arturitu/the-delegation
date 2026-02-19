
import React, { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';

const DebugPanel: React.FC = () => {
  const {
    performance,
    isDebugOpen,
    instanceCount,
    setInstanceCount,
    boidsParams,
    setBoidsParams,
    debugPositions,
    worldSize,
    setWorldSize
  } = useStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !debugPositions) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear background
    ctx.fillStyle = '#f4f4f5'; // zinc-100
    ctx.fillRect(0, 0, w, h);

    // Draw boundary (World Size)
    // Map world size to canvas. If worldSize is 20 (radius), total width is 40.
    // We map max range of ~60 to canvas width
    const scale = w / 100; // fit ~50 radius

    // Draw center
    ctx.strokeStyle = '#e4e4e7';
    ctx.beginPath();
    ctx.moveTo(w/2, 0);
    ctx.lineTo(w/2, h);
    ctx.moveTo(0, h/2);
    ctx.lineTo(w, h/2);
    ctx.stroke();

    // Draw World Boundary Square
    ctx.strokeStyle = '#d4d4d8';
    ctx.setLineDash([5, 5]);
    const size = worldSize * scale * 2;
    ctx.strokeRect(w/2 - size/2, h/2 - size/2, size, size);
    ctx.setLineDash([]);

    // Draw boids
    ctx.fillStyle = '#ef4444'; // red-500
    const count = debugPositions.length / 4;

    for (let i = 0; i < count; i++) {
      const x = debugPositions[i * 4 + 0];
      const z = debugPositions[i * 4 + 2];

      const cx = (x * scale) + (w / 2);
      const cy = (z * scale) + (h / 2);

      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();
    }

  }, [debugPositions, worldSize]);

  if (!isDebugOpen) return null;

  return (
    <div className="fixed top-24 right-8 w-80 bg-white/80 backdrop-blur-2xl rounded-2xl border border-black/5 shadow-2xl p-5 pointer-events-auto text-zinc-900 animate-in fade-in slide-in-from-right-4 duration-300 overflow-y-auto max-h-[85vh] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:display-none">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">System Performance</h2>
        <div className={`h-2 w-2 rounded-full ${performance.fps > 50 ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
      </div>

      <div className="space-y-4">
        {/* FPS Indicator */}
        <div className="flex items-end justify-between">
          <span className="text-sm font-bold text-zinc-500">Real-time FPS</span>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black tabular-nums tracking-tighter">{performance.fps}</span>
            <span className="text-[10px] font-bold text-zinc-400 uppercase">fps</span>
          </div>
        </div>

        {/* Meter bar simple */}
        <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-700 ease-out ${performance.fps > 55 ? 'bg-emerald-500' : 'bg-amber-500'}`}
            style={{ width: `${Math.min((performance.fps / 60) * 100, 100)}%` }}
          />
        </div>

        {/* Boids Simulation Visualization */}
        <div className="pt-4 border-t border-black/5">
           <div className="flex justify-between items-center mb-2">
             <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Behavior Logic (CPU)</span>
           </div>
           <canvas
             ref={canvasRef}
             width={250}
             height={250}
             className="w-full bg-zinc-100 rounded-lg border border-zinc-200"
           />
           <p className="text-[9px] text-zinc-400 mt-1">Real-time CPU mirror. Dashed line is world boundary.</p>
        </div>

        {/* World Config */}
        <div className="pt-4 border-t border-black/5">
           <div className="flex justify-between items-center mb-2">
             <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">World Radius</span>
             <span className="text-xs font-bold text-zinc-800 tabular-nums">{worldSize}m</span>
           </div>
           <input
             type="range"
             min="10"
             max="50"
             step="1"
             value={worldSize}
             onChange={(e) => setWorldSize(parseInt(e.target.value))}
             className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-900"
           />
        </div>

        {/* Boids Parameters */}
         <div className="pt-4 border-t border-black/5 space-y-3">
           <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Boids Config</p>

           <div>
             <div className="flex justify-between text-[10px] font-bold text-zinc-500 mb-1">
               <span>Speed</span>
               <span>{boidsParams.speed.toFixed(3)}</span>
             </div>
             <input type="range" min="0.01" max="0.2" step="0.001"
               value={boidsParams.speed}
               onChange={(e) => setBoidsParams({ speed: parseFloat(e.target.value) })}
               className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-900"
             />
           </div>

           <div>
             <div className="flex justify-between text-[10px] font-bold text-zinc-500 mb-1">
               <span>Separation Radius</span>
               <span>{boidsParams.separationRadius.toFixed(1)}</span>
             </div>
             <input type="range" min="0.1" max="5.0" step="0.1"
               value={boidsParams.separationRadius}
               onChange={(e) => setBoidsParams({ separationRadius: parseFloat(e.target.value) })}
               className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-900"
             />
           </div>

           <div>
             <div className="flex justify-between text-[10px] font-bold text-zinc-500 mb-1">
               <span>Separation Strength</span>
               <span>{boidsParams.separationStrength.toFixed(3)}</span>
             </div>
             <input type="range" min="0.01" max="0.2" step="0.01"
               value={boidsParams.separationStrength}
               onChange={(e) => setBoidsParams({ separationStrength: parseFloat(e.target.value) })}
               className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-900"
             />
           </div>
        </div>

        {/* Instance Control */}
        <div className="pt-4 border-t border-black/5">
           <div className="flex justify-between items-center mb-2">
             <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Instance Count</span>
             <span className="text-xs font-bold text-zinc-800 tabular-nums">{instanceCount}</span>
           </div>
           <input
             type="range"
             min="10"
             max="2000"
             step="10"
             value={instanceCount}
             onChange={(e) => setInstanceCount(parseInt(e.target.value))}
             className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-900"
           />
        </div>

        {/* Renderer Info */}
        <div className="pt-4 border-t border-black/5">
          <div className="bg-zinc-50 rounded-xl p-4">
            <span className="text-[10px] font-black uppercase text-zinc-400 block mb-3">Renderer Details</span>
            <div className="grid grid-cols-2 gap-4">
              <StatItem label="Draw Calls" value={performance.drawCalls} />
              <StatItem label="Triangles" value={`${(performance.triangles / 1000).toFixed(1)}k`} />
              <StatItem label="Geometries" value={performance.geometries} />
              <StatItem label="Textures" value={performance.textures} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatItem = ({ label, value, subValue }: { label: string, value: string | number, subValue?: string }) => (
  <div className="flex flex-col">
    <span className="text-[10px] font-bold text-zinc-400 uppercase leading-none mb-1">{label}</span>
    <div className="flex items-baseline gap-1">
      <span className="text-sm font-black tabular-nums text-zinc-800">{value}</span>
      {subValue && <span className="text-[8px] font-bold text-zinc-300">{subValue}</span>}
    </div>
  </div>
);

export default DebugPanel;
