import { useAgencyStore, type Task } from './store/agencyStore';
import { useStore } from './store/useStore';
import {
  callAgent,
  callOrchestrator,
  callBoardroomAgent,
  type AgentFunctionCall,
} from './agencyService';
import { ToolHandlerService } from './toolHandlerService';
import { getAgent } from '../data/agents';
import { getActiveAgentSet } from './store/agencyStore';

const ORCHESTRATOR_INDEX = 1;

const randomBetween = (min: number, max: number) =>
  Math.random() * (max - min) + min;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * AgencyOrchestrator - Pure logic class for managing agent tasks and project lifecycle.
 * Part of the 'Integration' pillar.
 */
export class AgencyOrchestrator {
  private runningAgents = new Set<number>();
  private sceneManager: any = null;

  constructor() {}

  /** Sets the scene manager reference for visual feedback. */
  public setSceneManager(scene: any) {
    this.sceneManager = scene;
  }

  /**
   * Main work loop - Checks state and dispatches new work.
   * Should be called periodically or on state changes.
   */
  public async tick() {
    const store = useAgencyStore.getState();

    // 1. Check if all tasks done or project is empty
    await this.checkAllTasksDone();

    // 2. Dispatch scheduled tasks
    const scheduledTasks = store.tasks.filter((t) => t.status === 'scheduled');
    for (const task of scheduledTasks) {
      this.dispatchTask(task);
    }
  }

  private processFunctionCall(fn: AgentFunctionCall, callerIndex: number): boolean {
    const handled = ToolHandlerService.process(fn, callerIndex, this.sceneManager);

    if (handled && fn.name === 'complete_task') {
      this.runningAgents.delete(callerIndex);
      this.sceneManager?.kickNpcDriver(callerIndex);
      setTimeout(() => this.checkAllTasksDone(), 100);
    }

    if (handled && fn.name === 'request_client_approval') {
      this.runningAgents.delete(callerIndex);
    }

    return handled;
  }

  private async checkAllTasksDone() {
    const store = useAgencyStore.getState();
    if (store.phase !== 'working' && store.phase !== 'awaiting_approval') return;

    const hasTasks = store.tasks.length > 0;
    const allDone = hasTasks && store.tasks.every((t) => t.status === 'done');
    const isEmptyWorking = !hasTasks && (store.phase === 'working' || store.phase === 'awaiting_approval');

    if (!allDone && !isEmptyWorking) return;
    if (store.finalOutput) return;
    if (this.runningAgents.has(ORCHESTRATOR_INDEX)) return;

    this.runningAgents.add(ORCHESTRATOR_INDEX);

    try {
      const outputs = store.tasks
        .filter((t) => t.output)
        .map((t) => `[${t.description}]\n${t.output}`)
        .join('\n\n---\n\n');

      const prompt = hasTasks
        ? `All tasks are completed. Team outputs:\n\n${outputs}\n\nNow assemble the final prompt for the client and call notify_client_project_ready.`
        : `All tasks have been removed. Sum up and call notify_client_project_ready.`;

      const response = await callOrchestrator(prompt);
      if (response.functionCalls) {
        for (const fn of response.functionCalls) {
          this.processFunctionCall(fn, ORCHESTRATOR_INDEX);
        }
      }
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') console.error('[Orchestrator] final delivery error:', err);
    } finally {
      this.runningAgents.delete(ORCHESTRATOR_INDEX);
    }
  }

  private async dispatchTask(task: Task) {
    const agents = task.assignedAgentIds;
    if (agents.some((id) => this.runningAgents.has(id))) return;

    if (agents.length === 1) {
      const agentIndex = agents[0];
      this.runningAgents.add(agentIndex);
      this.runSingleAgentTask(task, agentIndex);
    } else if (agents.length > 1) {
      agents.forEach((id) => this.runningAgents.add(id));
      this.runBoardroomTask(task);
    }
  }

  private async runSingleAgentTask(task: Task, agentIndex: number) {
    await sleep(randomBetween(1500, 3000));
    const store = useAgencyStore.getState();
    store.updateTaskStatus(task.id, 'in_progress');
    this.sceneManager?.setNpcWorking(agentIndex, true);

    try {
      const response = await callAgent({
        agentIndex,
        userMessage: `Task [${task.id}]: "${task.description}". Propose plan then complete_task.`,
      });
      if (response.functionCalls) {
        for (const fn of response.functionCalls) {
          this.processFunctionCall(fn, agentIndex);
        }
      }
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') console.error(`[Orchestrator] agent ${agentIndex} task error:`, err);
    } finally {
      this.runningAgents.delete(agentIndex);
    }
  }

  private async runBoardroomTask(task: Task) {
    const store = useAgencyStore.getState();
    const agents = task.assignedAgentIds;

    // Arrival logic
    await new Promise<void>((resolve) => {
      let arrived = 0;
      agents.forEach((idx) => this.sceneManager?.moveNpcToSpawn(idx, () => {
        arrived++;
        if (arrived >= agents.length) resolve();
      }));
    });

    store.updateTaskStatus(task.id, 'in_progress');
    try {
      for (const agentIndex of agents) {
        const response = await callBoardroomAgent(agentIndex, task.id, `Boardroom session for ${task.description}.`);
        if (response.functionCalls) {
          for (const fn of response.functionCalls) {
            this.processFunctionCall(fn, agentIndex);
          }
        }
        await sleep(1500);
      }
      store.updateTaskStatus(task.id, 'done');
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') console.error('[Orchestrator] boardroom error:', err);
    } finally {
      agents.forEach((idx) => this.runningAgents.delete(idx));
    }
  }
}
