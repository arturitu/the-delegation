import React, { useState } from 'react'
import { DebugLogEntry } from '../store/agencyStore'
import { AGENTS } from '../data/agents'
import { ChevronDown, ChevronRight, MessageSquare, Terminal, Eye, Zap, Copy, Check } from 'lucide-react'

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export const CopyButton: React.FC<{ text: string }> = ({ text }) => {
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

export const DebugEntryView: React.FC<{ entry: DebugLogEntry }> = ({ entry }) => {
    const [isOpen, setIsOpen] = useState(false);
    const agent = AGENTS.find(a => a.index === entry.agentIndex);

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
                                        {parsedResponse.text && (
                                            <div className="text-[11px] bg-white p-3 rounded leading-relaxed text-zinc-700 border border-zinc-100 shadow-sm relative italic">
                                                <div className="absolute -top-2 left-2 bg-white px-1 text-[8px] font-black uppercase text-zinc-400 border border-zinc-100 rounded">Text</div>
                                                {parsedResponse.text}
                                            </div>
                                        )}

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
