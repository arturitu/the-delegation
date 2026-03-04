import { LLMToolDefinition } from './types';

export const AGENCY_TOOLS: LLMToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'propose_task',
      description: 'Account Manager only. Create a new task for one or more agents.',
      parameters: {
        type: 'object',
        properties: {
          agentIds: {
            type: 'array',
            items: { type: 'integer' },
            description: 'List of agent IDs to assign the task to.',
          },
          title: {
            type: 'string',
            description: 'A very brief 2-4 word summary of the task.',
          },
          description: {
            type: 'string',
            description: 'A short 10-20 word instruction for the task.',
          },
        },
        required: ['agentIds', 'title', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'execute_work',
      description: 'Signal you are starting work on your assigned task (moves it to in_progress).',
      parameters: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'The ID of the task you are starting.',
          },
        },
        required: ['taskId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_task',
      description: 'When your work is done. output is the prompt you crafted (max 500 words).',
      parameters: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'The ID of the task you completed.',
          },
          output: {
            type: 'string',
            description: 'The prompt you crafted (max 500 words).',
          },
        },
        required: ['taskId', 'output'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'notify_client_project_ready',
      description: 'When all tasks are completed, assemble the final prompt for the client.',
      parameters: {
        type: 'object',
        properties: {
          finalPrompt: {
            type: 'string',
            description: 'The final assembled prompt for the client.',
          },
        },
        required: ['finalPrompt'],
      },
    },
  },
];
