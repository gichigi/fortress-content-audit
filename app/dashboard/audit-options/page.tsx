"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Check } from "lucide-react"

export default function AuditOptionsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const domain = searchParams.get("domain")?.trim() || null

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  const [includeLongform, setIncludeLongform] = useState(false)

  const loadSettings = useCallback(async (token: string) => {
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
      setIncludeLongform(!!data.include_longform_full_audit)
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
      await loadSettings(session.access_token)
      setLoading(false)
    }
    init()
  }, [domain, router, loadSettings])

  const autoSave = useCallback(async (longform: boolean) => {
    if (!authToken || !domain) return
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
          include_longform_full_audit: longform,
          // Preserve other fields
          enabled: currentData.enabled ?? false,
          readability_level: currentData.readability_level ?? null,
          formality: currentData.formality ?? null,
          locale: currentData.locale ?? null,
          flag_keywords: currentData.flag_keywords ?? [],
          ignore_keywords: currentData.ignore_keywords ?? [],
          flag_ai_writing: currentData.flag_ai_writing ?? false,
          source: currentData.source ?? "manual",
          voice_summary: currentData.voice_summary ?? null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast({ title: "Save failed", description: err.error || "Could not save.", variant: "destructive" })
        return
      }
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }, [authToken, domain, toast])

  // Auto-save when includeLongform changes
  useEffect(() => {
    if (loading) return
    if (saveTimeout) clearTimeout(saveTimeout)
    const timeout = setTimeout(() => {
      autoSave(includeLongform)
    }, 500)
    setSaveTimeout(timeout)
    return () => clearTimeout(timeout)
  }, [includeLongform, loading, autoSave])

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
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Audit Options</h1>
        <p className="text-muted-foreground mt-2">{domain}</p>
      </div>

      <div className="space-y-8">
        <div className="flex items-center justify-between rounded-md border border-border p-4">
          <div>
            <Label htmlFor="include_longform" className="cursor-pointer font-medium">
              Include blog/article pages
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              Adds /blog, /articles, etc. to audit scope. Takes longer, audits more pages.
            </p>
          </div>
          <Switch
            id="include_longform"
            checked={includeLongform}
            onCheckedChange={setIncludeLongform}
          />
        </div>

        {saving && (
          <div className="pt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </div>
        )}
        {justSaved && !saving && (
          <div className="pt-4 flex items-center gap-2 text-sm text-green-600">
            <Check className="h-4 w-4" />
            Saved
          </div>
        )}
      </div>
    </div>
  )
}
