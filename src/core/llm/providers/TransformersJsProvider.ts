import { LLMMessage, LLMProvider, LLMResponse, LLMToolDefinition } from '../types';
import { useUiStore } from '../../../integration/store/uiStore';
// @ts-ignore - Vite worker import
import TransformersWorker from '../workers/transformersWorker?worker';

export class TransformersJsProvider implements LLMProvider {
  private static instance: TransformersJsProvider;
  private worker: Worker | null = null;
  private resolveGenerate: ((value: LLMResponse) => void) | null = null;
  private rejectGenerate: ((reason: any) => void) | null = null;
  private resolveLoad: (() => void) | null = null;
  private currentModelId: string | null = null;
  private isModelReady: boolean = false;

  private constructor() {
    this.initWorker();
  }

  public static getInstance(): TransformersJsProvider {
    if (!TransformersJsProvider.instance) {
      TransformersJsProvider.instance = new TransformersJsProvider();
    }
    return TransformersJsProvider.instance;
  }

  private initWorker() {
    this.worker = new TransformersWorker();
    this.worker?.addEventListener('message', (event) => {
      const { type, data } = event.data;

      switch (type) {
        case 'LOADING_STATUS':
          this.handleLoadingStatus(data);
          break;
        case 'GENERATE_DONE':
          this.handleGenerateDone(data);
          break;
        case 'ERROR':
          this.handleError(data);
          break;
        case 'WEBGPU_STATUS':
          console.log('[TransformersJsProvider] WebGPU Status:', data.supported);
          break;
      }
    });

    // Verificar WebGPU al iniciar
    this.worker?.postMessage({ type: 'CHECK_WEBGPU' });
  }

  private handleLoadingStatus(data: any) {
    const { setModelLoadingProgress, setIsModelReady, setIsDownloading } = useUiStore.getState();
    
    if (data.status === 'downloading') {
      setModelLoadingProgress(data.progress);
    } else if (data.status === 'ready') {
      console.log('[TransformersJsProvider] Model Ready');
      this.isModelReady = true;
      setModelLoadingProgress(100);
      setIsModelReady(true);
      setIsDownloading(false);
      
      if (this.resolveLoad) {
        this.resolveLoad();
        this.resolveLoad = null;
      }
    }
  }

  private handleGenerateDone(data: any) {
    if (this.resolveGenerate) {
      this.resolveGenerate({
        content: data.text,
        usage: {
          promptTokens: 0, 
          completionTokens: 0,
          totalTokens: 0
        },
        raw: data.text
      });
      this.resolveGenerate = null;
      this.rejectGenerate = null;
    }
  }

  private handleError(error: string) {
    console.error('[TransformersJsProvider] Worker Error:', error);
    if (this.rejectGenerate) {
      this.rejectGenerate(new Error(error));
      this.resolveGenerate = null;
      this.rejectGenerate = null;
    }
    if (this.resolveLoad) {
      this.resolveLoad = null; // Don't reject load, just clear it
    }
    useUiStore.getState().setIsDownloading(false);
  }

  public async loadModel(modelId: string, quantization: '4bit' | 'fp32' = '4bit'): Promise<void> {
    if (this.currentModelId === modelId && this.isModelReady) return;
    
    // If already loading this model, wait for it
    if (this.currentModelId === modelId && !this.isModelReady && this.resolveLoad) {
      return new Promise((resolve) => {
        const checkReady = () => {
          if (this.isModelReady) resolve();
          else setTimeout(checkReady, 100);
        };
        checkReady();
      });
    }

    this.isModelReady = false;
    useUiStore.getState().setIsDownloading(true);
    this.currentModelId = modelId;

    console.log(`[TransformersJsProvider] Requesting LOAD_MODEL for: ${modelId}`);

    return new Promise((resolve) => {
      this.resolveLoad = resolve;
      this.worker?.postMessage({ 
        type: 'LOAD_MODEL', 
        data: { model: modelId, quantization } 
      });
    });
  }

  async generateCompletion(
    messages: LLMMessage[],
    _tools?: LLMToolDefinition[],
    systemInstruction?: string,
    modelName?: string
  ): Promise<LLMResponse> {
    const modelId = modelName || 'gemma-4';
    
    // Ensure model is loaded AND ready before attempting generation
    if (this.currentModelId !== modelId || !this.isModelReady) {
        console.log(`[TransformersJsProvider] Ensuring model ${modelId} is loaded...`);
        await this.loadModel(modelId);
    }

    return new Promise((resolve, reject) => {
      this.resolveGenerate = resolve;
      this.rejectGenerate = reject;

      const fullMessages = systemInstruction 
        ? [{ role: 'system', content: systemInstruction }, ...messages]
        : messages;

      this.worker?.postMessage({
        type: 'GENERATE',
        data: {
          messages: fullMessages,
          params: {
            temperature: 0.7,
            max_tokens: 1024
          }
        }
      });
    });
  }
}
