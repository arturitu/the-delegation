import { useCoreStore } from '../integration/store/coreStore';
import { useUiStore } from '../integration/store/uiStore';
import { LLMFactory } from '../core/llm/LLMFactory';

const SUMMARY_PROMPT = "You are an AI assistant helping an agent summarize their conversation history.";

/**
 * MemoryService - Handles long-term memory, summaries, and history management.
 * Part of the 'Context' pillar.
 */
export class MemoryService {
  static async updateAgentSummary(agentIndex: number) {
    const store = useCoreStore.getState();
    const llmConfig = useUiStore.getState().llmConfig;

    // In a future RAG system, this would interact with a Vector DB.
    // For now, it manages LLM-based summaries.
    try {
      const provider = LLMFactory.getProvider(llmConfig);
      // We pass the summary prompt as the system instruction or user message
      // depends on the provider implementation.
      const response = await provider.generateCompletion(
        [{ role: 'user', content: 'Please summarize the conversation history for agent ' + agentIndex }],
        [],
        SUMMARY_PROMPT,
        llmConfig.model
      );

      if (response.content) {
        store.setAgentSummary(agentIndex, response.content);
      }
    } catch (e) {
      console.error('[MemoryService] Failed to update agent summary', e);
    }
  }
}
