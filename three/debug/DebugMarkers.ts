import * as THREE from 'three/webgpu';

const CHARACTER_Y_OFFSET = 0.9;

/**
 * Renders small instanced spheres at the CPU-simulated positions.
 * Use this to visually compare CPU vs GPU boids divergence.
 * Orange = CPU simulation position.
 * The actual characters are driven by the GPU compute shader.
 */
export class DebugMarkers {
  private mesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();

  constructor(private scene: THREE.Scene, maxCount: number) {
    const geo = new THREE.SphereGeometry(0.18, 6, 5);
    const mat = new THREE.MeshBasicNodeMaterial({ color: 0xff6600 });
    mat.transparent = true;
    mat.opacity = 0.85;
    mat.depthTest = false; // always visible, even through geometry

    this.mesh = new THREE.InstancedMesh(geo, mat, maxCount);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 999;
    scene.add(this.mesh);
  }

  public update(positions: Float32Array | null, count: number, visible: boolean) {
    this.mesh.visible = visible;
    if (!visible || !positions) return;

    this.mesh.count = count;
    for (let i = 0; i < count; i++) {
      const x = positions[i * 4];
      const z = positions[i * 4 + 2];
      this.dummy.position.set(x, CHARACTER_Y_OFFSET, z);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  public dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
  }
}
