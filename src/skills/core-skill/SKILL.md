---
name: core-orchestration
description: Core tools for task management, client approval, and project completion.
tools:
  - name: propose_task
    description: Create a new task for one or more agents.
    parameters:
      type: object
      properties:
        agentIds:
          type: array
          items: { type: integer }
          description: List of agent IDs to assign the task to.
        title:
          type: string
          description: A very brief 2-4 word summary of the task.
        description:
          type: string
          description: A short 10-20 word instruction for the task.
        requiresApproval:
          type: boolean
          description: Whether the task requires client approval before starting.
      required: [agentIds, title, description, requiresApproval]

  - name: request_client_approval
    description: When you need client input to continue. Task goes on_hold.
    parameters:
      type: object
      properties:
        taskId:
          type: string
          description: The ID of the task that needs approval.
        question:
          type: string
          description: The question to ask the client.
      required: [taskId, question]

  - name: receive_client_approval
    description: Call this when the client provides the approval or information needed to resume a task that was ON_HOLD.
    parameters:
      type: object
      properties:
        taskId:
          type: string
          description: The ID of the task that has been approved.
      required: [taskId]

  - name: complete_task
    description: When your work is done OR the task is no longer necessary. If cancelled, use output to explain why.
    parameters:
      type: object
      properties:
        taskId:
          type: string
          description: The ID of the task you are closing.
        output:
          type: string
          description: The final prompt (max 300 words) OR an explanation of why the task was finished/cancelled.
      required: [taskId, output]

  - name: notify_client_project_ready
    description: When all tasks are completed, assemble the final prompt for the client.
    parameters:
      type: object
      properties:
        finalPrompt:
          type: string
          description: The final assembled prompt for the client.
      required: [finalPrompt]

  - name: request_revision
    description: Call this when the work does not meet the quality standards and needs to be redone. This will trigger a notification to the responsible agent(s).
    parameters:
      type: object
      properties:
        taskId:
          type: string
          description: The ID of the task that needs revision.
        feedback:
          type: string
          description: Detailed feedback on what needs to be improved or fixed.
      required: [taskId, feedback]
---

# Core Orchestration Skill

These are the fundamental capabilities required to manage the project flow, assign tasks, and communicate with the client.

## Instructions
- Always be clear and concise when proposing tasks.
- If a task depends on another, make sure to mention it in the description.
- Use `request_client_approval` whenever you are unsure about the direction or need specific data from the human.
- Only call `notify_client_project_ready` when ALL tasks in the project are marked as DONE.
