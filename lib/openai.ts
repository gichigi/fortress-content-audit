import { OpenAI } from "openai"
import Logger from "./logger"
import { TRAITS, type MixedTrait, type TraitName, isPredefinedTrait, isCustomTrait } from "./traits"

interface GenerationResult {
  success: boolean
  content?: string
  error?: string
}

type ResponseFormat = "json" | "markdown"

async function validateJsonResponse(text: string): Promise<{ isValid: boolean; content?: any; error?: string }> {
  // No validation - just pass through the raw JSON
  return {
    isValid: true,
    content: text
  }
}

async function validateMarkdownResponse(text: string): Promise<{ isValid: boolean; content?: string; error?: string }> {
  try {
    // Basic validation - ensure text is not empty and contains valid UTF-8
    if (!text || text.trim().length === 0) {
      return {
        isValid: false,
        error: "Empty or whitespace-only response"
      }
    }
    
    // Normalize Unicode characters to ensure consistent encoding
    const normalized = text.normalize('NFC')
    
    return {
      isValid: true,
      content: normalized
    }
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : "Invalid text format"
    }
  }
}

async function cleanResponse(text: string, format: ResponseFormat): Promise<string> {
  // Remove any markdown code block syntax if it exists
  text = text.replace(/```(json|markdown)\n?/g, "").replace(/```\n?/g, "")
  
  // Remove any leading/trailing whitespace
  text = text.trim()

  // For JSON responses, try to extract JSON if wrapped in markdown
  if (format === "json") {
    // Try to parse and re-stringify to clean up any trailing text
    try {
      // Find the start of JSON (either [ or {)
      const jsonStart = Math.min(
        text.indexOf('[') >= 0 ? text.indexOf('[') : Infinity,
        text.indexOf('{') >= 0 ? text.indexOf('{') : Infinity
      )
      
      if (jsonStart < Infinity) {
        // Try to parse from this point
        let jsonText = text.substring(jsonStart)
        
        // Try to find valid JSON by attempting to parse progressively smaller substrings
        let foundValid = false
        for (let i = jsonText.length; i > 0; i--) {
          try {
            const candidate = jsonText.substring(0, i)
            const parsed = JSON.parse(candidate)
            // If parse succeeds, re-stringify to clean format
            const cleaned = JSON.stringify(parsed)
            text = cleaned
            foundValid = true
            break
          } catch (e) {
            // Continue trying shorter substrings
          }
        }
        
        // If we couldn't find valid JSON, fall back to original text
        if (!foundValid) {
          text = jsonText
        }
      }
    } catch (e) {
      // If all else fails, try the old regex approach
      const arrayMatch = text.match(/\[[\s\S]*\]/)
      const objectMatch = text.match(/\{[\s\S]*\}/)
      
      if (arrayMatch) {
        text = arrayMatch[0]
      } else if (objectMatch) {
        text = objectMatch[0]
      }
    }
  }
  
  return text
}

export async function generateWithOpenAI(
  prompt: string, 
  systemPrompt: string,
  responseFormat: ResponseFormat = "json",
  max_tokens: number = 2000,
  model: string = "gpt-4o-mini" // Default to faster model
): Promise<GenerationResult> {
  const maxAttempts = 3
  Logger.info("Starting OpenAI generation", { prompt: prompt.substring(0, 100) + "...", format: responseFormat, model })
  Logger.debug("Full prompt", { prompt })

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      Logger.debug(`OpenAI attempt ${attempt}/${maxAttempts}`)
      
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const response = await openai.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        temperature: 0.4,
        max_tokens: max_tokens
      })

      const rawResponse = response.choices[0]?.message?.content
      if (!rawResponse) {
        throw new Error("Empty response from OpenAI")
      }

      Logger.debug("Raw OpenAI response", { response: rawResponse })

      // Log token usage information
      if (response.usage) {
        console.log("=".repeat(50))
        console.log("🔢 TOKEN USAGE SUMMARY")
        console.log("=".repeat(50))
        console.log(`Model: ${response.model}`)
        console.log(`Prompt tokens: ${response.usage.prompt_tokens}`)
        console.log(`Completion tokens: ${response.usage.completion_tokens}`) 
        console.log(`Total tokens: ${response.usage.total_tokens}`)
        console.log(`Max tokens requested: ${max_tokens}`)
        console.log("=".repeat(50))
      }

      // Clean the response based on expected format
      const cleanedResponse = await cleanResponse(rawResponse, responseFormat)
      Logger.debug("Cleaned response", { response: cleanedResponse })

      // Skip validation - just return the cleaned response
      Logger.info("OpenAI generation successful", { length: cleanedResponse.length, format: responseFormat })
      return {
        success: true,
        content: cleanedResponse
      }

    } catch (error) {
      if (attempt === maxAttempts) {
        Logger.error(
          "OpenAI generation failed",
          error instanceof Error ? error : new Error("Unknown error"),
          { attempt }
        )
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to generate content"
        }
      }
      Logger.warn("OpenAI generation attempt failed, retrying", {
        attempt,
        error: error instanceof Error ? error.message : "Unknown error"
      })
    }
  }

  // This should never be reached due to the error handling above
  return {
    success: false,
    error: "Unexpected error in generation"
  }
}






/* Function to generate style guide rules
export async function generateStyleGuideRules(brandDetails: any, section: string): Promise<GenerationResult> {
  const prompt = `Create style guide rules for ${brandDetails.name}'s ${section} section.
  
Brand Description: ${brandDetails.brandDetailsDescription}
Target Audience: ${brandDetails.audience}

Consider how ${brandDetails.audience} will interact with the content. Rules should help content creators effectively communicate with this audience.

Provide 1 specific rule in this EXACT format:

[rule description]
✅ Right: [clear example that follows the rule]
❌ Wrong: [example that breaks the rule]

Each rule must:
1. Start with the rule name
2. Include a Right example with '✅ Right:'
3. Include a Wrong example with '❌ Wrong:'
4. Use markdown formatting for emphasis
5. Be specific and actionable

Provide exactly ONE rule for each section, not a list. Do NOT include more than one rule. Only output one rule block in the format below.

Example format:

Use active voice
✅ The team completed the project on time
❌ The project was completed by the team

Use British English spelling
✅ Colour
❌ Color`

  return generateWithOpenAI(prompt, "You are an expert content strategist who creates clear, actionable style guide rules.", "markdown")
}*/

// Function to generate the entire core style guide in one go
export async function generateFullCoreStyleGuide(brandDetails: any, traitsContext?: string): Promise<GenerationResult> {
  console.log('[generateFullCoreStyleGuide] Generating core style guide for:', brandDetails?.name)
  
  try {
    const rulesSchema = await import('./rules-schema')
    const { getAllowedCategoriesPromptText } = rulesSchema
    
    const traitsSection = traitsContext ? `\nTraits Context:\n${traitsContext}\n` : ''

    const allowedCategories = getAllowedCategoriesPromptText()

    const prompt = `Create exactly 25 writing style rules in markdown format for this brand. Rules are designed to support brand voice traits.

- Brand
  - Name: ${brandDetails.name}
  - Audience: ${brandDetails.audience}
  - Description: ${brandDetails.brandDetailsDescription}
  - Formality: ${brandDetails.formalityLevel || 'Neutral'}
  - Reading Level: ${brandDetails.readingLevel || '10-12'}
  - English Variant: ${brandDetails.englishVariant || 'american'}
  - Keywords: ${Array.isArray(brandDetails.keywords) && brandDetails.keywords.length ? brandDetails.keywords.slice(0, 15).join(', ') : 'None'}

${traitsSection}

- Allowed Categories
${allowedCategories}

OUTPUT FORMAT:
Start directly with ### 1. [Category Name]
One sentence rule (8–12 words)
✅ Good example in brand voice
❌ Bad example in brand voice

REQUIREMENTS:
- Examples must sound like ${brandDetails.name} speaking to ${brandDetails.audience}
- No duplicate categories
- Exactly 25 rules`

    // Generate markdown rules directly
    let attempts = 0
    const maxAttempts = 3

    while (attempts < maxAttempts) {
      attempts++
      
      const result = await generateWithOpenAI(
        prompt,
        "You are a writing style guide expert. Generate clean markdown with exactly 25 numbered rules.",
        "markdown",
        5000,
        "gpt-4o"
      )

      if (!result.success || !result.content) {
        if (attempts === maxAttempts) {
          console.error('[generateFullCoreStyleGuide] Failed after all attempts:', result.error)
          return { success: false, error: result.error || 'Failed to generate core rules after retries' }
        }
        continue
      }

      console.log(`[generateFullCoreStyleGuide] Success! Generated ${result.content.length} chars`)
      return { success: true, content: result.content }
    }

    return { success: false, error: 'Failed to generate rules after all attempts' }
  } catch (error) {
    console.error('[generateFullCoreStyleGuide] Error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}


// Generate keywords for content marketing and brand voice
export async function generateKeywords(params: { name: string; brandDetailsDescription: string; audience?: string }): Promise<GenerationResult> {
  const { name, brandDetailsDescription, audience = 'general audience' } = params
  
  const prompt = `Generate 8-10 high-value keywords for this brand's content marketing and communications.

- Brand
  - Name: ${name}
  - Description: ${brandDetailsDescription}
  - Audience: ${audience}

- Guidelines
  - Focus on terms the audience actually searches for and uses
  - Include product/service names, features, and industry terminology
  - Avoid generic buzzwords like "innovative", "leading", "solution"
  - Each keyword MUST be 20 characters or less (including spaces)
  - Prefer 1-2 words; use 3 words only if under 20 chars
  - Choose terms that would appear in blog posts, marketing copy, and user communications
  
- Output format
  - Return clean JSON: {"keywords": ["keyword1", "keyword2", "keyword3"]}
  - Must contain exactly 8-10 keywords, no more, no less`

  return generateWithOpenAI(
    prompt,
    "You are a keyword expert focused on content marketing terms.",
    "json",
    400,
    "gpt-4o-mini"
  )
}

// Advanced rules (JSON) - select best 25 technical writing rules to support the voice
export async function generateAdvancedRulesJSON(params: { name: string; audience?: string; traits?: string[]; language_tag?: string; count?: number }): Promise<GenerationResult> {
  const { name, audience = 'general audience', traits = [], language_tag = 'en-US', count = 25 } = params
  const prompt = `Create exactly ${count} technical writing rules that best support ${name}'s brand voice${traits.length ? ` (traits: ${traits.join(', ')})` : ''}.

Requirements:
- Write recommendations and examples in ${language_tag}.
- Return STRICT JSON: [{"title":"string","description":"8-16 words","examples":{"good":"string","bad":"string"}}]
- Make each rule specific, actionable, and unique (no duplicates).
- The "good"/"bad" examples must sound like ${name} speaking to ${audience}.
- Keep descriptions short (8–16 words), referencing traits in ~60% when helpful.`

  return generateWithOpenAI(
    prompt,
    "You are a web style guide expert. Return strict JSON only.",
    "json",
    4000,
    "gpt-4o"
  )
}

// Typography suggestions (JSON)
export async function generateTypographySuggestions(params: { name: string; audience?: string; traits?: string[]; language_tag?: string; count?: number }): Promise<GenerationResult> {
  const { name, audience = 'general audience', traits = [], language_tag = 'en-US', count = 5 } = params
  const prompt = `Suggest ${count} typography directions aligned with ${name}'s brand voice${traits.length ? ` (traits: ${traits.join(', ')})` : ''}.

Return STRICT JSON array of:
[{
  "theme": "e.g., Modern Humanist",
  "font_categories": ["Sans Serif","Serif"],
  "example_fonts": ["Inter","Source Serif 4"],
  "weights": "e.g., 400–700",
  "spacing": "e.g., roomy line-height (1.5–1.7) and letter-spacing +1%",
  "use_cases": ["Headings","Body","UI"],
  "rationale": "1–2 sentences in ${language_tag}"
}]`

  return generateWithOpenAI(
    prompt,
    "You are a brand typographer. Return strict JSON only.",
    "json",
    1200,
    "gpt-4o"
  )
}





// Generate a short internal audience description (1–2 sentences, ~25–40 words)
export async function generateAudienceSummary(params: { name: string; brandDetailsDescription: string }): Promise<GenerationResult> {
  const { name, brandDetailsDescription } = params
  const prompt = `Based on the brand below, write a concise audience description (1–2 sentences, ~25–40 words). Keep it practical and specific. Output plain text only.

Brand Name: ${name}
What they do: ${brandDetailsDescription}`

  return generateWithOpenAI(
    prompt,
    "You are a brand strategist who writes precise, practical audience descriptions.",
    "markdown",
    200,
    "gpt-4o-mini"
  )
}

// Function to generate a concise brand summary from a single textarea
export async function generateBrandSummary(brandDetails: any): Promise<GenerationResult> {
  const prompt = `Write a single paragraph (30–40 words) that starts with the brand name and summarizes the brand using all key info, keywords, and terms from the input below.\n\nBrand Info:\n${brandDetails.brandDetailsText}`;
  return generateWithOpenAI(prompt, "You are a brand strategist.", "markdown");
}

// Function to extract just the brand name from brandDetailsText
export async function extractBrandName(brandDetails: any): Promise<GenerationResult> {
  const prompt = `Extract only the brand name from the text below. Return just the brand name, nothing else.\n\nBrand Info:\n${brandDetails.brandDetailsText}`;
  return generateWithOpenAI(prompt, "You are a brand analyst. Extract only the brand name from the given text.", "markdown");
}

// Generate trait suggestions based on brand information
export async function generateTraitSuggestions(brandDetails: any): Promise<GenerationResult> {
  const prompt = `Based on this brand information, suggest exactly 3 brand voice traits that would work best for this brand.

Brand Name: ${brandDetails.name || 'Brand'}
Description: ${brandDetails.brandDetailsDescription || brandDetails.brandDetailsText}
Audience: ${brandDetails.audience || brandDetails.targetAudience}

Available traits: Assertive, Witty, Direct, Inspiring, Warm, Inclusive, Playful, Supportive, Refined

Return ONLY a JSON array with exactly 3 trait names, like this:
["Warm", "Professional", "Inspiring"]`

  return generateWithOpenAI(
    prompt,
    "You are a brand voice expert. Choose the 3 most fitting traits for this brand.",
    "json",
    100,
    "gpt-4o"
  )
}
