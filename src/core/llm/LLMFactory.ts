import { GeminiProvider } from './providers/GeminiProvider';
import { LLMProvider, LLMConfig } from './types';

export class LLMFactory {
  static getProvider(config: LLMConfig): LLMProvider {
    switch (config.provider) {
      case 'gemini':
        if (!config.apiKey) throw new Error('Gemini API key is required');
        return new GeminiProvider(config.apiKey);
      case 'openai':
        // Placeholder for future OpenAIProvider
        throw new Error('OpenAI provider not yet implemented, but can be added here.');
      case 'local':
        // Placeholder for Ollama or LocalAI via OpenAI compatible API
        throw new Error('Local provider not yet implemented.');
      default:
        throw new Error(`Provider ${config.provider} not supported`);
    }
  }
}
