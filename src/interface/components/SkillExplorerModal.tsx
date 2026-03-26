import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, Download, Check, Globe, Shield, Zap, BookOpen } from 'lucide-react';
import { SkillLoader } from '../../core/skills/SkillLoader';
import { AgentSkill } from '../../core/skills/types';

interface RemoteSkill {
  id: string;
  skillId: string;
  name: string;
  source: string;
  description?: string;
  installs: number;
}

interface SkillExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SkillExplorerModal: React.FC<SkillExplorerModalProps> = ({ isOpen, onClose }) => {
  const [search, setSearch] = useState('');
  const [remoteSkills, setRemoteSkills] = useState<RemoteSkill[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());

  // Search skills.sh Registry
  useEffect(() => {
    if (!isOpen) return;
    
    const handler = setTimeout(async () => {
      setIsLoading(true);
      try {
        const query = search || 'agent'; // Default search
        const response = await fetch(`/api/skills/api/search?q=${encodeURIComponent(query)}&limit=12`);
        if (response.ok) {
          const data = await response.json();
          setRemoteSkills(data.skills || []);
        }
      } catch (e) {
        console.error('Search failed:', e);
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [search, isOpen]);

  if (!isOpen) return null;

  const fetchSkillContent = async (source: string, skillId: string) => {
    // 1. Strip provider prefix if present (e.g. "github/owner/repo" -> "owner/repo")
    const sourceParts = source.split('/');
    const repoPath = (sourceParts.length > 2 && (sourceParts[0] === 'github' || sourceParts[0] === 'github.com'))
      ? sourceParts.slice(1).join('/')
      : source;

    // 2. Identify owner prefix (e.g. from "vercel-labs/skills" get "vercel")
    const ownerName = repoPath.split('/')[0];
    const ownerShortPrefix = ownerName.split('-')[0];
    const skillIdWithoutPrefix = (ownerShortPrefix && skillId.startsWith(ownerShortPrefix + '-'))
      ? skillId.substring(ownerShortPrefix.length + 1)
      : null;

    const branches = ['main', 'master'];
    const basePaths = [
      `skills/${skillId}/SKILL.md`,
      `.agents/skills/${skillId}/SKILL.md`,
      `SKILL.md`
    ];
    
    if (skillIdWithoutPrefix) {
      basePaths.unshift(`skills/${skillIdWithoutPrefix}/SKILL.md`);
    }

    const errors: string[] = [];

    for (const branch of branches) {
      for (const path of basePaths) {
        try {
          const url = `https://raw.githubusercontent.com/${repoPath}/${branch}/${path}`;
          const res = await fetch(url);
          if (res.ok) return await res.text();
        } catch (e) {}
      }
    }
    
    // Fallback search: If still not found, try searching the repo structure? 
    // Usually too heavy, so we stop here with a clearer message.
    throw new Error(`SKILL.md not found in ${repoPath}. Tried branches [${branches.join(', ')}] and paths [${basePaths.join(', ')}]`);
  };

  const handleImportUrl = async () => {
    if (!importUrl) return;
    setIsImporting(true);
    try {
      const response = await fetch(importUrl);
      const content = await response.text();
      
      const fileName = importUrl.split('/').pop() || 'imported-skill.md';
      const id = fileName.replace('.md', '').toLowerCase();
      
      const skill = SkillLoader.parseSkill(fileName, content, id);
      if (skill) {
        await SkillLoader.saveUserSkill(skill);
        setImportUrl('');
        alert('Skill imported successfully!');
      } else {
        alert('Failed to parse skill. Ensure it follows the SKILL.md standard.');
      }
    } catch (e) {
      alert('Error fetching skill. Check the URL and CORS policy.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownload = async (remote: RemoteSkill) => {
    setDownloading(remote.id);
    
    try {
      const content = await fetchSkillContent(remote.source, remote.skillId);
      const skill = SkillLoader.parseSkill(`${remote.skillId}/SKILL.md`, content, remote.skillId);
      
      if (skill) {
        await SkillLoader.saveUserSkill(skill);
        setDownloaded(prev => new Set(prev).add(remote.id));
      } else {
        alert('Could not parse the remote skill content.');
      }
    } catch (e) {
      alert(`Error installing skill: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-white/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="px-8 py-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white shadow-lg shadow-indigo-200 rounded-2xl">
              <Globe size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-zinc-800">Add Skills</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <a 
                  href="https://skills.sh" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 underline flex items-center gap-1.5"
                >
                  <Globe size={10} /> Browse at skills.sh
                </a>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-2xl transition-all text-zinc-400">
            <X size={24} />
          </button>
        </div>

        {/* Marketplace Search & Import */}
        <div className="px-8 py-5 bg-zinc-50/50 space-y-5">
          <div className="grid grid-cols-1 gap-5">
            {/* Import - First */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-1">Import from URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Paste SKILL.md URL (GitHub raw, skills.sh...)"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  className="flex-1 px-4 py-3 bg-white border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none shadow-sm focus:ring-2 focus:ring-indigo-50"
                />
                <button
                  onClick={handleImportUrl}
                  disabled={isImporting || !importUrl}
                  className="px-6 py-3 bg-zinc-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 hover:bg-black transition-all active:scale-95"
                >
                  {isImporting ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>

            {/* Search - Second (Next to results) */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-1 font-bold">Search at skills.sh</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                <input
                  type="text"
                  placeholder="Find skills (e.g., search, web, coding)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-zinc-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-4 focus:ring-indigo-50 transition-all shadow-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-8 pt-4 space-y-4">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center text-zinc-400 space-y-4">
              <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
              <p className="text-sm font-bold uppercase tracking-widest">Searching skills.sh...</p>
            </div>
          ) : remoteSkills.length > 0 ? (
            remoteSkills.map(skill => {
              const isDownloaded = downloaded.has(skill.id) || !!SkillLoader.getSkill(skill.skillId);
              const isDownloading = downloading === skill.id;

              return (
                <div key={skill.id} className="p-5 border border-zinc-100 rounded-[24px] hover:border-indigo-100 hover:bg-indigo-50/30 transition-all flex items-center justify-between bg-white shadow-sm group">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
                      <Zap size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-sm text-zinc-800 uppercase tracking-tight">{skill.name}</h4>
                        <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded text-[9px] font-black uppercase">{skill.source.split('/')[1] || skill.source}</span>
                      </div>
                      <p className="text-xs text-zinc-500 font-medium mt-0.5 line-clamp-1">{skill.description || 'Community skill via skills.sh'}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter flex items-center gap-1">
                          <Check size={10} className="text-zinc-300" /> {skill.installs.toLocaleString()} installs
                        </span>
                        <a 
                          href={`https://github.com/${skill.source.replace('github/', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                        >
                          <Globe size={10} /> View Source
                        </a>
                      </div>
                    </div>
                  </div>

                  <button
                    disabled={isDownloaded || isDownloading}
                    onClick={() => handleDownload(skill)}
                    className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${isDownloaded
                        ? 'bg-emerald-50 text-emerald-600 cursor-default'
                        : 'bg-zinc-900 text-white hover:scale-105 active:scale-95 shadow-md shadow-zinc-200'
                      }`}
                  >
                    {isDownloading ? (
                      <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : isDownloaded ? (
                      <Check size={14} />
                    ) : (
                      <Download size={14} />
                    )}
                    {isDownloading ? 'Installing...' : isDownloaded ? 'Installed' : 'Install'}
                  </button>
                </div>
              );
            })
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-zinc-400 italic space-y-2">
              <Search size={48} className="opacity-20" />
              <p className="text-sm">No community skills found for "{search}"</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-zinc-50 border-t border-zinc-100 flex items-center justify-center">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Based on AgentSkills.io Standard</p>
        </div>
      </div>
    </div>
  );
};
