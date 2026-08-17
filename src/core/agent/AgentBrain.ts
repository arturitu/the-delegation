import { LLMMessage } from '../llm/types';
import { createLLMProvider } from '../llm/providers';
import { useUiStore } from '../../integration/store/uiStore';
import { useCoreStore } from '../../integration/store/coreStore';
import { useTeamStore } from '../../integration/store/teamStore';
import { ToolRegistry } from './ToolRegistry';
import { PromptBuilder } from './PromptBuilder';
import { AGENTIC_SETS, AgentNode } from '../../data/agents';

export interface BrainHost {
  data: AgentNode;
  simulation: {
    getAllAgents: () => any[];
    processScheduledTasks: () => void;
  };
  getCurrentTaskId: () => string | null;
}

export interface ThinkOptions {
  isChat?: boolean;
  tools?: any[];
  silent?: boolean;
}

export class AgentBrain {
  private history: LLMMessage[] = [];
  public isThinking: boolean = false;

  constructor(private readonly host: BrainHost) {
    this.refreshFromStore();
  }

  public async think(prompt: string, options: ThinkOptions = {}): Promise<{ text: string, toolCalls: any[] }> {
    if (this.isThinking) return { text: '', toolCalls: [] };
    this.isThinking = true;

    try {
      this.refreshFromStore();
      const core = useCoreStore.getState();
      const llmConfig = useUiStore.getState().llmConfig;
      const model = this.host.data.model || llmConfig.model;
      const provider = createLLMProvider({ ...llmConfig, model });
      const teamId = useTeamStore.getState().selectedAgentSetId;
      const activeTeam = useTeamStore.getState().customSystems.find(s => s.id === teamId)
        || AGENTIC_SETS.find(s => s.id === teamId);

      const hasVisionSupport = activeTeam?.outputType === 'image' || activeTeam?.outputType === 'video';

      // 1. Manage Message History
      if (!options.isChat) {
        const userMsg: LLMMessage = {
          role: 'user',
          content: prompt,
          metadata: options.silent ? { internal: true } : undefined
        };
        
        // Attach reference images if VISION is supported for this project type
        if (hasVisionSupport && core.referenceImages.length > 0) {
          userMsg.images = core.referenceImages;
        }

        this.history.push(userMsg);
        this.syncToStore();
      }

      // 2. Prepare context
      let messages: LLMMessage[] = this.history.slice(-10);

      // In chat mode, ensure the latest user message also carries images if it's the brief phase
      if (options.isChat && hasVisionSupport && core.referenceImages.length > 0) {
        messages = messages.map((m, idx) => {
          if (idx === messages.length - 1 && m.role === 'user') {
            return { ...m, images: core.referenceImages };
          }
          return m;
        });
      }
      const allAgents = this.host.simulation.getAllAgents();
      const systemPrompt = PromptBuilder.buildSystemPrompt(this.host.data, core.phase, core.userBrief, allAgents);
      const toolDefs = options.tools || ToolRegistry.getDefinitions(this.host.data.index, core.phase, this.host.data.subagents?.length || 0);

      // 3. Log and Execute LLM Call
      core.addRequestLog({
        agentIndex: this.host.data.index,
        agentName: this.host.data.name,
        systemInstruction: systemPrompt,
        contents: messages,
        systemTools: toolDefs,
        taskId: this.host.getCurrentTaskId() || undefined
      });

      const response = await provider.generateCompletion(
        messages,
        toolDefs,
        systemPrompt,
        model
      );

      // 4. Log Response
      core.addResponseLog({
        agentIndex: this.host.data.index,
        agentName: this.host.data.name,
        content: response.content || '',
        tool_calls: response.tool_calls,
        usage: response.usage,
        raw: response.raw,
        taskId: this.host.getCurrentTaskId() || undefined
      });

      // 5. Parse Tool Calls
      const text = response.content || '';
      const toolCalls = response.tool_calls?.map(tc => {
        try {
          return { id: tc.id, name: tc.function.name, args: JSON.parse(tc.function.arguments) };
        } catch (e) {
          console.error('[AgentBrain] Failed to parse tool arguments', tc.function.arguments);
          return null;
        }
      }).filter(Boolean) as any[] || [];

      // 6. Final Message Construction
      const isInternalTrigger = options.silent;
      const hasToolCallsOnly = !text && toolCalls.length > 0;
      const isBrief = toolCalls.some(tc => tc.name === 'set_user_brief');
      const isResolution = false;
      let finalContent = text;
      const isMalformed = response.finishReason === 'MALFORMED_FUNCTION_CALL';

      if (isMalformed) {
        finalContent = 'ERROR: Malformed function call. Please try again.';
        console.warn(`[AgentBrain:${this.host.data.name}] Malformed function call detected.`);
      } else if (hasToolCallsOnly && !isInternalTrigger) {
        finalContent = isBrief
          ? "Project brief set. Let's begin!"
          : 'Working on it...';
      } else if (!text && toolCalls.length === 0 && !isInternalTrigger) {
        finalContent = '...';
      }

      // UI/UX handling for chat auto-closing
      if (options.isChat && (isBrief || isResolution)) {
        setTimeout(() => {
          if (useUiStore.getState().isChatting) useUiStore.getState().setChatting(false);
          useUiStore.getState().setSelectedNpc(null);
        }, 3000);
      }

      const isInternalMessage = isInternalTrigger || (hasToolCallsOnly && isInternalTrigger);
      this.history.push({
        role: 'assistant',
        content: finalContent,
        tool_calls: response.tool_calls,
        metadata: isInternalMessage ? { internal: true } : undefined
      });
      this.syncToStore();

      // 7. Process Actions (Tools)
      for (const tc of toolCalls) {
        const result = ToolRegistry.process(this.host as any, tc);
        if (tc.name === 'deliver_project' && result) {
          this.handleFinalAssetGeneration(tc.args.output);
        }
        
        // Feed tool results back to history to satisfy strict APIs (OpenAI/Anthropic)
        this.history.push({
          role: 'tool',
          name: tc.id,
          content: typeof result === 'object' ? JSON.stringify(result) : String(result),
          metadata: { internal: true }
        });
      }
      if (toolCalls.length > 0) {
        this.syncToStore();
      }

      return { text, toolCalls };
    } catch (error) {
      console.error(`[AgentBrain:${this.host.data.name}] Logic error:`, error);
      const errMsg = error instanceof Error ? error.message : String(error);
      useUiStore.getState().setBYOKOpen(true, errMsg);
      throw error;
    } finally {
      this.isThinking = false;
      this.host.simulation.processScheduledTasks();
    }
  }

  /** Autonomous Intent: Start the project strategy. */
  public async spark() {
    return this.think('Start the project by proposing initial tasks.', { silent: true });
  }

  /** Autonomous Intent: Work on a specific task. */
  public async executeTask(taskId: string) {
    return this.think(`Proceed with task: ${taskId}`, { silent: true });
  }

  /** Autonomous Intent: Finalize and deliver the project results. */
  public async concludeProject() {
    return this.think('All tasks are complete! Use the deliver_project tool to fulfill the final delivery with the project result.', { silent: true });
  }

  private async handleFinalAssetGeneration(prompt: string) {
    const core = useCoreStore.getState();
    const teamId = useTeamStore.getState().selectedAgentSetId;
    const activeTeam = useTeamStore.getState().customSystems.find(s => s.id === teamId)
      || AGENTIC_SETS.find(s => s.id === teamId);

    if (!activeTeam) return;

    // Check if we need manual approval
    if (activeTeam.outputAutoApprove === false) {
      core.setPendingOutputPrompt(prompt);

      // Prepare default params based on output type
      const defaultParams: any = { model: activeTeam.outputModel };
      if (activeTeam.outputType === 'image') {
        defaultParams.aspectRatio = '16:9';
        defaultParams.imageSize = '1K';
      } else if (activeTeam.outputType === 'video') {
        defaultParams.resolution = '720p';
        defaultParams.aspectRatio = '16:9';
        defaultParams.durationSeconds = 4;
      }

      core.setPendingOutputParams(defaultParams);
      core.setReviewingOutput(true);
      return;
    }

    // Standard auto-approve flow
    await this.processFinalAsset(prompt, { model: activeTeam.outputModel });
  }

  public async processFinalAsset(prompt: string, options: any) {
    const core = useCoreStore.getState();
    const teamId = useTeamStore.getState().selectedAgentSetId;
    const activeTeam = useTeamStore.getState().customSystems.find(s => s.id === teamId)
      || AGENTIC_SETS.find(s => s.id === teamId);

    if (!activeTeam) return;

    core.setIsGeneratingAsset(true);
    core.setReviewingOutput(false);

    try {
      const llmConfig = useUiStore.getState().llmConfig;
      const model = options.model || activeTeam.outputModel || llmConfig.model;
      const provider = createLLMProvider({ ...llmConfig, model }) as any;

      core.addLogEntry({
        agentIndex: -1,
        action: `Generating final ${activeTeam.outputType} using ${model}...`,
        taskId: undefined
      });

      let assetContent: string = '';
      let usage: any = undefined;

      if (activeTeam.outputType === 'image') {
        const result = await provider.generateImage(prompt, model, (msg: string) => {
          console.log(`[System:Image] ${msg}`);
        }, options, core.referenceImages);
        assetContent = result.data || '';
        usage = result.usage;
      } else if (activeTeam.outputType === 'music') {
        const result = await provider.generateAudio(prompt, model, (msg: string) => {
          console.log(`[System:Audio] ${msg}`);
        });
        assetContent = result.data || '';
        usage = result.usage;
      } else if (activeTeam.outputType === 'video') {
        const result = await provider.generateVideo(prompt, model, (msg: string) => {
          console.log(`[System:Video] ${msg}`);
        }, options, core.referenceImages);
        assetContent = result.videoUrl || '';
        usage = result.usage;
      } else if (activeTeam.outputType === 'text') {
        // For text, the prompt is the final output
        core.setFinalOutput(prompt);
        core.setPhase('done');
        core.setFinalOutputOpen(true);
        core.setIsGeneratingAsset(false);
        return;
      }

      core.addResponseLog({
        agentIndex: -1,
        agentName: 'System',
        content: `Final ${activeTeam.outputType} generated successfully.`,
        usage: usage,
        raw: { model, ...usage },
        taskId: undefined
      });

      core.setFinalOutput(prompt);
      core.setFinalAsset(activeTeam.outputType === 'music' ? 'audio' : activeTeam.outputType as any, assetContent);
      core.setPhase('done');
      core.setFinalOutputOpen(true);
    } catch (error) {
      console.error('[AgentBrain] Final asset generation failed:', error);
      core.setIsGeneratingAsset(false);
      const errMsg = error instanceof Error ? error.message : String(error);
      useUiStore.getState().setBYOKOpen(true, errMsg);
      core.addLogEntry({
        agentIndex: 0,
        action: `Error generating final ${activeTeam.outputType}: ${errMsg}`,
        taskId: undefined
      });
    }
  }

  public appendHistory(message: LLMMessage) {
    this.refreshFromStore();
    this.history.push(message);
    this.syncToStore();
  }

  private refreshFromStore() {
    const history = useCoreStore.getState().agentHistories[this.host.data.index];
    if (history) this.history = [...history];
  }

  private syncToStore() {
    useCoreStore.getState().setAgentHistory(this.host.data.index, this.history);
  }
}
