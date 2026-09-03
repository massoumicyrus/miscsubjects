// Cloudflare Unified Model Catalogue — every model runnable THROUGH Cloudflare, so the
// agent creator and the model directory can offer them. @cf/* run on the Workers AI
// binding (env.AI.run, no key); everything else runs via the AI Gateway unified API
// (gw:<author>/<model>). @cf rows enabled on the account + their context_window/pricing
// are pulled live from the Cloudflare Workers AI model-search API (CF row op ai_models);
// catalogue-only @cf rows (flagged) and all third-party rows are transcribed from
// https://developers.cloudflare.com/ai/models/. null price/context = not exhibited by that
// source (the AI Gateway catalogue API is auth-gated).

export const CF_CATALOG = [
{
"model_id": "@cf/baai/bge-reranker-base",
"name": "bge-reranker-base",
"author": "baai",
"task": "Text Classification",
"modality": "classification",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": 0.00311,
"output_ppm": null,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.00311,
"currency": "USD"
}
],
"description": "Different from embedding model, reranker uses question and document as input and directly output similarity instead of embedding. You can get a relevance score by inputting query and passage to the reranker. And the score can be mapped to a float value in [0,1] by sigmoid function.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/huggingface/distilbert-sst-2-int8",
"name": "distilbert-sst-2-int8",
"author": "huggingface",
"task": "Text Classification",
"modality": "classification",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": 0.0263,
"output_ppm": null,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.0263,
"currency": "USD"
}
],
"description": "Distilled BERT model that was finetuned on SST-2 for sentiment classification",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/baai/bge-base-en-v1.5",
"name": "bge-base-en-v1.5",
"author": "baai",
"task": "Text Embeddings",
"modality": "embedding",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 153600,
"input_ppm": 0.0666,
"output_ppm": null,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.0666,
"currency": "USD"
}
],
"description": "BAAI general embedding (Base) model that transforms any given text into a 768-dimensional vector",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/baai/bge-large-en-v1.5",
"name": "bge-large-en-v1.5",
"author": "baai",
"task": "Text Embeddings",
"modality": "embedding",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 512,
"input_ppm": 0.204,
"output_ppm": null,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.204,
"currency": "USD"
}
],
"description": "BAAI general embedding (Large) model that transforms any given text into a 1024-dimensional vector",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/baai/bge-m3",
"name": "bge-m3",
"author": "baai",
"task": "Text Embeddings",
"modality": "embedding",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 60000,
"input_ppm": 0.0118,
"output_ppm": null,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.0118,
"currency": "USD"
}
],
"description": "Multi-Functionality, Multi-Linguality, and Multi-Granularity embeddings model.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/baai/bge-small-en-v1.5",
"name": "bge-small-en-v1.5",
"author": "baai",
"task": "Text Embeddings",
"modality": "embedding",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 512,
"input_ppm": 0.0202,
"output_ppm": null,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.0202,
"currency": "USD"
}
],
"description": "BAAI general embedding (Small) model that transforms any given text into a 384-dimensional vector",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/google/embeddinggemma-300m",
"name": "embeddinggemma-300m",
"author": "google",
"task": "Text Embeddings",
"modality": "embedding",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "EmbeddingGemma is a 300M parameter, state-of-the-art for its size, open embedding model from Google, built from Gemma 3 (with T5Gemma initialization) and the same research and technology used to create Gemini models. EmbeddingGemma produces vector representations of text, making it well-suited for search and retrieval tasks, including classification, clustering, and semantic similarity search. This model was trained with data in 100+ spoken languages.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/pfnet/plamo-embedding-1b",
"name": "plamo-embedding-1b",
"author": "pfnet",
"task": "Text Embeddings",
"modality": "embedding",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": 0.0186,
"output_ppm": null,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.0186,
"currency": "USD"
}
],
"description": "PLaMo-Embedding-1B is a Japanese text embedding model developed by Preferred Networks, Inc.\n\nIt can convert Japanese text input into numerical vectors and can be used for a wide range of applications, including information retrieval, text classification, and clustering.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/qwen/qwen3-embedding-0.6b",
"name": "qwen3-embedding-0.6b",
"author": "qwen",
"task": "Text Embeddings",
"modality": "embedding",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 8192,
"input_ppm": 0.0118,
"output_ppm": null,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.0118,
"currency": "USD"
}
],
"description": "The Qwen3 Embedding model series is the latest proprietary model of the Qwen family, specifically designed for text embedding and ranking tasks.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/black-forest-labs/flux-1-schnell",
"name": "flux-1-schnell",
"author": "black-forest-labs",
"task": "Text-to-Image",
"modality": "image",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": [
{
"unit": "per 512 by 512 tile",
"price": 5.28e-05,
"currency": "USD"
},
{
"unit": "per step",
"price": 0.000106,
"currency": "USD"
}
],
"description": "FLUX.1 [schnell] is a 12 billion parameter rectified flow transformer capable of generating images from text descriptions.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/black-forest-labs/flux-2-dev",
"name": "flux-2-dev",
"author": "black-forest-labs",
"task": "Text-to-Image",
"modality": "image",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "FLUX.2 [dev] is an image model from Black Forest Labs where you can generate highly realistic and detailed images, with multi-reference support.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/black-forest-labs/flux-2-klein-4b",
"name": "flux-2-klein-4b",
"author": "black-forest-labs",
"task": "Text-to-Image",
"modality": "image",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "FLUX.2 [klein] is an ultra-fast, distilled image model. It unifies image generation and editing in a single model, delivering state-of-the-art quality enabling interactive workflows, real-time previews, and latency-critical applications.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/black-forest-labs/flux-2-klein-9b",
"name": "flux-2-klein-9b",
"author": "black-forest-labs",
"task": "Text-to-Image",
"modality": "image",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "FLUX.2 [klein] 9B is a 9 billion parameter model that can generate images from text descriptions and supports multi-reference editing capabilities.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/bytedance/stable-diffusion-xl-lightning",
"name": "stable-diffusion-xl-lightning",
"author": "bytedance",
"task": "Text-to-Image",
"modality": "image",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": [
{
"unit": "per step",
"price": 0,
"currency": "USD"
}
],
"description": "SDXL-Lightning is a lightning-fast text-to-image generation model. It can generate high-quality 1024px images in a few steps.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/leonardo/lucid-origin",
"name": "lucid-origin",
"author": "leonardo",
"task": "Text-to-Image",
"modality": "image",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": [
{
"unit": "per 512 by 512 tile",
"price": 0.007,
"currency": "USD"
},
{
"unit": "per step",
"price": 0.000132,
"currency": "USD"
}
],
"description": "Lucid Origin from Leonardo.AI is their most adaptable and prompt-responsive model to date. Whether you're generating images with sharp graphic design, stunning full-HD renders, or highly specific creative direction, it adheres closely to your prompts, renders text with accuracy, and supports a wide array of visual styles and aesthetics \u2013 from stylized concept art to crisp product mockups.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/leonardo/phoenix-1.0",
"name": "phoenix-1.0",
"author": "leonardo",
"task": "Text-to-Image",
"modality": "image",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": [
{
"unit": "per 512 by 512 tile",
"price": 0.00583,
"currency": "USD"
},
{
"unit": "per step",
"price": 0.00011,
"currency": "USD"
}
],
"description": "Phoenix 1.0 is a model by Leonardo.Ai that generates images with exceptional prompt adherence and coherent text.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/lykon/dreamshaper-8-lcm",
"name": "dreamshaper-8-lcm",
"author": "lykon",
"task": "Text-to-Image",
"modality": "image",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Stable Diffusion model that has been fine-tuned to be better at photorealism without sacrificing range.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/runwayml/stable-diffusion-v1-5-img2img",
"name": "stable-diffusion-v1-5-img2img",
"author": "runwayml",
"task": "Text-to-Image",
"modality": "image",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": [
{
"unit": "per step",
"price": 0,
"currency": "USD"
}
],
"description": "Stable Diffusion is a latent text-to-image diffusion model capable of generating photo-realistic images. Img2img generate a new image from an input image with Stable Diffusion.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/runwayml/stable-diffusion-v1-5-inpainting",
"name": "stable-diffusion-v1-5-inpainting",
"author": "runwayml",
"task": "Text-to-Image",
"modality": "image",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": [
{
"unit": "per step",
"price": 0,
"currency": "USD"
}
],
"description": "Stable Diffusion Inpainting is a latent text-to-image diffusion model capable of generating photo-realistic images given any text input, with the extra capability of inpainting the pictures by using a mask.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/stabilityai/stable-diffusion-xl-base-1.0",
"name": "stable-diffusion-xl-base-1.0",
"author": "stabilityai",
"task": "Text-to-Image",
"modality": "image",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": [
{
"unit": "per step",
"price": 0,
"currency": "USD"
}
],
"description": "Diffusion-based text-to-image generative model by Stability AI. Generates and modify images based on text prompts.",
"run_via": "workers_ai_binding"
},
{
"model_id": "alibaba/wan-2.6-image",
"name": "wan-2.6-image",
"author": "Alibaba",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Alibaba's Wan 2.6 text-to-image model generating images from text prompts with optional negative prompts and customizable dimensions.",
"run_via": "ai_gateway"
},
{
"model_id": "black-forest-labs/flux-2-flex",
"name": "flux-2-flex",
"author": "Black Forest Labs",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "FLUX.2 [flex] is Black Forest Labs' fine-grained control variant of FLUX.2 \u2014 exposes tunable inference steps, guidance, and prompt upsampling for typography-heavy and production workflows.",
"run_via": "ai_gateway"
},
{
"model_id": "black-forest-labs/flux-2-max",
"name": "flux-2-max",
"author": "Black Forest Labs",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "FLUX.2 [max] is Black Forest Labs' highest-quality image model \u2014 top editing consistency, strongest prompt following, and grounding search for visualizations of real-time information.",
"run_via": "ai_gateway"
},
{
"model_id": "black-forest-labs/flux-2-pro-preview",
"name": "flux-2-pro-preview",
"author": "Black Forest Labs",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "FLUX.2 [pro] Preview is Black Forest Labs' recommended default for production image generation and editing \u2014 tracks the latest [pro] weights with strong multi-reference support.",
"run_via": "ai_gateway"
},
{
"model_id": "bytedance/seedream-4.0",
"name": "seedream-4.0",
"author": "ByteDance",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Seedream 4.0 is ByteDance's image creation model that combines text-to-image generation and image editing into a single architecture, offering fast, high-resolution output up to 4K.",
"run_via": "ai_gateway"
},
{
"model_id": "bytedance/seedream-4.5",
"name": "seedream-4.5",
"author": "ByteDance",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Seedream 4.5 builds on 4.0 with multi-reference image support, batch generation, and sequential image generation.",
"run_via": "ai_gateway"
},
{
"model_id": "bytedance/seedream-5-lite",
"name": "seedream-5-lite",
"author": "ByteDance",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Seedream 5 Lite is a lighter, faster version of the Seedream 5 family with multi-reference and batch generation support.",
"run_via": "ai_gateway"
},
{
"model_id": "google/imagen-4",
"name": "imagen-4",
"author": "Google",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Google's latest image generation model producing high-quality, photorealistic images from text prompts with support for multiple aspect ratios.",
"run_via": "ai_gateway"
},
{
"model_id": "google/nano-banana",
"name": "nano-banana",
"author": "Google",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Google's fast image generation model producing high-quality images from text prompts.",
"run_via": "ai_gateway"
},
{
"model_id": "google/nano-banana-2",
"name": "nano-banana-2",
"author": "Google",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Google's second-generation image generation model with improved quality and speed.",
"run_via": "ai_gateway"
},
{
"model_id": "google/nano-banana-pro",
"name": "nano-banana-pro",
"author": "Google",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Google's higher-quality image generation model with improved detail and prompt adherence.",
"run_via": "ai_gateway"
},
{
"model_id": "openai/gpt-image-1.5",
"name": "gpt-image-1.5",
"author": "OpenAI",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "OpenAI's image generation model that creates and edits images from text prompts, supporting multiple quality levels and output sizes.",
"run_via": "ai_gateway"
},
{
"model_id": "openai/gpt-image-2",
"name": "gpt-image-2",
"author": "OpenAI",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "OpenAI's next-generation image model that creates and edits images from text prompts, with support for multiple quality levels, sizes, and output formats. Transparent backgrounds not supported \u2014 use gpt-image-1.5 for transparent PNGs.",
"run_via": "ai_gateway"
},
{
"model_id": "recraft/recraftv3",
"name": "recraftv3",
"author": "Recraft",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Recraft V3 is the previous-generation text-to-image model from Recraft, well-suited to design-quality compositions, brand-aware imagery, and accurate text rendering.",
"run_via": "ai_gateway"
},
{
"model_id": "recraft/recraftv4",
"name": "recraftv4",
"author": "Recraft",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Recraft V4 generates art-directed images with strong composition, accurate text rendering, and design taste built in. Fast and cost-efficient at standard resolution.",
"run_via": "ai_gateway"
},
{
"model_id": "recraft/recraftv4-1",
"name": "recraftv4-1",
"author": "Recraft",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Recraft V4.1 generates art-directed images tuned for high aesthetics, with strong composition, accurate text rendering, and refined design taste. Fast and cost-efficient at standard resolution.",
"run_via": "ai_gateway"
},
{
"model_id": "recraft/recraftv4-1-pro",
"name": "recraftv4-1-pro",
"author": "Recraft",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Recraft V4.1 Pro generates high-resolution, art-directed images at 2048px+ tuned for high aesthetics, with strong composition, text rendering, and refined design taste. Built for print and production work.",
"run_via": "ai_gateway"
},
{
"model_id": "recraft/recraftv4-1-pro-vector",
"name": "recraftv4-1-pro-vector",
"author": "Recraft",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Generate detailed, high-resolution SVG vector graphics from text prompts with high aesthetic quality, fine geometry, scalable to any size for print and design work.",
"run_via": "ai_gateway"
},
{
"model_id": "recraft/recraftv4-1-utility",
"name": "recraftv4-1-utility",
"author": "Recraft",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Recraft V4.1 Utility is a general-purpose text-to-image model balancing quality and flexibility for a wide range of everyday use cases at standard resolution.",
"run_via": "ai_gateway"
},
{
"model_id": "recraft/recraftv4-1-utility-pro",
"name": "recraftv4-1-utility-pro",
"author": "Recraft",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Recraft V4.1 Utility Pro is a general-purpose text-to-image model producing high-resolution 2048px+ output for a wide range of production and print use cases.",
"run_via": "ai_gateway"
},
{
"model_id": "recraft/recraftv4-1-utility-pro-vector",
"name": "recraftv4-1-utility-pro-vector",
"author": "Recraft",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Generate detailed, high-resolution SVG vector graphics from text prompts with a general-purpose model, scalable to any size for print and large-scale design work.",
"run_via": "ai_gateway"
},
{
"model_id": "recraft/recraftv4-1-utility-vector",
"name": "recraftv4-1-utility-vector",
"author": "Recraft",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Generate production-ready SVG vector graphics from text prompts with a general-purpose model suited for a wide range of design and illustration tasks.",
"run_via": "ai_gateway"
},
{
"model_id": "recraft/recraftv4-1-vector",
"name": "recraftv4-1-vector",
"author": "Recraft",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Generate production-ready SVG vector graphics from text prompts with high aesthetic quality, clean geometry, structured layers, and editable paths.",
"run_via": "ai_gateway"
},
{
"model_id": "recraft/recraftv4-pro",
"name": "recraftv4-pro",
"author": "Recraft",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Recraft V4 Pro generates high-resolution, art-directed images at 2048px+ with strong composition, text rendering, and design taste. Built for print and production work.",
"run_via": "ai_gateway"
},
{
"model_id": "recraft/recraftv4-pro-vector",
"name": "recraftv4-pro-vector",
"author": "Recraft",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Generate detailed, production-ready SVG vector graphics from text prompts with fine geometry, scalable to any size for print and design work.",
"run_via": "ai_gateway"
},
{
"model_id": "recraft/recraftv4-vector",
"name": "recraftv4-vector",
"author": "Recraft",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Generate production-ready SVG vector graphics from text prompts with clean geometry, structured layers, and editable paths.",
"run_via": "ai_gateway"
},
{
"model_id": "xai/grok-imagine-image",
"name": "grok-imagine-image",
"author": "xAI",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "xAI's Grok Imagine image model. Generates and edits images from text and reference-image inputs with configurable aspect ratio and resolution.",
"run_via": "ai_gateway"
},
{
"model_id": "xai/grok-imagine-image-quality",
"name": "grok-imagine-image-quality",
"author": "xAI",
"task": "Text-to-Image",
"modality": "image",
"hosting": "third-party",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "xAI's higher-fidelity text-to-image model optimized for sharper details, more accurate compositions, and stronger text rendering. Supports image editing via reference images and masks. Default output at 2k resolution.",
"run_via": "ai_gateway"
},
{
"model_id": "@cf/microsoft/resnet-50",
"name": "resnet-50",
"author": "microsoft",
"task": "Image Classification",
"modality": "image-classification",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": [
{
"unit": "per inference request",
"price": 2.51e-06,
"currency": "USD"
}
],
"description": "50 layers deep image classification CNN trained on more than 1M images from ImageNet",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/llava-hf/llava-1.5-7b-hf",
"name": "llava-1.5-7b-hf",
"author": "llava-hf",
"task": "Image-to-Text",
"modality": "image-to-text",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "LLaVA is an open-source chatbot trained by fine-tuning LLaMA/Vicuna on GPT-generated multimodal instruction-following data. It is an auto-regressive language model, based on the transformer architecture.",
"run_via": "workers_ai_binding"
},
{
"model_id": "minimax/music-2.6",
"name": "music-2.6",
"author": "MiniMax",
"task": "Music Generation",
"modality": "music",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "MiniMax's music generation model that creates full-length songs with vocals from text prompts and lyrics, or instrumental tracks. Supports BPM/key control and auto-generated lyrics.",
"run_via": "ai_gateway"
},
{
"model_id": "@cf/deepgram/flux",
"name": "flux",
"author": "deepgram",
"task": "Automatic Speech Recognition",
"modality": "stt",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": [
{
"unit": "per audio minute (websocket)",
"price": 0.0077,
"currency": "USD"
}
],
"description": "Flux is the first conversational speech recognition model built specifically for voice agents.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/deepgram/nova-3",
"name": "nova-3",
"author": "deepgram",
"task": "Automatic Speech Recognition",
"modality": "stt",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": [
{
"unit": "per audio minute",
"price": 0.0052,
"currency": "USD"
},
{
"unit": "per audio minute (websocket)",
"price": 0.0092,
"currency": "USD"
}
],
"description": "Transcribe audio using Deepgram\u2019s speech-to-text model",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/openai/whisper",
"name": "whisper",
"author": "openai",
"task": "Automatic Speech Recognition",
"modality": "stt",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": [
{
"unit": "per audio minute",
"price": 0.000453,
"currency": "USD"
}
],
"description": "Whisper is a general-purpose speech recognition model. It is trained on a large dataset of diverse audio and is also a multitasking model that can perform multilingual speech recognition, speech translation, and language identification.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/openai/whisper-large-v3-turbo",
"name": "whisper-large-v3-turbo",
"author": "openai",
"task": "Automatic Speech Recognition",
"modality": "stt",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": [
{
"unit": "per audio minute",
"price": 0.000513,
"currency": "USD"
}
],
"description": "Whisper is a pre-trained model for automatic speech recognition (ASR) and speech translation.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/openai/whisper-tiny-en",
"name": "whisper-tiny-en",
"author": "openai",
"task": "Automatic Speech Recognition",
"modality": "stt",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Whisper is a pre-trained model for automatic speech recognition (ASR) and speech translation. Trained on 680k hours of labelled data, Whisper models demonstrate a strong ability to generalize to many datasets and domains without the need for fine-tuning. This is the English-only version of the Whisper Tiny model which was trained on the task of speech recognition.",
"run_via": "workers_ai_binding"
},
{
"model_id": "assemblyai/universal-3-pro",
"name": "universal-3-pro",
"author": "AssemblyAI",
"task": "Automatic Speech Recognition",
"modality": "stt",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "AssemblyAI's Universal 3 Pro speech recognition model for high-accuracy transcription.",
"run_via": "ai_gateway"
},
{
"model_id": "openai/gpt-4o-transcribe",
"name": "gpt-4o-transcribe",
"author": "OpenAI",
"task": "Automatic Speech Recognition",
"modality": "stt",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "A speech-to-text model that uses GPT-4o to transcribe audio with improved word error rate and better language recognition compared to original Whisper models.",
"run_via": "ai_gateway"
},
{
"model_id": "xai/grok-stt",
"name": "grok-stt",
"author": "xAI",
"task": "Automatic Speech Recognition",
"modality": "stt",
"hosting": "third-party",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "xAI's Grok speech-to-text model. Transcribes audio files into text across 25 languages with word-level timestamps, multichannel transcription, speaker diarization, and key-term biasing.",
"run_via": "ai_gateway"
},
{
"model_id": "@cf/aisingapore/gemma-sea-lion-v4-27b-it",
"name": "gemma-sea-lion-v4-27b-it",
"author": "aisingapore",
"task": "Text Generation",
"modality": "text",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 128000,
"input_ppm": 0.351,
"output_ppm": 0.555,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.351,
"currency": "USD"
},
{
"unit": "per M output tokens",
"price": 0.555,
"currency": "USD"
}
],
"description": "SEA-LION stands for Southeast Asian Languages In One Network, which is a collection of Large Language Models (LLMs) which have been pretrained and instruct-tuned for the Southeast Asia (SEA) region.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
"name": "deepseek-r1-distill-qwen-32b",
"author": "deepseek-ai",
"task": "Text Generation",
"modality": "text",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 80000,
"input_ppm": 0.497,
"output_ppm": 4.881,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.497,
"currency": "USD"
},
{
"unit": "per M output tokens",
"price": 4.881,
"currency": "USD"
}
],
"description": "DeepSeek-R1-Distill-Qwen-32B is a model distilled from DeepSeek-R1 based on Qwen2.5. It outperforms OpenAI-o1-mini across various benchmarks, achieving new state-of-the-art results for dense models.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/google/gemma-2b-it-lora",
"name": "gemma-2b-it-lora",
"author": "google",
"task": "Text Generation",
"modality": "text",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 8192,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "This is a Gemma-2B base model that Cloudflare dedicates for inference with LoRA adapters. Gemma is a family of lightweight, state-of-the-art open models from Google, built from the same research and technology used to create the Gemini models.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/google/gemma-4-26b-a4b-it",
"name": "gemma-4-26b-a4b-it",
"author": "google",
"task": "Text Generation",
"modality": "text",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 256000,
"input_ppm": 0.1,
"output_ppm": 0.3,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.1,
"currency": "USD"
},
{
"unit": "per M output tokens",
"price": 0.3,
"currency": "USD"
}
],
"description": "Gemma 4 is Google's most intelligent family of open models, built from Gemini 3 research to maximize intelligence-per-parameter.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/google/gemma-7b-it-lora",
"name": "gemma-7b-it-lora",
"author": "google",
"task": "Text Generation",
"modality": "text",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 3500,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "This is a Gemma-7B base model that Cloudflare dedicates for inference with LoRA adapters. Gemma is a family of lightweight, state-of-the-art open models from Google, built from the same research and technology used to create the Gemini models.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/ibm-granite/granite-4.0-h-micro",
"name": "granite-4.0-h-micro",
"author": "ibm-granite",
"task": "Text Generation",
"modality": "text",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 131000,
"input_ppm": 0.017,
"output_ppm": 0.112,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.017,
"currency": "USD"
},
{
"unit": "per M output tokens",
"price": 0.112,
"currency": "USD"
}
],
"description": "Granite 4.0 instruct models deliver strong performance across benchmarks, achieving industry-leading results in key agentic tasks like instruction following and function calling. These efficiencies make the models well-suited for a wide range of use cases like retrieval-augmented generation (RAG), multi-agent workflows, and edge deployments.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/meta-llama/llama-2-7b-chat-hf-lora",
"name": "llama-2-7b-chat-hf-lora",
"author": "meta-llama",
"task": "Text Generation",
"modality": "text",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 8192,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "This is a Llama2 base model that Cloudflare dedicated for inference with LoRA adapters. Llama 2 is a collection of pretrained and fine-tuned generative text models ranging in scale from 7 billion to 70 billion parameters. This is the repository for the 7B fine-tuned model, optimized for dialogue use cases and converted for the Hugging Face Transformers format.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/meta/llama-3.1-8b-instruct-fp8",
"name": "llama-3.1-8b-instruct-fp8",
"author": "meta",
"task": "Text Generation",
"modality": "text",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 32000,
"input_ppm": 0.152,
"output_ppm": 0.287,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.152,
"currency": "USD"
},
{
"unit": "per M output tokens",
"price": 0.287,
"currency": "USD"
}
],
"description": "Llama 3.1 8B quantized to FP8 precision",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/meta/llama-3.2-11b-vision-instruct",
"name": "llama-3.2-11b-vision-instruct",
"author": "meta",
"task": "Text Generation",
"modality": "text",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 128000,
"input_ppm": 0.0485,
"output_ppm": 0.676,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.0485,
"currency": "USD"
},
{
"unit": "per M output tokens",
"price": 0.676,
"currency": "USD"
}
],
"description": "The Llama 3.2-Vision instruction-tuned models are optimized for visual recognition, image reasoning, captioning, and answering general questions about an image.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/meta/llama-3.2-1b-instruct",
"name": "llama-3.2-1b-instruct",
"author": "meta",
"task": "Text Generation",
"modality": "text",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 60000,
"input_ppm": 0.027,
"output_ppm": 0.201,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.027,
"currency": "USD"
},
{
"unit": "per M output tokens",
"price": 0.201,
"currency": "USD"
}
],
"description": "The Llama 3.2 instruction-tuned text only models are optimized for multilingual dialogue use cases, including agentic retrieval and summarization tasks.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/meta/llama-3.2-3b-instruct",
"name": "llama-3.2-3b-instruct",
"author": "meta",
"task": "Text Generation",
"modality": "text",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 80000,
"input_ppm": 0.0509,
"output_ppm": 0.335,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.0509,
"currency": "USD"
},
{
"unit": "per M output tokens",
"price": 0.335,
"currency": "USD"
}
],
"description": "The Llama 3.2 instruction-tuned text only models are optimized for multilingual dialogue use cases, including agentic retrieval and summarization tasks.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
"name": "llama-3.3-70b-instruct-fp8-fast",
"author": "meta",
"task": "Text Generation",
"modality": "text",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 24000,
"input_ppm": 0.293,
"output_ppm": 2.253,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.293,
"currency": "USD"
},
{
"unit": "per M output tokens",
"price": 2.253,
"currency": "USD"
}
],
"description": "Llama 3.3 70B quantized to fp8 precision, optimized to be faster.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/meta/llama-4-scout-17b-16e-instruct",
"name": "llama-4-scout-17b-16e-instruct",
"author": "meta",
"task": "Text Generation",
"modality": "text",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 131000,
"input_ppm": 0.27,
"output_ppm": 0.85,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.27,
"currency": "USD"
},
{
"unit": "per M output tokens",
"price": 0.85,
"currency": "USD"
}
],
"description": "Meta's Llama 4 Scout is a 17 billion parameter model with 16 experts that is natively multimodal. These models leverage a mixture-of-experts architecture to offer industry-leading performance in text and image understanding.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/meta/llama-guard-3-8b",
"name": "llama-guard-3-8b",
"author": "meta",
"task": "Text Generation",
"modality": "text",
"hosting": "cloudflare",
"capabilities": [
"moderation",
"safety",
"content-filtering",
"guardrails"
],
"flags": [],
"context_window": 131072,
"input_ppm": 0.484,
"output_ppm": 0.03,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.484,
"currency": "USD"
},
{
"unit": "per M output tokens",
"price": 0.03,
"currency": "USD"
}
],
"description": "Llama Guard 3 is a Llama-3.1-8B pretrained model, fine-tuned for content safety classification. Similar to previous versions, it can be used to classify content in both LLM inputs (prompt classification) and in LLM responses (response classification). It acts as an LLM \u2013 it generates text in its output that indicates whether a given prompt or response is safe or unsafe, and if unsafe, it also lists the content categories violated.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/mistral/mistral-7b-instruct-v0.2-lora",
"name": "mistral-7b-instruct-v0.2-lora",
"author": "mistral",
"task": "Text Generation",
"modality": "text",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 15000,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "The Mistral-7B-Instruct-v0.2 Large Language Model (LLM) is an instruct fine-tuned version of the Mistral-7B-v0.2.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/mistralai/mistral-small-3.1-24b-instruct",
"name": "mistral-small-3.1-24b-instruct",
"author": "mistralai",
"task": "Text Generation",
"modality": "text",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 128000,
"input_ppm": 0.351,
"output_ppm": 0.555,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.351,
"currency": "USD"
},
{
"unit": "per M output tokens",
"price": 0.555,
"currency": "USD"
}
],
"description": "Building upon Mistral Small 3 (2501), Mistral Small 3.1 (2503) adds state-of-the-art vision understanding and enhances long context capabilities up to 128k tokens without compromising text performance. With 24 billion parameters, this model achieves top-tier capabilities in both text and vision tasks.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/moonshotai/kimi-k2.6",
"name": "kimi-k2.6",
"author": "moonshotai",
"task": "Text Generation",
"modality": "text",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 262144,
"input_ppm": 0.95,
"output_ppm": 4,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.95,
"currency": "USD"
},
{
"unit": "per M output tokens",
"price": 4,
"currency": "USD"
},
{
"unit": "per M cached input tokens",
"price": 0.16,
"currency": "USD"
}
],
"description": "Kimi K2.6 is a frontier-scale open-source 1T parameter model with a 262.1k context window, multi-turn tool calling, vision inputs, and structured outputs for agentic workloads.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/moonshotai/kimi-k2.7-code",
"name": "kimi-k2.7-code",
"author": "moonshotai",
"task": "Text Generation",
"modality": "text",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 262144,
"input_ppm": 0.95,
"output_ppm": 4,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.95,
"currency": "USD"
},
{
"unit": "per M output tokens",
"price": 4,
"currency": "USD"
},
{
"unit": "per M cached input tokens",
"price": 0.19,
"currency": "USD"
}
],
"description": "Kimi K2.7 is a frontier-scale open-source 1T parameter model with a 262.1k context window, multi-turn tool calling, vision inputs, and structured outputs for agentic workloads.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/nvidia/nemotron-3-120b-a12b",
"name": "nemotron-3-120b-a12b",
"author": "nvidia",
"task": "Text Generation",
"modality": "text",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 256000,
"input_ppm": 0.5,
"output_ppm": 1.5,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.5,
"currency": "USD"
},
{
"unit": "per M output tokens",
"price": 1.5,
"currency": "USD"
}
],
"description": "NVIDIA Nemotron 3 Super is a hybrid MoE model with leading accuracy for multi-agent applications and specialized agentic AI systems.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/openai/gpt-oss-120b",
"name": "gpt-oss-120b",
"author": "openai",
"task": "Text Generation",
"modality": "text",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 128000,
"input_ppm": 0.35,
"output_ppm": 0.75,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.35,
"currency": "USD"
},
{
"unit": "per M output tokens",
"price": 0.75,
"currency": "USD"
}
],
"description": "OpenAI\u2019s open-weight models designed for powerful reasoning, agentic tasks, and versatile developer use cases \u2013 gpt-oss-120b is for production, general purpose, high reasoning use-cases.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/openai/gpt-oss-20b",
"name": "gpt-oss-20b",
"author": "openai",
"task": "Text Generation",
"modality": "text",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 128000,
"input_ppm": 0.2,
"output_ppm": 0.3,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.2,
"currency": "USD"
},
{
"unit": "per M output tokens",
"price": 0.3,
"currency": "USD"
}
],
"description": "OpenAI\u2019s open-weight models designed for powerful reasoning, agentic tasks, and versatile developer use cases \u2013 gpt-oss-20b is for lower latency, and local or specialized use-cases.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/qwen/qwen2.5-coder-32b-instruct",
"name": "qwen2.5-coder-32b-instruct",
"author": "qwen",
"task": "Text Generation",
"modality": "text",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 32768,
"input_ppm": 0.66,
"output_ppm": 1,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.66,
"currency": "USD"
},
{
"unit": "per M output tokens",
"price": 1,
"currency": "USD"
}
],
"description": "Qwen2.5-Coder is the latest series of Code-Specific Qwen large language models (formerly known as CodeQwen). As of now, Qwen2.5-Coder has covered six mainstream model sizes, 0.5, 1.5, 3, 7, 14, 32 billion parameters, to meet the needs of different developers. Qwen2.5-Coder brings the following improvements upon CodeQwen1.5:",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/qwen/qwen3-30b-a3b-fp8",
"name": "qwen3-30b-a3b-fp8",
"author": "qwen",
"task": "Text Generation",
"modality": "text",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 32768,
"input_ppm": 0.0509,
"output_ppm": 0.335,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.0509,
"currency": "USD"
},
{
"unit": "per M output tokens",
"price": 0.335,
"currency": "USD"
}
],
"description": "Qwen3 is the latest generation of large language models in Qwen series, offering a comprehensive suite of dense and mixture-of-experts (MoE) models. Built upon extensive training, Qwen3 delivers groundbreaking advancements in reasoning, instruction-following, agent capabilities, and multilingual support.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/qwen/qwq-32b",
"name": "qwq-32b",
"author": "qwen",
"task": "Text Generation",
"modality": "text",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 24000,
"input_ppm": 0.66,
"output_ppm": 1,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.66,
"currency": "USD"
},
{
"unit": "per M output tokens",
"price": 1,
"currency": "USD"
}
],
"description": "QwQ is the reasoning model of the Qwen series. Compared with conventional instruction-tuned models, QwQ, which is capable of thinking and reasoning, can achieve significantly enhanced performance in downstream tasks, especially hard problems. QwQ-32B is the medium-sized reasoning model, which is capable of achieving competitive performance against state-of-the-art reasoning models, e.g., DeepSeek-R1, o1-mini.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/zai-org/glm-4.7-flash",
"name": "glm-4.7-flash",
"author": "zai-org",
"task": "Text Generation",
"modality": "text",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": 131072,
"input_ppm": 0.0605,
"output_ppm": 0.4,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.0605,
"currency": "USD"
},
{
"unit": "per M output tokens",
"price": 0.4,
"currency": "USD"
}
],
"description": "GLM-4.7-Flash is a fast and efficient multilingual text generation model with a 131,072 token context window. Optimized for dialogue, instruction-following, and multi-turn tool calling across 100+ languages.",
"run_via": "workers_ai_binding"
},
{
"model_id": "alibaba/qwen3-max",
"name": "qwen3-max",
"author": "Alibaba",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Alibaba's Qwen 3 Max is a large language model with strong coding, reasoning, and multilingual capabilities, served via DashScope's OpenAI-compatible endpoint.",
"run_via": "ai_gateway"
},
{
"model_id": "alibaba/qwen3.5-397b-a17b",
"name": "qwen3.5-397b-a17b",
"author": "Alibaba",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Reasoning"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Alibaba's Qwen 3.5 is a 397B-parameter mixture-of-experts model with 17B active parameters, offering strong reasoning capabilities with efficient inference.",
"run_via": "ai_gateway"
},
{
"model_id": "anthropic/claude-fable-5",
"name": "claude-fable-5",
"author": "Anthropic",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Reasoning",
"Vision"
],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Claude Fable 5 is Anthropic's most capable widely released model, built for the most demanding reasoning and long-horizon agentic work. Adaptive thinking is always on, and the model supports a 1M token context window with up to 128k output tokens per request.",
"run_via": "ai_gateway"
},
{
"model_id": "anthropic/claude-haiku-4.5",
"name": "claude-haiku-4.5",
"author": "Anthropic",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Reasoning",
"Vision"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Claude Haiku 4.5 delivers similar levels of coding performance at one-third the cost and more than twice the speed of larger models.",
"run_via": "ai_gateway"
},
{
"model_id": "anthropic/claude-opus-4.5",
"name": "claude-opus-4.5",
"author": "Anthropic",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Reasoning",
"Vision"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Claude Opus 4.5 brings further reasoning, coding, and agentic improvements over Opus 4.1, with stronger tool use and tighter instruction following.",
"run_via": "ai_gateway"
},
{
"model_id": "anthropic/claude-opus-4.6",
"name": "claude-opus-4.6",
"author": "Anthropic",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Reasoning",
"Vision"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Claude Opus 4.6 is Anthropic's flagship language model built for complex, multi-step work in coding, financial analysis, and legal reasoning. Extended thinking; one million token context window.",
"run_via": "ai_gateway"
},
{
"model_id": "anthropic/claude-opus-4.7",
"name": "claude-opus-4.7",
"author": "Anthropic",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Reasoning",
"Vision"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Claude Opus 4.7 is Anthropic's most capable generally available model, with a step-change improvement in agentic coding over Claude Opus 4.6. Adaptive thinking; one million token context window at standard pricing.",
"run_via": "ai_gateway"
},
{
"model_id": "anthropic/claude-opus-4.8",
"name": "claude-opus-4.8",
"author": "Anthropic",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Reasoning",
"Vision"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Claude Opus 4.8 is Anthropic's most capable generally available model, with a step-change improvement in agentic coding over Claude Opus 4.7. It uses adaptive thinking to calibrate reasoning per task and supports a one million token context window at standard pricing.",
"run_via": "ai_gateway"
},
{
"model_id": "anthropic/claude-sonnet-4",
"name": "claude-sonnet-4",
"author": "Anthropic",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Reasoning",
"Vision"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Claude Sonnet 4 delivers superior coding and reasoning while responding more precisely to instructions, a significant upgrade over previous versions.",
"run_via": "ai_gateway"
},
{
"model_id": "anthropic/claude-sonnet-4.5",
"name": "claude-sonnet-4.5",
"author": "Anthropic",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Reasoning",
"Vision"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Claude Sonnet 4.5 is the best coding model to date, with significant improvements across the entire development lifecycle.",
"run_via": "ai_gateway"
},
{
"model_id": "anthropic/claude-sonnet-4.6",
"name": "claude-sonnet-4.6",
"author": "Anthropic",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Reasoning",
"Vision"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Claude Sonnet 4.6 is Anthropic's latest balanced model offering strong coding, reasoning, and agentic capabilities with improved instruction following.",
"run_via": "ai_gateway"
},
{
"model_id": "deepseek/deepseek-v4-pro",
"name": "deepseek-v4-pro",
"author": "deepseek",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Reasoning"
],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "DeepSeek V4 Pro is a high-capability reasoning model from DeepSeek, served via Fireworks infrastructure for production-grade inference.",
"run_via": "ai_gateway"
},
{
"model_id": "google/gemini-2.5-flash",
"name": "gemini-2.5-flash",
"author": "Google",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Reasoning",
"Vision"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Google's fast multimodal Gemini 2.5 model with strong reasoning and a 1M token context window.",
"run_via": "ai_gateway"
},
{
"model_id": "google/gemini-2.5-flash-lite",
"name": "gemini-2.5-flash-lite",
"author": "Google",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Google's lightest and most cost-efficient Gemini 2.5 model for high-throughput tasks.",
"run_via": "ai_gateway"
},
{
"model_id": "google/gemini-2.5-pro",
"name": "gemini-2.5-pro",
"author": "Google",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Reasoning",
"Vision"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Google's most capable Gemini 2.5 model with strong reasoning, thinking support, and a 1M token context window.",
"run_via": "ai_gateway"
},
{
"model_id": "google/gemini-3-flash",
"name": "gemini-3-flash",
"author": "Google",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Vision"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Gemini 3 Flash is Google's fast multimodal model with frontier intelligence, superior search, and grounding capabilities.",
"run_via": "ai_gateway"
},
{
"model_id": "google/gemini-3.1-flash-lite",
"name": "gemini-3.1-flash-lite",
"author": "Google",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Google's lightest and most cost-efficient Gemini model for high-throughput tasks.",
"run_via": "ai_gateway"
},
{
"model_id": "google/gemini-3.1-pro",
"name": "gemini-3.1-pro",
"author": "Google",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Reasoning",
"Vision"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Google's most intelligent Gemini model with improved reasoning, a medium thinking level, and a 1M token context window.",
"run_via": "ai_gateway"
},
{
"model_id": "minimax/m2.7",
"name": "m2.7",
"author": "MiniMax",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "MiniMax's M2.7 language model with multilingual capabilities.",
"run_via": "ai_gateway"
},
{
"model_id": "minimax/m3",
"name": "m3",
"author": "MiniMax",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Function calling"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "MiniMax's M3 language model with frontier coding and agentic capabilities, a 1M token context window, and multilingual support.",
"run_via": "ai_gateway"
},
{
"model_id": "openai/gpt-4.1",
"name": "gpt-4.1",
"author": "OpenAI",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Vision",
"Function calling"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "OpenAI's flagship GPT model for complex tasks with a million-token context window.",
"run_via": "ai_gateway"
},
{
"model_id": "openai/gpt-4.1-mini",
"name": "gpt-4.1-mini",
"author": "OpenAI",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Vision"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Fast, affordable version of GPT-4.1 with a million-token context window.",
"run_via": "ai_gateway"
},
{
"model_id": "openai/gpt-4.1-nano",
"name": "gpt-4.1-nano",
"author": "OpenAI",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "GPT-4.1 Nano is OpenAI's smallest and cheapest GPT-4.1 variant, optimized for high-throughput, low-latency tasks.",
"run_via": "ai_gateway"
},
{
"model_id": "openai/gpt-4o",
"name": "gpt-4o",
"author": "OpenAI",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Vision"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "GPT-4o is OpenAI's multimodal flagship, accepting text and images and responding quickly across a wide range of tasks.",
"run_via": "ai_gateway"
},
{
"model_id": "openai/gpt-4o-mini",
"name": "gpt-4o-mini",
"author": "OpenAI",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Vision"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "GPT-4o Mini is the lightweight, low-cost variant of GPT-4o, well suited to high-volume tasks with multimodal inputs.",
"run_via": "ai_gateway"
},
{
"model_id": "openai/gpt-5",
"name": "gpt-5",
"author": "OpenAI",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Reasoning",
"Function calling",
"Vision"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "OpenAI's model excelling at coding, writing, and reasoning.",
"run_via": "ai_gateway"
},
{
"model_id": "openai/gpt-5-chat",
"name": "gpt-5-chat",
"author": "OpenAI",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "GPT-5 Chat is the chat-tuned variant of GPT-5, optimised for back-and-forth conversation and instruction following.",
"run_via": "ai_gateway"
},
{
"model_id": "openai/gpt-5-mini",
"name": "gpt-5-mini",
"author": "OpenAI",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Reasoning"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "GPT-5 Mini is the lightweight, low-cost variant of GPT-5, well suited to high-volume coding and reasoning tasks.",
"run_via": "ai_gateway"
},
{
"model_id": "openai/gpt-5-nano",
"name": "gpt-5-nano",
"author": "OpenAI",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "GPT-5 Nano is OpenAI's smallest GPT-5 variant, optimized for low latency and cheap, high-throughput tasks.",
"run_via": "ai_gateway"
},
{
"model_id": "openai/gpt-5.1",
"name": "gpt-5.1",
"author": "OpenAI",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Reasoning"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "GPT-5.1 is OpenAI's incremental improvement over GPT-5, with stronger coding, reasoning, and writing.",
"run_via": "ai_gateway"
},
{
"model_id": "openai/gpt-5.1-chat",
"name": "gpt-5.1-chat",
"author": "OpenAI",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "GPT-5.1 Chat is the chat-tuned variant of GPT-5.1, optimised for back-and-forth conversation and instruction following.",
"run_via": "ai_gateway"
},
{
"model_id": "openai/gpt-5.4",
"name": "gpt-5.4",
"author": "OpenAI",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Reasoning",
"Function calling",
"Vision"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "GPT-5.4 is OpenAI's flagship model with strong coding, reasoning, and multimodal capabilities.",
"run_via": "ai_gateway"
},
{
"model_id": "openai/gpt-5.4-mini",
"name": "gpt-5.4-mini",
"author": "OpenAI",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "GPT-5.4 mini is a smaller, faster, and more cost-efficient version of GPT-5.4 for lightweight tasks.",
"run_via": "ai_gateway"
},
{
"model_id": "openai/gpt-5.4-nano",
"name": "gpt-5.4-nano",
"author": "OpenAI",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "GPT-5.4 nano is OpenAI's smallest and fastest model, optimized for edge and low-latency use cases.",
"run_via": "ai_gateway"
},
{
"model_id": "openai/gpt-5.4-pro",
"name": "gpt-5.4-pro",
"author": "OpenAI",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Reasoning",
"Function calling"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "GPT-5.4 pro uses OpenAI's Responses API with built-in tools, improved reasoning, and stateful context management.",
"run_via": "ai_gateway"
},
{
"model_id": "openai/gpt-5.5",
"name": "gpt-5.5",
"author": "OpenAI",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Reasoning",
"Function calling",
"Vision"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "GPT-5.5 is OpenAI's flagship model with strong coding, reasoning, and multimodal capabilities.",
"run_via": "ai_gateway"
},
{
"model_id": "openai/gpt-5.5-pro",
"name": "gpt-5.5-pro",
"author": "OpenAI",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Reasoning",
"Function calling"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "GPT-5.5 pro uses OpenAI's Responses API with built-in tools, improved reasoning, and stateful context management.",
"run_via": "ai_gateway"
},
{
"model_id": "openai/o3",
"name": "o3",
"author": "OpenAI",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Reasoning"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "o3 is OpenAI's general-purpose reasoning model, balancing strong analytical performance with reasonable latency and cost.",
"run_via": "ai_gateway"
},
{
"model_id": "openai/o3-mini",
"name": "o3-mini",
"author": "OpenAI",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Reasoning"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "o3-mini is the lightweight, low-cost reasoning variant of o3, well suited to quick analytical tasks at scale.",
"run_via": "ai_gateway"
},
{
"model_id": "openai/o4-mini",
"name": "o4-mini",
"author": "OpenAI",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Reasoning"
],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "OpenAI's fast, lightweight reasoning model optimized for multi-step problem solving at lower cost.",
"run_via": "ai_gateway"
},
{
"model_id": "xai/grok-4.20-0309-non-reasoning",
"name": "grok-4.20-0309-non-reasoning",
"author": "xAI",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Function calling"
],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "xAI's Grok 4.20 non-reasoning model. Skips the thinking trace for fast, single-pass responses while keeping the same training as the reasoning variant.",
"run_via": "ai_gateway"
},
{
"model_id": "xai/grok-4.20-0309-reasoning",
"name": "grok-4.20-0309-reasoning",
"author": "xAI",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Function calling",
"Reasoning"
],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "xAI's Grok 4.20 reasoning model. Uses extended thinking to work through complex problems, returning a reasoning trace alongside the final answer.",
"run_via": "ai_gateway"
},
{
"model_id": "xai/grok-4.20-multi-agent-0309",
"name": "grok-4.20-multi-agent-0309",
"author": "xAI",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Function calling",
"Reasoning"
],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "xAI's Grok 4.20 multi-agent model with a 2M-token context window. Multiple agents collaborate in parallel to perform deep research tasks, with function calling, structured outputs, and reasoning capabilities.",
"run_via": "ai_gateway"
},
{
"model_id": "xai/grok-4.3",
"name": "grok-4.3",
"author": "xAI",
"task": "Text Generation",
"modality": "text",
"hosting": "third-party",
"capabilities": [
"Function calling",
"Reasoning",
"Vision"
],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "xAI's Grok 4.3 model with a 1M-token context window and strong agentic tool calling with minimal hallucinations. Accepts text and image inputs, and supports function calling, structured outputs, and configurable reasoning effort (none, low, medium, high).",
"run_via": "ai_gateway"
},
{
"model_id": "@cf/ai4bharat/indictrans2-en-indic-1B",
"name": "indictrans2-en-indic-1B",
"author": "ai4bharat",
"task": "Translation",
"modality": "translation",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": 0.342,
"output_ppm": 0.342,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.342,
"currency": "USD"
},
{
"unit": "per M output tokens",
"price": 0.342,
"currency": "USD"
}
],
"description": "IndicTrans2 is the first open-source transformer-based multilingual NMT model that supports high-quality translations across all the 22 scheduled Indic languages",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/meta/m2m100-1.2b",
"name": "m2m100-1.2b",
"author": "meta",
"task": "Translation",
"modality": "translation",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": 0.342,
"output_ppm": 0.342,
"price_raw": [
{
"unit": "per M input tokens",
"price": 0.342,
"currency": "USD"
},
{
"unit": "per M output tokens",
"price": 0.342,
"currency": "USD"
}
],
"description": "Multilingual encoder-decoder (seq-to-seq) model trained for Many-to-Many multilingual translation",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/deepgram/aura-1",
"name": "aura-1",
"author": "deepgram",
"task": "Text-to-Speech",
"modality": "tts",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": [
{
"unit": "per 1k characters",
"price": 0.015,
"currency": "USD"
}
],
"description": "Aura is a context-aware text-to-speech (TTS) model that applies natural pacing, expressiveness, and fillers based on the context of the provided text. The quality of your text input directly impacts the naturalness of the audio output.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/deepgram/aura-2-en",
"name": "aura-2-en",
"author": "deepgram",
"task": "Text-to-Speech",
"modality": "tts",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": [
{
"unit": "per 1k characters",
"price": 0.03,
"currency": "USD"
}
],
"description": "Aura-2 is a context-aware text-to-speech (TTS) model that applies natural pacing, expressiveness, and fillers based on the context of the provided text. The quality of your text input directly impacts the naturalness of the audio output.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/deepgram/aura-2-es",
"name": "aura-2-es",
"author": "deepgram",
"task": "Text-to-Speech",
"modality": "tts",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": [
{
"unit": "per 1k characters",
"price": 0.03,
"currency": "USD"
}
],
"description": "Aura-2 is a context-aware text-to-speech (TTS) model that applies natural pacing, expressiveness, and fillers based on the context of the provided text. The quality of your text input directly impacts the naturalness of the audio output.",
"run_via": "workers_ai_binding"
},
{
"model_id": "@cf/myshell-ai/melotts",
"name": "melotts",
"author": "myshell-ai",
"task": "Text-to-Speech",
"modality": "tts",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": [
{
"unit": "per audio minute",
"price": 0.000205,
"currency": "USD"
}
],
"description": "MeloTTS is a high-quality multi-lingual text-to-speech library by MyShell.ai.",
"run_via": "workers_ai_binding"
},
{
"model_id": "google/gemini-3.1-flash-tts",
"name": "gemini-3.1-flash-tts",
"author": "Google",
"task": "Text-to-Speech",
"modality": "tts",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Google Gemini 3.1 Flash text-to-speech.",
"run_via": "ai_gateway"
},
{
"model_id": "inworld/tts-1.5-max",
"name": "tts-1.5-max",
"author": "Inworld",
"task": "Text-to-Speech",
"modality": "tts",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Highest-quality text-to-speech with under 200ms latency, emotion control, and 15-language support.",
"run_via": "ai_gateway"
},
{
"model_id": "inworld/tts-1.5-mini",
"name": "tts-1.5-mini",
"author": "Inworld",
"task": "Text-to-Speech",
"modality": "tts",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Ultra-fast, cost-efficient text-to-speech with approximately 120ms latency and 15-language support.",
"run_via": "ai_gateway"
},
{
"model_id": "inworld/tts-2",
"name": "tts-2",
"author": "Inworld",
"task": "Text-to-Speech",
"modality": "tts",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Inworld's most powerful and expressive text-to-speech model. Rich expressive speech, real-time latency, natural language steering (e.g. [whisper], [say excitedly]), and stronger multilingual support across 15 production languages plus 90+ experimental languages.",
"run_via": "ai_gateway"
},
{
"model_id": "minimax/speech-2.8-hd",
"name": "speech-2.8-hd",
"author": "MiniMax",
"task": "Text-to-Speech",
"modality": "tts",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "MiniMax Speech 2.8 HD focuses on studio-grade audio generation with emotion control, multilingual support (40+ languages), and voice cloning.",
"run_via": "ai_gateway"
},
{
"model_id": "minimax/speech-2.8-turbo",
"name": "speech-2.8-turbo",
"author": "MiniMax",
"task": "Text-to-Speech",
"modality": "tts",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "MiniMax Speech 2.8 Turbo turns text into natural, expressive speech with voice cloning, emotion control, and 40+ language support at faster speeds.",
"run_via": "ai_gateway"
},
{
"model_id": "openai/tts-1",
"name": "tts-1",
"author": "OpenAI",
"task": "Text-to-Speech",
"modality": "tts",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "OpenAI's text-to-speech model optimized for real-time use with low latency.",
"run_via": "ai_gateway"
},
{
"model_id": "openai/tts-1-hd",
"name": "tts-1-hd",
"author": "OpenAI",
"task": "Text-to-Speech",
"modality": "tts",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "OpenAI's high-definition text-to-speech model producing higher quality audio output.",
"run_via": "ai_gateway"
},
{
"model_id": "xai/grok-tts",
"name": "grok-tts",
"author": "xAI",
"task": "Text-to-Speech",
"modality": "tts",
"hosting": "third-party",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "xAI's Grok text-to-speech model. Generates high-fidelity spoken audio in 5 expressive voices (eve, ara, rex, sal, leo) with 20+ supported languages. Supports inline speech tags for laughter, whispers, and pauses.",
"run_via": "ai_gateway"
},
{
"model_id": "@cf/pipecat-ai/smart-turn-v2",
"name": "smart-turn-v2",
"author": "pipecat-ai",
"task": "Dumb Pipe",
"modality": "vad",
"hosting": "cloudflare",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": [
{
"unit": "per audio minute",
"price": 0.000338,
"currency": "USD"
}
],
"description": "An open source, community-driven, native audio turn detection model in 2nd version",
"run_via": "workers_ai_binding"
},
{
"model_id": "alibaba/hh1-i2v",
"name": "hh1-i2v",
"author": "Alibaba",
"task": "Image-to-Video",
"modality": "video",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Alibaba's HappyHorse 1.0 image-to-video model. Animates a reference image with an optional text prompt. Supports 720P and 1080P output with durations from 3 to 15 seconds.",
"run_via": "ai_gateway"
},
{
"model_id": "alibaba/hh1-t2v",
"name": "hh1-t2v",
"author": "Alibaba",
"task": "Text-to-Video",
"modality": "video",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Alibaba's HappyHorse 1.0 text-to-video model. Generates videos from a text prompt with configurable resolution, aspect ratio, and duration (3-15s).",
"run_via": "ai_gateway"
},
{
"model_id": "alibaba/wan-2.7-i2v",
"name": "wan-2.7-i2v",
"author": "Alibaba",
"task": "Image-to-Video",
"modality": "video",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Alibaba's Wan 2.7 image-to-video model that generates videos from a reference image with optional text prompts. Supports 720P and 1080P output with durations from 2 to 15 seconds.",
"run_via": "ai_gateway"
},
{
"model_id": "bytedance/seedance-2.0",
"name": "seedance-2.0",
"author": "ByteDance",
"task": "Text-to-Video",
"modality": "video",
"hosting": "third-party",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "ByteDance's next-generation video model with a unified multimodal architecture. Generates high-quality video with synchronized audio from text, images, video clips, and audio inputs. Supports multimodal references (up to 9 images, 3 videos, 3 audio files), native audio, video editing, video extension, intelligent duration, and adaptive aspect ratio.",
"run_via": "ai_gateway"
},
{
"model_id": "bytedance/seedance-2.0-fast",
"name": "seedance-2.0-fast",
"author": "ByteDance",
"task": "Text-to-Video",
"modality": "video",
"hosting": "third-party",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Faster variant of ByteDance's Seedance 2.0 video model. Trades some quality for speed while sharing the same multimodal architecture. Supports text-to-video, image-to-video, native audio, multimodal references, video editing, and video extension.",
"run_via": "ai_gateway"
},
{
"model_id": "google/veo-3",
"name": "veo-3",
"author": "Google",
"task": "Text-to-Video",
"modality": "video",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Google's video generation model capable of producing high-quality videos with optional audio from text prompts.",
"run_via": "ai_gateway"
},
{
"model_id": "google/veo-3-fast",
"name": "veo-3-fast",
"author": "Google",
"task": "Text-to-Video",
"modality": "video",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "A faster version of Veo 3 optimized for lower latency video generation with audio support.",
"run_via": "ai_gateway"
},
{
"model_id": "google/veo-3.1",
"name": "veo-3.1",
"author": "Google",
"task": "Text-to-Video",
"modality": "video",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Google's latest video generation model with improved quality, motion, and audio generation.",
"run_via": "ai_gateway"
},
{
"model_id": "google/veo-3.1-fast",
"name": "veo-3.1-fast",
"author": "Google",
"task": "Text-to-Video",
"modality": "video",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "A faster version of Veo 3.1 optimized for lower latency while maintaining high-quality video and audio output.",
"run_via": "ai_gateway"
},
{
"model_id": "minimax/hailuo-2.3",
"name": "hailuo-2.3",
"author": "MiniMax",
"task": "Text-to-Video",
"modality": "video",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "A high-fidelity video generation model optimized for realistic human motion, cinematic VFX, expressive characters, and strong prompt and style adherence across text-to-video and image-to-video workflows.",
"run_via": "ai_gateway"
},
{
"model_id": "minimax/hailuo-2.3-fast",
"name": "hailuo-2.3-fast",
"author": "MiniMax",
"task": "Text-to-Video",
"modality": "video",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "A lower-latency version of Hailuo 2.3 that preserves core motion quality, visual consistency, and stylization while enabling faster iteration.",
"run_via": "ai_gateway"
},
{
"model_id": "pixverse/v5.6",
"name": "v5.6",
"author": "PixVerse",
"task": "Text-to-Video",
"modality": "video",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Pixverse v5.6 is a video generation model supporting text-to-video and image-to-video with audio generation, customizable aspect ratios, and up to 1080p output.",
"run_via": "ai_gateway"
},
{
"model_id": "pixverse/v6",
"name": "v6",
"author": "PixVerse",
"task": "Text-to-Video",
"modality": "video",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Pixverse v6 is the latest Pixverse video model with support for up to 15-second videos, customizable duration from 1 to 15 seconds, and audio generation.",
"run_via": "ai_gateway"
},
{
"model_id": "runwayml/gen-4.5",
"name": "gen-4.5",
"author": "RunwayML",
"task": "Text-to-Video",
"modality": "video",
"hosting": "third-party",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "RunwayML's video generation model supporting both text-to-video and image-to-video with customizable duration, aspect ratio, and content moderation controls.",
"run_via": "ai_gateway"
},
{
"model_id": "vidu/q3-pro",
"name": "q3-pro",
"author": "Vidu",
"task": "Text-to-Video",
"modality": "video",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Vidu Q3 Pro is a high-quality video generation model supporting text-to-video, image-to-video, and start/end-frame-to-video workflows with audio and up to 16-second clips.",
"run_via": "ai_gateway"
},
{
"model_id": "vidu/q3-turbo",
"name": "q3-turbo",
"author": "Vidu",
"task": "Text-to-Video",
"modality": "video",
"hosting": "third-party",
"capabilities": [],
"flags": [
"Zero data retention"
],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "Vidu Q3 Turbo is a faster version of Vidu Q3 optimized for lower latency video generation while maintaining audio support and up to 16-second clips.",
"run_via": "ai_gateway"
},
{
"model_id": "xai/grok-imagine-video",
"name": "grok-imagine-video",
"author": "xAI",
"task": "Text-to-Video",
"modality": "video",
"hosting": "third-party",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "xAI's video generation model. Generates, edits, and extends videos from text and image inputs with native synchronized audio including dialogue, sound effects, and music. Supports multiple creative modes (normal, fun, custom).",
"run_via": "ai_gateway"
},
{
"model_id": "xai/grok-imagine-video-1.5-preview",
"name": "grok-imagine-video-1.5-preview",
"author": "xAI",
"task": "Image-to-Video",
"modality": "video",
"hosting": "third-party",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "xAI's next-generation video generation model. Generates, edits, and extends videos from text and image inputs. Supports multiple aspect ratios and resolutions with improved quality over the previous generation.",
"run_via": "ai_gateway"
},
{
"model_id": "xai/grok-voice",
"name": "grok-voice",
"author": "xAI",
"task": "websocket",
"modality": "voice",
"hosting": "third-party",
"capabilities": [],
"flags": [],
"context_window": null,
"input_ppm": null,
"output_ppm": null,
"price_raw": null,
"description": "xAI's real-time voice conversation model with low-latency audio input and output streaming.",
"run_via": "ai_gateway"
}
];
