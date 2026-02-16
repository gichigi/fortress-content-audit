/**
 * Quick test to verify LangSmith integration is working
 * Run with: pnpm exec tsx test-langsmith-integration.ts
 */

import { config } from "dotenv"
import { traceable } from "langsmith/traceable"
import { createTracedOpenAIClient } from "./lib/langsmith-openai"

// Load environment variables from .env.local
config({ path: ".env.local" })

// Simple test function wrapped with traceable
const testLangSmithIntegration = traceable(
  async () => {
    console.log("\n🧪 Testing LangSmith Integration...\n")

    const openai = createTracedOpenAIClient()

    console.log("📤 Making test API call to OpenAI...")
    const startTime = Date.now()

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that responds concisely."
        },
        {
          role: "user",
          content: "Say 'LangSmith integration test successful!' and nothing else."
        }
      ],
      max_tokens: 50
    })

    const duration = Date.now() - startTime
    const result = response.choices[0].message.content

    console.log("\n✅ API Response:", result)
    console.log(`⏱️  Duration: ${duration}ms`)
    console.log(`🎯 Model: ${response.model}`)
    console.log(`📊 Token Usage:`)
    console.log(`   - Prompt tokens: ${response.usage?.prompt_tokens}`)
    console.log(`   - Completion tokens: ${response.usage?.completion_tokens}`)
    console.log(`   - Total tokens: ${response.usage?.total_tokens}`)

    console.log("\n🔍 Check LangSmith Dashboard:")
    console.log("   https://smith.langchain.com")
    console.log("   Project: aicontentaudit")
    console.log("   Look for trace: 'LangSmith Integration Test'\n")

    return result
  },
  {
    name: "LangSmith Integration Test",
    metadata: {
      test_type: "integration",
      environment: "development"
    }
  }
)

// Run the test
testLangSmithIntegration()
  .then(() => {
    console.log("✨ Test completed successfully!")
    console.log("If LANGSMITH_TRACING=true, you should see this trace in your dashboard.\n")
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ Test failed:", error)
    process.exit(1)
  })
