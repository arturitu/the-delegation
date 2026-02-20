import * as THREE from 'three/webgpu';
import { PLAYER_INDEX } from '../../data/agents';
import { useStore } from '../../store/useStore';

const PICK_RADIUS = 0.65; // world-space sphere radius for hit testing
const CHARACTER_Y_OFFSET = 0.9; // approximate center height of a character
const DRAG_THRESHOLD_PX = 4;
const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // y=0

export class InputManager {
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;
  private dragStartX = 0;
  private dragStartY = 0;
  private isDragging = false;

  public selectedIndex: number | null = null;

  constructor(
    private canvas: HTMLElement,
    private camera: THREE.PerspectiveCamera,
    private getPositions: () => Float32Array | null,
    private getCount: () => number,
    private onSelect: (index: number | null) => void,
    private onWaypoint: (x: number, z: number) => void,
    private onHover: (index: number | null, pos: { x: number; y: number } | null) => void,
  ) {
    this.boundPointerDown = this.handlePointerDown.bind(this);
    this.boundPointerMove = this.handlePointerMove.bind(this);
    this.boundPointerUp = this.handlePointerUp.bind(this);
    canvas.addEventListener('pointerdown', this.boundPointerDown);
    canvas.addEventListener('pointermove', this.boundPointerMove);
    canvas.addEventListener('pointerup', this.boundPointerUp);
  }

  private handlePointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.isDragging = false;
  }

  private handlePointerMove(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    if (event.buttons === 1) {
      const dx = event.clientX - this.dragStartX;
      const dy = event.clientY - this.dragStartY;
      if ((dx * dx + dy * dy) > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
        this.isDragging = true;
      }
    }

    // Detect hover - only if not dragging
    if (!this.isDragging) {
      const hoveredIdx = this.getAgentAtPointer();
      
      // If an NPC is selected, only allow hovering that specific NPC
      const effectiveHoverIdx = (this.selectedIndex !== null && hoveredIdx !== this.selectedIndex) 
        ? null 
        : hoveredIdx;

      if (effectiveHoverIdx !== null) {
        this.canvas.style.cursor = 'pointer';
        
        // Project 3D position to 2D for the bubble
        const positions = this.getPositions();
        if (positions) {
          const worldPos = new THREE.Vector3(
            positions[effectiveHoverIdx * 4],
            positions[effectiveHoverIdx * 4 + 1] + CHARACTER_Y_OFFSET + 0.4, // Reduced bubble height
            positions[effectiveHoverIdx * 4 + 2]
          );
          worldPos.project(this.camera);
          const x = (worldPos.x * 0.5 + 0.5) * rect.width;
          const y = (worldPos.y * -0.5 + 0.5) * rect.height;
          this.onHover(effectiveHoverIdx, { x, y });
        }
      } else {
        // Check floor intersection for pointer cursor
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const target = new THREE.Vector3();
        const intersectsFloor = this.raycaster.ray.intersectPlane(FLOOR_PLANE, target);

        if (intersectsFloor) {
          const { worldSize } = useStore.getState();
          if (Math.abs(target.x) <= worldSize && Math.abs(target.z) <= worldSize) {
            this.canvas.style.cursor = 'pointer';
          } else if (this.canvas.style.cursor === 'pointer') {
            this.canvas.style.cursor = 'auto';
          }
        } else if (this.canvas.style.cursor === 'pointer') {
          this.canvas.style.cursor = 'auto';
        }
        this.onHover(null, null);
      }
    } else {
      this.onHover(null, null);
    }
  }

  private getAgentAtPointer(): number | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const positions = this.getPositions();
    const count = this.getCount();
    if (!positions || count === 0) return null;

    const ray = this.raycaster.ray;
    let closestT = Infinity;
    let closestIdx: number | null = null;

    for (let i = 0; i < count; i++) {
      const cx = positions[i * 4];
      const cy = positions[i * 4 + 1] + CHARACTER_Y_OFFSET;
      const cz = positions[i * 4 + 2];

      const ocx = ray.origin.x - cx;
      const ocy = ray.origin.y - cy;
      const ocz = ray.origin.z - cz;

      const halfB = ocx * ray.direction.x + ocy * ray.direction.y + ocz * ray.direction.z;
      const c = ocx * ocx + ocy * ocy + ocz * ocz - PICK_RADIUS * PICK_RADIUS;
      const discriminant = halfB * halfB - c;

      if (discriminant < 0) continue;

      const t = -halfB - Math.sqrt(discriminant);
      if (t > 0 && t < closestT) {
        closestT = t;
        closestIdx = i;
      }
    }
    return closestIdx;
  }

  private handlePointerUp(event: PointerEvent) {
    if (event.button !== 0) return;
    if (this.isDragging) return;
    this.handleClick(event as unknown as MouseEvent);
  }

  private handleClick(event: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const closestIdx = this.getAgentAtPointer();

    if (closestIdx !== null) {
      if (closestIdx === PLAYER_INDEX) {
        // Click on the player → deselect any NPC (go back to default)
        this.selectedIndex = null;
        this.onSelect(null);
      } else if (closestIdx === this.selectedIndex) {
        // Click on already-selected NPC → deselect
        this.selectedIndex = null;
        this.onSelect(null);
      } else {
        // Click on a new NPC → select it
        this.selectedIndex = closestIdx;
        this.onSelect(closestIdx);
      }
    } else {
      // Click missed all characters
      if (this.selectedIndex !== null) {
        // If an NPC was selected, deselect it first
        this.selectedIndex = null;
        this.onSelect(null);
      } else {
        // If nothing was selected, move the player
        const target = new THREE.Vector3();
        this.raycaster.setFromCamera(this.pointer, this.camera);
        if (this.raycaster.ray.intersectPlane(FLOOR_PLANE, target)) {
          this.onWaypoint(target.x, target.z);
        }
      }
    }
  }

  public dispose() {
    this.canvas.removeEventListener('pointerdown', this.boundPointerDown);
    this.canvas.removeEventListener('pointermove', this.boundPointerMove);
    this.canvas.removeEventListener('pointerup', this.boundPointerUp);
  }
}
