
import { Engine } from './core/Engine';
import { Stage } from './core/Stage';
import { CharacterManager } from './entities/CharacterManager';
import { InputManager } from './input/InputManager';
import { useStore } from '../store/useStore';

export class SceneManager {
  private engine: Engine;
  private stage: Stage;
  private characters: CharacterManager;

  private inputManager: InputManager | null = null;
  private selectedIndex: number | null = null;

  private frameCount = 0;
  private lastTime = 0;
  private unsubs: (() => void)[] = [];
  private isDisposed = false;

  constructor(container: HTMLElement) {
    this.engine = new Engine(container);
    this.stage = new Stage(this.engine.renderer.domElement);
    this.characters = new CharacterManager(this.stage.scene);
    this.init();
  }

  private async init() {
    await this.engine.init();
    if (this.isDisposed) return;
    await this.characters.load();
    if (this.isDisposed) return;

    const state = useStore.getState();

    // Initial sync
    this.characters.setInstanceCount(state.instanceCount);
    this.characters.updateBoidsParams(state.boidsParams);
    this.characters.updateWorldSize(state.worldSize);
    this.stage.updateDimensions(state.worldSize);

    this.engine.renderer.setAnimationLoop(this.animate.bind(this));
    window.addEventListener('resize', this.onResize.bind(this));

    this.inputManager = new InputManager(
      this.engine.renderer.domElement,
      this.stage.camera,
      () => this.characters.getCPUPositions(),
      () => this.characters.getCount(),
      (index) => { this.selectedIndex = index; }
    );

    // Subscriptions
    const sub1 = useStore.subscribe((state) => {
      this.characters.fadeToAction(state.currentAction);
    });

    const sub2 = useStore.subscribe((state, prevState) => {
      if (state.instanceCount !== prevState.instanceCount) {
        this.characters.setInstanceCount(state.instanceCount);
      }
      // Update Uniforms when params change
      if (state.boidsParams !== prevState.boidsParams) {
        this.characters.updateBoidsParams(state.boidsParams);
      }

      // Update World Size
      if (state.worldSize !== prevState.worldSize) {
        this.characters.updateWorldSize(state.worldSize);
        this.stage.updateDimensions(state.worldSize);
      }
    });

    this.unsubs.push(sub1, sub2);
  }

  private onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.engine.onResize(w, h);
    this.stage.onResize(w, h);
  }

  private animate() {
    this.engine.timer.update();
    const delta = this.engine.timer.getDelta();
    const time = this.engine.timer.getElapsed();

    this.stage.update();

    // 1. GPU Update
    this.characters.update(delta, this.engine.renderer);

    // 2. GPU → CPU readback (async, 1-frame lag). Keeps debugPosArray in sync with the compute shader.
    //    Used for picking, camera follow, and the debug canvas/markers.
    const { isDebugOpen } = useStore.getState();
    this.characters.syncFromGPU(this.engine.renderer).then((positions) => {
      if (!positions) return;
      if (isDebugOpen) {
        useStore.getState().setDebugPositions(new Float32Array(positions));
      }
    });

    // 3. Camera follow selected character
    if (this.selectedIndex !== null) {
      const pos = this.characters.getCPUPosition(this.selectedIndex);
      this.stage.setFollowTarget(pos);
    } else {
      this.stage.setFollowTarget(null);
    }

    this.engine.render(this.stage.scene, this.stage.camera);

    this.updateStats(time);
  }

  private updateStats(time: number) {
    this.frameCount++;
    if (this.frameCount >= 20) {
      const fps = Math.round(20 / (time - this.lastTime));
      const info = this.engine.renderer.info;
      const count = this.characters.getCount();

      useStore.getState().updatePerformance({
        fps,
        drawCalls: info.render.drawCalls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        entities: count
      });

      this.frameCount = 0;
      this.lastTime = time;
    }
  }

  public dispose() {
    this.isDisposed = true;
    this.unsubs.forEach(unsub => unsub());
    window.removeEventListener('resize', this.onResize);
    this.inputManager?.dispose();
    this.engine.dispose();
    if (this.stage.controls) this.stage.controls.dispose();
  }
}
