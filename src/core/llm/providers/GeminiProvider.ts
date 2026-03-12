import { GoogleGenAI, Type, FunctionDeclaration, Tool } from '@google/genai';
import { LLMProvider, LLMMessage, LLMToolDefinition, LLMResponse, LLMToolCall } from '../types';

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateCompletion(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
    systemInstruction?: string,
    modelName: string = 'gemini-3-flash-preview',
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    const contents = this.mapMessagesToGemini(messages);

    const agencyTools: Tool[] | undefined = tools ? [{
      functionDeclarations: tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        parameters: {
          type: Type.OBJECT,
          properties: Object.keys(t.function.parameters.properties).reduce((acc, key) => {
            const prop = t.function.parameters.properties[key];
            const typeStr = prop.type.toUpperCase() as keyof typeof Type;
            acc[key] = {
              type: Type[typeStr] || Type.STRING,
              description: prop.description,
              ...(prop.items && { items: { type: Type[prop.items.type.toUpperCase() as keyof typeof Type] || Type.STRING } })
            };
            return acc;
          }, {} as Record<string, any>),
          required: t.function.parameters.required || [],
        }
      } as FunctionDeclaration))
    }] : undefined;

    const result = await this.client.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction: systemInstruction,
        tools: agencyTools,
        abortSignal: signal,
      }
    });

    const candidate = result.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    let contentStr: string | null = null;
    let toolCalls: LLMToolCall[] = [];

    for (const part of parts) {
      if (part.text) {
        contentStr = (contentStr || '') + part.text;
      }
    }

    // Also pull tool calls from the root result if that's where the SDK puts them
    if (result.functionCalls) {
      for (const call of result.functionCalls) {
        toolCalls.push({
          id: Math.random().toString(36).substring(7),
          type: 'function',
          function: {
            name: call.name,
            arguments: JSON.stringify(call.args)
          }
        });
      }
    }

    return {
      content: contentStr,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined
    };
  }

  private mapMessagesToGemini(messages: LLMMessage[]): any[] {
    return messages
      .filter(m => m.role !== 'system')
      .map(m => {
        const role = m.role === 'assistant' ? 'model' : 'user';
        const parts: any[] = [];

        if (m.content) {
          parts.push({ text: m.content });
        }

        if (m.tool_calls) {
          for (const tc of m.tool_calls) {
            parts.push({
              functionCall: {
                name: tc.function.name,
                args: JSON.parse(tc.function.arguments)
              }
            });
          }
        }

        if (m.role === 'tool' && m.name) {
          parts.push({
            functionResponse: {
              name: m.name,
              response: JSON.parse(m.content)
            }
          });
        }

        return { role, parts };
      });
  }
}
