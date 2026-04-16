import { pipeline, env, AutoTokenizer, AutoModelForCausalLM, TextGenerationPipeline } from '@huggingface/transformers';

// Configuración de Transformers.js para el entorno del navegador
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = true;

const MODEL_MAPPING: Record<string, string> = {
  'Bonsai 1.7B': 'onnx-community/Bonsai-1.7B-ONNX',
  'Gemma 4 E2B': 'onnx-community/gemma-4-E2B-it-ONNX'
};

let generator: any = null;

// Manejo de mensajes desde el hilo principal
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'LOAD_MODEL':
      await loadModel(data.model, data.quantization);
      break;

    case 'GENERATE':
      await generate(data.messages, data.params);
      break;

    case 'CHECK_WEBGPU':
      await checkWebGPU();
      break;
  }
});

async function checkWebGPU() {
  try {
    const adapter = await (navigator as any).gpu?.requestAdapter();
    self.postMessage({ type: 'WEBGPU_STATUS', data: { supported: !!adapter } });
  } catch (e) {
    self.postMessage({ type: 'WEBGPU_STATUS', data: { supported: false } });
  }
}

async function loadModel(modelId: string, quantization: string) {
  try {
    const hfModelId = MODEL_MAPPING[modelId] || modelId;
    self.postMessage({ type: 'LOADING_STATUS', data: { status: 'init', progress: 0 } });

    // 1. Cargar el Tokenizer
    console.log(`[Worker] Loading Tokenizer from ${hfModelId}...`);
    const tokenizer = await AutoTokenizer.from_pretrained(hfModelId, {
      progress_callback: (progress: any) => {
        if (progress.status === 'progress') {
          self.postMessage({ 
            type: 'LOADING_STATUS', 
            data: { status: 'downloading', progress: progress.progress, file: progress.file } 
          });
        }
      }
    });

    // 2. Cargamos el modelo explícitamente (AutoModelForCausalLM)
    console.log(`[Worker] Loading Model: ${hfModelId} with quantization: ${quantization}`);
    const model = await AutoModelForCausalLM.from_pretrained(hfModelId, {
      dtype: modelId === 'Bonsai 1.7B' ? 'q1' : (quantization === '4bit' ? 'q4' : 'fp32'),
      quantized: true,
      device: 'webgpu',
      use_external_data_format: true,
      progress_callback: (progress: any) => {
        console.log(`[Worker] Loading file: ${progress.file} (${progress.status})`);
        if (progress.status === 'progress') {
          self.postMessage({ 
            type: 'LOADING_STATUS', 
            data: { 
              status: 'downloading', 
              progress: progress.progress,
              file: progress.file 
            } 
          });
        }
      }
    });

    // 5. Inicializamos el Pipeline explícitamente
    generator = new TextGenerationPipeline({
      task: 'text-generation',
      model,
      tokenizer
    });

    console.log('[Worker] Engine ready. Tokenizer status:', !!generator.tokenizer);

    self.postMessage({ type: 'LOADING_STATUS', data: { status: 'ready', progress: 100 } });
  } catch (error) {
    console.error('[Worker] Engine failed to start:', error);
    self.postMessage({ type: 'ERROR', data: (error as Error).message });
  }
}

async function generate(messages: any[], params: any) {
  if (!generator) {
    self.postMessage({ type: 'ERROR', data: 'Model not loaded' });
    return;
  }

  try {
    console.log('[Worker] Starting generation for', messages.length, 'messages');
    
    // Convert system messages to user messages, and merge consecutive messages of the same role
    const formattedMessages = messages.reduce((acc: any[], msg) => {
      const role = msg.role === 'system' ? 'user' : (msg.role === 'assistant' ? 'model' : msg.role);
      
      if (acc.length > 0 && acc[acc.length - 1].role === role) {
        acc[acc.length - 1].content += '\n\n' + msg.content;
      } else {
        acc.push({ role, content: msg.content });
      }
      return acc;
    }, []);

    const output = await generator(formattedMessages, {
      max_new_tokens: params.max_tokens || 512,
      temperature: params.temperature || 0.7,
      do_sample: true,
      top_p: 0.95,
      return_full_text: false, // No incluir el prompt original en la salida
      ...params,
      callback_function: (beams: any) => {
        const decoded = generator.tokenizer.decode(beams[0].output_token_ids, {
          skip_special_tokens: true,
        });
        // Enviar stream de vuelta (opcional, pero mejora UX)
        self.postMessage({ type: 'GENERATE_CHUNK', data: { text: decoded } });
      }
    });

    // TextGenerationPipeline devuelve un array de mensajes si se le pasó un array (isChatInput = true)
    // o un string si se le pasó un string. Extraemos siempre el string final generado.
    let finalResult = '';
    if (Array.isArray(output[0].generated_text)) {
      finalResult = output[0].generated_text[output[0].generated_text.length - 1].content;
    } else {
      finalResult = output[0].generated_text;
    }

    self.postMessage({ type: 'GENERATE_DONE', data: { text: finalResult } });
  } catch (error) {
    console.error('[Worker] Generation failed:', error);
    self.postMessage({ type: 'ERROR', data: (error as Error).message });
  }
}
