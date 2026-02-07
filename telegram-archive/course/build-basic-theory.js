#!/usr/bin/env node
/**
 * Generates local HTML pages for the Basic Theory course from learn.evocoders.ai
 * Since individual lesson pages require Telegram auth, we create structured pages
 * with topic overviews and links to the original KB + related TG archive content.
 *
 * Run: node build-basic-theory.js
 */

const fs = require('fs');
const path = require('path');

// Course data structure
const levels = [
  {
    num: 1,
    emoji: '🌱',
    title: 'Новичок',
    titleEn: 'Beginner',
    desc: 'Foundational concepts of generative AI, major players, model types, and core terminology.',
    topics: [
      {
        slug: 'generative-ai',
        title: 'Генеративный ИИ',
        titleEn: 'Generative AI',
        desc: 'Introduction to generative artificial intelligence - what it is, how it works, and why it changed everything.',
        details: [
          'What makes AI "generative" vs traditional AI/ML',
          'Key generative modalities: text, image, audio, video, code',
          'History: from GPT-1 to modern foundation models',
          'How generative AI differs from discriminative models',
          'Real-world applications and impact on industries'
        ],
        relatedTG: ['Лента', 'AI-дайджест']
      },
      {
        slug: 'big-players',
        title: 'Большие игроки',
        titleEn: 'The Big Players',
        desc: 'Overview of major companies and organizations driving the AI revolution.',
        details: [
          'OpenAI - GPT family, ChatGPT, DALL-E, Sora',
          'Anthropic - Claude family, Constitutional AI approach',
          'Google DeepMind - Gemini, AlphaFold, PaLM',
          'Meta AI - Llama open-source models, FAIR research',
          'Mistral AI - European AI lab, open-weight models',
          'Other key players: xAI (Grok), Stability AI, Cohere, AI21 Labs',
          'Chinese labs: Alibaba (Qwen), DeepSeek, Baidu, ByteDance'
        ],
        relatedTG: ['Модельки', 'Лента']
      },
      {
        slug: 'llm-and-gpt',
        title: 'LLM и GPT',
        titleEn: 'LLM and GPT',
        desc: 'Large Language Models and the GPT architecture that started the revolution.',
        details: [
          'What is a Large Language Model (LLM)',
          'The Transformer architecture (Attention Is All You Need)',
          'GPT: Generative Pre-trained Transformer explained',
          'How LLMs generate text: next-token prediction',
          'Scaling laws and emergent abilities',
          'Key model families: GPT-4, Claude, Gemini, Llama, Qwen'
        ],
        relatedTG: ['Модельки', 'Лента']
      },
      {
        slug: 'diffusion-models',
        title: 'Диффузионные модели',
        titleEn: 'Diffusion Models',
        desc: 'Understanding image and video generation with diffusion-based approaches.',
        details: [
          'How diffusion models work: noise → image process',
          'Key models: Stable Diffusion, DALL-E 3, Midjourney, Flux',
          'Text-to-image generation pipeline',
          'ControlNet, LoRA adapters for customization',
          'Video generation: Sora, Runway, Kling',
          'Comparison with GANs and other generation approaches'
        ],
        relatedTG: ['Лента']
      },
      {
        slug: 'multimodality',
        title: 'Мультимодальность',
        titleEn: 'Multimodality',
        desc: 'AI models that work with multiple data types simultaneously.',
        details: [
          'What is multimodality: combining text, image, audio, video',
          'Vision-Language Models (VLMs): GPT-4V, Claude Vision, Gemini',
          'Audio understanding and generation: Whisper, speech models',
          'Document understanding and OCR capabilities',
          'Cross-modal generation: text→image, image→text, etc.',
          'Real-world multimodal applications'
        ],
        relatedTG: ['Модельки', 'Лента']
      },
      {
        slug: 'reasoning',
        title: 'Рассуждения',
        titleEn: 'Reasoning',
        desc: 'AI reasoning capabilities - chain of thought, thinking models, and logical inference.',
        details: [
          'Chain-of-thought (CoT) prompting and reasoning',
          'Reasoning models: o1, o3, DeepSeek-R1, QwQ',
          'Thinking tokens and extended reasoning',
          'Math, logic, and code reasoning benchmarks',
          'Limitations of current reasoning approaches',
          'System 1 vs System 2 thinking in AI'
        ],
        relatedTG: ['Модельки', 'Лента']
      },
      {
        slug: 'foundation-models',
        title: 'Фундаментальные модели',
        titleEn: 'Foundation Models',
        desc: 'The concept of foundation models - large pre-trained models adapted for many tasks.',
        details: [
          'What makes a model "foundational"',
          'Pre-training on massive datasets',
          'Transfer learning and adaptation',
          'Foundation models vs task-specific models',
          'The ecosystem: base models, fine-tunes, and APIs',
          'Open vs closed foundation models'
        ],
        relatedTG: ['Модельки']
      },
      {
        slug: 'data-classification',
        title: 'Классификация по типу данных',
        titleEn: 'Data Type Classification',
        desc: 'Categorizing AI models by what data types they handle as input and output.',
        details: [
          'Text models: LLMs, translation, summarization',
          'Image models: generation, editing, understanding',
          'Audio models: speech-to-text, text-to-speech, music',
          'Video models: generation, understanding, editing',
          'Code models: generation, completion, review',
          'Multimodal models: cross-type input/output',
          '3D and spatial models'
        ],
        relatedTG: ['Модельки']
      },
      {
        slug: 'sota',
        title: 'SOTA',
        titleEn: 'State of the Art',
        desc: 'Understanding state-of-the-art benchmarks, rankings, and how to track the latest developments.',
        details: [
          'What SOTA means in AI research',
          'Key benchmarks: MMLU, HumanEval, SWE-bench, MATH',
          'Leaderboards: Chatbot Arena, Open LLM Leaderboard',
          'How to evaluate claims about model performance',
          'The pace of progress: tracking new releases',
          'Where to follow AI news and research'
        ],
        relatedTG: ['Лента', 'AI-дайджест']
      }
    ]
  },
  {
    num: 2,
    emoji: '💡',
    title: 'Пользователь',
    titleEn: 'User',
    desc: 'Core concepts for effectively using AI models: prompts, tokens, context, and common pitfalls.',
    topics: [
      {
        slug: 'prompt',
        title: 'Промпт',
        titleEn: 'Prompt',
        desc: 'Understanding prompts - the primary interface between humans and AI models.',
        details: [
          'What is a prompt and why it matters',
          'System prompts, user prompts, and assistant messages',
          'Prompt structure: instruction, context, examples, constraints',
          'Writing clear and effective prompts',
          'Common prompt patterns and templates',
          'Iterative prompt refinement'
        ],
        relatedTG: ['Лента', 'Агенты и инструменты']
      },
      {
        slug: 'token',
        title: 'Токен',
        titleEn: 'Token',
        desc: 'How models process text through tokenization - the fundamental unit of LLM computation.',
        details: [
          'What is a token: subword units, not characters or words',
          'Tokenization algorithms: BPE, SentencePiece',
          'Token limits and model context windows',
          'Pricing models: input/output token costs',
          'How different languages tokenize differently',
          'Token counting tools and estimation'
        ],
        relatedTG: ['Агенты и инструменты']
      },
      {
        slug: 'context',
        title: 'Контекст',
        titleEn: 'Context',
        desc: 'Context windows, how models use context, and managing context effectively.',
        details: [
          'What is a context window (4K → 128K → 1M+ tokens)',
          'How models attend to context (attention mechanism basics)',
          'Long context vs effective context utilization',
          'Lost-in-the-middle problem',
          'Context management strategies',
          'RAG as context extension technique'
        ],
        relatedTG: ['Агенты и инструменты', 'Лента']
      },
      {
        slug: 'hallucination',
        title: 'Галлюцинации',
        titleEn: 'Hallucinations',
        desc: 'Why LLMs generate false information and how to detect and mitigate it.',
        details: [
          'What are hallucinations (confabulations)',
          'Why LLMs hallucinate: probabilistic generation',
          'Types: factual errors, fabricated references, logical inconsistencies',
          'Detection strategies and verification techniques',
          'Grounding: using RAG and tool use to reduce hallucinations',
          'When hallucinations are dangerous vs acceptable'
        ],
        relatedTG: ['Лента']
      },
      {
        slug: 'vibecoding',
        title: 'Вайбкодинг',
        titleEn: 'Vibecoding',
        desc: 'The new paradigm of coding by intent - describing what you want and letting AI write the code.',
        details: [
          'What is vibecoding and who coined the term',
          'From manual coding to intent-driven development',
          'When vibecoding works well vs when it fails',
          'Tools for vibecoding: Cursor, Claude Code, Copilot',
          'Best practices for effective vibecoding',
          'The spectrum: full manual → assisted → vibe → fully autonomous'
        ],
        relatedTG: ['Лента', 'Видео-контент']
      }
    ]
  },
  {
    num: 3,
    emoji: '⚡',
    title: 'Профи',
    titleEn: 'Professional',
    desc: 'Deep technical understanding of neural networks, model training, optimization, and architecture.',
    topics: [
      {
        slug: 'neural-networks',
        title: 'Основы нейросетей',
        titleEn: 'Neural Network Fundamentals',
        desc: 'Architecture of neural networks - layers, activation functions, and how learning happens.',
        details: [
          'Neurons, layers, and network architectures',
          'Activation functions: ReLU, GELU, Sigmoid',
          'Forward propagation and backpropagation',
          'Loss functions and gradient descent',
          'Convolutional, recurrent, and transformer networks',
          'Attention mechanism deep dive'
        ],
        relatedTG: []
      },
      {
        slug: 'data-to-model',
        title: 'От данных к модели',
        titleEn: 'Data to Model',
        desc: 'The complete pipeline from raw data to a trained model.',
        details: [
          'Data collection and curation at scale',
          'Data cleaning, deduplication, and filtering',
          'Preprocessing and feature engineering',
          'Dataset formats and standards',
          'Data quality vs quantity trade-offs',
          'Synthetic data generation'
        ],
        relatedTG: []
      },
      {
        slug: 'training-finetuning',
        title: 'Обучение и Fine-tuning',
        titleEn: 'Training & Fine-tuning',
        desc: 'How models are trained from scratch and adapted for specific tasks.',
        details: [
          'Pre-training: massive compute and data',
          'Supervised Fine-Tuning (SFT)',
          'RLHF: Reinforcement Learning from Human Feedback',
          'DPO: Direct Preference Optimization',
          'Parameter-efficient methods: LoRA, QLoRA, adapters',
          'When to fine-tune vs when to prompt engineer'
        ],
        relatedTG: ['Видео-контент']
      },
      {
        slug: 'model-optimization',
        title: 'Оптимизация моделей',
        titleEn: 'Model Optimization',
        desc: 'Making models faster, smaller, and cheaper to run.',
        details: [
          'Quantization: FP16, INT8, INT4, GPTQ, AWQ, GGUF',
          'Pruning: removing unnecessary weights',
          'Knowledge distillation: training smaller models',
          'Flash Attention and memory optimization',
          'Speculative decoding',
          'Model merging techniques'
        ],
        relatedTG: ['Видео-контент']
      },
      {
        slug: 'model-types',
        title: 'Типы и структуры моделей',
        titleEn: 'Model Types & Structures',
        desc: 'Different model architectures and their trade-offs.',
        details: [
          'Transformer variants: encoder, decoder, encoder-decoder',
          'Mixture of Experts (MoE) architecture',
          'Dense vs sparse models',
          'Multi-head attention variants',
          'State-space models (Mamba, etc.)',
          'Hybrid architectures'
        ],
        relatedTG: ['Модельки']
      }
    ]
  },
  {
    num: 4,
    emoji: '🚀',
    title: 'Мастер',
    titleEn: 'Master',
    desc: 'Advanced techniques: prompting strategies, agents, RAG, tool use, and practical AI development.',
    topics: [
      {
        slug: 'prompting-techniques',
        title: 'Техники промптинга',
        titleEn: 'Prompting Techniques',
        desc: 'Advanced prompting strategies for getting the best results from AI models.',
        details: [
          'Zero-shot, one-shot, and few-shot prompting',
          'Chain-of-Thought (CoT) and step-by-step reasoning',
          'Tree-of-Thought and multi-path reasoning',
          'ReAct: Reasoning + Acting pattern',
          'Role prompting and persona engineering',
          'Constitutional prompting and guardrails'
        ],
        relatedTG: ['Лента', 'Агенты и инструменты']
      },
      {
        slug: 'base-tools',
        title: 'Инструменты и библиотеки',
        titleEn: 'Tools & Libraries',
        desc: 'Key frameworks and libraries for building AI-powered applications.',
        details: [
          'LangChain: chains, agents, memory',
          'LlamaIndex: data connectors and retrieval',
          'Haystack: search and RAG pipelines',
          'Semantic Kernel: Microsoft AI orchestration',
          'OpenAI SDK, Anthropic SDK, Google AI SDK',
          'Hugging Face Transformers ecosystem'
        ],
        relatedTG: ['Агенты и инструменты', 'Видео-контент']
      },
      {
        slug: 'agents',
        title: 'Агенты',
        titleEn: 'Agents',
        desc: 'AI agents that can plan, reason, and take actions autonomously.',
        details: [
          'What is an AI agent: perception → planning → action loop',
          'Agent architectures: ReAct, Plan-and-Execute, Tree-of-Agents',
          'CrewAI, AutoGen, MetaGPT multi-agent frameworks',
          'Memory systems: short-term, long-term, episodic',
          'Tool use and function calling in agents',
          'Agent evaluation and safety'
        ],
        relatedTG: ['Агенты и инструменты', 'Видео-контент']
      },
      {
        slug: 'tool-use',
        title: 'Tool Use',
        titleEn: 'Tool Use',
        desc: 'Extending AI capabilities through function calling and external tool integration.',
        details: [
          'Function calling APIs: OpenAI, Anthropic, Google',
          'Tool definition schemas and parameter types',
          'Parallel tool calls and multi-step tool use',
          'Building custom tools for your domain',
          'Error handling and tool call validation',
          'Computer use and browser automation'
        ],
        relatedTG: ['Агенты и инструменты']
      },
      {
        slug: 'rag',
        title: 'RAG',
        titleEn: 'Retrieval-Augmented Generation',
        desc: 'Grounding AI responses in your own data using retrieval techniques.',
        details: [
          'RAG architecture: retrieve → augment → generate',
          'Embeddings and vector databases',
          'Chunking strategies for documents and code',
          'Hybrid search: semantic + keyword',
          'Reranking and relevance scoring',
          'Advanced RAG: CRAG, Self-RAG, Graph RAG'
        ],
        relatedTG: ['Видео-контент', 'Лента']
      },
      {
        slug: 'frameworks',
        title: 'Прикладные инструменты',
        titleEn: 'Applied Frameworks',
        desc: 'Practical frameworks for building production AI applications.',
        details: [
          'Dify: visual AI workflow builder',
          'n8n: workflow automation with AI nodes',
          'Flowise: LangChain visual builder',
          'Vercel AI SDK for web applications',
          'FastAPI + LLM integration patterns',
          'Low-code/no-code AI platforms'
        ],
        relatedTG: ['Видео-контент', 'Агенты и инструменты']
      },
      {
        slug: 'model-formats',
        title: 'Форматы моделей',
        titleEn: 'Model Formats',
        desc: 'Understanding different model distribution and execution formats.',
        details: [
          'GGUF: llama.cpp format for CPU/GPU inference',
          'GPTQ, AWQ: GPU-optimized quantized formats',
          'SafeTensors: safe model serialization',
          'ONNX: cross-platform model format',
          'ExLlamaV2, Marlin kernel formats',
          'Choosing the right format for your hardware'
        ],
        relatedTG: ['Модельки']
      },
      {
        slug: 'ai-protocols',
        title: 'ИИ-протоколы',
        titleEn: 'AI Protocols',
        desc: 'Communication protocols connecting AI models to tools and services.',
        details: [
          'MCP (Model Context Protocol): architecture and servers',
          'A2A (Agent-to-Agent): inter-agent communication',
          'OpenAI function calling protocol',
          'Tool use standards across providers',
          'Server-Sent Events for streaming',
          'WebSocket-based AI communication'
        ],
        relatedTG: ['Агенты и инструменты', 'Видео-контент']
      },
      {
        slug: 'hardware',
        title: 'База по железу',
        titleEn: 'Hardware Basics',
        desc: 'Hardware requirements for running AI models locally.',
        details: [
          'GPU vs CPU for AI inference',
          'VRAM requirements by model size',
          'NVIDIA GPUs: consumer vs data center',
          'Apple Silicon for local LLMs',
          'Cloud GPU providers and pricing',
          'Optimal hardware configurations by budget'
        ],
        relatedTG: ['Модельки']
      },
      {
        slug: 'api-providers',
        title: 'API-провайдеры',
        titleEn: 'API Providers',
        desc: 'Cloud API providers for accessing AI models without local hardware.',
        details: [
          'OpenAI API: models, pricing, features',
          'Anthropic API: Claude models and capabilities',
          'Google AI: Gemini API and Vertex AI',
          'OpenRouter: unified multi-provider access',
          'Together AI, Fireworks, Groq: inference providers',
          'Cost optimization strategies'
        ],
        relatedTG: ['Агенты и инструменты']
      }
    ]
  },
  {
    num: 5,
    emoji: '🌌',
    title: 'Горизонты',
    titleEn: 'Horizons',
    desc: 'Future of AI: AGI, safety, alignment, and philosophical questions about artificial intelligence.',
    topics: [
      {
        slug: 'agi',
        title: 'Общий искусственный интеллект',
        titleEn: 'Artificial General Intelligence (AGI)',
        desc: 'The quest for human-level AI that can perform any intellectual task.',
        details: [
          'Definitions of AGI and the debate around them',
          'Current progress toward AGI capabilities',
          'Timeline predictions from industry leaders',
          'AGI benchmarks and evaluation criteria',
          'Economic and social implications of AGI'
        ],
        relatedTG: ['Лента']
      },
      {
        slug: 'asi',
        title: 'Сверхинтеллект',
        titleEn: 'Artificial Superintelligence (ASI)',
        desc: 'Beyond human-level AI - what happens when AI surpasses all human capabilities.',
        details: [
          'What is superintelligence',
          'Bostrom\'s paths to superintelligence',
          'Speed, quality, and collective superintelligence',
          'The control problem',
          'Existential risk considerations'
        ],
        relatedTG: []
      },
      {
        slug: 'singularity',
        title: 'Технологическая сингулярность',
        titleEn: 'Technological Singularity',
        desc: 'The hypothetical point where AI improvement becomes self-sustaining and irreversible.',
        details: [
          'Vinge and Kurzweil\'s singularity predictions',
          'Recursive self-improvement scenarios',
          'Intelligence explosion dynamics',
          'Pre-singularity and post-singularity scenarios',
          'Criticism and skepticism of singularity theory'
        ],
        relatedTG: []
      },
      {
        slug: 'intelligence-explosion',
        title: 'Взрыв интеллекта',
        titleEn: 'Intelligence Explosion',
        desc: 'The rapid, recursive improvement of AI capabilities.',
        details: [
          'I.J. Good\'s intelligence explosion concept',
          'Self-improving AI systems',
          'Feedback loops in AI development',
          'Bottlenecks that might prevent explosion',
          'Current AI helping build better AI (AI-for-AI research)'
        ],
        relatedTG: []
      },
      {
        slug: 'transhumanism',
        title: 'Трансгуманизм',
        titleEn: 'Transhumanism',
        desc: 'Human enhancement through technology and AI.',
        details: [
          'Brain-computer interfaces (Neuralink, etc.)',
          'Cognitive enhancement possibilities',
          'Human-AI symbiosis scenarios',
          'Ethical considerations of human augmentation',
          'Longevity research and AI\'s role'
        ],
        relatedTG: []
      },
      {
        slug: 'spatial-intelligence',
        title: 'Пространственный интеллект',
        titleEn: 'Spatial Intelligence',
        desc: 'AI understanding of 3D space, physics, and physical world interaction.',
        details: [
          'Spatial understanding in AI models',
          'World models and physics simulation',
          'Robotics and embodied AI',
          '3D generation and reconstruction',
          'Autonomous navigation and spatial reasoning'
        ],
        relatedTG: []
      },
      {
        slug: 'world-model',
        title: 'Общая модель мира',
        titleEn: 'General World Model',
        desc: 'AI systems that build internal representations of how the world works.',
        details: [
          'What is a world model in AI',
          'LeCun\'s JEPA and world model proposals',
          'Video prediction as world modeling',
          'Implicit vs explicit world models in LLMs',
          'Simulation and planning with world models'
        ],
        relatedTG: []
      },
      {
        slug: 'accelerationists',
        title: 'Техно-оптимисты',
        titleEn: 'Techno-Optimists',
        desc: 'The e/acc movement and arguments for accelerating AI development.',
        details: [
          'Effective Accelerationism (e/acc) movement',
          'Marc Andreessen\'s techno-optimist manifesto',
          'Arguments for rapid AI development',
          'Open-source AI advocacy',
          'Balancing progress and safety'
        ],
        relatedTG: []
      },
      {
        slug: 'doomers',
        title: 'Техно-пессимисты',
        titleEn: 'Techno-Pessimists',
        desc: 'Concerns about existential risk from advanced AI.',
        details: [
          'AI doom arguments and scenarios',
          'Eliezer Yudkowsky and MIRI\'s position',
          'Pause AI movement',
          'Regulatory approaches globally',
          'The debate: safety vs progress'
        ],
        relatedTG: []
      },
      {
        slug: 'ai-safety',
        title: 'AI Safety',
        titleEn: 'AI Safety',
        desc: 'Research and practices for building safe AI systems.',
        details: [
          'What is AI safety and why it matters',
          'Risks: misuse, misalignment, accidents',
          'Safety evaluation and red-teaming',
          'Containment and monitoring strategies',
          'Major AI safety organizations and research'
        ],
        relatedTG: []
      },
      {
        slug: 'alignment',
        title: 'AI Alignment',
        titleEn: 'AI Alignment',
        desc: 'Ensuring AI systems act in accordance with human values and intentions.',
        details: [
          'The alignment problem defined',
          'RLHF, DPO, and current alignment techniques',
          'Scalable oversight and debate',
          'Interpretability and mechanistic understanding',
          'Superalignment: aligning superhuman AI'
        ],
        relatedTG: []
      },
      {
        slug: 'explainable-ai',
        title: 'XAI и Constitutional AI',
        titleEn: 'Explainable & Constitutional AI',
        desc: 'Making AI decisions transparent and building AI systems with built-in principles.',
        details: [
          'Explainable AI (XAI) methods and importance',
          'Feature attribution and attention visualization',
          'Constitutional AI (Anthropic\'s approach)',
          'LIME, SHAP, and other interpretability tools',
          'Regulatory requirements for explainability'
        ],
        relatedTG: []
      },
      {
        slug: 'decentralized-ai',
        title: 'Децентрализованный ИИ',
        titleEn: 'Decentralized AI',
        desc: 'Distributed and blockchain-based approaches to AI.',
        details: [
          'Why decentralize AI: censorship resistance, access',
          'Federated learning: training without sharing data',
          'On-chain AI and crypto-AI projects',
          'Distributed inference networks',
          'Challenges and limitations of decentralized AI'
        ],
        relatedTG: []
      }
    ]
  }
];

// Shared CSS
const sharedCSS = `
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#0a0a0f; color:#e4e6eb; }
a { color:#6ab2f2; text-decoration:none; }
a:hover { text-decoration:underline; }
.header { background:#111119; padding:16px 24px; border-bottom:1px solid #1e1e2e; display:flex; align-items:center; gap:16px; position:sticky; top:0; z-index:10; }
.header h1 { font-size:18px; color:#6ab2f2; }
.header .back { color:#8696a4; font-size:14px; }
.container { max-width:900px; margin:0 auto; padding:24px; }
.breadcrumb { color:#8696a4; font-size:13px; margin-bottom:20px; }
.breadcrumb a { color:#6ab2f2; }
.level-badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; margin-bottom:16px; }
.level-1 { background:rgba(74,222,128,0.15); color:#4ade80; }
.level-2 { background:rgba(96,165,250,0.15); color:#60a5fa; }
.level-3 { background:rgba(245,158,11,0.15); color:#f59e0b; }
.level-4 { background:rgba(239,68,68,0.15); color:#ef4444; }
.level-5 { background:rgba(168,85,247,0.15); color:#a855f7; }
h2 { font-size:28px; margin-bottom:8px; }
h2 .ru { color:#8696a4; font-size:20px; font-weight:400; }
.desc { color:#8696a4; font-size:15px; line-height:1.7; margin-bottom:24px; }
.detail-list { list-style:none; padding:0; }
.detail-list li { padding:10px 16px; margin-bottom:6px; border-radius:8px; background:#111119; border-left:3px solid #2b5278; font-size:14px; line-height:1.5; color:#e4e6eb; }
.detail-list li::before { content:'→ '; color:#6ab2f2; }
.section-title { font-size:16px; color:#8696a4; margin:24px 0 12px; text-transform:uppercase; letter-spacing:1px; }
.related-topics { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
.related-topics a { display:inline-block; background:#111119; border:1px solid #1e1e2e; padding:6px 14px; border-radius:8px; font-size:13px; color:#6ab2f2; }
.related-topics a:hover { background:#1e1e2e; text-decoration:none; }
.ext-link { display:block; margin-top:20px; padding:14px 20px; background:linear-gradient(135deg, rgba(106,178,242,0.08), rgba(106,178,242,0.02)); border:1px solid rgba(106,178,242,0.2); border-radius:12px; font-size:14px; }
.ext-link .label { color:#8696a4; font-size:12px; }
.nav-links { display:flex; justify-content:space-between; margin-top:30px; padding-top:20px; border-top:1px solid #1e1e2e; }
.nav-links a { color:#6ab2f2; font-size:14px; }
.nav-links .disabled { color:#333; }
.topic-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:12px; margin-top:16px; }
.topic-card { background:#111119; border-radius:12px; padding:18px; border-left:3px solid #2b5278; display:block; transition:background 0.15s; }
.topic-card:hover { background:#1a1a2e; text-decoration:none; }
.topic-card h3 { color:#e4e6eb; font-size:15px; margin-bottom:4px; }
.topic-card .en { color:#8696a4; font-size:13px; }
.footer { text-align:center; padding:30px; color:#8696a4; font-size:12px; margin-top:30px; border-top:1px solid #1e1e2e; }
`;

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Create directories
const baseDir = path.join(__dirname, 'basic-theory');
if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });

for (var l = 0; l < levels.length; l++) {
  var levelDir = path.join(baseDir, 'level-' + levels[l].num);
  if (!fs.existsSync(levelDir)) fs.mkdirSync(levelDir, { recursive: true });
}

// Generate topic pages
var totalPages = 0;
for (var l = 0; l < levels.length; l++) {
  var level = levels[l];
  var topics = level.topics;

  for (var t = 0; t < topics.length; t++) {
    var topic = topics[t];
    var prevTopic = t > 0 ? topics[t - 1] : null;
    var nextTopic = t < topics.length - 1 ? topics[t + 1] : null;

    var detailsHtml = topic.details.map(function(d) {
      return '      <li>' + escapeHtml(d) + '</li>';
    }).join('\n');

    var relatedHtml = '';
    if (topic.relatedTG.length > 0) {
      relatedHtml = '\n    <div class="section-title">Related Telegram Topics</div>\n    <div class="related-topics">\n';
      for (var r = 0; r < topic.relatedTG.length; r++) {
        var tgTopic = topic.relatedTG[r];
        var tgSlug = tgTopic.replace(/[^a-zA-Z\u0400-\u04FF0-9]/g, '_').replace(/_+/g, '_');
        relatedHtml += '      <a href="../../../site/' + tgSlug + '.html">' + escapeHtml(tgTopic) + ' (TG Archive)</a>\n';
      }
      relatedHtml += '    </div>';
    }

    var prevLink = prevTopic
      ? '<a href="' + prevTopic.slug + '.html">&larr; ' + escapeHtml(prevTopic.titleEn) + '</a>'
      : '<span class="disabled">&larr;</span>';
    var nextLink = nextTopic
      ? '<a href="' + nextTopic.slug + '.html">' + escapeHtml(nextTopic.titleEn) + ' &rarr;</a>'
      : '<span class="disabled">&rarr;</span>';

    var html = '<!DOCTYPE html>\n<html lang="ru">\n<head>\n<meta charset="UTF-8">\n'
      + '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
      + '<title>' + escapeHtml(topic.titleEn) + ' - Basic Theory - Эволюция Кода</title>\n'
      + '<style>' + sharedCSS + '</style>\n</head>\n<body>\n'
      + '<div class="header">\n'
      + '  <a href="../../index.html" class="back">&larr; Course</a>\n'
      + '  <h1>Базовая теория</h1>\n'
      + '</div>\n'
      + '<div class="container">\n'
      + '  <div class="breadcrumb"><a href="../../index.html">Course</a> / <a href="../index.html">Basic Theory</a> / <a href="index.html">Level ' + level.num + '</a> / ' + escapeHtml(topic.titleEn) + '</div>\n'
      + '  <span class="level-badge level-' + level.num + '">' + level.emoji + ' Level ' + level.num + ' — ' + escapeHtml(level.titleEn) + '</span>\n'
      + '  <h2>' + escapeHtml(topic.titleEn) + ' <span class="ru">' + escapeHtml(topic.title) + '</span></h2>\n'
      + '  <p class="desc">' + escapeHtml(topic.desc) + '</p>\n\n'
      + '  <div class="section-title">Key Topics Covered</div>\n'
      + '  <ul class="detail-list">\n' + detailsHtml + '\n  </ul>\n'
      + relatedHtml + '\n\n'
      + '  <div class="ext-link">\n'
      + '    <div class="label">Full lesson content (requires Telegram auth):</div>\n'
      + '    <a href="https://learn.evocoders.ai/basic-theory/level-' + level.num + '/' + topic.slug + '/" target="_blank">learn.evocoders.ai/basic-theory/level-' + level.num + '/' + topic.slug + '/</a>\n'
      + '  </div>\n\n'
      + '  <div class="nav-links">\n'
      + '    ' + prevLink + '\n'
      + '    ' + nextLink + '\n'
      + '  </div>\n'
      + '</div>\n'
      + '<div class="footer"><a href="../../index.html">&larr; Back to Course</a> | <a href="../index.html">Basic Theory</a></div>\n'
      + '</body>\n</html>';

    fs.writeFileSync(path.join(baseDir, 'level-' + level.num, topic.slug + '.html'), html);
    totalPages++;
  }

  // Generate level index page
  var topicCardsHtml = topics.map(function(t) {
    return '    <a href="' + t.slug + '.html" class="topic-card"><h3>' + escapeHtml(t.title) + '</h3><div class="en">' + escapeHtml(t.titleEn) + '</div></a>';
  }).join('\n');

  var levelIndexHtml = '<!DOCTYPE html>\n<html lang="ru">\n<head>\n<meta charset="UTF-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
    + '<title>Level ' + level.num + ': ' + escapeHtml(level.titleEn) + ' - Basic Theory - Эволюция Кода</title>\n'
    + '<style>' + sharedCSS + '</style>\n</head>\n<body>\n'
    + '<div class="header">\n'
    + '  <a href="../index.html" class="back">&larr; Basic Theory</a>\n'
    + '  <h1>' + level.emoji + ' Level ' + level.num + ': ' + escapeHtml(level.titleEn) + '</h1>\n'
    + '</div>\n'
    + '<div class="container">\n'
    + '  <div class="breadcrumb"><a href="../../index.html">Course</a> / <a href="../index.html">Basic Theory</a> / Level ' + level.num + '</div>\n'
    + '  <span class="level-badge level-' + level.num + '">' + level.emoji + ' Level ' + level.num + ' — ' + escapeHtml(level.title) + ' / ' + escapeHtml(level.titleEn) + '</span>\n'
    + '  <h2>Level ' + level.num + ': ' + escapeHtml(level.titleEn) + '</h2>\n'
    + '  <p class="desc">' + escapeHtml(level.desc) + '</p>\n'
    + '  <div class="section-title">' + topics.length + ' Topics</div>\n'
    + '  <div class="topic-grid">\n' + topicCardsHtml + '\n  </div>\n'
    + '</div>\n'
    + '<div class="footer"><a href="../../index.html">&larr; Back to Course</a> | <a href="../index.html">Basic Theory Overview</a></div>\n'
    + '</body>\n</html>';

  fs.writeFileSync(path.join(baseDir, 'level-' + level.num, 'index.html'), levelIndexHtml);
  totalPages++;
}

// Generate main basic-theory index page
var levelCardsHtml = levels.map(function(level) {
  return '  <a href="level-' + level.num + '/index.html" class="topic-card" style="border-left-color:var(--c' + level.num + ')">'
    + '<h3>' + level.emoji + ' Level ' + level.num + ': ' + escapeHtml(level.titleEn) + '</h3>'
    + '<div class="en">' + escapeHtml(level.title) + ' — ' + level.topics.length + ' topics</div></a>';
}).join('\n');

var mainIndexHtml = '<!DOCTYPE html>\n<html lang="ru">\n<head>\n<meta charset="UTF-8">\n'
  + '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
  + '<title>Basic Theory - Эволюция Кода Course</title>\n'
  + '<style>' + sharedCSS + '\n'
  + ':root { --c1:#4ade80; --c2:#60a5fa; --c3:#f59e0b; --c4:#ef4444; --c5:#a855f7; }\n'
  + '</style>\n</head>\n<body>\n'
  + '<div class="header">\n'
  + '  <a href="../index.html" class="back">&larr; Course</a>\n'
  + '  <h1>Курс «Базовая теория»</h1>\n'
  + '</div>\n'
  + '<div class="container">\n'
  + '  <div class="breadcrumb"><a href="../index.html">Course</a> / Basic Theory</div>\n'
  + '  <h2>Basic Theory <span class="ru">Базовая теория</span></h2>\n'
  + '  <p class="desc">5 progressive levels covering everything from what generative AI is to AGI, alignment, and the future of intelligence. Based on learn.evocoders.ai knowledge base.</p>\n'
  + '  <div class="section-title">5 Levels</div>\n'
  + '  <div class="topic-grid">\n' + levelCardsHtml + '\n  </div>\n'
  + '</div>\n'
  + '<div class="footer"><a href="../index.html">&larr; Back to Course</a> | <a href="https://learn.evocoders.ai/basic-theory/" target="_blank">Original KB (requires auth)</a></div>\n'
  + '</body>\n</html>';

fs.writeFileSync(path.join(baseDir, 'index.html'), mainIndexHtml);
totalPages++;

console.log('Generated ' + totalPages + ' pages for Basic Theory course');
console.log('  5 level index pages');
console.log('  ' + levels.reduce(function(s, l) { return s + l.topics.length; }, 0) + ' topic pages');
console.log('  1 main index page');
console.log('\nOutput: ./course/basic-theory/');
