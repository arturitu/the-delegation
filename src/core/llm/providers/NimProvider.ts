import { LLMMessage, LLMProvider, LLMResponse, LLMToolDefinition } from '../types';

export class NimProvider implements LLMProvider {
  constructor(private apiKey: string, private baseUrl: string = 'https://integrate.api.nvidia.com/v1') {}

  async generateCompletion(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
    systemInstruction?: string,
    modelName: string = 'meta/llama-3.3-70b-instruct'
  ): Promise<LLMResponse> {
    const payload: any = {
      model: modelName,
      messages: messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content || ""
      })),
      temperature: 0.3,
      max_tokens: 4096,
      top_p: 0.95
    };

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

    return {
      content: data.choices[0]?.message?.content || "",
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
