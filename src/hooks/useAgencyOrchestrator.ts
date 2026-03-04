import { useEffect, useRef } from 'react'
import { useSceneManager } from '../three/SceneContext'
import { useAgencyStore, type Task } from '../store/agencyStore'
import { useStore } from '../store/useStore'
import {
  callAgent,
  callAccountManager,
  type AgentFunctionCall,
} from '../services/agencyService'
import { ToolHandlerService } from '../services/toolHandlerService'
import { getAgent, AM_INDEX } from '../data/agents'

// ── Constants ───────────────────────────────────────────────────────

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
      // Kick the NPC driver so the agent immediately wanders away from the work desk
      sceneRef.current?.kickNpcDriver(callerIndex)
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

    /** Helper to check whether the task has already been completed. */
    const isTaskDone = () => {
      const status = useAgencyStore.getState().tasks.find((t) => t.id === task.id)?.status
      return status === 'done'
    }

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
      if (isTaskDone()) return

      // Step 2: Drafting + Completion
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
    } finally {
      runningAgents.current.delete(agentIndex)
    }
  }

  // ── Dispatch a scheduled task ─────────────────────────────────
  const dispatchTask = (task: Task) => {
    const agentIndex = task.assignedAgentIds[0]
    if (runningAgents.current.has(agentIndex)) return
    runningAgents.current.add(agentIndex)
    runSingleAgentTask(task, agentIndex)
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
        store.setClientBrief(text)
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

    // ---- Any other NPC: route through their LLM for a contextual response ----
    try {
      const response = await callAgent({ agentIndex: npcIndex, userMessage: text, chatMode: true })
      return response.text || null
    } catch (err) {
      console.error('[Orchestrator] NPC chat error:', err)
      return null
    }
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

      // Exit chat mode when a task starts for the chatted NPC
      const { isChatting, selectedNpcIndex } = useStore.getState()
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

      // When project reaches 'done', close chat if the user is talking to a non-AM agent
      if (s.phase === 'done' && prev.phase !== 'done') {
        const { isChatting: chatActive, selectedNpcIndex: selNpc } = useStore.getState()
        if (chatActive && selNpc !== null && selNpc !== AM_INDEX) {
          sceneRef.current?.endChat()
        }
      }
    })

    return () => {
      scene.setAgencyHandler(null)
      unsub()
    }
  }, [scene]) // eslint-disable-line react-hooks/exhaustive-deps
}
