export const APP_EVENTS = {
  START_CHAT: 'agency:start_chat',
  END_CHAT: 'agency:end_chat',
  TASK_STARTED: 'agency:task_started',
  TASK_COMPLETED: 'agency:task_completed',
};

/**
 * Simple Event Bus for cross-pilar communication (Pilar 5: Integration)
 */
class EventBus extends EventTarget {
  emit(eventName: string, detail: any = {}) {
    this.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  on(eventName: string, callback: (e: any) => void) {
    this.addEventListener(eventName, callback);
    return () => this.removeEventListener(eventName, callback);
  }
}

export const eventBus = new EventBus();
