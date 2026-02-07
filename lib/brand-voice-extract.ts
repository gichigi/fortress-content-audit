/**
 * Lightweight brand voice extraction from website content.
 * Used by POST /api/brand-voice/generate.
 */

import { extractElementManifest, type ElementManifest } from "@/lib/manifest-extractor"
import { generateWithOpenAI } from "@/lib/openai"
import Logger from "@/lib/logger"

export interface BrandVoiceExtractResult {
  voice_summary: string | null
  source_summary: string | null
  source_pages: string[] | null
  readability_level: string | null
  formality: string | null
  locale: string | null
  flag_keywords: string[]
  ignore_keywords: string[]
}

function formatContentSampleForVoice(manifests: ElementManifest[]): string {
  if (manifests.length === 0) return "(No content extracted.)"
  let out = ""
  for (const m of manifests) {
    out += `## ${m.page_url}\n`
    out += "Headings: " + m.headings.map((h) => h.text).filter(Boolean).join(" | ") + "\n"
    out += "Link/button text: " + [...m.links.slice(0, 20).map((l) => l.text), ...m.buttons.map((b) => b.text)].filter(Boolean).join(" | ") + "\n"
    // Add description samples for voice understanding
    const descriptions = m.descriptions || []
    if (descriptions.length > 0) {
      out += "Copy samples:\n"
      for (const d of descriptions.slice(0, 4)) {
        out += `- ${d.text}\n`
      }
    }
    out += "\n"
  }
  return out.trim()
}

const SYSTEM_PROMPT = `You infer brand voice from website content samples (headings, link text, button copy).
Return JSON only. No markdown code fences around the JSON.

voice_summary: A single markdown document (full brand voice guidelines). Derive from the actual content—use the vocabulary and themes you see. Structure it as:
- A short summary at the top (1–2 paragraphs: who the brand is, who they speak to, how they should sound).
- A "Traits" or "Core traits" section: 2–4 traits. For each trait give a name, 1–2 sentences on what it means, short bullets for "What it means" and "What it doesn't mean" (or do's/don'ts).
- A "Tone guidelines" or "Do's and don'ts" section: short bullets for how to write (e.g. avoid jargon, use active voice, allow/avoid contractions).
Be specific to this brand so an editor can use the doc. Do NOT default to generic "direct, avoid jargon"—use the themes and vocabulary in the content.
source_summary: Why we inferred this. 2–4 scannable phrases pointing at the content (e.g. "Headings use product names. CTAs are action verbs.").

Other keys: readability_level (grade_6_8 | grade_10_12 | grade_13_plus or null), formality (formal | neutral | casual or null), locale (en-US | en-GB or null), flag_keywords (array of strings, empty if none), ignore_keywords (array of strings, empty if none).`

/**
 * Extract brand voice from site content (homepage + key pages) via manifest and OpenAI.
 */
export async function extractBrandVoiceFromSite(
  domain: string
): Promise<BrandVoiceExtractResult> {
  const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`
  const manifests = await extractElementManifest(baseUrl)
  const sourcePages = manifests.map((m) => m.page_url)
  const contentSample = formatContentSampleForVoice(manifests)

  const userPrompt = `Domain: ${domain}\n\nContent sample from pages:\n\n${contentSample}\n\nInfer a full brand voice guidelines document from the actual headings and copy. voice_summary: one markdown document with (1) short summary (who the brand is, audience, how they sound), (2) 2–4 core traits with "what it means" / "what it doesn't mean" bullets, (3) tone guidelines or do's/don'ts. Be specific to this brand—use the vocabulary and themes in the content. source_summary: 2–4 phrases on why we inferred this. Return JSON with keys: voice_summary, source_summary, readability_level, formality, locale, flag_keywords, ignore_keywords.`

  const result = await generateWithOpenAI(
    userPrompt,
    SYSTEM_PROMPT,
    "json",
    2500,
    "gpt-4o-mini"
  )

  if (!result.success || !result.content) {
    Logger.warn("[BrandVoiceExtract] OpenAI failed, returning stub", { error: result.error })
    return {
      voice_summary: null,
      source_summary: `Could not infer voice from ${domain}. You can set it manually.`,
      source_pages: sourcePages.length ? sourcePages : [baseUrl],
      readability_level: null,
      formality: null,
      locale: null,
      flag_keywords: [],
      ignore_keywords: [],
    }
  }

  try {
    const raw = result.content.replace(/^[^{]*/, "").replace(/[^}]*$/, "")
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      voice_summary: typeof parsed.voice_summary === "string" ? parsed.voice_summary : null,
      source_summary: typeof parsed.source_summary === "string" ? parsed.source_summary : null,
      source_pages: sourcePages.length ? sourcePages : [baseUrl],
      readability_level: typeof parsed.readability_level === "string" ? parsed.readability_level : null,
      formality: typeof parsed.formality === "string" ? parsed.formality : null,
      locale: typeof parsed.locale === "string" ? parsed.locale : null,
      flag_keywords: Array.isArray(parsed.flag_keywords) ? parsed.flag_keywords.filter((x): x is string => typeof x === "string") : [],
      ignore_keywords: Array.isArray(parsed.ignore_keywords) ? parsed.ignore_keywords.filter((x): x is string => typeof x === "string") : [],
    }
  } catch (e) {
    Logger.warn("[BrandVoiceExtract] Parse failed, returning stub", { error: e })
    return {
      voice_summary: null,
      source_summary: `Inference ran but result was invalid. You can set voice manually.`,
      source_pages: sourcePages.length ? sourcePages : [baseUrl],
      readability_level: null,
      formality: null,
      locale: null,
      flag_keywords: [],
      ignore_keywords: [],
    }
  }
}
