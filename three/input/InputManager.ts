import * as THREE from 'three/webgpu';

const PICK_RADIUS = 0.65; // world-space sphere radius for hit testing
const CHARACTER_Y_OFFSET = 0.9; // approximate center height of a character
const DRAG_THRESHOLD_PX = 4;

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
    private onSelect: (index: number | null) => void
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
    if (event.buttons !== 1) return;
    const dx = event.clientX - this.dragStartX;
    const dy = event.clientY - this.dragStartY;
    if ((dx * dx + dy * dy) > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
      this.isDragging = true;
    }
  }

  private handlePointerUp(event: PointerEvent) {
    if (event.button !== 0) return;
    if (this.isDragging) return;
    this.handleClick(event as MouseEvent);
  }

  private handleClick(event: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);

    const positions = this.getPositions();
    const count = this.getCount();
    if (!positions || count === 0) return;

    const ray = this.raycaster.ray;
    let closestT = Infinity;
    let closestIdx: number | null = null;

    for (let i = 0; i < count; i++) {
      const cx = positions[i * 4];
      const cy = positions[i * 4 + 1] + CHARACTER_Y_OFFSET;
      const cz = positions[i * 4 + 2];

      // Ray-sphere intersection
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

    if (closestIdx !== null && closestIdx === this.selectedIndex) {
      // Click on already selected → deselect
      this.selectedIndex = null;
      this.onSelect(null);
    } else if (closestIdx !== null) {
      this.selectedIndex = closestIdx;
      this.onSelect(closestIdx);
    } else {
      // Click on empty space → deselect
      if (this.selectedIndex !== null) {
        this.selectedIndex = null;
        this.onSelect(null);
      }
    }
  }

  public dispose() {
    this.canvas.removeEventListener('pointerdown', this.boundPointerDown);
    this.canvas.removeEventListener('pointermove', this.boundPointerMove);
    this.canvas.removeEventListener('pointerup', this.boundPointerUp);
  }
}
