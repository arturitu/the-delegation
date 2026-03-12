import { useEffect, useRef } from 'react'
import { useSceneManager } from '../../simulation/SceneContext'
import { useCoreStore, type Task } from '../store/coreStore'
import { useUiStore } from '../store/uiStore'
import {
  callAgent,
  callOrchestrator,
  callBoardroomAgent,
  type AgentFunctionCall,
} from '../coreService'
import { ToolHandlerService } from '../toolHandlerService'
import { getAgent } from '../../data/agents'
import { getActiveAgentSet } from '../store/coreStore'

// ── Constants ─────────────────────────────────────────────────
const ORCHESTRATOR_INDEX = 1 // Orchestrator

const randomBetween = (min: number, max: number) =>
  Math.random() * (max - min) + min

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// ─────────────────────────────────────────────────────────────
export function useCoreOrchestrator() {
  const scene = useSceneManager()
  const sceneRef = useRef(scene)
  useEffect(() => { sceneRef.current = scene }, [scene])

  /** Agents currently being processed — prevents double-dispatch. */
  const runningAgents = useRef(new Set<number>())

  /**
   * Wrapper for tool handler to include local context.
   */
  const processFunctionCall = (fn: AgentFunctionCall, callerIndex: number): boolean => {
    const handled = ToolHandlerService.process(fn, callerIndex, sceneRef.current)

    // Additional side effects specific to the orchestrator hook
    if (handled && fn.name === 'complete_task') {
      runningAgents.current.delete(callerIndex)
      // Kick the NPC driver so the agent immediately wanders away from the work desk
      sceneRef.current?.kickNpcDriver(callerIndex)
      setTimeout(() => {
        checkAllTasksDone()
      }, 100)
    }

    // When an agent requests approval, it stops working — release from runningAgents
    // so it won't block re-dispatch once the user approves.
    if (handled && fn.name === 'request_client_approval') {
      runningAgents.current.delete(callerIndex)
    }

    return handled
  }

  // ── Check if all tasks done → trigger AM to wrap up ──────────
  const checkAllTasksDone = async () => {
    const store = useCoreStore.getState()
    if (store.phase !== 'working' && store.phase !== 'awaiting_approval') return

    // Check if ALL tasks are done (if tasks is empty, it's also "all done" if we were working)
    const hasTasks = store.tasks.length > 0;
    const allDone = hasTasks && store.tasks.every((t) => t.status === 'done');
    const isEmptyWorking = !hasTasks && (store.phase === 'working' || store.phase === 'awaiting_approval');

    if (!allDone && !isEmptyWorking) return

    // Check if we already delivered the final output
    if (store.finalOutput) return

    // Check if AM is already processing something
    if (runningAgents.current.has(ORCHESTRATOR_INDEX)) return
    runningAgents.current.add(ORCHESTRATOR_INDEX)

    try {
      const outputs = store.tasks
        .filter((t) => t.output)
        .map((t) => `[${t.description}]\n${t.output}`)
        .join('\n\n---\n\n')

      const prompt = hasTasks
        ? `All tasks are completed. Team outputs:\n\n${outputs}\n\nNow assemble the final prompt for the client and call notify_client_project_ready.`
        : `All tasks have been removed. The project is effectively empty but needs to be closed. Summarize the situation and call notify_client_project_ready.`

      const response = await callOrchestrator(prompt)
      if (response.functionCalls) {
        for (const fn of response.functionCalls) {
          processFunctionCall(fn, ORCHESTRATOR_INDEX)
        }
      }
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') console.error('[Orchestrator] final delivery error:', err)
    } finally {
      runningAgents.current.delete(ORCHESTRATOR_INDEX)
    }
  }

  // ── Single-agent task work loop ───────────────────────────────
  const runSingleAgentTask = async (task: Task, agentIndex: number) => {
    await sleep(randomBetween(1500, 3000))

    // Programmatically start the task (replaces the old execute_work LLM call)
    const store = useCoreStore.getState()
    store.updateTaskStatus(task.id, 'in_progress')
    store.addLogEntry({
      agentIndex,
      action: `started work on task`,
      taskId: task.id,
    })
    sceneRef.current?.setNpcWorking(agentIndex, true)

    try {
      // Single combined call: draft + complete in one shot
      const response = await callAgent({
        agentIndex,
        userMessage: `You have been assigned task [${task.id}]: "${task.description}". ` +
          `First, analyze the task and call request_client_approval to discuss your plan with the client. ` +
          `If the client approves, call complete_task with your final output.`,
      })
      if (response.functionCalls) {
        for (const fn of response.functionCalls) {
          processFunctionCall(fn, agentIndex)
        }
      }
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') console.error(`[Orchestrator] agent ${agentIndex} task error:`, err)
    } finally {
      // Always clean up — handles early returns (on_hold/done) and errors.
      // complete_task already deletes, but a Set delete is idempotent.
      runningAgents.current.delete(agentIndex)
    }
  }

  // ── Multi-agent boardroom task ────────────────────────────────
  const runBoardroomTask = async (task: Task) => {
    const store = useCoreStore.getState()
    const agents = task.assignedAgentIds

    store.addLogEntry({
      agentIndex: agents[0],
      action: `gathering team in boardroom for "${task.description}"`,
      taskId: task.id,
    })

    // Move all agents to boardroom and wait for arrivals
    await new Promise<void>((resolve) => {
      let arrived = 0
      const onArrival = () => {
        arrived++
        if (arrived >= agents.length) resolve()
      }
      agents.forEach((idx) => sceneRef.current?.moveNpcToSpawn(idx, onArrival))
    })

    store.updateTaskStatus(task.id, 'in_progress')
    agents.forEach((idx) => runningAgents.current.add(idx))

    try {
      // Round-robin boardroom chat: each agent speaks once to propose subtasks
      for (const agentIndex of agents) {
        store.addLogEntry({
          agentIndex,
          action: `discussing task in boardroom — "${task.description}"`,
          taskId: task.id,
        })

        const response = await callBoardroomAgent(
          agentIndex,
          task.id,
          `Boardroom meeting for task [${task.id}]: "${task.description}". ` +
          `Client brief: "${store.clientBrief}". ` +
          `Your teammates in this meeting: ${agents.filter((i) => i !== agentIndex).map((i) => getAgent(i, getActiveAgentSet().agents)?.role).join(', ')}. ` +
          `Propose a subtask for yourself or delegate. Use propose_subtask.`,
        )

        if (response.functionCalls) {
          for (const fn of response.functionCalls) {
            processFunctionCall(fn, agentIndex)
          }
        }

        await sleep(1500)
      }

      // Mark the boardroom task itself as done (subtasks carry the real work)
      store.updateTaskStatus(task.id, 'done')
      store.addLogEntry({
        agentIndex: agents[0],
        action: `boardroom session concluded — subtasks distributed`,
        taskId: task.id,
      })
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') console.error('[Orchestrator] boardroom error:', err)
    } finally {
      agents.forEach((idx) => runningAgents.current.delete(idx))
    }
  }

  // ── Dispatch a scheduled task ─────────────────────────────────
  const dispatchTask = (task: Task) => {
    const isBoardroom = task.assignedAgentIds.length > 1

    if (isBoardroom) {
      // All agents must be free
      const anyBusy = task.assignedAgentIds.some((i) => runningAgents.current.has(i))
      if (anyBusy) return
      task.assignedAgentIds.forEach((i) => runningAgents.current.add(i))
      runBoardroomTask(task)
    } else {
      const agentIndex = task.assignedAgentIds[0]
      if (runningAgents.current.has(agentIndex)) return
      runningAgents.current.add(agentIndex)
      runSingleAgentTask(task, agentIndex)
    }
  }

  // ── Core message handler (intercepts player→NPC chat) ───────
  const handleCoreMessage = async (
    npcIndex: number,
    text: string,
  ): Promise<string | null> => {
    const store = useCoreStore.getState()

    // ---- Orchestrator: always route through agency service ----
    if (npcIndex === ORCHESTRATOR_INDEX) {
      if (store.phase === 'idle') {
        store.setPhase('briefing')
      }

      // Check if there's a pending approval task for the orchestrator
      const orchestratorPendingTask = store.tasks.find(
        (t) => t.status === 'on_hold' && t.assignedAgentIds.includes(ORCHESTRATOR_INDEX),
      )

      try {
        runningAgents.current.add(ORCHESTRATOR_INDEX)

        let response;
        if (orchestratorPendingTask) {
          store.updateTaskStatus(orchestratorPendingTask.id, 'in_progress')
          store.addLogEntry({
            agentIndex: 0,
            action: `approved task for Manager — resuming work`,
            taskId: orchestratorPendingTask.id,
          })

          response = await callOrchestrator(
            `Client responded to your approval request: "${text}". Incorporate their feedback. ` +
            `Call request_client_approval if you still need more input, otherwise proceed with your management tools (propose_task, update_client_brief, etc.).`
          )
        } else {
          response = await callOrchestrator(text)
        }

        if (response.functionCalls) {
          for (const fn of response.functionCalls) {
            processFunctionCall(fn, ORCHESTRATOR_INDEX)
          }
        }
        return response.text || null
      } catch (err) {
        if ((err as DOMException)?.name !== 'AbortError') console.error('[Orchestrator] Orchestrator message error:', err)
        return null
      } finally {
        runningAgents.current.delete(ORCHESTRATOR_INDEX)
      }
    }

    // ---- NPC with pending approval ----
    const pendingTask = store.tasks.find(
      (t) => t.status === 'on_hold' && t.assignedAgentIds.includes(npcIndex),
    )
    if (pendingTask) {
      store.updateTaskStatus(pendingTask.id, 'in_progress')
      store.addLogEntry({
        agentIndex: 0,
        action: `approved task for ${getAgent(npcIndex, getActiveAgentSet().agents)?.role} — resuming work`,
        taskId: pendingTask.id,
      })

      runningAgents.current.add(npcIndex)
      try {
        sceneRef.current?.setNpcWorking(npcIndex, true)

        // Single combined call: incorporate feedback and complete
        const response = await callAgent({
          agentIndex: npcIndex,
          userMessage: `Client responded: "${text}". Incorporate their feedback and produce your final prompt. ` +
            `Call request_client_approval if you still need more input, if not Call complete_task with your output.`,
        })

        if (response.functionCalls) {
          for (const fn of response.functionCalls) {
            processFunctionCall(fn, npcIndex)
          }
        }
        return response.text || null
      } catch (err) {
        if ((err as DOMException)?.name !== 'AbortError') console.error('[Orchestrator] approval resume error:', err)
        return null
      } finally {
        runningAgents.current.delete(npcIndex)
      }
    }

    // ---- Any other NPC: route through their LLM for a contextual response ----
    try {
      const response = await callAgent({ agentIndex: npcIndex, userMessage: text, chatMode: true })
      return response.text || null
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') console.error('[Orchestrator] NPC chat error:', err)
      return null
    }
  }

  // ── Register handler + subscribe to task changes ─────────────
  useEffect(() => {
    if (!scene) return

    scene.setCoreHandler(handleCoreMessage)

    // Watch for new scheduled tasks and dispatch them
    const unsub = useCoreStore.subscribe((s, prev) => {
      // Check if tasks changed status or were removed, making project ready
      const tasksChanged = s.tasks.some((t, i) => t.status !== prev.tasks[i]?.status) ||
                           s.tasks.length !== prev.tasks.length;

      if (tasksChanged) {
        checkAllTasksDone();
      }

      // Find tasks that just became 'scheduled' (were not present or not scheduled before)
      const newScheduled = s.tasks.filter(
        (t) =>
          t.status === 'scheduled' &&
          !prev.tasks.some((pt) => pt.id === t.id && pt.status === 'scheduled'),
      )

      // Guard: only dispatch unique newly scheduled tasks
      if (newScheduled.length > 0) {
        setTimeout(() => {
          // Re-verify status before dispatching to ensure idempotency after the delay
          const currentStore = useCoreStore.getState();
          for (const task of newScheduled) {
            const currentTask = currentStore.tasks.find(t => t.id === task.id);
            const agentIndex = task.assignedAgentIds[0];

            // Dispatch only if still scheduled AND agent isn't already busy
            if (currentTask?.status === 'scheduled' && !runningAgents.current.has(agentIndex)) {
              dispatchTask(task);
            }
          }
        }, 2000);
      }

      // Exit chat mode only when a brand-new task (scheduled) starts for the chatted NPC.
      // Do NOT close chat on on_hold → in_progress (approval resume) — the user should
      // see the agent's acknowledgment reply before the chat closes naturally.
      const { isChatting, selectedNpcIndex } = useUiStore.getState()
      if (isChatting && selectedNpcIndex !== null) {
        const justStarted = s.tasks.find(
          (t) =>
            t.status === 'in_progress' &&
            t.assignedAgentIds.includes(selectedNpcIndex) &&
            prev.tasks.some((pt) => pt.id === t.id && pt.status === 'scheduled'),
        )
        if (justStarted) {
          sceneRef.current?.endChat()
        }
      }

      // When project reaches 'done', close chat if the user is talking to a non-Orchestrator agent
      if (s.phase === 'done' && prev.phase !== 'done') {
        const { isChatting: chatActive, selectedNpcIndex: selNpc } = useUiStore.getState()
        if (chatActive && selNpc !== null && selNpc !== ORCHESTRATOR_INDEX) {
          sceneRef.current?.endChat()
        }
      }
    })

    return () => {
      scene.setCoreHandler(null)
      unsub()
    }
  }, [scene]) // eslint-disable-line react-hooks/exhaustive-deps
}
