import { useEffect, useRef } from 'react'
import { useSceneManager } from '../three/SceneContext'
import { useAgencyStore, type Task } from '../store/agencyStore'
import {
  callAgent,
  callAccountManager,
  callBoardroomAgent,
  type AgentFunctionCall,
} from '../services/agencyService'
import { ToolHandlerService } from '../services/toolHandlerService'
import { getAgent } from '../data/agents'

// ── Constants ─────────────────────────────────────────────────
const AM_INDEX = 1 // Account Manager

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
   * Wrapper for tool handler to include local context.
   */
  const processFunctionCall = (fn: AgentFunctionCall, callerIndex: number): boolean => {
    const handled = ToolHandlerService.process(fn, callerIndex, sceneRef.current)

    // Additional side effects specific to the orchestrator hook
    if (handled && fn.name === 'complete_task') {
      runningAgents.current.delete(callerIndex)
      setTimeout(() => {
        checkAllTasksDone()
      }, 100)
    }

    return handled
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
      // Step 1: Agent acknowledges and starts working
      const startResponse = await callAgent({
        agentIndex,
        userMessage: `You have been assigned task [${task.id}]: "${task.description}". Begin by calling execute_work.`,
      })
      if (startResponse.functionCalls) {
        for (const fn of startResponse.functionCalls) {
          processFunctionCall(fn, agentIndex)
        }
      }

      // If the agent went on hold (approval needed), stop here
      if (useAgencyStore.getState().tasks.find((t) => t.id === task.id)?.status === 'on_hold') {
        return
      }

      // Step 2: Reflection / Drafting phase (Replaces artificial WORK_DURATION_MS)
      // This provides more "realistic" agent behavior as they actually process the request
      await callAgent({
        agentIndex,
        userMessage: `Draft a preliminary version of your prompt for this task. Identify any challenges or missing information internally.`,
      })

      // Step 3: Refinement and Completion
      const completeResponse = await callAgent({
        agentIndex,
        userMessage: `Now produce the final high-quality prompt for task [${task.id}]. Call complete_task with your output.`,
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
          `Your teammates in this meeting: ${agents.filter((i) => i !== agentIndex).map((i) => getAgent(i)?.role).join(', ')}. ` +
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
          action: `approved task for ${getAgent(npcIndex)?.role} — resuming work`,
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

          // Reflection / Designing phase - use the response pattern instead of hardcoded strings
          await callAgent({
            agentIndex: npcIndex,
            userMessage: `Client responded: "${text}". Draft an updated version of your result taking this feedback into account.`,
          })

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
