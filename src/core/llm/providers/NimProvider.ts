import { LLMMessage, LLMProvider, LLMResponse, LLMToolDefinition } from '../types';

export class NimProvider implements LLMProvider {
  constructor(private apiKey: string, private baseUrl: string = 'https://integrate.api.nvidia.com/v1') {}

  async generateCompletion(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
    systemInstruction?: string,
    modelName: string = 'meta/llama-3.3-70b-instruct'
  ): Promise<LLMResponse> {
    const mappedMessages = messages.filter(m => m.role !== 'system').map(m => {
      if (m.role === 'tool') {
        return {
          role: 'tool',
          content: m.content || "Success",
          tool_call_id: m.name || "unknown"
        };
      }
      const res: any = {
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content || ""
      };
      if (m.tool_calls && m.tool_calls.length > 0) {
        res.tool_calls = m.tool_calls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments
          }
        }));
      }
      return res;
    });

    const payload: any = {
      model: modelName,
      messages: mappedMessages,
      temperature: 0.3,
      max_tokens: 4096,
      top_p: 0.95
    };

    if (tools && tools.length > 0) {
      payload.tools = tools.map(t => ({
        type: 'function',
        function: {
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters
        }
      }));
    }

    if (modelName.includes("gemma") || modelName.includes("gpt-oss")) {
      payload.chat_template_kwargs = { "enable_thinking": true };
    }

    if (systemInstruction) {
      payload.messages.unshift({ role: 'system', content: systemInstruction });
    }

    console.log("Routing to Nvidia NIM:", payload);
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NIM API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Nvidia NIM response:", data);

    const message = data.choices[0]?.message;
    const toolCalls = message?.tool_calls?.map((tc: any) => ({
      id: tc.id,
      type: 'function',
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments
      }
    }));

    return {
      content: message?.content || "",
      tool_calls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      finishReason: data.choices[0]?.finish_reason,
      raw: data,
      request: payload
    };
  }

  async generateImage(): Promise<{ data: string; usage?: any }> {
    throw new Error('Image generation is not supported by this provider. Please select a Gemini model for this agent.');
  }

  async generateAudio(): Promise<{ data: string; usage?: any }> {
    throw new Error('Audio generation is not supported by this provider. Please select a Gemini model for this agent.');
  }

  async generateVideo(): Promise<{ videoUrl: string; usage?: any }> {
    throw new Error('Video generation is not supported by this provider. Please select a Gemini model for this agent.');
  }
}
