import { LLMConfig, LLMProvider } from '../types';
import { GeminiProvider } from './GeminiProvider';
import { NimProvider } from './NimProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { AnthropicProvider } from './AnthropicProvider';

export function createLLMProvider(config: LLMConfig): LLMProvider {
  if (config.model.startsWith('meta/') || config.model.startsWith('nvidia/') || config.model.includes('gpt-oss')) {
    if (!config.nimApiKey) throw new Error('NVIDIA NIM API Key is missing');
    return new NimProvider(config.nimApiKey, config.baseUrl);
  }
  
  if (config.model.startsWith('gpt-')) {
    if (!config.openaiApiKey) throw new Error('OpenAI API Key is missing');
    return new OpenAIProvider(config.openaiApiKey, config.baseUrl);
  }
  
  if (config.model.startsWith('claude-')) {
    if (!config.anthropicApiKey) throw new Error('Anthropic API Key is missing');
    return new AnthropicProvider(config.anthropicApiKey, config.baseUrl);
  }
  
  // Default to Gemini
  if (!config.apiKey) throw new Error('Gemini API Key is missing');
  return new GeminiProvider(config.apiKey);
}
