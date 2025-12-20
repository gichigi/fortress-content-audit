#!/usr/bin/env tsx
/**
 * Test script for content audit API
 * 
 * Usage:
 *   npx tsx scripts/test-audit.ts <domain>
 * 
 * Example:
 *   npx tsx scripts/test-audit.ts vercel.com
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { miniAudit, pollAuditStatus, AuditTier } from '../lib/audit'
import { OpenAI } from 'openai'

interface TestResult {
  status: 'completed' | 'failed' | 'in_progress'
  output_text?: string
  transformation_response?: string
  output_text_length: number
  tokens_used?: {
    input_tokens?: number
    output_tokens?: number
    reasoning_tokens?: number
    total_tokens?: number
  }
  time_taken_ms: number
  tool_calls_used?: number
  urls_audited: string[]
  reasoning_summaries: string[]
  issues_count: number
  pages_scanned: number
  error?: string
}

async function testAudit(domain: string): Promise<TestResult> {
  const startTime = Date.now()
  
  console.log(`\n=== Testing Audit for: ${domain} ===\n`)
  
  try {
    // Start audit
    const initialResult = await miniAudit(domain)
    
    // If in progress, poll until complete
    if (initialResult.status === 'in_progress' && initialResult.responseId) {
      console.log(`[Test] Audit started in background, polling for completion...`)
      console.log(`[Test] Response ID: ${initialResult.responseId}\n`)
      
      let pollCount = 0
      const maxPolls = 120 // 10 minutes max (5s intervals)
      
      while (pollCount < maxPolls) {
        await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
        pollCount++
        
        const pollResult = await pollAuditStatus(initialResult.responseId, 'FREE')
        
        if (pollResult.status === 'completed') {
          const totalTime = Date.now() - startTime
          
          // Get full response to extract usage and tool calls
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
          const fullResponse = await openai.responses.retrieve(initialResult.responseId)
          
          // Extract output text
          const outputText = fullResponse.output_text || ''
          
          // Extract transformation response (if we can get it from the parsed result)
          let transformationResponse: string | undefined
          try {
            if (pollResult.issues) {
              transformationResponse = JSON.stringify(pollResult, null, 2)
            }
          } catch (e) {
            // Ignore
          }
          
          // Count tool calls from output array
          const toolCallsUsed = Array.isArray(fullResponse.output) 
            ? fullResponse.output.filter((item: any) => item.type === 'web_search_call').length
            : 0
          
          return {
            status: 'completed',
            output_text: outputText,
            transformation_response: transformationResponse,
            output_text_length: outputText.length,
            tokens_used: fullResponse.usage ? {
              input_tokens: fullResponse.usage.input_tokens,
              output_tokens: fullResponse.usage.output_tokens,
              reasoning_tokens: (fullResponse.usage as any).output_tokens_details?.reasoning_tokens,
              total_tokens: fullResponse.usage.total_tokens,
            } : undefined,
            time_taken_ms: totalTime,
            tool_calls_used: toolCallsUsed,
            urls_audited: pollResult.auditedUrls || [],
            reasoning_summaries: pollResult.reasoningSummaries || [],
            issues_count: pollResult.issues?.length || 0,
            pages_scanned: pollResult.pagesScanned || 0,
          }
        } else if (pollResult.status === 'failed') {
          return {
            status: 'failed',
            output_text_length: 0,
            time_taken_ms: Date.now() - startTime,
            urls_audited: [],
            reasoning_summaries: [],
            issues_count: 0,
            pages_scanned: 0,
            error: 'Audit failed during polling',
          }
        }
        
        // Log progress
        if (pollCount % 6 === 0) { // Every 30 seconds
          console.log(`[Test] Still polling... (${pollCount * 5}s elapsed)`)
        }
      }
      
      // Timeout
      return {
        status: 'failed',
        output_text_length: 0,
        time_taken_ms: Date.now() - startTime,
        urls_audited: [],
        reasoning_summaries: [],
        issues_count: 0,
        pages_scanned: 0,
        error: 'Polling timeout after 10 minutes',
      }
    }
    
    // If completed immediately (shouldn't happen with background:true, but handle it)
    if (initialResult.status === 'completed') {
      const totalTime = Date.now() - startTime
      
      // Try to get full response if we have responseId
      let usage: any = undefined
      let toolCallsUsed = 0
      let outputText = ''
      
      if (initialResult.responseId) {
        try {
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
          const fullResponse = await openai.responses.retrieve(initialResult.responseId)
          outputText = fullResponse.output_text || ''
          
          // Count tool calls
          toolCallsUsed = Array.isArray(fullResponse.output) 
            ? fullResponse.output.filter((item: any) => item.type === 'web_search_call').length
            : 0
          
          // Extract usage
          if (fullResponse.usage) {
            usage = {
              input_tokens: fullResponse.usage.input_tokens,
              output_tokens: fullResponse.usage.output_tokens,
              reasoning_tokens: (fullResponse.usage as any).output_tokens_details?.reasoning_tokens,
              total_tokens: fullResponse.usage.total_tokens,
            }
          }
        } catch (e) {
          // Fallback to what we have
          outputText = initialResult.issues ? JSON.stringify(initialResult, null, 2) : ''
        }
      } else {
        outputText = initialResult.issues ? JSON.stringify(initialResult, null, 2) : ''
      }
      
      return {
        status: 'completed',
        output_text: outputText,
        transformation_response: initialResult.issues ? JSON.stringify(initialResult, null, 2) : undefined,
        output_text_length: outputText.length,
        tokens_used: usage,
        time_taken_ms: totalTime,
        tool_calls_used: toolCallsUsed,
        urls_audited: initialResult.auditedUrls || [],
        reasoning_summaries: initialResult.reasoningSummaries || [],
        issues_count: initialResult.issues?.length || 0,
        pages_scanned: initialResult.pagesScanned || 0,
      }
    }
    
    // Unexpected status
    return {
      status: 'failed',
      output_text_length: 0,
      time_taken_ms: Date.now() - startTime,
      urls_audited: [],
      reasoning_summaries: [],
      issues_count: 0,
      pages_scanned: 0,
      error: `Unexpected status: ${initialResult.status}`,
    }
    
  } catch (error) {
    return {
      status: 'failed',
      output_text_length: 0,
      time_taken_ms: Date.now() - startTime,
      urls_audited: [],
      reasoning_summaries: [],
      issues_count: 0,
      pages_scanned: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Main execution
async function main() {
  const domain = process.argv[2]
  
  if (!domain) {
    console.error('Usage: npx tsx scripts/test-audit.ts <domain>')
    console.error('Example: npx tsx scripts/test-audit.ts vercel.com')
    process.exit(1)
  }
  
  const result = await testAudit(domain)
  
  // Print results
  console.log('\n=== TEST RESULTS ===\n')
  console.log(`Status: ${result.status}`)
  console.log(`Time taken: ${(result.time_taken_ms / 1000).toFixed(2)}s`)
  console.log(`Output text length: ${result.output_text_length} chars`)
  console.log(`Issues found: ${result.issues_count}`)
  console.log(`Pages scanned: ${result.pages_scanned}`)
  console.log(`URLs audited: ${result.urls_audited.length}`)
  console.log(`Reasoning summaries: ${result.reasoning_summaries.length}`)
  console.log(`Tool calls used: ${result.tool_calls_used || 'N/A'}`)
  
  if (result.tokens_used) {
    console.log(`\nTokens used:`)
    console.log(`  Input: ${result.tokens_used.input_tokens?.toLocaleString() || 'N/A'}`)
    console.log(`  Output: ${result.tokens_used.output_tokens?.toLocaleString() || 'N/A'}`)
    console.log(`  Reasoning: ${result.tokens_used.reasoning_tokens?.toLocaleString() || 'N/A'}`)
    console.log(`  Total: ${result.tokens_used.total_tokens?.toLocaleString() || 'N/A'}`)
  }
  
  if (result.error) {
    console.log(`\nError: ${result.error}`)
  }
  
  if (result.urls_audited.length > 0) {
    console.log(`\nURLs audited:`)
    result.urls_audited.forEach((url, i) => {
      console.log(`  ${i + 1}. ${url}`)
    })
  }
  
  if (result.reasoning_summaries.length > 0) {
    console.log(`\nReasoning summaries (first 3):`)
    result.reasoning_summaries.slice(0, 3).forEach((summary, i) => {
      const preview = summary.substring(0, 150).replace(/\n/g, ' ')
      console.log(`  ${i + 1}. ${preview}...`)
    })
  }
  
  if (result.issues_count > 0 && result.output_text) {
    try {
      const parsed = JSON.parse(result.output_text)
      if (parsed.issues && parsed.issues.length > 0) {
        console.log(`\nFirst 3 issues:`)
        parsed.issues.slice(0, 3).forEach((issue: any, i: number) => {
          console.log(`\n  ${i + 1}. ${issue.title}`)
          console.log(`     Category: ${issue.category || 'N/A'}`)
          console.log(`     Severity: ${issue.severity || 'N/A'}`)
          if (issue.locations && issue.locations.length > 0) {
            console.log(`     URL: ${issue.locations[0].url || 'N/A'}`)
          }
        })
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
  
  // Output JSON for programmatic use
  console.log(`\n=== JSON OUTPUT ===\n`)
  console.log(JSON.stringify(result, null, 2))
}

main().catch(console.error)

