// fortress v1
import { NextResponse } from "next/server"
import { generateWithOpenAI } from "@/lib/openai"
import { auditSinglePage } from "@/lib/audit"
import { validateUrl } from "@/lib/url-validation"
import PostHogClient from "@/lib/posthog"
import { detectLocaleFromUrl } from "@/lib/locale-detection"

export async function POST(request: Request) {
  const startTime = Date.now()
  try {
    const { domain, brandText } = await request.json()

    if (!domain && !brandText) {
      return NextResponse.json(
        { error: "Domain or brand text is required" },
        { status: 400 }
      )
    }

    let auditResult = null
    let normalizedDomain = null
    let detectedLocale = 'en-US' // Default

    // If domain provided, run audit, normalize, and detect locale
    if (domain) {
      try {
        const validation = validateUrl(domain)
        if (validation.isValid) {
          normalizedDomain = validation.url
          
          // Detect locale from website
          try {
            detectedLocale = await detectLocaleFromUrl(normalizedDomain)
          } catch (error) {
            console.error("Locale detection failed:", error)
            // Continue with default
          }
          
          // Run audit
          auditResult = await auditSinglePage(normalizedDomain)
        } else {
          console.error("URL validation failed:", validation.error)
        }
      } catch (error) {
        console.error("Audit failed:", error)
        // Continue without audit if it fails
      }
    }

    // Generate brand details from domain or text
    const prompt = domain
      ? `Analyze this website: ${normalizedDomain || domain}

Extract and return JSON only:
{
  "name": "Brand name",
  "description": "1-2 sentence description of what they do",
  "audiences": ["Audience 1", "Audience 2"],
  "products": ["Product/Service 1", "Product/Service 2"],
  "values": ["Value 1", "Value 2", "Value 3"]
}`
      : `Based on this brand information, extract details:

${brandText}

Return JSON only:
{
  "name": "Brand name",
  "description": "1-2 sentence description of what they do",
  "audiences": ["Audience 1", "Audience 2"],
  "products": ["Product/Service 1", "Product/Service 2"],
  "values": ["Value 1", "Value 2", "Value 3"]
}`

    const result = await generateWithOpenAI(
      prompt,
      "You are a brand analyst. Extract brand details accurately. Return strict JSON only.",
      "json",
      1500,
      "gpt-4o"
    )

    if (!result.success || !result.content) {
      return NextResponse.json(
        { error: result.error || "Failed to analyze brand" },
        { status: 500 }
      )
    }

    let brandData
    try {
      brandData = JSON.parse(result.content)
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid JSON response from AI" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      brand: {
        name: brandData.name || "",
        description: brandData.description || "",
        audiences: Array.isArray(brandData.audiences) ? brandData.audiences : [],
        products: Array.isArray(brandData.products) ? brandData.products : [],
        values: Array.isArray(brandData.values) ? brandData.values : [],
      },
      audit: auditResult
        ? {
            groups: auditResult.groups || [],
          }
        : null,
      locale: detectedLocale,
    })
  } catch (error) {
    const duration = Date.now() - startTime
    const err = error instanceof Error ? error : new Error('Unknown error')
    console.error("Error analyzing brand:", err)
    try {
      const posthog = PostHogClient()
      posthog.capture({
        distinctId: 'server',
        event: 'error_occurred',
        properties: {
          type: 'llm',
          message: err.message,
          endpoint: '/api/analyze-brand',
          duration_ms: duration,
        }
      })
      posthog.shutdown()
    } catch {}
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

