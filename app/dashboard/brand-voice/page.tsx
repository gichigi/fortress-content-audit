"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { GuidelinesEditor } from "@/components/guidelines-editor"
import { Loader2, Save, Sparkles } from "lucide-react"
import { MAX_VOICE_SUMMARY } from "@/lib/brand-voice-constants"

interface GuidelinesData {
  enabled: boolean
  voice_summary: string | null
  source: string
  source_summary: string | null
  generated_at: string | null
}

export default function GuidelinesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const domain = searchParams.get("domain")?.trim() || null

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)

  const [enabled, setEnabled] = useState(false)
  const [voiceSummary, setVoiceSummary] = useState("")
  const [sourceSummary, setSourceSummary] = useState<string | null>(null)

  const loadData = useCallback(async (token: string) => {
    if (!domain) return
    const res = await fetch(`/api/brand-voice?domain=${encodeURIComponent(domain)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      if (res.status === 401) router.replace("/auth/sign-in")
      return
    }
    const data = await res.json()
    if (data) {
      setEnabled(data.enabled === true)
      setVoiceSummary(data.voice_summary ?? "")
      setSourceSummary(data.source_summary ?? null)
    }
  }, [domain, router])

  useEffect(() => {
    if (!domain) {
      router.replace("/dashboard")
      return
    }
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        router.replace("/auth/sign-in")
        return
      }
      setAuthToken(session.access_token)
      setLoading(true)
      await loadData(session.access_token)
      setLoading(false)
    }
    init()
  }, [domain, router, loadData])

  const handleSave = async () => {
    if (!authToken || !domain) return

    // Validate voice summary length
    if (voiceSummary.length > MAX_VOICE_SUMMARY) {
      toast({
        title: "Too long",
        description: `Brand voice guidelines cannot exceed ${MAX_VOICE_SUMMARY} characters. Current: ${voiceSummary.length}`,
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      // Get current profile to preserve other fields
      const getRes = await fetch(`/api/brand-voice?domain=${encodeURIComponent(domain)}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      const currentData = getRes.ok ? await getRes.json() : {}

      const res = await fetch("/api/brand-voice", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          domain,
          enabled,
          voice_summary: voiceSummary || null,
          // Preserve other fields
          readability_level: currentData.readability_level ?? null,
          formality: currentData.formality ?? null,
          locale: currentData.locale ?? null,
          flag_keywords: currentData.flag_keywords ?? [],
          ignore_keywords: currentData.ignore_keywords ?? [],
          flag_ai_writing: currentData.flag_ai_writing ?? false,
          include_longform_full_audit: currentData.include_longform_full_audit ?? false,
          source: currentData.source ?? "manual",
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast({ title: "Save failed", description: err.error || "Could not save.", variant: "destructive" })
        return
      }
      toast({ title: "Saved", description: "Brand voice guidelines saved." })
    } finally {
      setSaving(false)
    }
  }

  const handleGenerate = async () => {
    if (!authToken || !domain) return
    setGenerating(true)
    try {
      const res = await fetch("/api/brand-voice/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ domain }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast({ title: "Generate failed", description: err.error || "Could not generate.", variant: "destructive" })
        return
      }
      const data = await res.json()
      setVoiceSummary(data.voice_summary ?? "")
      setSourceSummary(data.source_summary ?? null)
      toast({ title: "Generated", description: "Brand voice extracted from site." })
    } finally {
      setGenerating(false)
    }
  }

  if (!domain) return null
  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl px-6 py-8">
      <div className="mb-8">
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Guidelines</h1>
        <p className="text-muted-foreground mt-2">{domain}</p>
        <p className="text-sm text-muted-foreground mt-1">Define and manage brand voice guidelines</p>
      </div>

      <div className="space-y-8">
        {/* Master Toggle */}
        <section className="rounded-md border border-border p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="guidelines_enabled" className="cursor-pointer font-medium">
                Enable brand voice checks
              </Label>
              <p className="text-sm text-muted-foreground mt-0.5">
                Check content against your brand voice guidelines during audits
              </p>
            </div>
            <Switch id="guidelines_enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </section>

        {/* Guidelines Editor - Shows when enabled */}
        <div
          className="overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out"
          style={{
            maxHeight: enabled ? "3000px" : "0px",
            opacity: enabled ? 1 : 0,
          }}
        >
          <section>
            <h2 className="font-serif text-2xl font-semibold mb-4">Brand Voice Document</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Write or generate guidelines for voice characteristics, tone preferences, do's and don'ts, and example phrases.
            </p>

            {!voiceSummary.trim() && (
              <div className="mb-4 rounded-md border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                No guidelines set. Use "Generate from site" to infer guidelines from your pages, or write your own.
              </div>
            )}

            <GuidelinesEditor
              id="voice_summary"
              value={voiceSummary}
              onChange={setVoiceSummary}
              placeholder="Write your brand voice guidelines here, or use Generate from site to infer them automatically."
            />

            {sourceSummary && (
              <div className="mt-4 rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                <strong>Inferred from site:</strong> {sourceSummary}
              </div>
            )}

            <p className="mt-2 text-sm text-muted-foreground">
              These guidelines will be checked against your content during audits when enabled.
            </p>
          </section>

          <div className="flex flex-wrap gap-2 pt-6">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save
            </Button>
            <Button
              variant="secondary"
              onClick={handleGenerate}
              disabled={generating}
              title="Infer brand voice from your site content (headings, copy)"
            >
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Generate from site
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
