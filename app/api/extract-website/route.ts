import { NextResponse } from "next/server"
import { generateWithOpenAI, generateAudienceSummary, generateKeywords, generateTraitSuggestions } from "@/lib/openai"
import Logger from "@/lib/logger"
import { validateUrl } from "@/lib/url-validation"
import * as cheerio from "cheerio"
import OpenAI from "openai"

// Define interfaces for brand details
interface TargetAudienceDetail {
  demographic: {
    age: string
    occupation: string
    location: string
  }
  interestsValues: string[]
  context: string
  needsPainPoints: string
}

interface BrandDetails {
  name: string
  industry: string
  description: string
  targetAudience: TargetAudienceDetail | string
}

interface ProcessedBrandDetails extends Omit<BrandDetails, 'targetAudience'> {
  targetAudience: string
  _rawTargetAudience?: TargetAudienceDetail
}

const REQUIRED_FIELDS = [
  "name",
  "industry", 
  "description",
  "targetAudience"
] as const

// Function to flatten target audience object into a string
function flattenTargetAudience(audience: TargetAudienceDetail): string {
  const parts = []
  
  // Add demographic info
  if (audience.demographic) {
    const demo = []
    if (audience.demographic.occupation) demo.push(audience.demographic.occupation)
    if (audience.demographic.age) demo.push(`aged ${audience.demographic.age}`)
    if (audience.demographic.location) demo.push(`in ${audience.demographic.location}`)
    if (demo.length) parts.push(demo.join(" "))
  }

  // Add interests and values
  if (audience.interestsValues?.length) {
    parts.push(`interested in ${audience.interestsValues.join(", ")}`)
  }

  // Add context if available
  if (audience.context) {
    parts.push(audience.context)
  }

  return parts.join(" who are ")
}

// Test OpenAI connection inline
async function testOpenAIConnection() {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error("OpenAI API key not found")
    }

    const openai = new OpenAI({ apiKey })
    
    // Simple test call with faster model
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Test" }],
      max_tokens: 5,
    })

    if (!response.choices?.[0]?.message) {
      throw new Error("Invalid OpenAI response")
    }

    return { success: true }
  } catch (error) {
    console.error("OpenAI test failed:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "OpenAI connection failed" 
    }
  }
}

export async function POST(request: Request) {
  Logger.info("Received extract website request")

  try {
    // Parse request body
    const body = await request.json()
    Logger.debug("Request body", { body })

    // Check if we have either URL or description
    if (!body.url && !body.description) {
      Logger.error("Missing URL or description in request")
      return NextResponse.json(
        {
          success: false,
          message: "URL or description is required",
          error: "Missing required field: url or description",
        },
        { status: 400 }
      )
    }

    // If description provided, generate brand details directly from description
    if (body.description && !body.url) {
      Logger.info("Processing description input", { descriptionLength: body.description.length })
      
      const prompt = `Extract and expand brand details from this business description: "${body.description}"

- Brand
  - Input: ${body.description}
  - Task: Create comprehensive brand profile

- Brand Name Requirements (CRITICAL)
  - Create a memorable name that fits the business
  - Must be phonetic and easy to pronounce
  - 1-3 words maximum, ideally 2 words
  - Avoid generic words like "Solutions", "Services", "Group"
  - Avoid overly obvious or literal names
  - Consider phonetics, alliteration, rhythm or distinctive sounds
  - Be creative and distinctive rather than descriptive

- Guidelines
  - Description must be exactly 300-400 characters [50-60 tokens] (STRICT LIMIT)
  - Include what they do, their approach, and what makes them special
  - Use clear, professional language
  - Write in first person plural (use we/our language consistently)
  - Focus on current offerings, not history
  - CRITICAL: Never truncate mid-sentence. If approaching 400 characters, end at the last complete sentence before the limit.
  - CRITICAL: Count characters carefully - descriptions over 400 characters will be rejected.

- Output format
  - Return clean JSON: {"name": "memorable brand name", "industry": "category", "description": "300-400 char description", "targetAudience": "audience details"}`

      try {
        const result = await generateWithOpenAI(prompt, "You are a brand naming expert who specializes in crafting memorable names that fit businesses. You excel at creating phonetic, distinctive names that match each brand's unique personality and industry context.", "json", 800, "gpt-4o")
        
        if (result.success && result.content) {
          const brandDetails = JSON.parse(result.content)
          
          
          // Run audience generation and domain terms extraction in parallel
          // TODO: Consider consolidating into single AI call for 20-25% performance improvement
          // (eliminates network overhead, reduces token usage, better context sharing)
          
          // TEMPORARILY DISABLED: Audience generation for performance testing
          // const [audienceResult, keywordsResult] = await Promise.all([
          //   generateAudienceSummary({ 
          //     name: brandDetails.name, 
          //     description: brandDetails.description 
          //   }).catch(err => ({ success: false, error: err.message })),
          //   
          //   generateKeywords({ 
          //     name: brandDetails.name, 
          //     description: brandDetails.description,
          //     audience: audienceStr 
          //   }).catch(err => ({ success: false, error: err.message }))
          // ])
          
          // Generate audience first for keyword context
          const audienceResult = await generateAudienceSummary({ 
            name: brandDetails.name, 
            brandDetailsDescription: brandDetails.description 
          }).catch(err => ({ success: false, error: err.message }))
          
          // Process audience with error handling
          let audienceStr = ''
          if (audienceResult?.success && audienceResult?.content) {
            audienceStr = audienceResult.content.trim()
          } else {
            // Fallback to original targetAudience from brand details
            try {
              if (typeof brandDetails.targetAudience === 'string') {
                audienceStr = brandDetails.targetAudience
              } else if (brandDetails.targetAudience) {
                audienceStr = flattenTargetAudience(brandDetails.targetAudience)
              }
            } catch {}
          }

          // Generate keywords with audience context
          const keywordsResult = await generateKeywords({ 
            name: brandDetails.name, 
            brandDetailsDescription: brandDetails.description,
            audience: audienceStr || 'general audience'
          }).catch(err => ({ success: false, error: err.message }))
          
          // Process keywords with error handling
          let keywords = ''
          if (keywordsResult?.success && keywordsResult?.content) {
            const parsed = JSON.parse(keywordsResult.content)
            const keywordArray = Array.isArray(parsed.keywords) ? parsed.keywords : []
            keywords = keywordArray.join('\n')
          }

          // Generate trait suggestions
          Logger.info("About to generate trait suggestions...")
          let suggestedTraits: string[] = []
          try {
            Logger.info("Generating trait suggestions for:", { brandName: brandDetails.name, audience: audienceStr })
            const traitsResult = await generateTraitSuggestions({
              name: brandDetails.name,
              brandDetailsDescription: brandDetails.description || brandDetails.brandDetailsDescription,
              audience: audienceStr
            })
            
            Logger.info("Trait suggestions result:", { success: traitsResult.success, content: traitsResult.content })
            
            if (traitsResult.success && traitsResult.content) {
              const parsed = JSON.parse(traitsResult.content)
              suggestedTraits = Array.isArray(parsed) ? parsed : []
              Logger.info("Parsed suggested traits:", suggestedTraits)
            }
          } catch (error) {
            Logger.error("Failed to generate trait suggestions:", error)
          }

          Logger.info("Successfully generated brand details from description")
          
          return NextResponse.json({
            success: true,
            brandName: brandDetails.name,
            brandDetailsDescription: brandDetails.description,
            audience: audienceStr,
            keywords,
            suggestedTraits
          })
        } else {
          throw new Error("Failed to generate brand details")
        }
      } catch (error) {
        Logger.error("Error processing description", error)
        return NextResponse.json({
          success: false,
          message: "Could not process description. Try again or add details manually.",
          error: "Description processing failed"
        }, { status: 500 })
      }
    }

    // Sanitize and validate the URL
    let cleanUrl = body.url.trim().replace(/^['"\s]+|['"\s]+$/g, "")
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = "https://" + cleanUrl
    }
    // Validate again after cleaning
    const urlValidation = validateUrl(cleanUrl)
    if (!urlValidation.isValid) {
      Logger.error("Invalid URL provided after cleaning", new Error(urlValidation.error))
      return NextResponse.json(
        {
          success: false,
          message: "Invalid URL provided. Please check for typos or extra punctuation.",
          error: urlValidation.error,
        },
        { status: 400 }
      )
    }

    // Test OpenAI connection inline
    const testResult = await testOpenAIConnection()
    if (!testResult.success) {
      throw new Error(testResult.error || "API key validation failed")
    }

    // Fetch the website HTML
    let siteResponse, html
    try {
      siteResponse = await fetch(urlValidation.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        }
      })
      html = await siteResponse.text()
    } catch (fetchError: any) {
      Logger.error("Failed to fetch website", fetchError)
      
      // Handle specific network errors
      if (fetchError.code === 'ECONNRESET' || fetchError.message?.includes('ECONNRESET')) {
        return NextResponse.json({
          success: false,
          message: "Connection was interrupted. Try again or add details manually.",
          error: "Connection reset by peer"
        }, { status: 400 })
      }
      
      if (fetchError.message?.includes('timeout')) {
        return NextResponse.json({
          success: false,
          message: "Site didn't respond. Try again or add details manually.",
          error: "Request timeout"
        }, { status: 400 })
      }
      
      // Generic network error
      return NextResponse.json({
        success: false,
        message: "Can't reach this site. Try again later.",
        error: fetchError.message || "Network error"
      }, { status: 400 })
    }
    
    // Debug: Log what we actually got
    Logger.debug("Fetched HTML preview", { 
      url: urlValidation.url,
      htmlPreview: html.slice(0, 500),
      contentLength: html.length 
    })

    // Use cheerio to extract key info from homepage
    const $ = cheerio.load(html)
    const title = $('title').text()
    const metaDesc = $('meta[name="description"]').attr('content') || ''
    const h1 = $('h1').first().text()
    const h2 = $('h2').first().text()
    // Try to get main content (simple: first <main>, fallback: body text)
    let mainContent = $('main').text() || $('body').text()
    mainContent = mainContent.replace(/\s+/g, ' ').trim().slice(0, 2000)

    // Debug: Log extracted content
    Logger.debug("Extracted content", { 
      title, 
      metaDesc, 
      h1, 
      h2, 
      mainContentPreview: mainContent.slice(0, 200) 
    })

    // Find links to About, Company, Team pages
    const subpageLinks: string[] = []
    $('a').each((_: unknown, el: any) => {
      const href = $(el).attr('href') || ''
      if (/about|company|team/i.test(href) && !href.startsWith('#') && !href.startsWith('mailto:')) {
        let url = href
        if (!/^https?:\/\//i.test(url)) {
          url = new URL(url, urlValidation.url).href
        }
        if (!subpageLinks.includes(url)) subpageLinks.push(url)
      }
    })
    // Limit to 1 subpage
    const subpagesToCrawl = subpageLinks.slice(0, 1)
    let subpageText = ''
    
    // Fetch subpages in parallel for better performance
    if (subpagesToCrawl.length > 0) {
      const subpagePromises = subpagesToCrawl.map(async (subUrl) => {
        try {
          const subRes = await fetch(subUrl, { 
            signal: AbortSignal.timeout(3000), // 3 second timeout
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Accept-Encoding': 'gzip, deflate, br',
              'DNT': '1',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1',
            }
          })
          const subHtml = await subRes.text()
          const $sub = cheerio.load(subHtml)
          const subTitle = $sub('title').text()
          const subMeta = $sub('meta[name="description"]').attr('content') || ''
          const subH1 = $sub('h1').first().text()
          const subH2 = $sub('h2').first().text()
          let subMain = $sub('main').text() || $sub('body').text()
          subMain = subMain.replace(/\s+/g, ' ').trim().slice(0, 1500)
          return `\n[Subpage: ${subUrl}]\n${subTitle}\n${subMeta}\n${subH1}\n${subH2}\n${subMain}`
        } catch (e) { 
          console.log(`Failed to fetch subpage ${subUrl}:`, e)
          return '' // Return empty string on error
        }
      })
      
      // Wait for all subpage fetches to complete
      const subpageResults = await Promise.all(subpagePromises)
      subpageText = subpageResults.join('')
    }

    // Combine all extracted text
    let summary = [title, metaDesc, h1, h2, mainContent, subpageText].filter(Boolean).join('\n')
    // Reduce to 7k chars for faster processing while maintaining quality
    summary = summary.slice(0, 7000)

    // Generate prompt for website extraction with improved guidance
    const prompt = `Analyze this website content and extract the brand's core identity.

- Brand
  - Website content provided below
  - Task: Create comprehensive brand profile

- Brand Name Requirements
  - Extract the existing brand name if clearly mentioned
  - If no clear name exists, create a compelling name that fits the business
  - 1-3 words maximum
  - Be creative and descriptive

- Guidelines
  - Description must be exactly 300-400 characters (STRICT LIMIT)
  - Start with brand name followed by what they are/do
  - Include main products/services
  - Specify target audience
  - Mention what makes them unique (if identifiable)
  - Use professional, clear language
  - Write in first person plural (use we/our language consistently)
  - Focus on current offerings, not history
  - CRITICAL: Never truncate mid-sentence. If approaching 400 characters, end at the last complete sentence before the limit.
  - CRITICAL: Count characters carefully - descriptions over 400 characters will be rejected.

- Output format
  - Return clean JSON: {"name": "memorable brand name", "description": "300-400 char description"}
  - Description must be exactly 300-400 characters

Website Content:
${summary}`

    const result = await generateWithOpenAI(
      prompt,
      "You are a brand naming expert who specializes in crafting memorable names that fit businesses. You excel at creating phonetic, distinctive names that match each brand's unique personality and industry context. You also write clear, readable brand summaries using simple language and short sentences.",
      "json", // Use json format for faster processing
      500, // Reduce max tokens since we only need a short paragraph
      "gpt-4o"
    )

    if (!result.success || !result.content) {
      throw new Error(result.error || "Failed to extract brand information")
    }

    // Parse the JSON response
    const parsed = JSON.parse(result.content)
    const brandName = parsed.name || ""
    const brandDetailsDescription = parsed.description || ""
    
    Logger.debug("Generated brand details", { brandName, brandDetailsDescription })

    // Generate audience and keywords in parallel
    // TODO: Consider consolidating into single AI call for 20-25% performance improvement
    // (eliminates network overhead, reduces token usage, better context sharing)
    
    // TEMPORARILY DISABLED: Audience generation for performance testing
    // const [audienceResult, keywordsResult] = await Promise.all([
    //   generateAudienceSummary({ 
    //     name: brandName || 'Brand', 
    //     description: brandDetailsDescription 
    //   }).catch(err => ({ success: false, error: err.message })),
    //   
    //   generateKeywords({
    
    // Generate audience first, then keywords with audience context
    const audienceResult = await generateAudienceSummary({ 
      name: brandName || 'Brand', 
      brandDetailsDescription: brandDetailsDescription 
    }).catch(err => ({ success: false, error: err.message }))

    // Process audience with error handling
    let audience = ''
    if (audienceResult?.success && audienceResult?.content) {
      audience = audienceResult.content.trim()
    }

    // Generate keywords with audience context
    const keywordsResult = await generateKeywords({ 
      name: brandName || 'Brand', 
      brandDetailsDescription: brandDetailsDescription,
      audience: audience || 'general audience'
    }).catch(err => ({ success: false, error: err.message }))

    // Process keywords with error handling
    let keywords = ''
    if (keywordsResult?.success && keywordsResult?.content) {
      const parsed = JSON.parse(keywordsResult.content)
      const keywordArray = Array.isArray(parsed.keywords) ? parsed.keywords : []
      keywords = keywordArray.join('\n')
    }

    // Generate trait suggestions
    Logger.info("About to generate trait suggestions...")
    let suggestedTraits: string[] = []
    try {
      Logger.info("Generating trait suggestions for:", { brandName, audience })
      const traitsResult = await generateTraitSuggestions({
        name: brandName,
        brandDetailsDescription: brandDetailsDescription,
        audience: audience
      })
      
      Logger.info("Trait suggestions result:", { success: traitsResult.success, content: traitsResult.content })
      
      if (traitsResult.success && traitsResult.content) {
        const parsed = JSON.parse(traitsResult.content)
        suggestedTraits = Array.isArray(parsed) ? parsed : []
        Logger.info("Parsed suggested traits:", suggestedTraits)
      }
    } catch (error) {
      Logger.error("Failed to generate trait suggestions:", error)
    }

    Logger.info("Successfully extracted brand information")
    return NextResponse.json({
      success: true,
      brandDetailsDescription,
      brandName,
      audience,
      keywords,
      suggestedTraits
    })
  } catch (error) {
    Logger.error(
      "Error in extract-website API",
      error instanceof Error ? error : new Error("Unknown error")
    )

    return NextResponse.json(
      {
        success: false,
        message: "Failed to extract brand information",
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    )
  }
}
