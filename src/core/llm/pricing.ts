import { DEFAULT_MODELS } from './constants';

export interface ModelPricing {
  inputPer1M?: number;
  outputPer1M?: number;
  perImage?: number;
  perSong?: number;
  perSecond?: number;
}

export const GEMINI_PRICING: Record<string, ModelPricing> = {
  // Text Models
  [DEFAULT_MODELS.text]: { inputPer1M: 0.50, outputPer1M: 3.00 },
  'gemini-3.1-pro-preview': { inputPer1M: 2.00, outputPer1M: 12.00 },
  'gemini-3.1-flash-lite-preview': { inputPer1M: 0.25, outputPer1M: 1.50 },
  'gemma-4': { inputPer1M: 0.00, outputPer1M: 0.00 },
  
  // Image Models
  [DEFAULT_MODELS.image]: { perImage: 0.067 },
  'gemini-3-pro-image-preview': { perImage: 0.134 },
  'gemini-2.5-flash-image': { perImage: 0.039 },
  
  // Music Models
  [DEFAULT_MODELS.music]: { perSong: 0.040 },
  'lyria-3-pro-preview': { perSong: 0.080 },
  
  // Video Models
  [DEFAULT_MODELS.video]: { perSecond: 0.050 },
  'veo-3.1-fast-generate-preview': { perSecond: 0.150 },
  'veo-3.1-generate-preview': { perSecond: 0.400 },
};

export const DEFAULT_PRICING: ModelPricing = GEMINI_PRICING[DEFAULT_MODELS.text];

export function calculateCost(promptTokens: number, completionTokens: number, modelName: string, durationOrCount?: number): number {
  const lowerName = modelName.toLowerCase();
  const pricingKey = Object.keys(GEMINI_PRICING).find(key => lowerName.includes(key));
  const pricing = pricingKey ? GEMINI_PRICING[pricingKey] : DEFAULT_PRICING;

  // 1. Per Image
  if (pricing.perImage !== undefined) {
    return (durationOrCount || 1) * pricing.perImage;
  }
  
  // 2. Per Song
  if (pricing.perSong !== undefined) {
    return (durationOrCount || 1) * pricing.perSong;
  }
  
  // 3. Per Second (Video)
  if (pricing.perSecond !== undefined) {
    return (durationOrCount || 4) * pricing.perSecond; // Default 4s if not specified
  }

  // 4. Token based (Text)
  const inputCost = (promptTokens / 1000000) * (pricing.inputPer1M || 0);
  const outputCost = (completionTokens / 1000000) * (pricing.outputPer1M || 0);

  return inputCost + outputCost;
}

export function calculateTokensForCost(modelName: string, durationOrCount?: number): number {
  const lowerName = modelName.toLowerCase();
  const pricingKey = Object.keys(GEMINI_PRICING).find(key => lowerName.includes(key));
  const pricing = pricingKey ? GEMINI_PRICING[pricingKey] : DEFAULT_PRICING;
  
  const cost = calculateCost(0, 0, modelName, durationOrCount);
  const baseOutputPrice = GEMINI_PRICING[DEFAULT_MODELS.text]?.outputPer1M || 3.0;
  
  return Math.floor((cost / baseOutputPrice) * 1000000);
}
