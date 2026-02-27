import { AnimationName, CharacterStateDef, CharacterStateKey, ICharacterDriver } from '../../types';

// ── STATE MAP ────────────────────────────────────────────────
/**
 * Declarative definition of every character state.
 * To add a new state: add an entry here. No logic changes needed elsewhere.
 *
 *  loop: true  → animation loops; state persists until an explicit transition.
 *  loop: false → animation plays once, then auto-transitions to `nextState`.
 *  interruptible: false → the state machine will queue the new state and apply
 *                         it once the current animation finishes.
 */
export const STATE_MAP: Record<CharacterStateKey, CharacterStateDef> = {
  idle:        { animation: AnimationName.IDLE,        expression: 'idle',      loop: true,  interruptible: true },
  walk:        { animation: AnimationName.WALK,                                 loop: true,  interruptible: true },
  talk:        { animation: AnimationName.TALK,        expression: 'neutral',   loop: true,  interruptible: true },
  listen:      { animation: AnimationName.LISTEN,      expression: 'listening', loop: true,  interruptible: true },
  sit_down:    { animation: AnimationName.SIT_DOWN,                             loop: false, nextState: 'sit_idle', interruptible: false },
  sit_idle:    { animation: AnimationName.SIT_IDLE,    expression: 'idle',      loop: true,  interruptible: true },
  sit_work:    { animation: AnimationName.SIT_WORK,    expression: 'idle',      loop: true,  interruptible: true },
  look_around: { animation: AnimationName.LOOK_AROUND, expression: 'surprised', loop: false, nextState: 'idle',    interruptible: true },
  happy:       { animation: AnimationName.HAPPY,       expression: 'happy',     loop: false, nextState: 'idle',    interruptible: true },
  sad:         { animation: AnimationName.SAD,         expression: 'sad',       loop: false, nextState: 'idle',    interruptible: true },
  pick:        { animation: AnimationName.PICK,                                 loop: false, nextState: 'idle',    interruptible: false },
  wave:        { animation: AnimationName.WAVE,                                 loop: false, nextState: 'idle',    interruptible: true },
};

// ── STATE MACHINE ────────────────────────────────────────────

export class CharacterStateMachine {
  /** Current state key per agent index. */
  private currentState: CharacterStateKey[] = [];
  /** Countdown timer for non-looping states (seconds remaining). */
  private stateTimer: number[] = [];
  /** Queued state to apply once current non-interruptible state finishes. */
  private pendingState: (CharacterStateKey | null)[] = [];

  constructor(private readonly count: number) {
    for (let i = 0; i < count; i++) {
      this.currentState[i] = 'idle';
      this.stateTimer[i] = 0;
      this.pendingState[i] = null;
    }
  }

  // ── Public API ───────────────────────────────────────────────

  /** Request a state transition. If the current state is non-interruptible, the request is queued. */
  public transition(index: number, newState: CharacterStateKey, driver: ICharacterDriver): void {
    const current = STATE_MAP[this.currentState[index]];

    if (!current.interruptible) {
      // Queue the request; it will be applied when the current animation ends.
      this.pendingState[index] = newState;
      return;
    }

    this._applyState(index, newState, driver);
  }

  /** Returns the current state key for an agent. */
  public getState(index: number): CharacterStateKey {
    return this.currentState[index];
  }

  /**
   * Called every frame. Processes timers for non-looping animations
   * and fires auto-transitions when they expire.
   */
  public update(delta: number, driver: ICharacterDriver): void {
    for (let i = 0; i < this.count; i++) {
      const def = STATE_MAP[this.currentState[i]];
      if (def.loop) continue;

      this.stateTimer[i] -= delta;
      if (this.stateTimer[i] <= 0) {
        const next = this.pendingState[i] ?? def.nextState ?? 'idle';
        this.pendingState[i] = null;
        this._applyState(i, next, driver);
      }
    }
  }

  // ── Internal ─────────────────────────────────────────────────

  private _applyState(index: number, key: CharacterStateKey, driver: ICharacterDriver): void {
    const def = STATE_MAP[key];
    if (!def) {
      console.warn(`[CharacterStateMachine] Unknown state: "${key}"`);
      return;
    }

    this.currentState[index] = key;

    // Set animation via driver
    driver.setAnimation(index, def.animation);

    // Set expression if defined for this state
    if (def.expression !== undefined) {
      driver.setExpression(index, def.expression);
    }

    // Start timer for non-looping states
    if (!def.loop) {
      const duration = def.durationOverride ?? driver.getAnimationDuration(def.animation);
      this.stateTimer[index] = duration > 0 ? duration : 1.0;
    }
  }
}
