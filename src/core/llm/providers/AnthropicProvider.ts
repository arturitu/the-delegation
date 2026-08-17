import { LLMMessage, LLMProvider, LLMResponse, LLMToolDefinition } from '../types';

export class AnthropicProvider implements LLMProvider {
  constructor(private apiKey: string, private baseUrl: string = 'https://api.anthropic.com/v1') {}

  async generateCompletion(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
    systemInstruction?: string,
    modelName: string = 'claude-3-5-sonnet-20241022'
  ): Promise<LLMResponse> {
    const mappedMessages = messages.filter(m => m.role !== 'system').map(m => {
      if (m.role === 'tool') {
        return {
          role: 'user', // Anthropic treats tool results as user messages
          content: [
            {
              type: 'tool_result',
              tool_use_id: m.name || "unknown",
              content: m.content || "Success"
            }
          ]
        };
      }
      
      const res: any = {
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content ? [{ type: 'text', text: m.content }] : []
      };

      if (m.tool_calls && m.tool_calls.length > 0) {
        if (m.role === 'assistant') {
          res.content.push(...m.tool_calls.map(tc => ({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments || "{}")
          })));
        }
      }

      if (res.content.length === 0) {
        res.content.push({ type: 'text', text: '...' });
      }

      return res;
    });

    const payload: any = {
      model: modelName,
      messages: mappedMessages,
      max_tokens: 4096,
    };

    if (tools && tools.length > 0) {
      payload.tools = tools.map(t => ({
        name: t.function.name,
        description: t.function.description || "",
        input_schema: t.function.parameters
      }));
    }

    if (systemInstruction) {
      payload.system = systemInstruction;
    }

    console.log("Routing to Anthropic:", payload);
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Anthropic response:", data);

    const textContent = data.content?.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n') || "";
    
    const toolCalls = data.content
      ?.filter((c: any) => c.type === 'tool_use')
      ?.map((tc: any) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.input)
        }
      }));

    return {
      content: textContent,
      tool_calls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      },
      finishReason: data.stop_reason,
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
