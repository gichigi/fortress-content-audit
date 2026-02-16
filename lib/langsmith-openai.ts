import { OpenAI } from "openai"
import { wrapOpenAI } from "langsmith/wrappers"

/**
 * Creates an OpenAI client wrapped with LangSmith tracing
 * All API calls made through this client will be automatically traced to LangSmith
 *
 * Environment variables required:
 * - OPENAI_API_KEY: Your OpenAI API key
 * - LANGSMITH_TRACING: Set to "true" to enable tracing
 * - LANGSMITH_API_KEY: Your LangSmith API key
 * - LANGSMITH_PROJECT: Project name for organizing traces (optional, defaults to "default")
 */
export function createTracedOpenAIClient(options?: ConstructorParameters<typeof OpenAI>[0]): OpenAI {
  const apiKey = options?.apiKey || process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error("OpenAI API key is required")
  }

  // Create base OpenAI client with all options
  const client = new OpenAI({
    ...options,
    apiKey,
  })

  // Wrap with LangSmith if tracing is enabled
  if (process.env.LANGSMITH_TRACING === "true" && process.env.LANGSMITH_API_KEY) {
    console.log("🔍 LangSmith tracing enabled")
    return wrapOpenAI(client)
  }

  // Return unwrapped client if tracing is not enabled
  console.log("⚠️  LangSmith tracing disabled (set LANGSMITH_TRACING=true to enable)")
  return client
}

/**
 * Lazy-loaded default traced OpenAI client instance
 * Use this for most operations to ensure consistent tracing
 */
let _defaultClient: OpenAI | null = null
export function getTracedOpenAI(): OpenAI {
  if (!_defaultClient) {
    _defaultClient = createTracedOpenAIClient()
  }
  return _defaultClient
}
