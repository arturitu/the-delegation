import React, { useEffect, useRef, useState } from 'react'
import { useAgencyStore, DebugLogEntry } from '../integration/store/agencyStore'
import { getAgentSet } from '../data/agents'
import { ChevronDown, ChevronRight, MessageSquare, Terminal, Eye, Zap, Copy, Check, Download, Filter } from 'lucide-react'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`p-1 rounded transition-all cursor-pointer ${copied ? 'text-emerald-500' : 'text-zinc-300 hover:text-zinc-600 hover:bg-zinc-100'}`}
      title="Copy to clipboard"
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
    </button>
  );
};

const DebugEntryView: React.FC<{ entry: DebugLogEntry }> = ({ entry }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedAgentSetId = useAgencyStore((s) => s.selectedAgentSetId);
    const agents = getAgentSet(selectedAgentSetId).agents;
    const agent = agents.find(a => a.index === entry.agentIndex);

    // Parse tool calls from rawContent (only available in response entries)
    // Structure: { text: string, toolCalls: LLMToolCall[] }
    // where LLMToolCall = { id, type, function: { name, arguments (JSON string) } }
    let toolCalls: any[] = [];
    let parsedResponse: any = null;
    if (entry.phase === 'response') {
        try {
            parsedResponse = JSON.parse(entry.rawContent);
            if (Array.isArray(parsedResponse.toolCalls)) {
                toolCalls = parsedResponse.toolCalls;
            }
        } catch (e) {
            // rawContent is not valid JSON
        }
    }

    const fullContent = `
AGENT: ${agent?.role} (${entry.phase})
TIME: ${formatTime(entry.timestamp)}
PHASE: ${entry.phase}

SYSTEM PROMPT:
${entry.systemPrompt}

DYNAMIC CONTEXT:
${entry.dynamicContext}

${entry.phase === 'request' ? 'REQUEST MESSAGE' : 'RAW RESPONSE'}:
${entry.rawContent}
    `.trim();

    return (
        <div className="border-b border-zinc-50 last:border-0 py-3 group">
            <div className="flex items-center gap-1 mb-1 pr-1">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex-1 flex items-center justify-between text-left hover:bg-zinc-50/50 rounded p-1 transition-colors cursor-pointer"
                >
                    <div className="flex flex-col gap-1.5 w-full">
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: agent?.color ?? '#ccc' }} />
                                <span className="text-[10px] font-black text-zinc-800 uppercase tracking-widest leading-none">
                                    {agent?.role}
                                </span>
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter ${
                                    entry.phase === 'request' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                                }`}>
                                    {entry.phase}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[8px] font-mono text-zinc-400">{formatTime(entry.timestamp)}</span>
                                {isOpen ? <ChevronDown size={12} className="text-zinc-300" /> : <ChevronRight size={12} className="text-zinc-300" />}
                            </div>
                        </div>

                        {/* Summary of tool calls in preview */}
                        {toolCalls.length > 0 && !isOpen && (
                            <div className="flex flex-wrap gap-1 pl-4">
                                {toolCalls.map((tc, i) => (
                                    <span key={i} className="flex items-center gap-1 text-[8px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded shadow-sm">
                                        <Zap size={8} />
                                        {tc.function?.name ?? tc.name}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </button>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <CopyButton text={fullContent} />
                </div>
            </div>

            {isOpen && (
                <div className="mt-2 space-y-2 pl-4 border-l border-zinc-100">
                    {/* System Prompt — collapsed by default */}
                    <details className="group/sp">
                        <summary className="flex items-center justify-between gap-1.5 py-1 cursor-pointer list-none">
                            <div className="flex items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity">
                                <ChevronRight size={10} className="text-zinc-400 group-open/sp:rotate-90 transition-transform" />
                                <Terminal size={10} />
                                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">System Prompt</span>
                            </div>
                            <div onClick={e => e.stopPropagation()}>
                                <CopyButton text={entry.systemPrompt} />
                            </div>
                        </summary>
                        <pre className="mt-1.5 text-[10px] bg-zinc-50 p-2 rounded leading-relaxed text-zinc-600 whitespace-pre-wrap font-mono border border-zinc-100/50">
                            {entry.systemPrompt}
                        </pre>
                    </details>

                    {/* Dynamic Context — collapsed by default */}
                    <details className="group/dc">
                        <summary className="flex items-center justify-between gap-1.5 py-1 cursor-pointer list-none">
                            <div className="flex items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity">
                                <ChevronRight size={10} className="text-zinc-400 group-open/dc:rotate-90 transition-transform" />
                                <Zap size={10} />
                                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Dynamic Context</span>
                            </div>
                            <div onClick={e => e.stopPropagation()}>
                                <CopyButton text={entry.dynamicContext} />
                            </div>
                        </summary>
                        <pre className="mt-1.5 text-[10px] bg-amber-50/30 p-2 rounded leading-relaxed text-amber-900/70 whitespace-pre-wrap font-mono border border-amber-100/20">
                            {entry.dynamicContext}
                        </pre>
                    </details>

                    <div className="pt-2">
                        <div className="flex items-center justify-between gap-1.5 mb-1.5 opacity-50">
                            <div className="flex items-center gap-1.5">
                                <MessageSquare size={10} />
                                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                                    {entry.phase === 'request' ? 'Request Message' : 'Response Details'}
                                </span>
                            </div>
                            <CopyButton text={entry.rawContent} />
                        </div>
                        {entry.phase === 'response' ? (
                            <div className="space-y-3">
                                {parsedResponse ? (
                                    <>
                                        {/* Formatted Text Content */}
                                        {parsedResponse.text && (
                                            <div className="text-[11px] bg-white p-3 rounded leading-relaxed text-zinc-700 border border-zinc-100 shadow-sm relative italic whitespace-pre-wrap">
                                                <div className="absolute -top-2 left-2 bg-white px-1 text-[8px] font-black uppercase text-zinc-400 border border-zinc-100 rounded">Text</div>
                                                {parsedResponse.text}
                                            </div>
                                        )}

                                        {/* Formatted Tool Calls */}
                                        {toolCalls.length > 0 && (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-1.5 ml-1">
                                                    <Zap size={10} className="text-emerald-500" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Tool calls</span>
                                                </div>
                                                {toolCalls.map((tc, i) => {
                                                    const name = tc.function?.name ?? tc.name ?? '(unknown)';
                                                    let args: Record<string, unknown> | null = null;
                                                    try { args = JSON.parse(tc.function?.arguments ?? '{}'); } catch { args = tc.args ?? null; }
                                                    return (
                                                        <div key={i} className="bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 shadow-lg">
                                                            <div className="bg-zinc-800 px-2.5 py-1.5 flex items-center justify-between">
                                                                <span className="text-[10px] font-black text-emerald-400 font-mono tracking-wider">{name}</span>
                                                                <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-tighter">Arguments</span>
                                                            </div>
                                                            <div className="p-2.5 bg-zinc-900/50">
                                                                {args && Object.keys(args).length > 0 ? (
                                                                    <div className="space-y-1.5">
                                                                        {Object.entries(args).map(([key, value]) => (
                                                                            <div key={key} className="flex flex-col gap-0.5">
                                                                                <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-tighter">{key}</span>
                                                                                <div className="text-[9px] text-zinc-300 font-mono bg-zinc-800/50 p-1.5 rounded border border-zinc-700/50 wrap-break-word whitespace-pre-wrap">
                                                                                    {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-[9px] text-zinc-500 italic">No arguments</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Raw JSON fallback */}
                                        <details className="mt-2">
                                            <summary className="text-[8px] font-bold text-zinc-300 uppercase cursor-pointer hover:text-zinc-500 transition-colors ml-1">View Full Raw JSON</summary>
                                            <pre className="mt-1 text-[9px] bg-zinc-50/50 p-2 rounded text-zinc-400 whitespace-pre overflow-x-auto border border-zinc-100 font-mono">
                                                {entry.rawContent}
                                            </pre>
                                        </details>
                                    </>
                                ) : (
                                    <pre className="text-[10px] bg-white p-2 rounded leading-relaxed text-zinc-600 whitespace-pre-wrap font-mono border border-zinc-100 shadow-sm">
                                        {entry.rawContent}
                                    </pre>
                                )}
                            </div>
                        ) : (
                            <pre className="text-[10px] bg-white p-2 rounded leading-relaxed text-zinc-600 whitespace-pre-wrap font-mono border border-zinc-100 shadow-sm">
                                {entry.rawContent}
                            </pre>
                        )}
                    </div>

                    {entry.messages.length > 1 && (
                        <div>
                             <div className="flex items-center gap-1.5 mb-1.5 opacity-50">
                                <Eye size={10} />
                                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">History Snapshot ({entry.messages.length} msgs)</span>
                            </div>
                            <div className="max-h-40 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {entry.messages.map((m, i) => (
                                    <div key={i} className={`p-1.5 rounded text-[9px] ${m.role === 'user' ? 'bg-zinc-50 border border-zinc-100' : 'bg-emerald-50/30 border border-emerald-100/30'}`}>
                                        <div className="font-bold uppercase tracking-tighter mb-0.5 opacity-40">{m.role}</div>
                                        <div className="line-clamp-3 hover:line-clamp-none transition-all">{typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export function ActionLogPanel() {
  const { setLogOpen, actionLog, debugLog, logFilterAgentIndex, phase, setFinalOutputOpen, selectedAgentSetId } = useAgencyStore()
  const agents = getAgentSet(selectedAgentSetId).agents;
  const [activeTab, setActiveTab] = useState<'activity' | 'technical'>('technical')
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)

  const handleDownloadAll = () => {
    const content = debugLog.map(entry => {
      const agent = agents.find(a => a.index === entry.agentIndex);
      return `
=========================================
AGENT: ${agent?.role} (${entry.phase})
TIME: ${new Date(entry.timestamp).toLocaleString()}
PHASE: ${entry.phase}
=========================================

SYSTEM PROMPT:
${entry.systemPrompt}

-----------------------------------------
DYNAMIC CONTEXT:
${entry.dynamicContext}

-----------------------------------------
${entry.phase === 'request' ? 'REQUEST MESSAGE' : 'RAW RESPONSE'}:
${entry.rawContent}

`.trim();
    }).join('\n\n\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `the-delegation-technical-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Auto-scroll to top when a new log entry arrives (since order is reversed)
  useEffect(() => {
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [actionLog, debugLog, activeTab])

  const filterAgent =
    logFilterAgentIndex !== null ? agents.find(a => a.index === logFilterAgentIndex) ?? null : null

  const entries =
    logFilterAgentIndex !== null
      ? actionLog.filter((e) => e.agentIndex === logFilterAgentIndex).reverse()
      : [...actionLog].reverse()

  const debugEntries =
    logFilterAgentIndex !== null
      ? debugLog.filter((e) => e.agentIndex === logFilterAgentIndex).reverse()
      : [...debugLog].reverse()

  return (
    <div className="w-[320px] h-full bg-white border-r border-zinc-100 flex flex-col pointer-events-auto overflow-hidden shrink-0 relative">
          {/* Header */}
          <div className="h-10 px-5 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0 z-10">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Logs</span>
              {filterAgent && (
                <div
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold text-white uppercase tracking-tighter animate-in fade-in zoom-in duration-200"
                  style={{ backgroundColor: filterAgent.color }}
                >
                  {filterAgent.role}
                  <button
                    onClick={() => setLogOpen(true, null)}
                    className="hover:scale-110 transition-transform cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                  className={`p-1.5 rounded transition-colors cursor-pointer ${
                    isFilterMenuOpen || logFilterAgentIndex !== null
                      ? 'bg-zinc-900 text-white'
                      : 'text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50'
                  }`}
                  title="Filter by agent"
                >
                  <Filter size={14} />
                </button>

                {isFilterMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setIsFilterMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-zinc-100 rounded-xl shadow-xl z-30 py-1.5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      <button
                        onClick={() => {
                          setLogOpen(true, null);
                          setIsFilterMenuOpen(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-50 transition-colors ${
                          logFilterAgentIndex === null ? 'text-zinc-900' : 'text-zinc-400'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${logFilterAgentIndex === null ? 'bg-zinc-900' : 'bg-transparent border border-zinc-200'}`} />
                        All Agents
                      </button>
                      <div className="h-px bg-zinc-50 my-1" />
                      {agents.map((agent) => (
                        <button
                          key={agent.index}
                          onClick={() => {
                            setLogOpen(true, agent.index);
                            setIsFilterMenuOpen(false);
                          }}
                          className={`w-full px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-50 transition-colors ${
                            logFilterAgentIndex === agent.index ? 'text-zinc-900' : 'text-zinc-400'
                          }`}
                        >
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: agent.color }}
                          />
                          {agent.role}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {activeTab === 'technical' && debugEntries.length > 0 && (
                <button
                  onClick={handleDownloadAll}
                  className="text-zinc-400 hover:text-zinc-900 transition-colors p-1 rounded hover:bg-zinc-50 cursor-pointer"
                  title="Download all as .txt"
                >
                  <Download size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex border-b border-zinc-100 bg-zinc-50/30">
            <button
                onClick={() => setActiveTab('activity')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                    activeTab === 'activity' ? 'bg-white border-b-2 border-zinc-900 text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
                }`}
            >
                Activity
            </button>
            <button
                onClick={() => setActiveTab('technical')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                    activeTab === 'technical' ? 'bg-white border-b-2 border-zinc-900 text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
                }`}
            >
                Technical
            </button>
          </div>

          {/* Entries */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 shadow-[inset_0_-20px_20px_-20px_rgba(0,0,0,0.05)]">
            <div ref={topRef} />

            {activeTab === 'activity' ? (
              entries.length === 0 ? (
                <p className="text-zinc-300 text-[10px] font-bold uppercase tracking-widest text-center py-16">Awaiting actions...</p>
              ) : (
                entries.map((entry) => {
                  const agent = agents.find(a => a.index === entry.agentIndex)
                  return (
                    <div key={entry.id} className="flex flex-col gap-1.5 group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-1.5 h-1.5 rounded-full shadow-sm"
                            style={{ backgroundColor: agent?.color ?? '#e4e4e7' }}
                          />
                          <span className="text-[10px] font-black text-zinc-900 uppercase tracking-widest leading-none">
                            {agent?.role ?? 'System'}
                          </span>
                        </div>
                        <span className="text-[9px] font-medium text-zinc-400 font-mono">
                          {formatTime(entry.timestamp)}
                        </span>
                      </div>

                      <div className="pl-3.5 border-l border-zinc-50 group-hover:border-zinc-200 transition-colors">
                        <p className="text-xs text-zinc-600 leading-relaxed font-medium">
                          {entry.action}
                        </p>
                      </div>
                    </div>
                  )
                })
              )
            ) : (
                debugEntries.length === 0 ? (
                    <p className="text-zinc-300 text-[10px] font-bold uppercase tracking-widest text-center py-16">No technical data...</p>
                ) : (
                    debugEntries.map((entry) => (
                        <DebugEntryView key={entry.id} entry={entry} />
                    ))
                )
            )}
          </div>
    </div>
  )
}
