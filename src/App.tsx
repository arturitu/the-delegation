/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SceneManager } from './simulation/SceneManager';
import { SceneContext } from './simulation/SceneContext';
import { useCoreOrchestrator } from './integration/hooks/useCoreOrchestrator';
import { useCoreStore } from './integration/store/coreStore';
import Header from './interface/Header';
import InspectorPanel from './interface/InspectorPanel';
import { ActionLogPanel } from './interface/ActionLogPanel';
import { KanbanPanel } from './interface/KanbanPanel';
import { FinalOutputModal } from './interface/FinalOutputModal';
import SimulationView from './interface/SimulationView';

/** Mounts inside SceneContext so useSceneManager() is available. */
function CoreOrchestrator() {
  useCoreOrchestrator();
  return null;
}

const App: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<SceneManager | null>(null);
  const [sceneManager, setSceneManager] = useState<SceneManager | null>(null);
  const { isLogOpen, isKanbanOpen, setIsResizing } = useCoreStore();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [kanbanHeight, setKanbanHeight] = useState(220);

  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, [setIsResizing]);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, [setIsResizing]);

  const resize = useCallback((e: MouseEvent) => {
    if (useCoreStore.getState().isResizing) {
      const windowHeight = window.innerHeight;
      const newHeight = windowHeight - e.clientY;
      const minHeight = windowHeight * 0.2;
      const maxHeight = windowHeight * 0.5;
      if (newHeight >= minHeight && newHeight <= maxHeight) {
        setKanbanHeight(newHeight);
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  useEffect(() => {
    if (canvasRef.current && !managerRef.current) {
      const manager = new SceneManager(canvasRef.current);
      managerRef.current = manager;
      setSceneManager(manager);
    }

    return () => {
      if (managerRef.current) {
        managerRef.current.dispose();
        managerRef.current = null;
        setSceneManager(null);
      }
    };
  }, []);

  return (
    <SceneContext.Provider value={sceneManager}>
      <CoreOrchestrator />
      <div className="w-screen h-screen bg-white overflow-hidden flex flex-col">
        {/* Top: Header */}
        {!isFullscreen && <Header />}

        <div className="flex-1 flex flex-row min-h-0 min-w-0 overflow-hidden">
          {/* Left: Log panel */}
          {isLogOpen && !isFullscreen && <ActionLogPanel />}

          {/* Center: canvas + kanban drawer stacked */}
          <div className="relative flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-zinc-50">
            <SimulationView canvasRef={canvasRef} isFullscreen={isFullscreen} setIsFullscreen={setIsFullscreen} />

            {/* Resize Bar */}
            {isKanbanOpen && !isFullscreen && (
              <div
                className={`h-2 hover:h-2 bg-transparent hover:bg-zinc-200 border-t border-black/5 transition-colors cursor-row-resize z-30 flex items-center justify-center group shrink-0 ${useCoreStore.getState().isResizing ? 'bg-zinc-300' : ''}`}
                onMouseDown={startResizing}
              >
                <div className="w-12 h-1 bg-zinc-300 rounded-full group-hover:bg-zinc-400" />
              </div>
            )}

            {isKanbanOpen && !isFullscreen && <KanbanPanel height={kanbanHeight} />}
          </div>

          {/* Right: Inspector sidebar */}
          {!isFullscreen && <InspectorPanel />}
        </div>

        {/* Final output — fixed viewport overlay */}
        <FinalOutputModal />
      </div>
    </SceneContext.Provider>
  );
};

export default App;

