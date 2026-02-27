
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
  cos,
  uv
} from 'three/tsl';
import { ExpressionKey, AnimationName, AgentBehavior } from '../../types';
import { AgentStateBuffer } from '../behavior/AgentStateBuffer';
import { ExpressionBuffer } from '../behavior/ExpressionBuffer';
import { AGENTS, PLAYER_INDEX } from '../../data/agents';

export class CharacterManager {
  private instanceCount = AGENTS.length;

  // Compute Buffers (GPU)
  private posAttribute: THREE.StorageInstancedBufferAttribute | null = null;
  private velAttribute: THREE.StorageInstancedBufferAttribute | null = null;
  private timeOffsetAttribute: THREE.InstancedBufferAttribute | null = null;
  private colorAttribute: THREE.InstancedBufferAttribute | null = null;
  private positionStorage: any;
  private velocityStorage: any;

  // Agent state buffer (CPU+GPU): waypoint + behavior state per instance
  private agentStateBuffer: AgentStateBuffer | null = null;

  // Expression buffer (CPU+GPU): eye and mouth UV offsets per instance
  private expressionBuffer: ExpressionBuffer | null = null;

  // CPU-side mirror of GPU positions (updated via GPU readback each frame)
  private debugPosArray: Float32Array | null = null;

  // Logic Nodes
  private computeNode: any;

  // Assets & Objects
  private instancedMeshes: THREE.Mesh[] = [];
  private meshData: { name: string; geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial }[] = [];
  private colors: string[] | null = null;

  // Animation Data
  private animationsMeta: { [key: string]: { offset: number; numFrames: number; duration: number; index: number } } = {};
  private bakedAnimationsBuffer: THREE.StorageBufferAttribute | null = null;
  private metaBuffer: THREE.StorageBufferAttribute | null = null;
  private numBones = 0;

  // Uniforms
  private uSpeed = uniform(0.015);

  public isLoaded = false;

  constructor(private scene: THREE.Scene) {}

  public async load() {
    const loader = new GLTFLoader();
    try {
      const gltf = await loader.loadAsync('/models/character.glb');
      const model = gltf.scene;

      const skinnedMeshes: THREE.SkinnedMesh[] = [];
      model.traverse((child) => {
        if ((child as any).isSkinnedMesh) {
          skinnedMeshes.push(child as THREE.SkinnedMesh);
        }
      });

      if (skinnedMeshes.length === 0) {
        console.warn("CharacterManager: No skinned meshes found.");
        return;
      }

      this.meshData = skinnedMeshes.map(m => ({
        name: m.name,
        geometry: m.geometry,
        material: m.material as THREE.MeshStandardMaterial
      }));

      const firstMesh = skinnedMeshes[0];
      this.numBones = firstMesh.skeleton.bones.length;

      const animations = gltf.animations;
      const animNames = Object.values(AnimationName);
      const bakedDataList: Float32Array[] = [];
      const metaArray = new Float32Array(animNames.length * 4);
      let currentOffset = 0;

      animNames.forEach((name, i) => {
        let clip = animations.find(a => a.name === name);
        // Fallback for essential animations
        if (!clip) {
          if (name === AnimationName.IDLE) clip = animations[0];
          else clip = animations.find(a => a.name === AnimationName.IDLE) || animations[0];
        }

        const baked = this.bakeAnimation(firstMesh, clip!, model);
        bakedDataList.push(baked.data);

        this.animationsMeta[name] = {
          offset: currentOffset,
          numFrames: baked.numFrames,
          duration: baked.duration,
          index: i
        };

        metaArray[i * 4 + 0] = currentOffset;
        metaArray[i * 4 + 1] = baked.numFrames;
        metaArray[i * 4 + 2] = baked.duration;
        metaArray[i * 4 + 3] = 0;

        currentOffset += baked.numFrames * this.numBones;
      });

      const totalSize = bakedDataList.reduce((acc, data) => acc + data.length, 0);
      const combinedData = new Float32Array(totalSize);
      let seek = 0;
      for (const data of bakedDataList) {
        combinedData.set(data, seek);
        seek += data.length;
      }

      this.bakedAnimationsBuffer = new THREE.StorageBufferAttribute(combinedData, 16);
      this.metaBuffer = new THREE.StorageBufferAttribute(metaArray, 4);

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
    if (this.expressionBuffer) {
      this.expressionBuffer.update(delta);
    }
    if (this.computeNode) {
      renderer.compute(this.computeNode);
    }
  }

  private cleanupInstances() {
    for (const mesh of this.instancedMeshes) {
      this.scene.remove(mesh);
    }
    this.instancedMeshes = [];
    this.computeNode = null;
    this.expressionBuffer = null;
  }

  private initInstances() {
    if (this.meshData.length === 0) return;

    const posArray = new Float32Array(this.instanceCount * 4);
    const velArray = new Float32Array(this.instanceCount * 4);
    const timeOffsetArray = new Float32Array(this.instanceCount);
    const colorArray = new Float32Array(this.instanceCount * 3);

    const tempColor = new THREE.Color();
    const spawnRadius = 8; // Default spawn area

    for (let i = 0; i < this.instanceCount; i++) {
      const agent = AGENTS[i] || AGENTS[0];
      const colorOverride = this.colors && this.colors[i] ? this.colors[i] : agent.color;

      if (i === PLAYER_INDEX) {
        // Player spawns slightly offset from center so they're clearly visible
        posArray[i * 4 + 0] = 0;
        posArray[i * 4 + 2] = 0;
        posArray[i * 4 + 3] = 1;
        tempColor.set(colorOverride);
      } else {
        posArray[i * 4 + 0] = (Math.random() - 0.5) * spawnRadius * 2;
        posArray[i * 4 + 2] = (Math.random() - 0.5) * spawnRadius * 2;
        posArray[i * 4 + 3] = 1;
        velArray[i * 4 + 0] = (Math.random() - 0.5) * 0.1;
        velArray[i * 4 + 2] = (Math.random() - 0.5) * 0.1;
        tempColor.set(colorOverride);
      }

      timeOffsetArray[i] = Math.random() * 10;
      colorArray[i * 3 + 0] = tempColor.r;
      colorArray[i * 3 + 1] = tempColor.g;
      colorArray[i * 3 + 2] = tempColor.b;
    }

    this.debugPosArray = new Float32Array(posArray);

    this.posAttribute = new THREE.StorageInstancedBufferAttribute(posArray, 4);
    this.velAttribute = new THREE.StorageInstancedBufferAttribute(velArray, 4);
    this.timeOffsetAttribute = new THREE.InstancedBufferAttribute(timeOffsetArray, 1);
    this.colorAttribute = new THREE.InstancedBufferAttribute(colorArray, 3);

    this.positionStorage = storage(this.posAttribute, 'vec4', this.instanceCount);
    this.velocityStorage = storage(this.velAttribute, 'vec4', this.instanceCount);

    // Physics & state buffer — all start at mode 0 (IDLE)
    this.agentStateBuffer = new AgentStateBuffer(this.instanceCount);
    for (let i = 0; i < this.instanceCount; i++) {
        this.setPhysicsMode(i, AgentBehavior.IDLE);
        this.setAnimation(i, AnimationName.IDLE);
    }

    this.expressionBuffer = new ExpressionBuffer(this.instanceCount);

    this.initComputeNode();
    this.createInstancedMesh();
  }

  private initComputeNode() {
    const agentStorage = this.agentStateBuffer!.storageNode;

    this.computeNode = Fn(() => {
      const index = instanceIndex;

      const posElement = this.positionStorage.element(index);
      const velElement = this.velocityStorage.element(index);
      const agentData  = agentStorage.element(index);   // vec4: (wpX, anim, wpZ, state)
      const agentState = agentData.w;                   // float: 0=IDLE 1=GOTO

      const pos = posElement.xyz.toVar();

      // ── Physical Logic ──────────────────────────────────────

      If(agentState.greaterThan(float(0.5)), () => {
        // ── GOTO (state == 1) ──────────────────────────────────
        const waypointXZ = vec3(agentData.x, float(0), agentData.z);
        const toTarget = waypointXZ.sub(pos);
        const dist = toTarget.length();
        If(dist.greaterThan(float(0.2)), () => {
          const gotoVel = toTarget.normalize().mul(this.uSpeed.mul(3.0));
          velElement.assign(vec4(gotoVel, 0.0));
          posElement.assign(vec4(pos.add(gotoVel), 1.0));
        }).Else(() => {
          posElement.assign(vec4(pos, 1.0));
          // Note: CPU will detect proximity and transition to IDLE
        });

      }).Else(() => {
        // ── IDLE (0) ──────────────────────────────────────────
        // Hold position. Use agentData.xz as facing direction if non-zero.
        const facing = vec3(agentData.x, float(0), agentData.z);

        If(facing.length().greaterThan(float(0.001)), () => {
          velElement.assign(vec4(facing, 0.0));
        }).Else(() => {
          velElement.assign(vec4(0, 0, 0, 0));
        });

        posElement.assign(vec4(pos, 1.0));
      });

    })().compute(this.instanceCount);
  }

  private createInstancedMesh() {
    for (const { name, geometry, material: baseMaterial } of this.meshData) {
      const instancedGeometry = new THREE.InstancedBufferGeometry();
      instancedGeometry.copy(geometry as any);
      instancedGeometry.instanceCount = this.instanceCount;

      // Solo dejamos el atributo que NO se calcula en el Compute Shader
      if (this.timeOffsetAttribute) instancedGeometry.setAttribute('instanceTimeOffset', this.timeOffsetAttribute);
      if (this.colorAttribute) instancedGeometry.setAttribute('instanceColor', this.colorAttribute);

      const material = new THREE.MeshStandardNodeMaterial();
      material.roughness = 1;
      material.metalness = 0.25;

      const instanceColor = attribute('instanceColor', 'vec3');
      const map = (baseMaterial as any).map;

      const expressionData = this.expressionBuffer!.storageNode.element(instanceIndex);
      const isEyes = name.toLowerCase().includes('eyes');
      const isMouth = name.toLowerCase().includes('mouth');

      if (isEyes) {
        material.uvNode = uv().add(expressionData.xy);
      } else if (isMouth) {
        material.uvNode = uv().add(expressionData.zw);
      }

      // Solo coloreamos el mesh cuyo nombre sea 'body'
      if (name.toLowerCase().includes('body')) {
        if (map) {
          const texColor = texture(map);
          material.colorNode = vec4(texColor.rgb.mul(instanceColor), texColor.a);
        } else {
          material.colorNode = vec4(instanceColor, 1.0);
        }
      } else {
        // Los otros respetan la transparencia original de su mapa PNG
        material.transparent = true;
        if (map) {
          const texColor = isEyes || isMouth ? texture(map, material.uvNode) : texture(map);
          material.colorNode = texColor; // Usa el color y el canal alfa original de la textura
        } else {
          material.opacityNode = float(0);
        }
      }

      const vertexNode = this.createVertexNode();
      material.positionNode = vertexNode;
      // (material as any).castShadowPositionNode = vertexNode;

      const instancedMesh = new THREE.Mesh(instancedGeometry, material);
      instancedMesh.frustumCulled = false;
      instancedMesh.castShadow = true;
      instancedMesh.receiveShadow = true;
      this.scene.add(instancedMesh);
      this.instancedMeshes.push(instancedMesh);
    }
  }

  private createVertexNode() {
    return Fn(() => {
      const instancePos = this.positionStorage.element(instanceIndex).xyz;
      const rawVel = this.velocityStorage.element(instanceIndex).xyz;
      const agentState = this.agentStateBuffer!.storageNode.element(instanceIndex);
      const timeOffset = attribute('instanceTimeOffset');

      // 1. Determine local rotation (facing)
      const isMoving = rawVel.length().greaterThan(float(0.001));
      const facing = vec3(0, 0, 1).toVar(); // Default: Forward

      If(isMoving, () => {
        facing.assign(rawVel);
      }).Else(() => {
        // If IDLE, use waypoint vector as facing if provided
        const waypoint = vec3(agentState.x, 0, agentState.z);
        If(waypoint.length().greaterThan(float(0.001)), () => {
          facing.assign(waypoint);
        });
      });

      const angle = atan(facing.z, facing.x).negate().add(float(Math.PI / 2));
      const rotationMat = mat3(
        vec3(cos(angle), float(0), sin(angle).negate()),
        vec3(float(0), float(1), float(0)),
        vec3(sin(angle), float(0), cos(angle))
      );

      const finalPosition = positionLocal.toVar();

      if (this.bakedAnimationsBuffer && this.metaBuffer) {
        const animBuffer = storage(this.bakedAnimationsBuffer, 'mat4', this.bakedAnimationsBuffer.count);
        const metaStorage = storage(this.metaBuffer, 'vec4', this.metaBuffer.count);

        const agentData = this.agentStateBuffer!.storageNode.element(instanceIndex);
        const animIndex = agentData.y.toUint();

        const meta = metaStorage.element(animIndex);
        const animOffset = uint(meta.x);
        const numFrames = uint(meta.y);
        const duration = float(meta.z);

        const animTime = time.add(timeOffset);
        const t = animTime.div(duration).fract();
        const currentFrame = t.mul(numFrames.toFloat()).toUint();
        const safeFrame = currentFrame.min(numFrames.sub(uint(1)));

        const skinIndex = attribute('skinIndex');
        const skinWeight = attribute('skinWeight');
        const skinMat = mat4(0).toVar();

        const addInfluence = (boneIdxNode: any, weightNode: any) => {
          If(weightNode.greaterThan(0), () => {
            const address = animOffset.add(safeFrame.mul(uint(this.numBones))).add(boneIdxNode.toUint());
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
    const duration = clip.duration;
    const numFrames = Math.ceil(duration * 60);
    const numBones = skeleton.bones.length;
    const data = new Float32Array(numFrames * numBones * 16);
    for (let f = 0; f < numFrames; f++) {
      mixer.setTime((f / numFrames) * duration);
      root.updateMatrixWorld(true);
      skeleton.update();
      for (let b = 0; b < numBones; b++) {
        const i = (f * numBones + b) * 16;
        for (let k = 0; k < 16; k++) data[i + k] = skeleton.boneMatrices[b * 16 + k];
      }
    }
    return {
      data,
      numFrames,
      duration,
    };
  }

  public getCount() { return this.instanceCount; }

  /** Exposes the agent state buffer so BehaviorManager can read/write states. */
  public getAgentStateBuffer(): AgentStateBuffer | null {
    return this.agentStateBuffer;
  }

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

  public setPhysicsMode(index: number, mode: AgentBehavior) {
    if (!this.agentStateBuffer || index < 0 || index >= this.instanceCount) return;
    this.agentStateBuffer.setState(index, mode);
  }

  public getAgentState(index: number): AgentBehavior {
    if (!this.agentStateBuffer || index < 0 || index >= this.instanceCount) return AgentBehavior.IDLE;
    return this.agentStateBuffer.getState(index) as AgentBehavior;
  }

  public setAnimation(index: number, name: AnimationName) {
    if (this.agentStateBuffer && index >= 0 && index < this.instanceCount) {
      const meta = this.animationsMeta[name];
      if (meta) {
        this.agentStateBuffer.setAnimation(index, meta.index);
      }
    }
  }

  public getAnimationIndex(index: number): number {
    if (!this.agentStateBuffer || index < 0 || index >= this.instanceCount) return 0;
    return this.agentStateBuffer.getAnimation(index);
  }

  public getAnimationMeta(name: AnimationName) {
    return this.animationsMeta[name];
  }

  /** Returns the baked clip duration in seconds. Returns 1.0 if the animation is not found. */
  public getAnimationDuration(name: AnimationName): number {
    return this.animationsMeta[name]?.duration ?? 1.0;
  }

  public setExpression(index: number, name: ExpressionKey) {
    if (this.expressionBuffer) {
      this.expressionBuffer.setExpression(index, name);
    }
  }

  public setSpeaking(index: number, isSpeaking: boolean) {
    if (this.expressionBuffer) {
      this.expressionBuffer.setSpeaking(index, isSpeaking);
    }
    // Note: External logic should handle TALK/IDLE animations
  }

  public setColors(hexColors: string[]) {
    this.colors = hexColors;
    if (this.isLoaded) {
      this.cleanupInstances();
      this.initInstances();
    }
  }
}
