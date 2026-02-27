
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { NavMeshManager } from '../pathfinding/NavMeshManager';
import { PoiManager } from './PoiManager';

export class WorldManager {
  private office: THREE.Group | null = null;

  constructor(
    private scene: THREE.Scene,
    private navMesh: NavMeshManager,
    private poiManager: PoiManager
  ) {}

  public async load(): Promise<void> {
    const loader = new GLTFLoader();
    const officeGltf = await loader.loadAsync('/models/office.glb');
    this.office = officeGltf.scene;
    this.scene.add(this.office);

    // Extract NavMesh and setup
    this.office.traverse((child) => {
      if ((child as any).isMesh) {
        const mesh = child as THREE.Mesh;
        const name = mesh.name.toLowerCase();

        if (name.includes('navmesh')) {
          this.navMesh.loadFromGeometry(mesh.geometry);
          mesh.visible = false; // Hide the navmesh geometry itself
        } else {
          mesh.receiveShadow = true;
          mesh.castShadow = true;

          // Apply specific material for WebGPU shadow compatibility as requested
          if (mesh.material) {
            const oldMat = mesh.material as THREE.MeshStandardMaterial;
            mesh.material = new THREE.MeshStandardNodeMaterial({
              color: oldMat.color,
              map: oldMat.map,
              roughness: 1,
              metalness: 0.35,
            });
          }
        }
      }
    });

    // Extract Points of Interest
    this.poiManager.loadFromGlb(this.office);
  }

  public getOffice(): THREE.Group | null {
    return this.office;
  }
}
