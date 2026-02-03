// Brand voice profile: GET by domain, PUT to save (manual or after generate)
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
 * GET /api/brand-voice?domain=example.com
 * Returns brand voice profile for the authenticated user and domain.
 */
export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const domain = searchParams.get("domain")
    if (!domain?.trim()) {
      return NextResponse.json({ error: "domain query required" }, { status: 400 })
    }

    const normalized = normalizeDomain(domain)
    if (!isValidDomain(normalized)) {
      return NextResponse.json({ error: "Invalid domain format" }, { status: 400 })
    }

    const { data: profile, error } = await supabaseAdmin
      .from("brand_voice_profiles")
      .select("*")
      .eq("user_id", userId)
      .eq("domain", normalized)
      .maybeSingle()

    if (error) {
      console.error("[BrandVoice GET] Error:", error)
      // Specific error handling for common cases
      if (error.code === "42P01") {
        // Table doesn't exist (shouldn't happen, but defensive)
        return NextResponse.json({ error: "Database error" }, { status: 500 })
      }
      return NextResponse.json({ error: "Failed to load profile" }, { status: 500 })
    }

    return NextResponse.json(profile ?? null)
  } catch (e) {
    console.error("[BrandVoice GET] Error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/brand-voice
 * Body: domain, readability_level?, formality?, locale?, flag_keywords?, ignore_keywords?, source?, voice_summary?, flag_ai_writing?
 * Upserts brand voice profile for the authenticated user and domain.
 */
export async function PUT(request: Request) {
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
    const {
      domain,
      enabled,
      readability_level,
      formality,
      locale,
      flag_keywords,
      ignore_keywords,
      source,
      voice_summary,
      flag_ai_writing,
      include_longform_full_audit,
      source_domain,
      source_pages,
      source_summary,
      generated_at,
    } = body

    if (!domain || typeof domain !== "string" || !domain.trim()) {
      return NextResponse.json({ error: "domain required" }, { status: 400 })
    }

    const normalized = normalizeDomain(domain)
    if (!isValidDomain(normalized)) {
      return NextResponse.json({ error: "Invalid domain format" }, { status: 400 })
    }

    // Validate enum values
    if (readability_level !== undefined && readability_level !== null) {
      if (!VALID_READABILITY.includes(readability_level)) {
        return NextResponse.json(
          { error: `Invalid readability_level. Must be one of: ${VALID_READABILITY.join(", ")}` },
          { status: 400 }
        )
      }
    }

    if (formality !== undefined && formality !== null) {
      if (!VALID_FORMALITY.includes(formality)) {
        return NextResponse.json(
          { error: `Invalid formality. Must be one of: ${VALID_FORMALITY.join(", ")}` },
          { status: 400 }
        )
      }
    }

    if (locale !== undefined && locale !== null) {
      if (!VALID_LOCALE.includes(locale)) {
        return NextResponse.json(
          { error: `Invalid locale. Must be one of: ${VALID_LOCALE.join(", ")}` },
          { status: 400 }
        )
      }
    }

    // Validate size limits
    if (voice_summary && typeof voice_summary === "string" && voice_summary.length > MAX_VOICE_SUMMARY) {
      return NextResponse.json(
        { error: `voice_summary exceeds maximum length of ${MAX_VOICE_SUMMARY} characters` },
        { status: 400 }
      )
    }

    if (flag_keywords && Array.isArray(flag_keywords)) {
      if (flag_keywords.length > MAX_KEYWORDS) {
        return NextResponse.json(
          { error: `flag_keywords exceeds maximum of ${MAX_KEYWORDS} items` },
          { status: 400 }
        )
      }
      if (flag_keywords.some((k) => typeof k === "string" && k.length > MAX_KEYWORD_LENGTH)) {
        return NextResponse.json(
          { error: `flag_keywords item exceeds maximum length of ${MAX_KEYWORD_LENGTH} characters` },
          { status: 400 }
        )
      }
    }

    if (ignore_keywords && Array.isArray(ignore_keywords)) {
      if (ignore_keywords.length > MAX_KEYWORDS) {
        return NextResponse.json(
          { error: `ignore_keywords exceeds maximum of ${MAX_KEYWORDS} items` },
          { status: 400 }
        )
      }
      if (ignore_keywords.some((k) => typeof k === "string" && k.length > MAX_KEYWORD_LENGTH)) {
        return NextResponse.json(
          { error: `ignore_keywords item exceeds maximum length of ${MAX_KEYWORD_LENGTH} characters` },
          { status: 400 }
        )
      }
    }

    const rowData: Record<string, unknown> = {
      user_id: userId,
      domain: normalized,
      updated_at: new Date().toISOString(),
    }
    if (enabled !== undefined) rowData.enabled = Boolean(enabled)
    if (readability_level !== undefined) rowData.readability_level = readability_level ?? null
    if (formality !== undefined) rowData.formality = formality ?? null
    if (locale !== undefined) rowData.locale = locale ?? null
    if (flag_keywords !== undefined) rowData.flag_keywords = Array.isArray(flag_keywords) ? flag_keywords : []
    if (ignore_keywords !== undefined) rowData.ignore_keywords = Array.isArray(ignore_keywords) ? ignore_keywords : []
    if (source !== undefined) rowData.source = source ?? "manual"
    if (voice_summary !== undefined) rowData.voice_summary = voice_summary ?? null
    if (flag_ai_writing !== undefined) rowData.flag_ai_writing = Boolean(flag_ai_writing)
    if (include_longform_full_audit !== undefined) rowData.include_longform_full_audit = Boolean(include_longform_full_audit)
    if (source_domain !== undefined) rowData.source_domain = source_domain ?? null
    if (source_pages !== undefined) rowData.source_pages = source_pages ?? null
    if (source_summary !== undefined) rowData.source_summary = source_summary ?? null
    if (generated_at !== undefined) rowData.generated_at = generated_at ?? null

    const { data: upserted, error } = await supabaseAdmin
      .from("brand_voice_profiles")
      .upsert(rowData as any, { onConflict: "user_id,domain" })
      .select()
      .single()

    if (error) {
      console.error("[BrandVoice PUT] Error:", error)
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
    console.error("[BrandVoice PUT] Error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    )
  }
}
