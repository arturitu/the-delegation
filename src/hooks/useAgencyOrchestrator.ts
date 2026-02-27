import { useEffect, useRef } from 'react'
import { useSceneManager } from '../three/SceneContext'
import { useAgencyStore, type Task } from '../store/agencyStore'
import {
  callAgent,
  callAccountManager,
  callBoardroomAgent,
  type AgentFunctionCall,
} from '../services/geminiAgencyService'
import { AGENTS } from '../data/agents'

// ── Constants ─────────────────────────────────────────────────
const AM_INDEX = 1 // Account Manager

/** Simulated time an agent spends "working" before attempting to complete (ms). */
const WORK_DURATION_MS = { min: 8_000, max: 20_000 }

const randomBetween = (min: number, max: number) =>
  Math.random() * (max - min) + min

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// ─────────────────────────────────────────────────────────────
export function useAgencyOrchestrator() {
  const scene = useSceneManager()
  const sceneRef = useRef(scene)
  useEffect(() => { sceneRef.current = scene }, [scene])

  /** Agents currently being processed — prevents double-dispatch. */
  const runningAgents = useRef(new Set<number>())

  /**
   * Process a function call returned by an agent and update the store.
   * Returns true if the call was handled.
   */
  const processFunctionCall = (fn: AgentFunctionCall, callerIndex: number): boolean => {
    const store = useAgencyStore.getState()

    switch (fn.name) {
      case 'propose_task': {
        const { agentIds, title, description, requiresApproval } = fn.args as {
          agentIds: number[]
          title: string
          description: string
          requiresApproval: boolean
        }
        const task = store.addTask({
          title: title || 'New Task',
          description,
          assignedAgentIds: agentIds,
          status: 'scheduled',
          requiresClientApproval: requiresApproval ?? false,
        })
        store.addLogEntry({
          agentIndex: callerIndex,
          action: `proposed task "${title || description}" → assigned to ${agentIds.map(i => AGENTS[i]?.role).join(', ')}`,
          taskId: task.id,
        })
        // Transition to working phase on first task creation
        if (store.phase === 'briefing' || store.phase === 'idle') {
          store.setPhase('working')
        }
        return true
      }

      case 'execute_work': {
        const { taskId } = fn.args as { taskId: string }
        store.updateTaskStatus(taskId, 'in_progress')
        store.addLogEntry({
          agentIndex: callerIndex,
          action: `started work on task`,
          taskId,
        })
        sceneRef.current?.setNpcWorking(callerIndex, true)
        return true
      }

      case 'request_client_approval': {
        const { taskId, question } = fn.args as { taskId: string; question: string }
        store.updateTaskStatus(taskId, 'on_hold')
        store.setPendingApproval(taskId)
        store.addLogEntry({
          agentIndex: callerIndex,
          action: `requested client approval — "${question}"`,
          taskId,
        })
        sceneRef.current?.setNpcWorking(callerIndex, false)
        return true
      }

      case 'complete_task': {
        const { taskId, output } = fn.args as { taskId: string; output: string }
        store.updateTaskStatus(taskId, 'done')
        store.setTaskOutput(taskId, output)
        store.addLogEntry({
          agentIndex: callerIndex,
          action: `completed task`,
          taskId,
        })
        sceneRef.current?.setNpcWorking(callerIndex, false)
        runningAgents.current.delete(callerIndex)

        // Use a small timeout to allow state to settle before checking if all tasks are done
        setTimeout(() => {
          checkAllTasksDone()
        }, 100)
        return true
      }

      case 'propose_subtask': {
        const { agentId, title, description } = fn.args as { agentId: number; title: string; description: string }
        const parentTask = useAgencyStore.getState().tasks.find(
          (t) => t.assignedAgentIds.includes(callerIndex) && t.status === 'in_progress'
        )
        const sub = store.addTask({
          title: title || 'Subtask',
          description,
          assignedAgentIds: [agentId],
          status: 'scheduled',
          requiresClientApproval: false,
          parentTaskId: parentTask?.id,
        })
        store.addLogEntry({
          agentIndex: callerIndex,
          action: `proposed subtask for ${AGENTS[agentId]?.role} — "${title || description}"`,
          taskId: sub.id,
        })
        return true
      }

      case 'notify_client_project_ready': {
        const { finalPrompt } = fn.args as { finalPrompt: string }
        store.setFinalOutput(finalPrompt)
        store.setPhase('done')
        // store.setFinalOutputOpen(true) // Don't open automatically
        store.addLogEntry({
          agentIndex: callerIndex,
          action: `delivered final prompt to client`,
        })
        return true
      }
    }
  }

  // ── Check if all tasks done → trigger AM to wrap up ──────────
  const checkAllTasksDone = async () => {
    const store = useAgencyStore.getState()
    if (store.phase !== 'working') return

    // Check if there are any tasks at all
    if (store.tasks.length === 0) return

    // Check if ALL tasks are done
    const allDone = store.tasks.every((t) => t.status === 'done')
    if (!allDone) return

    // Check if we already delivered the final output
    if (store.finalOutput) return

    // Check if AM is already processing something
    if (runningAgents.current.has(AM_INDEX)) return
    runningAgents.current.add(AM_INDEX)

    store.addLogEntry({ agentIndex: AM_INDEX, action: 'all tasks completed — preparing final delivery' })

    try {
      const outputs = store.tasks
        .filter((t) => t.output)
        .map((t) => `[${t.description}]\n${t.output}`)
        .join('\n\n---\n\n')

      const response = await callAccountManager(
        `All tasks are completed. Team outputs:\n\n${outputs}\n\nNow assemble the final prompt for the client and call notify_client_project_ready.`
      )
      if (response.functionCalls) {
        for (const fn of response.functionCalls) {
          processFunctionCall(fn, AM_INDEX)
        }
      }
    } catch (err) {
      console.error('[Orchestrator] final delivery error:', err)
    } finally {
      runningAgents.current.delete(AM_INDEX)
    }
  }

  // ── Single-agent task work loop ───────────────────────────────
  const runSingleAgentTask = async (task: Task, agentIndex: number) => {
    const store = useAgencyStore.getState()

    store.addLogEntry({
      agentIndex,
      action: `received task assignment — "${task.description}"`,
      taskId: task.id,
    })

    await sleep(randomBetween(1500, 3000))

    try {
      // Step 1: Agent acknowledges and starts
      const startResponse = await callAgent({
        agentIndex,
        userMessage: `You have been assigned task [${task.id}]: "${task.description}". Start working on it now. Call execute_work to begin.`,
      })
      if (startResponse.functionCalls) {
        for (const fn of startResponse.functionCalls) {
          processFunctionCall(fn, agentIndex)
        }
      }

      // If the agent went on hold (approval needed), stop here — resumption handles the rest
      if (useAgencyStore.getState().tasks.find((t) => t.id === task.id)?.status === 'on_hold') {
        return
      }

      // Step 2: Simulate work duration
      await sleep(randomBetween(WORK_DURATION_MS.min, WORK_DURATION_MS.max))

      // Bail if task was cancelled or already done by now
      const currentStatus = useAgencyStore.getState().tasks.find((t) => t.id === task.id)?.status
      if (currentStatus !== 'in_progress') return

      // Step 3: Agent completes the task
      const completeResponse = await callAgent({
        agentIndex,
        userMessage: `You have been working on task [${task.id}]: "${task.description}". Your work is done. Call complete_task with your final prompt output.`,
      })
      if (completeResponse.functionCalls) {
        for (const fn of completeResponse.functionCalls) {
          processFunctionCall(fn, agentIndex)
        }
      }
    } catch (err) {
      console.error(`[Orchestrator] agent ${agentIndex} task error:`, err)
      runningAgents.current.delete(agentIndex)
    }
  }

  // ── Multi-agent boardroom task ────────────────────────────────
  const runBoardroomTask = async (task: Task) => {
    const store = useAgencyStore.getState()
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
      agents.forEach((idx) => sceneRef.current?.moveNpcToBoardroom(idx, onArrival))
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
          `Your teammates in this meeting: ${agents.filter((i) => i !== agentIndex).map((i) => AGENTS[i]?.role).join(', ')}. ` +
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
      console.error('[Orchestrator] boardroom error:', err)
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

  // ── Agency message handler (intercepts player→NPC chat) ───────
  const handleAgencyMessage = async (
    npcIndex: number,
    text: string,
  ): Promise<string | null> => {
    const store = useAgencyStore.getState()

    // ---- Account Manager: always route through agency service ----
    if (npcIndex === AM_INDEX) {
      if (store.phase === 'idle') {
        store.setPhase('briefing')
        store.setClientBrief(text) // initial brief
        store.addLogEntry({ agentIndex: 0, action: `briefed the team — "${text.slice(0, 80)}..."` })
      }

      try {
        runningAgents.current.add(AM_INDEX)
        const response = await callAccountManager(text)
        if (response.functionCalls) {
          for (const fn of response.functionCalls) {
            processFunctionCall(fn, AM_INDEX)
          }
        }
        return response.text || null
      } catch (err) {
        console.error('[Orchestrator] AM message error:', err)
        return null
      } finally {
        runningAgents.current.delete(AM_INDEX)
      }
    }

    // ---- NPC with pending approval ----
    const pendingId = store.pendingApprovalTaskId
    if (pendingId) {
      const task = store.tasks.find(
        (t) => t.id === pendingId && t.assignedAgentIds.includes(npcIndex),
      )
      if (task) {
        store.setPendingApproval(null)
        store.updateTaskStatus(task.id, 'in_progress')
        store.addLogEntry({
          agentIndex: 0,
          action: `approved task — resuming work`,
          taskId: task.id,
        })

        try {
          const response = await callAgent({
            agentIndex: npcIndex,
            userMessage: `Client responded: "${text}". Resume the task and complete it.`,
          })
          if (response.functionCalls) {
            for (const fn of response.functionCalls) {
              processFunctionCall(fn, npcIndex)
            }
          }
          // Restart the work loop for this agent
          sceneRef.current?.setNpcWorking(npcIndex, true)
          sleep(randomBetween(WORK_DURATION_MS.min, WORK_DURATION_MS.max)).then(async () => {
            const status = useAgencyStore.getState().tasks.find((t) => t.id === task.id)?.status
            if (status !== 'in_progress') return
            const completeRes = await callAgent({
              agentIndex: npcIndex,
              userMessage: `Complete your task now. Call complete_task with your final prompt.`,
            })
            if (completeRes.functionCalls) {
              for (const fn of completeRes.functionCalls) {
                processFunctionCall(fn, npcIndex)
              }
            }
          })
          return response.text || null
        } catch (err) {
          console.error('[Orchestrator] approval resume error:', err)
          return null
        }
      }
    }

    return null // fall through to normal chat
  }

  // ── Register handler + subscribe to task changes ─────────────
  useEffect(() => {
    if (!scene) return

    scene.setAgencyHandler(handleAgencyMessage)

    // Watch for new scheduled tasks and dispatch them
    const unsub = useAgencyStore.subscribe((s, prev) => {
      const newScheduled = s.tasks.filter(
        (t) =>
          t.status === 'scheduled' &&
          !prev.tasks.some((pt) => pt.id === t.id && pt.status === 'scheduled'),
      )

      // Small delay so the AM has time to finish speaking before agents start
      if (newScheduled.length > 0) {
        setTimeout(() => {
          for (const task of newScheduled) {
            dispatchTask(task)
          }
        }, 2000)
      }
    })

    return () => {
      scene.setAgencyHandler(null)
      unsub()
    }
  }, [scene]) // eslint-disable-line react-hooks/exhaustive-deps
}
