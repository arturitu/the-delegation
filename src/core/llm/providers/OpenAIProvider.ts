import { LLMMessage, LLMProvider, LLMResponse, LLMToolDefinition } from '../types';

export class OpenAIProvider implements LLMProvider {
  constructor(private apiKey: string, private baseUrl: string = 'https://api.openai.com/v1') {}

  async generateCompletion(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
    systemInstruction?: string,
    modelName: string = 'gpt-4o'
  ): Promise<LLMResponse> {
    const payload: any = {
      model: modelName,
      messages: messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content || ""
      })),
      temperature: 0.3,
    };

    if (systemInstruction) {
      payload.messages.unshift({ role: 'system', content: systemInstruction });
    }

    console.log("Routing to OpenAI:", payload);
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
      throw new Error(`OpenAI API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("OpenAI response:", data);

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
