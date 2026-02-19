
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  Fn,
  instanceIndex,
  storage,
  float,
  vec3,
  vec4,
  mat3,
  mat4,
  uint,
  If,
  Loop,
  uniform,
  atan,
  attribute,
  positionLocal,
  time,
  texture,
  sin,
  cos
} from 'three/tsl';
import { BoidsParams } from '../../types';

export class CharacterManager {
  private instanceCount = 100;
  private colors = ['#7EACEA', '#f472b6', '#fb7185', '#4ade80', '#fbbf24'];

  // Compute Buffers (GPU)
  private posAttribute: THREE.StorageInstancedBufferAttribute | null = null;
  private velAttribute: THREE.StorageInstancedBufferAttribute | null = null;
  private timeOffsetAttribute: THREE.InstancedBufferAttribute | null = null;
  private colorAttribute: THREE.InstancedBufferAttribute | null = null;
  private positionStorage: any;
  private velocityStorage: any;

  // CPU-side mirror of GPU positions (updated via GPU readback each frame)
  private debugPosArray: Float32Array | null = null;

  // Logic Nodes
  private computeNode: any;

  // Assets & Objects
  private instancedMesh: THREE.Mesh | null = null;
  private baseGeometry: THREE.BufferGeometry | null = null;
  private baseMaterial: THREE.MeshStandardMaterial | null = null;

  // Animation Data
  private bakedAnimationBuffer: THREE.StorageBufferAttribute | null = null;
  private numFrames = 0;
  private numBones = 0;
  private animationDuration = 0;

  // Uniforms
  private uSpeed = uniform(0.015);
  private uSeparationRadius = uniform(0.6);
  private uSeparationStrength = uniform(0.030);
  private uWorldSize = uniform(20.0);

  public isLoaded = false;

  constructor(private scene: THREE.Scene) {}

  public async load() {
    const loader = new GLTFLoader();
    try {
      const gltf = await loader.loadAsync('/models/character.glb');
      const model = gltf.scene;

      let skinnedMesh: THREE.SkinnedMesh | null = null;
      model.traverse((child) => {
        if ((child as any).isSkinnedMesh && !skinnedMesh) {
          skinnedMesh = child as THREE.SkinnedMesh;
        }
      });

      const clip = gltf.animations[1];
      if (!skinnedMesh || !clip) return;

      this.baseGeometry = skinnedMesh.geometry;
      this.baseMaterial = skinnedMesh.material as THREE.MeshStandardMaterial;

      this.bakeAnimation(skinnedMesh, clip, model);
      this.initInstances();
      this.isLoaded = true;
    } catch (err) {
      console.error("Failed to load character:", err);
    }
  }

  public setInstanceCount(count: number) {
    if (this.instanceCount === count) return;
    this.instanceCount = count;
    if (this.isLoaded) {
      this.cleanupInstances();
      this.initInstances();
    }
  }

  public updateBoidsParams(params: BoidsParams) {
    this.uSpeed.value = params.speed;
    this.uSeparationRadius.value = params.separationRadius;
    this.uSeparationStrength.value = params.separationStrength;
  }

  public updateWorldSize(size: number) {
    this.uWorldSize.value = size;
  }

  /**
   * Reads back the GPU position buffer to CPU.
   * Must be called after renderer.compute() each frame.
   * Returns the updated positions (1-frame GPU lag).
   */
  public async syncFromGPU(renderer: any): Promise<Float32Array | null> {
    if (!this.posAttribute) return null;
    try {
      const buffer = await renderer.getArrayBufferAsync(this.posAttribute);
      this.debugPosArray = new Float32Array(buffer);
    } catch {
      // WebGPU readback not available – fall back to stale data
    }
    return this.debugPosArray;
  }

  public update(delta: number, renderer: any) {
    if (this.computeNode) {
      renderer.compute(this.computeNode);
    }
  }

  private cleanupInstances() {
    if (this.instancedMesh) {
      this.scene.remove(this.instancedMesh);
      this.instancedMesh = null;
    }
    this.computeNode = null;
  }

  private initInstances() {
    if (!this.baseGeometry || !this.baseMaterial) return;

    const posArray = new Float32Array(this.instanceCount * 4);
    const velArray = new Float32Array(this.instanceCount * 4);
    const timeOffsetArray = new Float32Array(this.instanceCount);
    const colorArray = new Float32Array(this.instanceCount * 3);

    const tempColor = new THREE.Color();

    for (let i = 0; i < this.instanceCount; i++) {
      posArray[i * 4 + 0] = (Math.random() - 0.5) * 20;
      posArray[i * 4 + 2] = (Math.random() - 0.5) * 20;
      posArray[i * 4 + 3] = 1;

      velArray[i * 4 + 0] = (Math.random() - 0.5) * 0.1;
      velArray[i * 4 + 2] = (Math.random() - 0.5) * 0.1;

      timeOffsetArray[i] = Math.random() * 10;

      // Assign random color from array
      const hex = this.colors[Math.floor(Math.random() * this.colors.length)];
      tempColor.set(hex);
      colorArray[i * 3 + 0] = tempColor.r;
      colorArray[i * 3 + 1] = tempColor.g;
      colorArray[i * 3 + 2] = tempColor.b;
    }

    this.debugPosArray = new Float32Array(posArray); // seeded with initial positions, updated via GPU readback

    this.posAttribute = new THREE.StorageInstancedBufferAttribute(posArray, 4);
    this.velAttribute = new THREE.StorageInstancedBufferAttribute(velArray, 4);
    this.timeOffsetAttribute = new THREE.InstancedBufferAttribute(timeOffsetArray, 1);
    this.colorAttribute = new THREE.InstancedBufferAttribute(colorArray, 3);

    this.positionStorage = storage(this.posAttribute, 'vec4', this.instanceCount);
    this.velocityStorage = storage(this.velAttribute, 'vec4', this.instanceCount);

    this.initComputeNode();
    this.createInstancedMesh();
  }

  private initComputeNode() {
    this.computeNode = Fn(() => {
      const index = instanceIndex;

      const posElement = this.positionStorage.element(index);
      const velElement = this.velocityStorage.element(index);
      const pos = posElement.xyz.toVar();
      const vel = velElement.xyz.toVar();
      const accel = vec3(0).toVar();

      // World Boundary (Square)
      const halfSize = this.uWorldSize;
      If(pos.x.abs().greaterThan(halfSize).or(pos.z.abs().greaterThan(halfSize)), () => {
        accel.addAssign(pos.negate().normalize().mul(0.01));
      });

      // Separation
      Loop({ start: uint(0), end: uint(this.instanceCount), type: 'uint' }, ({ i }) => {
        const otherPos = this.positionStorage.element(i).xyz;
        const diff = pos.sub(otherPos);
        const dist = diff.length();
        If(dist.lessThan(this.uSeparationRadius).and(dist.greaterThan(0.01)), () => {
            accel.addAssign(diff.normalize().mul(this.uSeparationStrength));
        });
      });

      const newVel = vel.add(accel).toVar();
      const speed = newVel.length();
      If(speed.greaterThan(0.001), () => {
         newVel.assign(newVel.normalize().mul(this.uSpeed));
      }).Else(() => {
         newVel.assign(vec3(0, 0, this.uSpeed));
      });

      velElement.assign(vec4(newVel, 0.0));
      posElement.assign(vec4(pos.add(newVel), 1.0));

    })().compute(this.instanceCount);
  }

  private createInstancedMesh() {
    const instancedGeometry = new THREE.InstancedBufferGeometry();
    instancedGeometry.copy(this.baseGeometry as any);
    instancedGeometry.instanceCount = this.instanceCount;

    // Solo dejamos el atributo que NO se calcula en el Compute Shader
    if (this.timeOffsetAttribute) instancedGeometry.setAttribute('instanceTimeOffset', this.timeOffsetAttribute);
    if (this.colorAttribute) instancedGeometry.setAttribute('instanceColor', this.colorAttribute);

    const material = new THREE.MeshStandardNodeMaterial();
    material.roughness = 1;
    material.metalness = 0.25;

    const map = (this.baseMaterial as any).map;
    const instanceColor = attribute('instanceColor', 'vec3');

    if (map) {
      const texColor = texture(map);
      material.colorNode = vec4(texColor.rgb.mul(instanceColor), texColor.a);
    } else {
      material.colorNode = vec4(instanceColor, 1.0);
    }

    material.positionNode = this.createVertexNode();

    this.instancedMesh = new THREE.Mesh(instancedGeometry, material);
    this.instancedMesh.frustumCulled = false;
    this.instancedMesh.castShadow = true;
    this.instancedMesh.receiveShadow = true;
    this.scene.add(this.instancedMesh);
  }

  private createVertexNode() {
    return Fn(() => {
      const instancePos = this.positionStorage.element(instanceIndex).xyz;
      const instanceVel = this.velocityStorage.element(instanceIndex).xyz;
      const timeOffset = attribute('instanceTimeOffset');

      const angle = atan(instanceVel.z, instanceVel.x).negate().add(float(Math.PI / 2));
      const rotationMat = mat3(
        vec3(cos(angle), float(0), sin(angle).negate()),
        vec3(float(0), float(1), float(0)),
        vec3(sin(angle), float(0), cos(angle))
      );

      const finalPosition = positionLocal.toVar();

      if (this.bakedAnimationBuffer) {
        const animBuffer = storage(this.bakedAnimationBuffer, 'mat4', this.numFrames * this.numBones);
        const animTime = time.add(timeOffset);
        const t = animTime.div(float(this.animationDuration)).fract();
        const currentFrame = t.mul(float(this.numFrames)).toInt();
        const safeFrame = currentFrame.min(uint(this.numFrames - 1));

        const skinIndex = attribute('skinIndex');
        const skinWeight = attribute('skinWeight');
        const skinMat = mat4(0).toVar();

        const addInfluence = (boneIdxNode: any, weightNode: any) => {
            If(weightNode.greaterThan(0), () => {
              const address = safeFrame.mul(uint(this.numBones)).add(boneIdxNode.toInt());
              skinMat.addAssign(animBuffer.element(address).mul(weightNode));
           });
        };

        addInfluence(skinIndex.x, skinWeight.x);
        addInfluence(skinIndex.y, skinWeight.y);
        addInfluence(skinIndex.z, skinWeight.z);
        addInfluence(skinIndex.w, skinWeight.w);

        finalPosition.assign(skinMat.mul(vec4(positionLocal, 1.0)).xyz);
      }

      return rotationMat.mul(finalPosition).add(instancePos);
    })();
  }

  private bakeAnimation(mesh: THREE.SkinnedMesh, clip: THREE.AnimationClip, root: THREE.Object3D) {
    const mixer = new THREE.AnimationMixer(root);
    mixer.clipAction(clip).play();
    const skeleton = mesh.skeleton;
    this.animationDuration = clip.duration;
    this.numFrames = Math.ceil(clip.duration * 60);
    this.numBones = skeleton.bones.length;
    const data = new Float32Array(this.numFrames * this.numBones * 16);
    for (let f = 0; f < this.numFrames; f++) {
      mixer.setTime((f / this.numFrames) * clip.duration);
      root.updateMatrixWorld(true);
      skeleton.update();
      for (let b = 0; b < this.numBones; b++) {
        const i = (f * this.numBones + b) * 16;
        for (let k = 0; k < 16; k++) data[i + k] = skeleton.boneMatrices[b * 16 + k];
      }
    }
    this.bakedAnimationBuffer = new THREE.StorageBufferAttribute(data, 16);
  }

  public fadeToAction(name: string) {}
  public getCount() { return this.instanceCount; }

  /** Returns the current CPU-tracked positions buffer (vec4 stride). Updated each simulateOnCPU call. */
  public getCPUPositions(): Float32Array | null {
    return this.debugPosArray;
  }

  /** Returns the world position of a single character from the CPU buffer. */
  public getCPUPosition(index: number): THREE.Vector3 | null {
    if (!this.debugPosArray || index < 0 || index >= this.instanceCount) return null;
    const i = index * 4;
    return new THREE.Vector3(this.debugPosArray[i], this.debugPosArray[i + 1], this.debugPosArray[i + 2]);
  }

  public setColors(hexColors: string[]) {
    this.colors = hexColors;
    if (this.isLoaded) {
      this.cleanupInstances();
      this.initInstances();
    }
  }
}
