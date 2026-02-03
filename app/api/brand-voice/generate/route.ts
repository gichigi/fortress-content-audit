// POST /api/brand-voice/generate – extract brand voice from website (stub; agent implemented in lib)
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import {
  VALID_READABILITY,
  VALID_FORMALITY,
  VALID_LOCALE,
  MAX_VOICE_SUMMARY,
  MAX_KEYWORDS,
  MAX_KEYWORD_LENGTH,
  isValidDomain,
} from "@/lib/brand-voice-constants"

function getBearer(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization")
  if (!auth?.toLowerCase().startsWith("bearer ")) return null
  const parts = auth.split(" ")
  if (parts.length !== 2) return null
  return parts[1]
}

function normalizeDomain(domain: string): string {
  return domain
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "")
    .toLowerCase()
    .trim()
}

/**
 * POST /api/brand-voice/generate
 * Body: { domain: string }
 * Extracts lightweight brand voice from site content and saves profile.
 */
export async function POST(request: Request) {
  try {
    const token = getBearer(request)
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }
    const userId = userData.user.id

    const body = await request.json().catch(() => ({}))
    const domain = body?.domain
    if (!domain || typeof domain !== "string" || !domain.trim()) {
      return NextResponse.json({ error: "domain required" }, { status: 400 })
    }

    const normalized = normalizeDomain(domain)
    if (!isValidDomain(normalized)) {
      return NextResponse.json({ error: "Invalid domain format" }, { status: 400 })
    }

    // Extraction will be implemented in brand-voice-agents; for now stub
    const { extractBrandVoiceFromSite } = await import("@/lib/brand-voice-extract")
    const result = await extractBrandVoiceFromSite(normalized)

    // Validate and coerce extracted enum values to valid ones or null
    const validReadability: string | null =
      result.readability_level && VALID_READABILITY.includes(result.readability_level as any)
        ? result.readability_level
        : null

    const validFormality: string | null =
      result.formality && VALID_FORMALITY.includes(result.formality as any)
        ? result.formality
        : null

    const validLocale: string | null =
      result.locale && VALID_LOCALE.includes(result.locale as any)
        ? result.locale
        : null

    // Validate array lengths
    let validFlagKeywords = Array.isArray(result.flag_keywords) ? result.flag_keywords : []
    if (validFlagKeywords.length > MAX_KEYWORDS) {
      validFlagKeywords = validFlagKeywords.slice(0, MAX_KEYWORDS)
    }
    validFlagKeywords = validFlagKeywords.filter(
      (k) => typeof k === "string" && k.length > 0 && k.length <= MAX_KEYWORD_LENGTH && !/[\n\r\t]/.test(k)
    )

    let validIgnoreKeywords = Array.isArray(result.ignore_keywords) ? result.ignore_keywords : []
    if (validIgnoreKeywords.length > MAX_KEYWORDS) {
      validIgnoreKeywords = validIgnoreKeywords.slice(0, MAX_KEYWORDS)
    }
    validIgnoreKeywords = validIgnoreKeywords.filter(
      (k) => typeof k === "string" && k.length > 0 && k.length <= MAX_KEYWORD_LENGTH && !/[\n\r\t]/.test(k)
    )

    // Validate voice summary length
    let validVoiceSummary = result.voice_summary ?? null
    if (validVoiceSummary && validVoiceSummary.length > MAX_VOICE_SUMMARY) {
      validVoiceSummary = validVoiceSummary.substring(0, MAX_VOICE_SUMMARY)
    }

    const row = {
      user_id: userId,
      domain: normalized,
      readability_level: validReadability,
      formality: validFormality,
      locale: validLocale,
      flag_keywords: validFlagKeywords,
      ignore_keywords: validIgnoreKeywords,
      source: "auto",
      voice_summary: validVoiceSummary,
      source_domain: normalized,
      source_pages: result.source_pages ?? null,
      source_summary: result.source_summary ?? null,
      generated_at: new Date().toISOString(),
      flag_ai_writing: false,
      include_longform_full_audit: false,
      updated_at: new Date().toISOString(),
    }

    const { data: upserted, error } = await supabaseAdmin
      .from("brand_voice_profiles")
      .upsert(row, { onConflict: "user_id,domain" })
      .select()
      .single()

    if (error) {
      console.error("[BrandVoice Generate] Save error:", error)
      // PostgreSQL error code 23505 = unique violation
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This domain already has a profile for this user" },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: "Failed to save profile" }, { status: 500 })
    }

    return NextResponse.json(upserted)
  } catch (e) {
    console.error("[BrandVoice Generate] Error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    )
  }
}
