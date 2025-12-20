#!/usr/bin/env tsx
/**
 * Test script to see raw web search output
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { OpenAI } from 'openai'

async function testWebSearch() {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 60000,
  })
  
  const domainHostname = 'notion.com'
  const searchQuery = `site:${domainHostname}`
  
  console.log(`\n=== Testing Web Search for: ${searchQuery} ===\n`)
  
  const params: any = {
    model: "gpt-4o-mini",
    input: `Search the web for: ${searchQuery}

List the top 3 most important page URLs from the search results. Return ONLY the URLs, one per line.`,
    tools: [{
      type: "web_search_preview"
    }],
    max_tool_calls: 3,
    max_output_tokens: 2000,
    include: ["web_search_call.action.sources"], // Request sources to get URLs
  }
  
  console.log('Creating search request...')
  const response = await openai.responses.create(params)
  console.log(`Response ID: ${response.id}`)
  console.log(`Initial status: ${response.status}\n`)
  
  // Poll for completion
  let status = response.status as string
  let finalResponse = response
  let attempts = 0
  const maxAttempts = 60 // 60 seconds max
  
  while ((status === "queued" || status === "in_progress") && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    finalResponse = await openai.responses.retrieve(response.id)
    status = finalResponse.status as string
    attempts++
    if (attempts % 5 === 0) {
      console.log(`  Polling... (${attempts}s, status: ${status})`)
    }
  }
  
  console.log(`\n=== FINAL STATUS: ${status} ===\n`)
  
  if (status === "completed") {
    console.log('=== OUTPUT TEXT ===')
    console.log(finalResponse.output_text || '(empty)')
    
    // Check for web search results in output array
    console.log('\n=== WEB SEARCH CALLS ===')
    if (finalResponse.output && Array.isArray(finalResponse.output)) {
      finalResponse.output.forEach((item: any, idx: number) => {
        if (item.type === 'web_search_call') {
          console.log(`\nSearch Call ${idx + 1}:`)
          console.log(`  Status: ${item.status}`)
          console.log(`  Action: ${JSON.stringify(item.action, null, 2)}`)
          if (item.result) {
            console.log(`  Result: ${JSON.stringify(item.result, null, 2)}`)
          }
          if (item.sources) {
            console.log(`  Sources: ${JSON.stringify(item.sources, null, 2)}`)
          }
        }
      })
    }
    
    console.log('\n=== FULL RESPONSE (JSON) ===')
    console.log(JSON.stringify(finalResponse, null, 2))
  } else {
    console.log('Response did not complete')
    console.log(JSON.stringify(finalResponse, null, 2))
  }
}

testWebSearch().catch(console.error)

