/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { SceneManager } from './three/SceneManager';
import { SceneContext } from './three/SceneContext';
import UIOverlay from './components/UIOverlay';
import { useAgencyOrchestrator } from './hooks/useAgencyOrchestrator';

/** Mounts inside SceneContext so useSceneManager() is available. */
function AgencyOrchestrator() {
  useAgencyOrchestrator();
  return null;
}

const App: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<SceneManager | null>(null);
  const [sceneManager, setSceneManager] = useState<SceneManager | null>(null);

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
      <AgencyOrchestrator />
      <div className="relative w-screen h-screen bg-white overflow-hidden">
        {/* Three.js Container */}
        <div ref={canvasRef} className="absolute inset-0 w-full h-full" />

        {/* UI Layer */}
        <UIOverlay />
      </div>
    </SceneContext.Provider>
  );
};

export default App;

