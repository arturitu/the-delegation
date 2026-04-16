import { useState, useEffect } from 'react'
import { useCoreStore } from '../integration/store/coreStore'
import { useActiveTeam } from '../integration/store/teamStore'
import { useSceneManager } from '../simulation/SceneContext'
import {
  Sparkles,
  Settings2,
  Image as ImageIcon,
  Video,
  Music,
  Type,
  X,
  Check,
  Monitor,
  Clock,
  Maximize,
  Volume2,
  AlertCircle
} from 'lucide-react'
import { AVAILABLE_MODELS } from '../core/llm/constants'
import { InfoBubble } from './components/InfoBubble'

export function OutputReviewModal() {
  const {
    isReviewingOutput,
    setReviewingOutput,
    pendingOutputPrompt,
    pendingOutputParams,
    resetProject,
    referenceImages
  } = useCoreStore()

  const activeTeam = useActiveTeam()
  const scene = useSceneManager()
  const [prompt, setPrompt] = useState(pendingOutputPrompt)
  const [params, setParams] = useState(pendingOutputParams)
  const [isConfirmingReset, setIsConfirmingReset] = useState(false)

  // Sync internal state when store changes
  useEffect(() => {
    if (isReviewingOutput) {
      setPrompt(pendingOutputPrompt)
      setParams(pendingOutputParams)
      setIsConfirmingReset(false)
    }
  }, [isReviewingOutput, pendingOutputPrompt, pendingOutputParams])

  if (!isReviewingOutput) return null

  const handleGenerate = async () => {
    const brain = scene?.getLeadBrain()
    if (brain) {
      // Trigger the actual generation
      await brain.processFinalAsset(prompt, params)
    }
  }

  const handleCancelAndReset = () => {
    setIsConfirmingReset(true)
  }

  const confirmReset = () => {
    resetProject()
    setIsConfirmingReset(false)
    setReviewingOutput(false)
  }

  const updateParam = (key: string, value: any) => {
    setParams((prev: any) => ({ ...prev, [key]: value }))
  }

  const renderImageControls = () => (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
          <Maximize size={12} /> Aspect Ratio
          <InfoBubble text="The horizontal or vertical proportions of the generated asset." />
        </label>
        <select
          value={params.aspectRatio || '16:9'}
          onChange={(e) => updateParam('aspectRatio', e.target.value)}
          className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-darkDelegation outline-none"
        >
          <option value="1:1">1:1 Square</option>
          <option value="16:9">16:9 Cinematic</option>
          <option value="9:16">9:16 Vertical</option>
          <option value="4:3">4:3 Classic</option>
          <option value="3:2">3:2 Professional</option>
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
          <Settings2 size={12} /> Image Size
          <InfoBubble text="Target dimensions for the final image. Higher sizes offer more detail but may take longer." />
        </label>
        <select
          value={params.imageSize || '1K'}
          onChange={(e) => updateParam('imageSize', e.target.value)}
          className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-darkDelegation outline-none"
        >
          <option value="512">512px (Fast)</option>
          <option value="1K">1K (Standard)</option>
          <option value="2K">2K (High Res)</option>
          <option value="4K">4K (Ultra)</option>
        </select>
      </div>
    </div>
  )

  const renderVideoControls = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
            <Monitor size={12} /> Resolution
            <InfoBubble text="Video output quality. Higher resolutions increase visual fidelity and processing requirements." />
          </label>
          <select
            value={params.resolution || '720p'}
            onChange={(e) => updateParam('resolution', e.target.value)}
            className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-darkDelegation outline-none"
          >
            <option value="720p">720p HD</option>
            <option value="1080p">1080p Full HD</option>
            <option value="4k">4K Vision</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
            <Clock size={12} /> Duration
            <InfoBubble text="Total runtime of the generated video clip." />
          </label>
          <select
            value={params.durationSeconds || 4}
            onChange={(e) => updateParam('durationSeconds', parseInt(e.target.value))}
            className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-darkDelegation outline-none"
          >
            <option value="4">4 Seconds</option>
            <option value="6">6 Seconds</option>
            <option value="8">8 Seconds</option>
          </select>
        </div>
      </div>
    </div>
  )

  const renderModelControl = () => {
    const type = activeTeam.outputType === 'music' ? 'music' : (activeTeam.outputType as keyof typeof AVAILABLE_MODELS);
    const models = AVAILABLE_MODELS[type] || [];

    return (
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
          <Sparkles size={12} /> Generation Model
          <InfoBubble text="Select the specific Gemini model used for the final generation. Flash models are faster, Pro models are more capable." />
        </label>
        <select
          value={params.model || activeTeam.outputModel}
          onChange={(e) => updateParam('model', e.target.value)}
          className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-darkDelegation outline-none"
        >
          {models.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
    )
  }

  const Icon = {
    image: ImageIcon,
    video: Video,
    music: Music,
    text: Type
  }[activeTeam.outputType] || Sparkles

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-darkDelegation/40 backdrop-blur-md p-4"
      onClick={handleCancelAndReset}
    >
      <div
        className="bg-white border border-black/10 rounded-[32px] w-180 max-w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-100 bg-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-darkDelegation flex items-center justify-center text-white shadow-lg">
              <Icon size={24} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-darkDelegation flex items-center gap-2">
                Review & Optimize Output
              </h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                The lead agent has synthesized the team's work. Fine-tune it before final generation.
              </p>
            </div>
          </div>
          <button
            onClick={handleCancelAndReset}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-all active:scale-90"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8 bg-zinc-50/30">
          {/* Prompt Editor */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                PROMPT / CONTENT
              </label>
              <div className="px-2 py-0.5 bg-zinc-100 rounded text-[9px] font-bold text-zinc-400 tracking-tighter">
                EDITABLE
              </div>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full h-40 bg-white border border-zinc-200 rounded-2xl p-4 text-sm text-zinc-700 leading-relaxed font-sans focus:ring-2 focus:ring-darkDelegation outline-none resize-none shadow-sm"
              placeholder="Enter the final generation prompt..."
            />
          </div>

          {/* Parameters Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              {renderModelControl()}
              {activeTeam.outputType === 'image' && renderImageControls()}
              {activeTeam.outputType === 'video' && renderVideoControls()}
            </div>

            <div className="bg-darkDelegation rounded-[24px] p-6 text-white space-y-4 shadow-xl">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">System Information</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Team</p>
                  <p className="text-xs font-black">{activeTeam.teamName}</p>
                </div>
                <div>
                  <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Output Type</p>
                  <p className="text-xs font-black capitalize">{activeTeam.outputType}</p>
                </div>

                {referenceImages.length > 0 && (
                  <div className="pt-6 border-t border-white/10 space-y-3">
                    <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Visual Inspiration</p>
                    <div className="grid grid-cols-3 gap-2">
                      {referenceImages.map((img, idx) => (
                        <div key={idx} className="aspect-square rounded-lg overflow-hidden border border-white/5 bg-white/5">
                          <img src={img} alt="Ref" className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-white/10">
                  <p className="text-[10px] leading-relaxed text-zinc-400 italic">
                    "This is the final terminal phase. You can adjust the parameters and the synthesized prompt to get the best result. Once approved, the simulation will complete and your asset will be generated."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-zinc-100 flex justify-end items-center bg-white gap-3">
          <button
            onClick={handleCancelAndReset}
            className="px-6 py-3 bg-white border border-zinc-200 text-zinc-500 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] hover:bg-zinc-50 hover:text-red-500 hover:border-red-500 transition-all active:scale-[0.98]"
          >
            Cancel & Reset Project
          </button>

          <button
            onClick={handleGenerate}
            className="px-8 py-3 bg-darkDelegation text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] hover:bg-black active:scale-[0.98] transition-all shadow-lg shadow-black/10 flex items-center gap-2"
          >
            <Check size={14} strokeWidth={3} />
            Approve & Generate
          </button>
        </div>
      </div>

      {/* Confirmation Modal Overlay */}
      {isConfirmingReset && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-darkDelegation/40 backdrop-blur-md p-4 cursor-default"
          onClick={(e) => {
            e.stopPropagation()
            setIsConfirmingReset(false)
          }}
        >
          <div
            className="bg-white border border-black/10 rounded-[24px] w-96 p-8 shadow-2xl flex flex-col items-center text-center gap-6 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center text-red-500">
              <AlertCircle size={32} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-darkDelegation">Are you absolutely sure?</h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                All progress will be lost and the project will be reset to its initial state. This action cannot be undone.
              </p>
            </div>
            <div className="flex flex-col w-full gap-2 mt-2">
              <button
                onClick={confirmReset}
                className="w-full py-4 bg-red-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] hover:bg-red-600 active:scale-[0.98] transition-all"
              >
                Yes, Reset Project
              </button>
              <button
                onClick={() => setIsConfirmingReset(false)}
                className="w-full py-4 bg-zinc-100 text-zinc-500 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] hover:bg-zinc-200 active:scale-[0.98] transition-all"
              >
                No, Go Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
