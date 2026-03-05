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

        const assignedRoles = agentIds
          .map(i => AGENTS.find(a => a.index === i)?.role || `Agent #${i}`)
          .join(', ');

        store.addLogEntry({
          agentIndex: callerIndex,
          action: `proposed task "${title || description}" → assigned to ${assignedRoles}`,
          taskId: task.id,
        });
        // Transition to working phase on first task creation
        if (store.phase === 'briefing' || store.phase === 'idle') {
          store.setPhase('working');
        }
        return true;
      }

      case 'request_client_approval': {
        const { taskId, question } = fn.args as { taskId: string; question: string };
        store.updateTaskStatus(taskId, 'on_hold');
        store.addLogEntry({
          agentIndex: callerIndex,
          action: `requested client approval — "${question}"`,
          taskId,
        });
        scene?.setNpcWorking(callerIndex, false);

        // Transition to working phase if not already there (prevents UI being stuck in briefing or idle)
        if (store.phase !== 'working' && store.phase !== 'done') {
           store.setPhase('working');
        }

        // Auto-end chat only for worker agents to release inspector.
        // DO NOT end chat for Orquestrator (Manager) as they are the primary point of contact during briefing/management.
        const ORCHESTRATOR_INDEX = 1;
        if (callerIndex !== ORCHESTRATOR_INDEX) {
          if (scene && 'endChat' in scene) {
            (scene as any).endChat();
          }
        }

        // Move agent to spawn (waiting area) since they are on hold
        if (scene && 'moveNpcToSpawn' in scene) {
          (scene as any).moveNpcToSpawn(callerIndex);
        }
        return true;
      }

      case 'receive_client_approval': {
        const { taskId } = fn.args as { taskId: string };

        // Validate task existence
        const task = store.tasks.find(t => t.id === taskId);
        if (!task) {
          console.warn(`[ToolHandler] Agent tried to approve non-existent task: ${taskId}`);
          return false;
        }

        store.updateTaskStatus(taskId, 'in_progress');
        store.addLogEntry({
          agentIndex: callerIndex,
          action: `received client approval - resuming work`,
          taskId,
        });

        scene?.setNpcWorking(callerIndex, true);

        // If the agent was in the boardroom waiting, return them
        if (scene && 'returnNpcFromBoardroom' in scene) {
          (scene as any).returnNpcFromBoardroom(callerIndex);
        }

        // Auto-end chat from the agent side (only for workers)
        const ORCHESTRATOR_INDEX = 1;
        if (callerIndex !== ORCHESTRATOR_INDEX && scene && 'endChat' in scene) {
          (scene as any).endChat();
        }
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

        const agentRole = AGENTS.find(a => a.index === agentId)?.role || `Agent #${agentId}`;

        store.addLogEntry({
          agentIndex: callerIndex,
          action: `proposed subtask for ${agentRole} — "${title || description}"`,
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
      case 'update_client_brief': {
        const { brief } = fn.args as { brief: string };
        store.setClientBrief(brief);
        store.addLogEntry({
          agentIndex: callerIndex,
          action: `updated client brief — "${brief.slice(0, 50)}..."`,
        });
        return true;
      }
      default:
        console.warn(`[ToolHandler] Unknown function: ${fn.name}`);
        return false;
    }
  }
}
