export type LLMRole = 'system' | 'user' | 'assistant' | 'tool';

export interface LLMMessage {
  role: LLMRole;
  content: string;
  name?: string; // Required for tool responses in some APIs
  tool_calls?: LLMToolCall[];
}

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface LLMToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any; // JSON Schema
  };
}

export interface LLMConfig {
  provider: 'gemini' | 'openai' | 'anthropic' | 'local';
  apiKey?: string;
  baseUrl?: string;
  model: string;
}

export interface LLMResponse {
  content: string | null;
  tool_calls?: LLMToolCall[];
}

export interface LLMProvider {
  generateCompletion(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
    systemInstruction?: string,
    modelName?: string,
    signal?: AbortSignal
  ): Promise<LLMResponse>;
}
