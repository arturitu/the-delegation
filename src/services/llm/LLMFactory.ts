import { GeminiProvider } from './providers/GeminiProvider';
import { LLMProvider, LLMConfig } from './types';

export class LLMFactory {
  static getProvider(config: LLMConfig): LLMProvider {
    switch (config.provider) {
      case 'gemini':
        if (!config.apiKey) throw new Error('Gemini API key is required');
        return new GeminiProvider(config.apiKey);
      default:
        throw new Error(`Provider ${config.provider} not supported`);
    }
  }
}
