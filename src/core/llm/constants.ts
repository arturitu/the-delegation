export const LOCAL_MODELS = ['Bonsai 1.7B', 'Gemma 4 E2B'] as const;

export const DEFAULT_MODELS = {
  text: 'Bonsai 1.7B',
  image: 'gemini-3.1-flash-image-preview',
  music: 'lyria-3-clip-preview',
  video: 'veo-3.1-lite-generate-preview'
} as const;

export const AVAILABLE_MODELS = {
  text: [
    'gemini-3-flash-preview',
    'gemini-3.1-pro-preview',
    'gemini-3.1-flash-lite-preview',
    'Bonsai 1.7B',
    'Gemma 4 E2B'
  ],
  image: [
    'gemini-3.1-flash-image-preview',
    'gemini-3-pro-image-preview',
    'gemini-2.5-flash-image'
  ],
  music: [
    'lyria-3-clip-preview',
    'lyria-3-pro-preview'
  ],
  video: [
    'veo-3.1-lite-generate-preview',
    'veo-3.1-fast-generate-preview',
    'veo-3.1-generate-preview'
  ]
} as const;

export type ModelType = keyof typeof AVAILABLE_MODELS;
