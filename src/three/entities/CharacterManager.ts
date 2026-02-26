
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
import { AgentBehavior, ExpressionKey } from '../../types';
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

  // Animation Data (walk = GOTO, idle = IDLE/FROZEN, talk = TALK)
  private bakedWalkBuffer: THREE.StorageBufferAttribute | null = null;
  private bakedIdleBuffer: THREE.StorageBufferAttribute | null = null;
  private bakedTalkBuffer: THREE.StorageBufferAttribute | null = null;
  private numWalkFrames = 0;
  private numIdleFrames = 0;
  private numTalkFrames = 0;
  private walkDuration = 0;
  private idleDuration = 0;
  private talkDuration = 0;
  private numBones = 0;

  // Uniforms
  private uSpeed = uniform(0.015);
  private uWorldSize = uniform(10.0);
  private worldSize = 10.0;

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

      const walkClip = gltf.animations[2];
      const talkClip = gltf.animations[1];
      const idleClip = gltf.animations[0];
      if (skinnedMeshes.length === 0 || !walkClip) return;

      this.meshData = skinnedMeshes.map(m => ({
        name: m.name,
        geometry: m.geometry,
        material: m.material as THREE.MeshStandardMaterial
      }));

      const firstMesh = skinnedMeshes[0];

      const walkData = this.bakeAnimation(firstMesh, walkClip, model);
      this.bakedWalkBuffer = walkData.buffer;
      this.numWalkFrames = walkData.numFrames;
      this.walkDuration = walkData.duration;
      this.numBones = walkData.numBones;

      if (idleClip) {
        const idleData = this.bakeAnimation(firstMesh, idleClip, model);
        this.bakedIdleBuffer = idleData.buffer;
        this.numIdleFrames = idleData.numFrames;
        this.idleDuration = idleData.duration;
      } else {
        this.bakedIdleBuffer = this.bakedWalkBuffer;
        this.numIdleFrames = this.numWalkFrames;
        this.idleDuration = this.walkDuration;
      }

      if (talkClip) {
        const talkData = this.bakeAnimation(firstMesh, talkClip, model);
        this.bakedTalkBuffer = talkData.buffer;
        this.numTalkFrames = talkData.numFrames;
        this.talkDuration = talkData.duration;
      } else {
        this.bakedTalkBuffer = this.bakedIdleBuffer;
        this.numTalkFrames = this.numIdleFrames;
        this.talkDuration = this.idleDuration;
      }
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

  public updateWorldSize(size: number) {
    this.uWorldSize.value = size;
    this.worldSize = size;
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
    const spawnRadius = this.worldSize;

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

    // Agent state buffer — player and NPCs start IDLE (0 = default)
    // Create BEFORE initComputeNode so the storage node is ready, and set
    // needsUpdate AFTER the attribute is constructed to force the initial upload.
    this.agentStateBuffer = new AgentStateBuffer(this.instanceCount);
    this.agentStateBuffer.setState(PLAYER_INDEX, AgentBehavior.IDLE);

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
      const agentData  = agentStorage.element(index);   // vec4: (wpX, 0, wpZ, state)
      const agentState = agentData.w;                   // float: 0=IDLE 1=FROZEN 2=GOTO 3=TALK

      const pos = posElement.xyz.toVar();

      // ── FROZEN or TALK (state ≈ 1 or 3) ──────────────────────
      const isFrozen = agentState.greaterThan(float(0.5)).and(agentState.lessThan(float(1.5)));
      const isTalk = agentState.greaterThan(float(2.5));
      const shouldStay = isFrozen.or(isTalk);

      If(shouldStay.or(agentState.greaterThan(float(1.5))), () => {

        // ── GOTO (state ≈ 2, between 1.5 and 2.5) ─────────────
        If(agentState.greaterThan(float(1.5)).and(agentState.lessThan(float(2.5))), () => {
          const waypointXZ = vec3(agentData.x, float(0), agentData.z);
          const toTarget = waypointXZ.sub(pos);
          const dist = toTarget.length();
          If(dist.greaterThan(float(0.2)), () => {
            const gotoVel = toTarget.normalize().mul(this.uSpeed.mul(3.0));
            velElement.assign(vec4(gotoVel, 0.0));
            posElement.assign(vec4(pos.add(gotoVel), 1.0));
          }).Else(() => {
            posElement.assign(vec4(pos, 1.0));
          });

        }).Else(() => {
          // FROZEN or TALK — hold position, use agentData.xz as facing direction if non-zero
          const facing = vec3(agentData.x, float(0), agentData.z);
          If(facing.length().greaterThan(float(0.001)), () => {
            velElement.assign(vec4(facing, 0.0));
          });
          posElement.assign(vec4(pos, 1.0));
        });

      }).Else(() => {
        // ── IDLE (state ≈ 0) ──────────────────────────────────
        // Keep current position, no velocity
        velElement.assign(vec4(0.0, 0.0, 0.0, 0.0));
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
      const timeOffset = attribute('instanceTimeOffset');

      // When velocity is zero (FROZEN/GOTO-arrived) atan(0,0) = NaN breaks the mesh.
      // Fall back to facing +Z so the rotation matrix is always valid.
      const isMoving = rawVel.length().greaterThan(float(0.001));
      const safeVel = vec3(0, 0, 1).toVar();
      If(isMoving, () => { safeVel.assign(rawVel); });

      const angle = atan(safeVel.z, safeVel.x).negate().add(float(Math.PI / 2));
      const rotationMat = mat3(
        vec3(cos(angle), float(0), sin(angle).negate()),
        vec3(float(0), float(1), float(0)),
        vec3(sin(angle), float(0), cos(angle))
      );

      const finalPosition = positionLocal.toVar();

      if (this.bakedWalkBuffer && this.bakedIdleBuffer && this.bakedTalkBuffer) {
        const walkBuffer = storage(this.bakedWalkBuffer, 'mat4', this.numWalkFrames * this.numBones);
        const idleBuffer = storage(this.bakedIdleBuffer, 'mat4', this.numIdleFrames * this.numBones);
        const talkBuffer = storage(this.bakedTalkBuffer, 'mat4', this.numTalkFrames * this.numBones);
        const agentState = this.agentStateBuffer!.storageNode.element(instanceIndex).w;

        const skinIndex = attribute('skinIndex');
        const skinWeight = attribute('skinWeight');
        const skinMat = mat4(0).toVar();

        // Animation selection based on AgentBehavior:
        // 0: IDLE, 1: FROZEN, 2: GOTO, 3: TALK
        const isIdleOrFrozen = agentState.lessThan(float(1.5));
        const isTalk = agentState.greaterThan(float(2.5));

        const buildSkinMat = (animBuf: any, numFrames: number, duration: number) => {
          const animTime = time.add(timeOffset);
          const t = animTime.div(float(duration)).fract();
          const currentFrame = t.mul(float(numFrames)).toInt();
          const safeFrame = currentFrame.min(uint(numFrames - 1));
          const addInfluence = (boneIdxNode: any, weightNode: any) => {
            If(weightNode.greaterThan(0), () => {
              const address = safeFrame.mul(uint(this.numBones)).add(boneIdxNode.toInt());
              skinMat.addAssign(animBuf.element(address).mul(weightNode));
            });
          };
          addInfluence(skinIndex.x, skinWeight.x);
          addInfluence(skinIndex.y, skinWeight.y);
          addInfluence(skinIndex.z, skinWeight.z);
          addInfluence(skinIndex.w, skinWeight.w);
        };

        If(isIdleOrFrozen, () => {
          buildSkinMat(idleBuffer, this.numIdleFrames, this.idleDuration);
        }).Else(() => {
          If(isTalk, () => {
            buildSkinMat(talkBuffer, this.numTalkFrames, this.talkDuration);
          }).Else(() => {
            buildSkinMat(walkBuffer, this.numWalkFrames, this.walkDuration);
          });
        });

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
      buffer: new THREE.StorageBufferAttribute(data, 16),
      numFrames,
      numBones,
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

  public getAgentState(index: number): number {
    if (!this.agentStateBuffer || index < 0 || index >= this.instanceCount) return 0;
    return this.agentStateBuffer.getState(index);
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
    if (this.agentStateBuffer) {
      if (isSpeaking) {
        const currentState = this.agentStateBuffer.getState(index);
        // Solo cambiamos el estado de animación a TALK si no se está moviendo (GOTO)
        if (currentState !== AgentBehavior.GOTO) {
          this.agentStateBuffer.setState(index, AgentBehavior.TALK);
        }
      } else {
        // Al dejar de hablar volvemos a IDLE si estábamos en estado TALK
        if (this.agentStateBuffer.getState(index) === AgentBehavior.TALK) {
          this.agentStateBuffer.setState(index, AgentBehavior.IDLE);
        }
      }
    }
  }

  public setColors(hexColors: string[]) {
    this.colors = hexColors;
    if (this.isLoaded) {
      this.cleanupInstances();
      this.initInstances();
    }
  }
}
