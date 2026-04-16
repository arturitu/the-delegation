import { AgentNode, AGENTIC_SETS } from '../../data/agents';
import { useCoreStore } from '../../integration/store/coreStore';
import { useTeamStore } from '../../integration/store/teamStore';

export class PromptBuilder {
  /**
   * Builds the system prompt for an agent based on their role and current project context.
   */
  public static buildSystemPrompt(agent: AgentNode, phase: string, brief: string, allAgents: any[], isLocal: boolean = false): string {
    const isLead = agent.index === 1;
    const team = allAgents
      .map((a: any) => `[${a.data.index}] ${a.data.name}`)
      .join(', ');

    const objectives = {
      idle: isLead ? 'Chat with [0] to define brief, then set_user_brief.' : 'Wait for Lead to start.',
      working: isLead ? 'Manage board. deliver_project when all Done.' : 'Complete tasks.',
      done: 'Project finished.'
    };

    const tasks = useCoreStore.getState().tasks;
    const board = tasks.length > 0
      ? tasks.map(t => {
          const agentName = allAgents.find((a: any) => a.data.index === t.assignedAgentId)?.data?.name || `Agent ${t.assignedAgentId}`;
          
          const feedbackStr = t.reviewComments 
            ? `\n   >> USER FEEDBACK / REVISION REQUESTED: "${t.reviewComments}"` 
            : '';
            
          const outputStr = (t.status === 'done' && t.output)
            ? `\n   >> FINAL APPROVED WORK:\n   """\n   ${t.output}\n   """` 
            : '';

          return `* [${t.status.toUpperCase()}] ${t.title} (Owner: ${agentName})${feedbackStr}${outputStr}`;
        }).join('\n\n')
      : 'Empty';

    const selectedTeamId = useTeamStore.getState().selectedAgentSetId;
    const activeTeam = useTeamStore.getState().customSystems.find(s => s.id === selectedTeamId) 
      || AGENTIC_SETS.find(s => s.id === selectedTeamId);
      
    const referenceImages = useCoreStore.getState().referenceImages;
    const hasImages = referenceImages.length > 0 && (activeTeam?.outputType === 'image' || activeTeam?.outputType === 'video');
    
    let modelLimitInfo = '';
    if (activeTeam?.outputType === 'video') {
      if (activeTeam.outputModel?.includes('lite')) {
        modelLimitInfo = ` Note: The current model (${activeTeam.outputModel}) supports only 1 reference image for animation.`;
      } else {
        modelLimitInfo = ` Note: The current model (${activeTeam.outputModel}) supports up to 3 reference images for style and content guidance.`;
      }
    }

    const imageInstruction = hasImages
      ? `\n6. REFERENCE IMAGES: The user has provided ${referenceImages.length} reference image(s). You MUST use these as a visual guide for the project's style, mood, and content. Your team should analyze these to ensure the final ${activeTeam?.outputType} aligns with the inspiration.${modelLimitInfo}`
      : '';

    const outputInstruction = activeTeam?.outputType !== 'text' 
      ? `\n4. TEAM OUTPUT: ${activeTeam?.outputType?.toUpperCase()}. Your 'deliver_project' output MUST be a highly detailed PROMPT for a ${activeTeam?.outputType} generator model (${activeTeam?.outputModel}).
CRITICAL: You MUST synthesize all subagent findings, research results, and any user feedback into this final prompt. DO NOT just repeat your initial brief.
The generation model expects a SINGLE prompt to produce a SINGLE ${activeTeam?.outputType}. Be precise.`
      : '';

    const pendingReviews = tasks.filter(t => t.assignedAgentId === agent.index && t.reviewComments);
    const reviewContext = pendingReviews.length > 0
      ? `\nREVISION REQUESTED:\n${pendingReviews.map(t => `- [${t.title}] Feedback: ${t.reviewComments}`).join('\n')}`
      : '';

    const localProtocol = isLocal 
      ? `\n6. TOOL CALLING PROTOCOL: To use a tool, you MUST output a JSON block wrapped in <tool_call> tags. Example: <tool_call>{"name": "create_task", "args": {"title": "Research X", "assignedAgentId": 2}}</tool_call>. DO NOT use tools if not explicitly required by your phase goals. ALWAYS finish your response with the tool call if you use one.`
      : '';

    return `ID: ${agent.name}. Role: ${agent.description}. Phase: ${phase}.
${brief ? `Brief: ${brief}` : ''}${reviewContext}
Team: User (0), ${team}
KANBAN:
${board}
RULES:
1. MAX 30 WORDS for chat. Systemic outputs ('complete_task', 'deliver_project', and the task titles/descriptions you create) MUST be under 100 WORDS. NO conversational filler, intros, outros, or self-attribution ("I have done..."). Focus exclusively on core data and synthesis.
2. Tools only in WORKING (except set_user_brief in IDLE).
3. QUALITY: If your node has 'Human-in-the-loop' enabled, your 'complete_task' result will be reviewed by the user before completion. 
4. NO META-TALK: Avoid "I have finished X", "Here is the result". Use the tool payload for content and Chat for conversation only.${outputInstruction}${imageInstruction}
5. LANGUAGE: You MUST generate all systemic outputs (tasks, 'complete_task' results, and 'deliver_project' prompts) in the same language as the 'Brief' or the user's interaction. If the project description is in Spanish, EVERYTHING you generate must be in Spanish.${localProtocol}
Goal: ${objectives[phase as keyof typeof objectives] || ''}`;
  }
}
