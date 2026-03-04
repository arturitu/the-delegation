import { useAgencyStore } from '../store/agencyStore';
import { AgentFunctionCall } from './agencyService';
import { AGENTS } from '../data/agents';

export class ToolHandlerService {
  /**
   * Process a function call returned by an agent and update the store.
   * @param fn The function call to process
   * @param callerIndex The index of the agent making the call
   * @param scene Object containing methods to interact with the 3D scene
   * @returns true if the call was handled
   */
  static process(
    fn: AgentFunctionCall,
    callerIndex: number,
    scene: { setNpcWorking: (index: number, working: boolean) => void } | null
  ): boolean {
    const store = useAgencyStore.getState();

    switch (fn.name) {
      case 'propose_task': {
        const { agentIds, title, description, requiresApproval } = fn.args as {
          agentIds: number[];
          title: string;
          description: string;
          requiresApproval: boolean;
        };
        const task = store.addTask({
          title: title || 'New Task',
          description,
          assignedAgentIds: agentIds,
          status: 'scheduled',
          requiresClientApproval: requiresApproval ?? false,
        });
        store.addLogEntry({
          agentIndex: callerIndex,
          action: `proposed task "${title || description}" → assigned to ${agentIds.map(i => AGENTS[i]?.role).join(', ')}`,
          taskId: task.id,
        });
        // Transition to working phase on first task creation
        if (store.phase === 'briefing' || store.phase === 'idle') {
          store.setPhase('working');
        }
        return true;
      }

      case 'execute_work': {
        const { taskId } = fn.args as { taskId: string };
        store.updateTaskStatus(taskId, 'in_progress');
        store.addLogEntry({
          agentIndex: callerIndex,
          action: `started work on task`,
          taskId,
        });
        scene?.setNpcWorking(callerIndex, true);
        return true;
      }

      case 'request_client_approval': {
        const { taskId, question } = fn.args as { taskId: string; question: string };
        store.updateTaskStatus(taskId, 'on_hold');
        store.setPendingApproval(taskId);
        store.addLogEntry({
          agentIndex: callerIndex,
          action: `requested client approval — "${question}"`,
          taskId,
        });
        scene?.setNpcWorking(callerIndex, false);
        return true;
      }

      case 'complete_task': {
        const { taskId, output } = fn.args as { taskId: string; output: string };
        store.updateTaskStatus(taskId, 'done');
        store.setTaskOutput(taskId, output);
        store.addLogEntry({
          agentIndex: callerIndex,
          action: `completed task`,
          taskId,
        });
        scene?.setNpcWorking(callerIndex, false);
        return true;
      }

      case 'propose_subtask': {
        const { agentId, title, description } = fn.args as { agentId: number; title: string; description: string };
        const parentTask = store.tasks.find(
          (t) => t.assignedAgentIds.includes(callerIndex) && t.status === 'in_progress'
        );
        const sub = store.addTask({
          title: title || 'Subtask',
          description,
          assignedAgentIds: [agentId],
          status: 'scheduled',
          requiresClientApproval: false,
          parentTaskId: parentTask?.id,
        });
        store.addLogEntry({
          agentIndex: callerIndex,
          action: `proposed subtask for ${AGENTS[agentId]?.role} — "${title || description}"`,
          taskId: sub.id,
        });
        return true;
      }

      case 'notify_client_project_ready': {
        const { finalPrompt } = fn.args as { finalPrompt: string };
        store.setFinalOutput(finalPrompt);
        store.setPhase('done');
        store.addLogEntry({
          agentIndex: callerIndex,
          action: `delivered final prompt to client`,
        });
        return true;
      }

      default:
        console.warn(`[ToolHandler] Unknown function: ${fn.name}`);
        return false;
    }
  }
}
