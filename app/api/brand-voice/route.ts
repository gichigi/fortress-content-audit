// Brand voice profile: GET by domain, PUT to save (manual or after generate)
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

function getBearer(req: Request) {
  const a = req.headers.get("authorization") || req.headers.get("Authorization")
  if (!a?.toLowerCase().startsWith("bearer ")) return null
  return a.split(" ")[1]
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

    const { data: profile, error } = await supabaseAdmin
      .from("brand_voice_profiles")
      .select("*")
      .eq("user_id", userId)
      .eq("domain", normalized)
      .maybeSingle()

    if (error) {
      console.error("[BrandVoice GET] Error:", error)
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

    const row: Record<string, unknown> = {
      user_id: userId,
      domain: normalized,
      updated_at: new Date().toISOString(),
    }
    if (enabled !== undefined) row.enabled = Boolean(enabled)
    if (readability_level !== undefined) row.readability_level = readability_level ?? null
    if (formality !== undefined) row.formality = formality ?? null
    if (locale !== undefined) row.locale = locale ?? null
    if (flag_keywords !== undefined) row.flag_keywords = Array.isArray(flag_keywords) ? flag_keywords : []
    if (ignore_keywords !== undefined) row.ignore_keywords = Array.isArray(ignore_keywords) ? ignore_keywords : []
    if (source !== undefined) row.source = source ?? "manual"
    if (voice_summary !== undefined) row.voice_summary = voice_summary ?? null
    if (flag_ai_writing !== undefined) row.flag_ai_writing = Boolean(flag_ai_writing)
    if (include_longform_full_audit !== undefined) row.include_longform_full_audit = Boolean(include_longform_full_audit)
    if (source_domain !== undefined) row.source_domain = source_domain ?? null
    if (source_pages !== undefined) row.source_pages = source_pages ?? null
    if (source_summary !== undefined) row.source_summary = source_summary ?? null
    if (generated_at !== undefined) row.generated_at = generated_at ?? null

    const { data: upserted, error } = await supabaseAdmin
      .from("brand_voice_profiles")
      .upsert(row, { onConflict: "user_id,domain" })
      .select()
      .single()

    if (error) {
      console.error("[BrandVoice PUT] Error:", error)
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
