import { Cpu, Save, Shield, Target, Trash2, User, X, Check, Pipette, Globe } from 'lucide-react';
import React, { useState, useMemo, useEffect } from 'react';
import { useUiStore } from '../../integration/store/uiStore';
import { AgentNode, AgenticSystem, USER_ID, USER_NAME, DEFAULT_MAX_ITERATIONS, getAllCharacters } from '../../data/agents';
import { USER_COLOR, USER_COLOR_LIGHT, USER_COLOR_SOFT } from '../../theme/brand';
import { useCoreStore } from '../../integration/store/coreStore';
import { useTeamStore } from '../../integration/store/teamStore';
import { Avatar } from '../components/Avatar';
import { ColorPicker } from './ColorPicker';
import { InfoBubble } from './InfoBubble';
import { CORE_TOOLS } from '../../core/llm/toolDefinitions';
import { SkillLoader } from '../../core/skills/SkillLoader';
import { AgentSkill } from '../../core/skills/types';
import { getBrightness } from './colorUtils';

interface AgentConfigPanelProps {
  agent: AgentNode;
  system: AgenticSystem;
  onClose: (wasSaved: boolean) => void;
  onUpdate: (updatedAgent: AgentNode) => void;
  onRemove?: () => void;
  mode?: 'view' | 'edit';
}

export const AgentConfigPanel: React.FC<AgentConfigPanelProps> = ({
  agent,
  system: activeSystem,
  onClose,
  onUpdate,
  onRemove,
  mode = 'edit'
}) => {
  const isView = mode === 'view';
  const { availableModels } = useCoreStore();
  const { saveCustomSystem } = useTeamStore();

  const [editData, setEditData] = useState<AgentNode>(agent);
  const isUser = agent.index === 0;
  const isLead = agent.index === 1;

  useEffect(() => {
    setEditData(agent);
  }, [agent]);

  const updateDraft = (changes: Partial<AgentNode>) => {
    const newData = { ...editData, ...changes };
    setEditData(newData);
    onUpdate(newData);
  };

  const allCharacters = useMemo(() => getAllCharacters(activeSystem), [activeSystem]);

  const availableNext = useMemo(() => {
    if (isLead) return [{ id: USER_ID, name: USER_NAME }];
    return allCharacters.filter(c => c.id !== agent.id);
  }, [allCharacters, agent.id, isLead]);

  const availableRetry = useMemo(() => {
    const list = [...allCharacters.filter(c => c.id !== agent.id || c.id === agent.id)];
    // Always allow retrying to the User (HITL)
    if (!list.some(c => c.id === USER_ID)) {
      list.unshift({
        id: USER_ID,
        name: USER_NAME,
        index: 0,
        instruction: '',
        color: USER_COLOR,
        model: 'Human'
      } as AgentNode);
    }
    return list;
  }, [allCharacters, agent.id]);

  const nameCollision = useMemo(() => {
    return allCharacters.some(c =>
      c.id !== agent.id && c.name.toLowerCase().trim() === editData.name.toLowerCase().trim()
    );
  }, [allCharacters, agent.id, editData.name]);

  const isValid = useMemo(() => {
    const brightness = getBrightness(editData.color);
    const isNameEmpty = editData.name.trim() === '';
    return brightness <= 180 && !nameCollision && !isNameEmpty;
  }, [editData.color, editData.name, nameCollision]);

  const handleSave = () => {
    if (!isValid) return;

    const oldId = agent.id;
    const newId = editData.id;

    // 1. Recursive update function
    const updateRecursive = (node: AgentNode): AgentNode => {
      // If this is the node being edited
      let updatedNode = node.id === agent.id ? { ...editData } : { ...node };

      // Update references if ID changed
      if (oldId !== newId) {
        updatedNode = {
          ...updatedNode,
          nextId: updatedNode.nextId === oldId ? newId : updatedNode.nextId,
          retryId: updatedNode.retryId === oldId ? newId : updatedNode.retryId,
        };
      }

      // Recurse subagents
      if (updatedNode.subagents) {
        updatedNode.subagents = updatedNode.subagents.map(updateRecursive);
      }

      return updatedNode;
    };

    const newLeadAgent = updateRecursive(activeSystem.leadAgent);

    const updatedSystem: AgenticSystem = {
      ...activeSystem,
      leadAgent: newLeadAgent,
    };

    saveCustomSystem(updatedSystem);
    onClose(true); // SAVED
  };

  const handleNameChange = (name: string) => {
    // Limit to letters, numbers and spaces
    const sanitizedName = name.replace(/[^a-zA-Z0-9 ]/g, '');
    const id = sanitizedName.trim().toLowerCase().replace(/ /g, '-');
    updateDraft({ name: sanitizedName, id });
  };


  const renderField = (label: string, icon: React.ReactNode, value: React.ReactNode, helpText?: string, inline?: boolean) => (
    <div className={inline ? "flex items-center justify-between" : "space-y-1.5"}>
      <div className="flex items-center gap-1.5">
        {icon && <div className="text-zinc-400 shrink-0">{icon}</div>}
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">{label}</label>
        {helpText && <InfoBubble text={helpText} />}
      </div>
      <div className={inline ? "" : "px-1"}>{value}</div>
    </div>
  );

  return (
    <div className="w-80 h-full bg-white border-l border-zinc-100 flex flex-col pointer-events-auto overflow-hidden animate-in slide-in-from-right-full duration-300">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
        <div className="flex items-center gap-2">
          {isUser ? (
            <Avatar type="user" color={USER_COLOR} size={32} />
          ) : (
            <Avatar type={isLead ? 'lead' : 'sub'} color={editData.color} size={32} />
          )}
          <h3 className="font-bold text-sm text-zinc-800 uppercase tracking-tight truncate">
            {isUser ? 'User Info' : (isLead ? 'Lead Agent Info' : 'Subagent Info')}
          </h3>
        </div>
        <button onClick={() => onClose(false)} className="p-1 hover:bg-zinc-200 rounded-md transition-colors text-zinc-400">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-8">
        {isUser ? (
          <div
            className="flex flex-col items-center justify-center p-8 text-center space-y-4 rounded-3xl border italic"
            style={{ backgroundColor: USER_COLOR_LIGHT, borderColor: USER_COLOR_SOFT }}
          >
            <div
              className="p-1 rounded-2xl text-white shadow-lg"
              style={{ backgroundColor: 'transparent', boxShadow: `0 10px 15px -3px ${USER_COLOR}33` }}
            >
              <Avatar type="user" color={USER_COLOR} size={64} />
            </div>
            <div>
              <h4 className="text-sm font-black text-zinc-800 uppercase tracking-widest mb-1">Primary User</h4>
              <p className="text-[11px] text-zinc-500 font-medium leading-relaxed">This is you. Your identity and role are fixed across all teams for consistency.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Identity Group */}
            <div className="space-y-6">
              {!isView && (
                <div className="space-y-1.5 px-1">
                  <div className="flex items-center gap-1.5">
                    <Pipette size={12} className="text-zinc-400" />
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Agent Color</label>
                  </div>
                  <ColorPicker
                    color={editData.color}
                    onChange={(val) => updateDraft({ color: val })}
                  />
                </div>
              )}

              {renderField('Name', <User size={12} />, isView ? (
                <p className="text-sm font-bold text-zinc-900">{editData.name}</p>
              ) : (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={editData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className={`w-full px-3 py-2 bg-zinc-50 border rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-black/5 ${nameCollision ? 'border-red-500 text-red-600' : 'border-zinc-200'
                      }`}
                  />
                  {nameCollision && (
                    <p className="text-[9px] text-red-500 font-bold uppercase tracking-tight px-1">
                      This name is already used in the team
                    </p>
                  )}
                </div>
              ), 'Limit characters to letters, numbers and spaces. The ID is auto-generated.')}

              {renderField('LLM Model', <Cpu size={12} />, isView ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 border border-zinc-200 rounded-lg text-xs font-mono text-zinc-600 w-fit">
                  {editData.model || 'gemini-3-flash-preview'}
                </div>
              ) : (
                <select
                  value={editData.model || 'gemini-3-flash-preview'}
                  onChange={(e) => updateDraft({ model: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-black/5 cursor-pointer"
                >
                  {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              ), 'The specific Gemini model this agent will use.')}
            </div>

            {/* Content Group */}
            <div className="space-y-6">
              {renderField('Description', <Target size={12} />, isView ? (
                <p className="text-xs text-zinc-600 leading-relaxed font-medium italic bg-zinc-50/50 p-3 rounded-xl border border-zinc-100/50">
                  {editData.description || "No description provided."}
                </p>
              ) : (
                <input
                  type="text"
                  value={editData.description}
                  onChange={(e) => updateDraft({ description: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-black/5"
                  placeholder="Concise summary of capabilities..."
                />
              ), 'A short summary of what this agent does best.')}

              {renderField('Instructions', <Shield size={12} />, isView ? (
                <div className="bg-zinc-50/50 p-4 rounded-xl border border-zinc-100/50 min-h-[100px]">
                  <p className="text-xs text-zinc-600 leading-relaxed whitespace-pre-wrap font-medium">
                    {editData.instruction}
                  </p>
                </div>
              ) : (
                <textarea
                  value={editData.instruction}
                  onChange={(e) => updateDraft({ instruction: e.target.value })}
                  className="w-full h-48 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-black/5 resize-none font-medium text-zinc-600"
                  placeholder="Core task, persona, and constraints..."
                />
              ), 'Core guidelines and constraints for the agent.')}
            </div>

            {/* Hierarchy Group */}
            <div className="space-y-4 pt-4 border-t border-zinc-100">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300 mb-4">Flow & Hierarchy</h4>

              <div className="grid grid-cols-1 gap-4">
                {renderField('Next Step (Success)', null, isLead || isView ? (
                  <div className="text-[11px] font-bold text-zinc-900 bg-zinc-50 px-2.5 py-1.5 rounded-lg border border-zinc-100 truncate">{allCharacters.find(c => c.id === editData.nextId)?.name || 'None'}</div>
                ) : (
                  <select
                    value={editData.nextId || ''}
                    onChange={(e) => updateDraft({ nextId: e.target.value })}
                    className="w-full px-2 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-[11px] font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="">None</option>
                    {availableNext.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {renderField('Retry on fail', null, isLead || isView ? (
                  <div className="text-[11px] font-bold text-zinc-900 bg-zinc-50 px-2.5 py-1.5 rounded-lg border border-zinc-100 truncate">{isLead ? (editData.retryId === editData.id ? 'Self' : 'N/A') : allCharacters.find(c => c.id === editData.retryId)?.name || 'None'}</div>
                ) : (
                  <select
                    value={editData.retryId || ''}
                    onChange={(e) => updateDraft({ retryId: e.target.value || undefined })}
                    className="w-full px-2 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-[11px] font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="">None</option>
                    {availableRetry.map(c => <option key={c.id} value={c.id}>{c.id === agent.id ? 'Self' : c.name}</option>)}
                  </select>
                ))}

                {!!editData.retryId && renderField('Max Retries', null, isView ? (
                  <div className="text-[11px] font-bold text-zinc-900 bg-zinc-50 px-2.5 py-1.5 rounded-lg border border-zinc-100 truncate">{editData.maxIterations || DEFAULT_MAX_ITERATIONS}</div>
                ) : (
                  <select
                    value={editData.maxIterations || DEFAULT_MAX_ITERATIONS}
                    onChange={(e) => updateDraft({ maxIterations: parseInt(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-[11px] font-bold focus:outline-none cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                ))}
              </div>
            </div>

            {/* Skills Group */}
            <div className="space-y-6 pt-4 border-t border-zinc-100">
              <div className="flex items-center gap-1.5 px-1">
                <Globe size={12} className="text-zinc-400" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">Skills</h4>
              </div>

              {/* Skill Design Patterns (ADK) */}
              <div className="space-y-1.5 px-1">
                <div className="flex items-center justify-between">
                  {renderField('Skill Design Patterns', null, null, undefined, true)}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-zinc-400">Based on</span>
                  <a
                    href="https://lavinigam.com/posts/adk-skill-design-patterns/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-600 hover:underline"
                  >
                    this post
                  </a>
                </div>
                {isView ? (
                  <div className="text-[11px] font-bold text-zinc-900 bg-zinc-50 px-2.5 py-1.5 rounded-lg border border-zinc-100 truncate capitalized">
                    {editData.pattern || 'None'}
                  </div>
                ) : (
                  <select
                    value={editData.pattern || ''}
                    onChange={(e) => updateDraft({ pattern: e.target.value || undefined })}
                    className="w-full px-2 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-[11px] font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="">None (Generalist)</option>
                    <option value="reviewer">Reviewer</option>
                    <option value="generator">Generator</option>
                    <option value="pipeline">Pipeline</option>
                    <option value="tool-wrapper">Tool Wrapper</option>
                    <option value="inversion">Inversion</option>
                  </select>
                )}
              </div>

              {/* Extra Skills Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <Check size={12} className="text-zinc-400" />
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Extra Skills</label>
                  </div>
                  {!isView && (
                    <button
                      onClick={() => useUiStore.getState().setSkillExplorerOpen(true)}
                      className="flex items-center gap-1 px-2 py-1 bg-zinc-900 hover:bg-black text-[9px] font-black uppercase tracking-widest text-white rounded-lg transition-all active:scale-95 shadow-sm"
                    >
                      <Globe size={10} />
                      + Add Skills
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 px-1 pb-1">
                  <span className="text-[9px] font-bold text-zinc-400">Based on</span>
                  <a
                    href="https://agentskills.io/home"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-600 hover:underline"
                  >
                    Agent Skills Open Standard
                  </a>
                </div>

                <div className="px-1">
                  {isView ? (
                    <div className="flex flex-wrap gap-1">
                      {(editData.skills || []).length > 0 ? (
                        editData.skills?.map(s => (
                          <span key={s} className="px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded text-[10px] font-bold border border-zinc-200">
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-zinc-400 italic">No extra skills</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-zinc-50 border border-zinc-100 rounded-xl">
                      {SkillLoader.getAllSkills()
                        .filter(s => s.id !== 'core-skill' && s.metadata.pattern === undefined)
                        .map(skill => {
                          const isSelected = (editData.skills || []).includes(skill.id);
                          return (
                            <button
                              key={skill.id}
                              onClick={() => {
                                const current = editData.skills || [];
                                const next = isSelected
                                  ? current.filter(id => id !== skill.id)
                                  : [...current, skill.id];
                                updateDraft({ skills: next });
                              }}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${isSelected
                                ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm'
                                : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-400'
                                }`}
                            >
                              {skill.metadata.name}
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>

              {/* Capabilities Group */}
              <div className="pt-2">
                <div className="flex items-center gap-1.5 px-1 mb-3">
                  <Cpu size={12} className="text-zinc-400" />
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">Capabilities</h4>
                </div>
                <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 opacity-60">
                    <Check size={12} className="text-zinc-400" />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Complete Task</span>
                  </div>
                  {(editData.subagents?.length || 0) > 0 && (
                    <div className="flex items-center gap-2">
                      <Check size={12} className="text-zinc-900" />
                      <span className="text-[10px] font-bold text-zinc-900 uppercase">Propose Task (Manager)</span>
                    </div>
                  )}
                  {editData.retryId === USER_ID && (
                    <div className="flex items-center gap-2">
                      <Check size={12} className="text-zinc-900" />
                      <span className="text-[10px] font-bold text-zinc-900 uppercase">Human Approval (HITL)</span>
                    </div>
                  )}
                  {editData.retryId && editData.retryId !== USER_ID && (
                    <div className="flex items-center gap-2">
                      <Check size={12} className="text-zinc-900" />
                      <span className="text-[10px] font-bold text-zinc-900 uppercase">Request Revision (Critic)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer Actions */}
      {!isView && !isUser && (
        <div className="p-4 border-t border-zinc-100 bg-zinc-50/30 flex flex-col gap-2">
          <button
            onClick={handleSave}
            disabled={!isValid}
            className={`w-full py-3 bg-zinc-900 hover:bg-black text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-black/5 active:scale-95 ${!isValid ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Save size={16} strokeWidth={2.5} />
            Update Agent
          </button>
          {onRemove && (
            <button
              onClick={onRemove}
              className="w-full py-2.5 text-red-500 hover:bg-red-50 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
            >
              <Trash2 size={14} />
              Remove from Team
            </button>
          )}
        </div>
      )}
    </div>
  );
};
