import React, { useState } from 'react'
import { useAgencyStore } from '../store/agencyStore'

export function FinalOutputModal() {
  const { isFinalOutputOpen, setFinalOutputOpen, finalOutput } = useAgencyStore()
  const [copied, setCopied] = useState(false)

  if (!isFinalOutputOpen || !finalOutput) return null

  const handleCopy = async () => {
    await navigator.clipboard.writeText(finalOutput)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={() => setFinalOutputOpen(false)}
    >
      <div
        className="bg-zinc-50 border border-black/10 rounded-2xl w-[640px] max-w-[95vw] max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/5">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-800">
              Your Prompt is Ready
            </h2>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Crafted by your agency team
            </p>
          </div>
          <button
            onClick={() => setFinalOutputOpen(false)}
            className="text-zinc-400 hover:text-zinc-700 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <pre className="text-xs text-zinc-700 leading-relaxed whitespace-pre-wrap font-sans">
            {finalOutput}
          </pre>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-black/5 flex justify-end">
          <button
            onClick={handleCopy}
            className="px-5 py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black active:scale-[0.98] transition-all"
          >
            {copied ? 'Copied!' : 'Copy Prompt'}
          </button>
        </div>
      </div>
    </div>
  )
}
