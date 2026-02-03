// POST /api/brand-voice/generate – extract brand voice from website (stub; agent implemented in lib)
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

    // Extraction will be implemented in brand-voice-agents; for now stub
    const { extractBrandVoiceFromSite } = await import("@/lib/brand-voice-extract")
    const result = await extractBrandVoiceFromSite(normalized)

    const row = {
      user_id: userId,
      domain: normalized,
      readability_level: result.readability_level ?? null,
      formality: result.formality ?? null,
      locale: result.locale ?? null,
      flag_keywords: result.flag_keywords ?? [],
      ignore_keywords: result.ignore_keywords ?? [],
      source: "auto",
      voice_summary: result.voice_summary ?? null,
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
