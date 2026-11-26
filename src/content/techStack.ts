/**
 * Tools shown as an icon row in the home About section (owner request, 2026-11-26).
 * `icon` is a Simple Icons slug (simpleicons.org, e.g. "nextdotjs"), or "openai" / "phone" (plain line icons —
 * not in the set). Kept out of the assistant corpus on purpose: the chat assistant still never says which
 * tools or models power the site's own demos.
 */
export interface TechGroup {
  title: string;
  items: { name: string; icon: string }[];
}

export const techStack: TechGroup[] = [
  {
    title: "LLMs & models",
    items: [
      { name: "OpenAI", icon: "openai" },
      { name: "Claude", icon: "claude" },
      { name: "Gemini", icon: "googlegemini" },
      { name: "Llama", icon: "meta" },
      { name: "Mistral", icon: "mistralai" },
      { name: "DeepSeek", icon: "deepseek" },
      { name: "Ollama · local models", icon: "ollama" },
      { name: "Hugging Face", icon: "huggingface" },
      { name: "vLLM", icon: "vllm" },
      { name: "OpenRouter", icon: "openrouter" },
    ],
  },
  {
    title: "Agents & GenAI",
    items: [
      { name: "LangChain", icon: "langchain" },
      { name: "LangGraph", icon: "langgraph" },
      { name: "CrewAI", icon: "crewai" },
      { name: "Haystack", icon: "haystack" },
      { name: "Dify", icon: "dify" },
      { name: "Model Context Protocol", icon: "modelcontextprotocol" },
      { name: "Pydantic", icon: "pydantic" },
      { name: "Weights & Biases", icon: "weightsandbiases" },
      { name: "Gradio", icon: "gradio" },
      { name: "Streamlit", icon: "streamlit" },
    ],
  },
  {
    title: "Vector search & data",
    items: [
      { name: "Qdrant", icon: "qdrant" },
      { name: "Milvus", icon: "milvus" },
      { name: "Elasticsearch", icon: "elasticsearch" },
      { name: "PostgreSQL · pgvector", icon: "postgresql" },
      { name: "Supabase", icon: "supabase" },
      { name: "MongoDB", icon: "mongodb" },
      { name: "Redis", icon: "redis" },
      { name: "DuckDB", icon: "duckdb" },
      { name: "BigQuery", icon: "googlebigquery" },
      { name: "Metabase", icon: "metabase" },
    ],
  },
  {
    title: "Voice AI",
    items: [
      { name: "ElevenLabs", icon: "elevenlabs" },
      { name: "Deepgram", icon: "deepgram" },
      { name: "LiveKit", icon: "livekit" },
      { name: "Vonage", icon: "vonage" },
      { name: "Phone & SIP calls", icon: "phone" },
    ],
  },
  {
    title: "Automation & workflows",
    items: [
      { name: "n8n", icon: "n8n" },
      { name: "Make", icon: "make" },
      { name: "Zapier", icon: "zapier" },
      { name: "UiPath", icon: "uipath" },
      { name: "Apache Airflow", icon: "apacheairflow" },
      { name: "Temporal", icon: "temporal" },
      { name: "Prefect", icon: "prefect" },
      { name: "Celery", icon: "celery" },
      { name: "RabbitMQ", icon: "rabbitmq" },
      { name: "Apache Kafka", icon: "apachekafka" },
      { name: "Selenium", icon: "selenium" },
      { name: "Puppeteer", icon: "puppeteer" },
      { name: "Scrapy", icon: "scrapy" },
    ],
  },
  {
    title: "Apps I connect to",
    items: [
      { name: "WhatsApp Business", icon: "whatsapp" },
      { name: "Telegram", icon: "telegram" },
      { name: "Gmail", icon: "gmail" },
      { name: "Google Calendar", icon: "googlecalendar" },
      { name: "Google Sheets", icon: "googlesheets" },
      { name: "Google Forms", icon: "googleforms" },
      { name: "HubSpot", icon: "hubspot" },
      { name: "Zoho", icon: "zoho" },
      { name: "Odoo", icon: "odoo" },
      { name: "Shopify", icon: "shopify" },
      { name: "Razorpay", icon: "razorpay" },
      { name: "Stripe", icon: "stripe" },
      { name: "QuickBooks", icon: "quickbooks" },
      { name: "Xero", icon: "xero" },
      { name: "Zendesk", icon: "zendesk" },
      { name: "Intercom", icon: "intercom" },
      { name: "Notion", icon: "notion" },
      { name: "Airtable", icon: "airtable" },
      { name: "Calendly", icon: "calendly" },
      { name: "Zoom", icon: "zoom" },
    ],
  },
  {
    title: "Backend & cloud",
    items: [
      { name: "Python", icon: "python" },
      { name: "FastAPI", icon: "fastapi" },
      { name: "Node.js", icon: "nodedotjs" },
      { name: "Next.js", icon: "nextdotjs" },
      { name: "TypeScript", icon: "typescript" },
      { name: "Docker", icon: "docker" },
      { name: "Kubernetes", icon: "kubernetes" },
      { name: "GitHub Actions", icon: "githubactions" },
      { name: "Google Cloud", icon: "googlecloud" },
      { name: "Vercel", icon: "vercel" },
      { name: "Cloudflare", icon: "cloudflare" },
      { name: "Grafana", icon: "grafana" },
      { name: "Sentry", icon: "sentry" },
    ],
  },
  {
    title: "Computer vision & robotics",
    items: [
      { name: "PyTorch", icon: "pytorch" },
      { name: "TensorFlow", icon: "tensorflow" },
      { name: "OpenCV", icon: "opencv" },
      { name: "Ultralytics YOLO", icon: "ultralytics" },
      { name: "ONNX", icon: "onnx" },
      { name: "CUDA · TensorRT", icon: "nvidia" },
      { name: "ROS 2", icon: "ros" },
      { name: "C++", icon: "cplusplus" },
      { name: "GStreamer", icon: "gstreamer" },
      { name: "NumPy", icon: "numpy" },
      { name: "scikit-learn", icon: "scikitlearn" },
      { name: "MLflow", icon: "mlflow" },
      { name: "DVC", icon: "dvc" },
      { name: "Linux", icon: "linux" },
    ],
  },
];
